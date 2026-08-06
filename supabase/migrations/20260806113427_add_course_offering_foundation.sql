-- A training cohort is the commercial offering/intake for reusable course content.
-- Keep the existing table name for compatibility while establishing the canonical
-- course -> offering relationship used by future checkout and student management.
alter table public.training_cohorts
  add column course_id uuid references public.courses(id) on delete restrict,
  add column contract_policy text not null default 'required',
  add column checkout_version smallint not null default 1;

-- Keep the database default on the proven legacy workflow during the staged
-- rollout. The V2 admin action writes checkout_version = 2 explicitly, so an
-- older application deployment can never create a V2 offering accidentally
-- between the database migration and the application deployment.

alter table public.training_cohorts
  add constraint training_cohorts_contract_policy_check
  check (contract_policy in ('required', 'none')),
  add constraint training_cohorts_checkout_version_check
  check (checkout_version in (1, 2)),
  add constraint training_cohorts_legacy_checkout_shape_check
  check (
    checkout_version = 2
    or (course_id is null and contract_policy = 'required')
  ),
  add constraint training_cohorts_contract_policy_consistency_check
  check (
    contract_policy = 'required'
    or (
      contract_version_id is null
      and contract_assigned_by is null
      and contract_assigned_at is null
    )
  );

create index training_cohorts_course_status_idx
on public.training_cohorts (course_id, status, starts_on)
where course_id is not null;

comment on column public.training_cohorts.course_id is
  'Reusable video course/content granted by this commercial offering. Nullable during the staged migration and for unmapped historical cohorts.';

comment on column public.training_cohorts.contract_policy is
  'Whether this offering requires a signed contract before payment. Values: required, none.';

comment on column public.training_cohorts.checkout_version is
  'Explicit workflow version. Version 1 preserves historical behavior; version 2 is the unified offering checkout.';

create or replace function private.enforce_course_offering_foundation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  course_is_ready boolean;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  -- The current product supports two customer-facing delivery choices. Existing
  -- historical hybrid cohorts remain readable/editable, but new cohorts cannot
  -- introduce another delivery mode without an explicit product decision.
  if tg_op = 'INSERT'
     and new.checkout_version = 2
     and new.delivery_mode not in ('online', 'offline') then
    raise exception 'New course offerings must use online or offline delivery.';
  end if;

  if tg_op = 'UPDATE' then
    if new.checkout_version is distinct from old.checkout_version then
      raise exception 'The course offering checkout version is immutable.';
    end if;

    if (
      new.course_id is distinct from old.course_id
      or new.contract_policy is distinct from old.contract_policy
      or new.delivery_mode is distinct from old.delivery_mode
    ) and old.status <> 'draft' then
      raise exception 'Course, delivery mode, and contract policy can only be changed while the offering is a draft.';
    end if;

    if new.checkout_version = 2
       and new.delivery_mode is distinct from old.delivery_mode
       and new.delivery_mode not in ('online', 'offline') then
      raise exception 'Course offerings must use online or offline delivery.';
    end if;
  end if;

  if new.contract_policy = 'none' and new.contract_version_id is not null then
    raise exception 'A no-contract offering cannot have a contract version assigned.';
  end if;

  if new.checkout_version = 2
     and new.status = 'open'
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    if new.course_id is null then
      raise exception 'A reusable course must be linked before opening enrollment.';
    end if;

    -- Acquire the parent lock in its own statement. Under READ COMMITTED the
    -- following statement then gets a fresh snapshot after any concurrent
    -- readiness-reducing content mutation has committed.
    perform 1
    from public.courses as course
    where course.id = new.course_id
    for update;

    select course.published = true
           and exists (
             select 1
             from public.lessons as lesson
             join public.lesson_videos as video on video.lesson_id = lesson.id
             where lesson.course_id = course.id
               and video.playback_status = 'ready'
           )
    into course_is_ready
    from public.courses as course
    where course.id = new.course_id;

    if coalesce(course_is_ready, false) is false then
      raise exception 'The linked course must be published and contain at least one ready video lesson.';
    end if;

    if new.contract_policy = 'required' and new.contract_version_id is null then
      raise exception 'A published contract version is required for this offering.';
    end if;

    -- Version 2 is prepared here but does not open until its complete public
    -- application, payment, approval and content-grant transaction ships.
    raise exception 'Unified course offering checkout is not enabled for public enrollment yet.';
  end if;

  return new;
end;
$$;

-- Trigger functions are invoked by PostgreSQL, not through the Data API.
-- Remove the default PUBLIC execute privilege so this validation surface is
-- not callable outside the trigger path.
revoke all on function private.enforce_course_offering_foundation() from public, anon, authenticated;

-- Once customers can commit to an offering, its linked course must not lose
-- the minimum content needed for access. The BEFORE phase serializes content
-- edits with enrollment opening by locking the course row; the AFTER phase
-- validates the final state and rolls the mutation back if it broke readiness.
create or replace function private.protect_active_offering_course_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_course_id uuid;
  course_is_ready boolean;
begin
  if tg_table_name = 'courses' then
    target_course_id := old.id;
  elsif tg_table_name = 'lessons' then
    target_course_id := old.course_id;
  elsif tg_table_name = 'lesson_videos' then
    select lesson.course_id
    into target_course_id
    from public.lessons as lesson
    where lesson.id = old.lesson_id;
  end if;

  -- A cascading lesson delete can make its child video's parent temporarily
  -- unavailable here. The lesson trigger owns the readiness check in that case.
  if target_course_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_when = 'BEFORE' then
    perform 1
    from public.courses as course
    where course.id = target_course_id
    for update;

    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if exists (
    select 1
    from public.training_cohorts as cohort
    where cohort.course_id = target_course_id
      and cohort.status in ('open', 'closed', 'in_progress', 'completed')
  ) then
    select course.published = true
           and exists (
             select 1
             from public.lessons as lesson
             join public.lesson_videos as video on video.lesson_id = lesson.id
             where lesson.course_id = course.id
               and video.playback_status = 'ready'
           )
    into course_is_ready
    from public.courses as course
    where course.id = target_course_id;

    if coalesce(course_is_ready, false) is false then
      raise exception using
        errcode = '23514',
        constraint = 'active_offering_course_readiness',
        message = 'A course linked to a customer-committed offering must remain published with at least one ready video lesson.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.protect_active_offering_course_readiness() from public, anon, authenticated;

drop trigger if exists a0_training_cohorts_offering_foundation on public.training_cohorts;
create trigger a0_training_cohorts_offering_foundation
before insert or update or delete on public.training_cohorts
for each row execute function private.enforce_course_offering_foundation();

create trigger a0_courses_lock_active_offering_readiness
before update of published on public.courses
for each row
when (old.published is distinct from new.published)
execute function private.protect_active_offering_course_readiness();

create trigger z0_courses_check_active_offering_readiness
after update of published on public.courses
for each row
when (old.published is distinct from new.published)
execute function private.protect_active_offering_course_readiness();

create trigger a0_lessons_lock_active_offering_readiness
before delete or update of course_id on public.lessons
for each row execute function private.protect_active_offering_course_readiness();

create trigger z0_lessons_check_active_offering_readiness
after delete or update of course_id on public.lessons
for each row execute function private.protect_active_offering_course_readiness();

create trigger a0_lesson_videos_lock_active_offering_readiness
before delete or update of lesson_id, provider, video_url, provider_video_id, playback_status
on public.lesson_videos
for each row execute function private.protect_active_offering_course_readiness();

create trigger z0_lesson_videos_check_active_offering_readiness
after delete or update of lesson_id, provider, video_url, provider_video_id, playback_status
on public.lesson_videos
for each row execute function private.protect_active_offering_course_readiness();
