create table public.class_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.training_cohorts(id) on delete restrict,
  teacher_user_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= assigned_at)
);

create unique index class_teacher_assignments_one_active_idx
on public.class_teacher_assignments (class_id)
where ended_at is null;

create index class_teacher_assignments_teacher_idx
on public.class_teacher_assignments (teacher_user_id, ended_at, class_id);

create index class_teacher_assignments_assigned_by_idx
on public.class_teacher_assignments (assigned_by);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.training_cohorts(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  delivery_mode text not null check (delivery_mode in ('online', 'offline')),
  meeting_url text check (
    meeting_url is null
    or meeting_url = ''
    or meeting_url ~* '^https://[^[:space:]]+$'
  ),
  location text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (delivery_mode = 'online' and trim(location) = '')
    or (delivery_mode = 'offline' and char_length(trim(location)) between 1 and 1000 and coalesce(meeting_url, '') = '')
  )
);

create index class_sessions_class_start_idx
on public.class_sessions (class_id, starts_at);

create index class_sessions_created_by_idx
on public.class_sessions (created_by);

create index class_sessions_updated_by_idx
on public.class_sessions (updated_by);

alter table public.class_teacher_assignments enable row level security;
alter table public.class_sessions enable row level security;

create policy "class teachers: participants read"
on public.class_teacher_assignments for select to authenticated
using (
  teacher_user_id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1
    from public.course_offering_enrollments enrollment
    where enrollment.offering_id = class_teacher_assignments.class_id
      and enrollment.content_access_user_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

create policy "class teachers: admins create"
on public.class_teacher_assignments for insert to authenticated
with check (
  (select private.is_admin())
  and assigned_by = (select auth.uid())
);

create policy "class teachers: admins update"
on public.class_teacher_assignments for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "class sessions: participants read"
on public.class_sessions for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.class_teacher_assignments assignment
    where assignment.class_id = class_sessions.class_id
      and assignment.teacher_user_id = (select auth.uid())
      and assignment.ended_at is null
  )
  or exists (
    select 1
    from public.course_offering_enrollments enrollment
    where enrollment.offering_id = class_sessions.class_id
      and enrollment.content_access_user_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

create policy "class sessions: admins create"
on public.class_sessions for insert to authenticated
with check (
  (select private.is_admin())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "class sessions: admins update"
on public.class_sessions for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()) and updated_by = (select auth.uid()));

create policy "class sessions: admins delete"
on public.class_sessions for delete to authenticated
using ((select private.is_admin()));

create or replace function public.save_guided_class_schedule(
  p_class_id uuid,
  p_teacher_user_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_schedule_summary text,
  p_location text,
  p_sessions jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_class public.training_cohorts%rowtype;
  session_item jsonb;
  session_title text;
  session_starts_at timestamptz;
  session_ends_at timestamptz;
  session_meeting_url text;
  session_location text;
  expected_delivery_mode text;
begin
  if current_user_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  select * into target_class
  from public.training_cohorts
  where id = p_class_id
  for update;

  if not found
     or target_class.checkout_version <> 2
     or target_class.status <> 'draft'
     or target_class.class_type not in ('instructor_led_online', 'offline_with_video') then
    raise exception 'Only a scheduled guided-class draft can use this workflow.';
  end if;

  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then
    raise exception 'The class dates are invalid.';
  end if;
  if char_length(trim(coalesce(p_schedule_summary, ''))) not between 1 and 2000 then
    raise exception 'The schedule summary is required.';
  end if;
  if target_class.class_type = 'offline_with_video'
     and char_length(trim(coalesce(p_location, ''))) not between 1 and 1000 then
    raise exception 'The classroom location is required.';
  end if;
  if target_class.class_type = 'instructor_led_online' and trim(coalesce(p_location, '')) <> '' then
    raise exception 'An online class cannot have a classroom location.';
  end if;
  if not exists (
    select 1 from public.user_roles
    where user_id = p_teacher_user_id and role = 'teacher'
  ) then
    raise exception 'The selected account is not a teacher.';
  end if;
  if jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) = 0 then
    raise exception 'At least one class session is required.';
  end if;

  expected_delivery_mode := case
    when target_class.class_type = 'offline_with_video' then 'offline'
    else 'online'
  end;

  for session_item in select value from jsonb_array_elements(p_sessions)
  loop
    session_title := trim(coalesce(session_item->>'title', ''));
    session_starts_at := (session_item->>'starts_at')::timestamptz;
    session_ends_at := (session_item->>'ends_at')::timestamptz;
    session_meeting_url := nullif(trim(coalesce(session_item->>'meeting_url', '')), '');
    session_location := trim(coalesce(session_item->>'location', ''));

    if char_length(session_title) not between 1 and 160
       or session_ends_at <= session_starts_at then
      raise exception 'A class session is invalid.';
    end if;
    if expected_delivery_mode = 'online'
       and session_meeting_url is not null
       and session_meeting_url !~* '^https://[^[:space:]]+$' then
      raise exception 'An online meeting link must start with https://.';
    end if;
    if expected_delivery_mode = 'offline' and char_length(session_location) not between 1 and 1000 then
      raise exception 'Every classroom session needs a location.';
    end if;
  end loop;

  update public.class_teacher_assignments
  set ended_at = now()
  where class_id = p_class_id
    and ended_at is null
    and teacher_user_id <> p_teacher_user_id;

  if not exists (
    select 1 from public.class_teacher_assignments
    where class_id = p_class_id
      and teacher_user_id = p_teacher_user_id
      and ended_at is null
  ) then
    insert into public.class_teacher_assignments (class_id, teacher_user_id, assigned_by)
    values (p_class_id, p_teacher_user_id, current_user_id);
  end if;

  delete from public.class_sessions where class_id = p_class_id;

  insert into public.class_sessions (
    class_id, title, starts_at, ends_at, delivery_mode,
    meeting_url, location, created_by, updated_by
  )
  select
    p_class_id,
    trim(item->>'title'),
    (item->>'starts_at')::timestamptz,
    (item->>'ends_at')::timestamptz,
    expected_delivery_mode,
    case when expected_delivery_mode = 'online' then nullif(trim(coalesce(item->>'meeting_url', '')), '') else null end,
    case when expected_delivery_mode = 'offline' then trim(coalesce(item->>'location', '')) else '' end,
    current_user_id,
    current_user_id
  from jsonb_array_elements(p_sessions) item;

  update public.training_cohorts
  set starts_on = p_starts_on,
      ends_on = p_ends_on,
      schedule_summary = trim(p_schedule_summary),
      location = case when target_class.class_type = 'offline_with_video' then trim(p_location) else '' end
  where id = p_class_id;
end;
$$;

revoke all on function public.save_guided_class_schedule(uuid, uuid, date, date, text, text, jsonb) from public, anon;
grant execute on function public.save_guided_class_schedule(uuid, uuid, date, date, text, text, jsonb) to authenticated;

