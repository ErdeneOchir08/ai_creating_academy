-- Phase 3: explicitly activate the version-2 course-offering checkout.
--
-- Apply this migration only after the V2 application release is deployed and
-- its checkout, payment review, notification and effective-access paths have
-- passed production smoke testing. The preceding foundation migration keeps
-- V2 offerings blocked from transitioning to `open` until this file is applied.

create or replace function private.enforce_course_offering_foundation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  course_is_ready boolean;
  contract_is_assignable boolean;
  program_is_active boolean;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  -- V2 intentionally exposes only the two customer-facing delivery choices.
  -- Historical hybrid V1 cohorts remain compatible.
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
      or new.contract_version_id is distinct from old.contract_version_id
      or new.delivery_mode is distinct from old.delivery_mode
    ) and old.status <> 'draft' then
      raise exception 'Course, delivery mode, contract policy, and contract version can only be changed while the offering is a draft.';
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

  -- Validate every write that leaves a V2 offering open. This prevents a later
  -- edit from weakening the payment or delivery prerequisites after activation.
  if new.checkout_version = 2 and new.status = 'open' then
    select not program.is_archived
    into program_is_active
    from public.training_programs program
    where program.id = new.program_id;

    if coalesce(program_is_active, false) is false then
      raise exception 'Registration cannot remain open for an archived program.';
    end if;

    if new.delivery_mode not in ('online', 'offline') then
      raise exception 'Course offerings must use online or offline delivery.';
    end if;

    if new.course_id is null then
      raise exception 'A reusable course must be linked before opening enrollment.';
    end if;

    if new.tuition_amount_mnt is null or new.tuition_amount_mnt <= 0 then
      raise exception 'A positive tuition amount is required before opening enrollment.';
    end if;

    if new.payment_due_days is null or new.payment_due_days <= 0 then
      raise exception 'A positive payment deadline is required before opening enrollment.';
    end if;

    -- Serialize the opening decision with readiness-reducing course edits.
    perform 1
    from public.courses course
    where course.id = new.course_id
    for update;

    select course.published = true
           and exists (
             select 1
             from public.lessons lesson
             join public.lesson_videos video on video.lesson_id = lesson.id
             where lesson.course_id = course.id
               and video.playback_status = 'ready'
           )
    into course_is_ready
    from public.courses course
    where course.id = new.course_id;

    if coalesce(course_is_ready, false) is false then
      raise exception 'The linked course must be published and contain at least one ready video lesson.';
    end if;

    if new.contract_policy = 'required' then
      if new.contract_version_id is null then
        raise exception 'A published contract version is required for this offering.';
      end if;

      select version.status = 'published' and not template.is_archived
      into contract_is_assignable
      from public.contract_template_versions version
      join public.contract_templates template on template.id = version.template_id
      where version.id = new.contract_version_id;

      if coalesce(contract_is_assignable, false) is false then
        raise exception 'The assigned contract must be published and belong to an active template.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Trigger functions are not part of the Data API surface.
revoke all on function private.enforce_course_offering_foundation()
from public, anon, authenticated;

-- Opening the first V2 offering is the one-way checkout cutover for its course.
-- The foundation BEFORE trigger has already locked and validated the course;
-- this AFTER trigger records ownership inside the same transaction. A draft V2
-- offering therefore has no routing effect, while a successful open can never
-- be undone merely by closing or archiving offerings later.
create or replace function private.claim_v2_course_checkout_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  ownership_version smallint;
begin
  if new.checkout_version <> 2 or new.status <> 'open' then
    return new;
  end if;

  if current_user_id is null
     or coalesce((select private.is_admin()), false) is false then
    raise exception 'Only an authenticated administrator can open a V2 course offering.';
  end if;

  insert into public.course_checkout_ownerships (
    course_id,
    claimed_checkout_version,
    claimed_by_offering_id,
    claimed_by_user_id,
    claimed_at
  )
  values (
    new.course_id,
    new.checkout_version,
    new.id,
    current_user_id,
    now()
  )
  on conflict (course_id) do nothing;

  select ownership.claimed_checkout_version
  into ownership_version
  from public.course_checkout_ownerships ownership
  where ownership.course_id = new.course_id;

  if ownership_version is null or ownership_version < 2 then
    raise exception 'The course offering checkout ownership could not be established.';
  end if;

  return new;
end;
$$;

revoke all on function private.claim_v2_course_checkout_ownership()
from public, anon, authenticated;

create trigger z1_training_cohorts_claim_v2_checkout
after insert or update on public.training_cohorts
for each row execute function private.claim_v2_course_checkout_ownership();
