alter table public.courses
add column archived_at timestamptz;

create index courses_public_catalog_idx
on public.courses (created_at desc)
where published = true and archived_at is null;

create or replace function public.set_course_archived(
  p_course_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  perform 1
  from public.courses course
  where course.id = p_course_id
  for update;

  if not found then
    raise exception 'Course not found.';
  end if;

  if p_archived then
    -- Stop every new V2 checkout before hiding the reusable content package.
    -- Existing applications, enrollments, entitlements, payments and contract
    -- snapshots remain untouched and continue to be available to their owners.
    update public.training_cohorts
    set status = 'closed'
    where (
        course_id = p_course_id
        or course_id in (
          select relation.source_course_id
          from public.course_bonus_courses relation
          where relation.bonus_course_id = p_course_id
        )
      )
      and status = 'open';

    update public.courses
    set archived_at = coalesce(archived_at, now())
    where id = p_course_id;
  else
    update public.courses
    set archived_at = null
    where id = p_course_id;
  end if;
end;
$$;

revoke all on function public.set_course_archived(uuid, boolean) from public, anon;
grant execute on function public.set_course_archived(uuid, boolean) to authenticated, service_role;

create or replace function private.course_is_ready(p_course_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select course.published = true
      and course.archived_at is null
      and exists (
        select 1
        from public.lessons lesson
        join public.lesson_videos video on video.lesson_id = lesson.id
        where lesson.course_id = course.id
          and video.playback_status = 'ready'
      )
    from public.courses course
    where course.id = p_course_id
  ), false);
$$;

revoke all on function private.course_is_ready(uuid) from public, anon;
grant execute on function private.course_is_ready(uuid) to authenticated, service_role;

create or replace function public.get_public_ready_course_ids()
returns table (course_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select course.id
  from public.courses as course
  where course.published = true
    and course.archived_at is null
    and exists (
      select 1
      from public.lessons as lesson
      join public.lesson_videos as video on video.lesson_id = lesson.id
      where lesson.course_id = course.id
        and video.playback_status = 'ready'
    );
$$;

revoke all on function public.get_public_ready_course_ids() from public;
grant execute on function public.get_public_ready_course_ids() to anon, authenticated;

drop policy if exists "payment requests: students create own" on public.payment_requests;
create policy "payment requests: students create own"
on public.payment_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and receipt_path like ((select auth.uid())::text || '/%')
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and exists (
    select 1
    from public.courses
    where courses.id = payment_requests.course_id
      and courses.published = true
      and courses.archived_at is null
  )
  and not exists (
    select 1
    from public.enrollments
    where enrollments.course_id = payment_requests.course_id
      and enrollments.user_id = (select auth.uid())
      and enrollments.status = 'active'
  )
);
