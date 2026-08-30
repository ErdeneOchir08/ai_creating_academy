grant insert on table public.course_offering_configuration_changes to authenticated;

create policy "course offering configuration changes: admins create"
on public.course_offering_configuration_changes for insert to authenticated
with check (
  (select private.is_admin())
  and changed_by = (select auth.uid())
);

create or replace function public.update_published_class_schedule(
  p_class_id uuid,
  p_expected_revision integer,
  p_reason text,
  p_teacher_user_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_schedule_summary text,
  p_location text,
  p_sessions jsonb
)
returns table (new_revision integer, active_enrollment_count bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_class public.training_cohorts%rowtype;
  updated_class public.training_cohorts%rowtype;
  session_item jsonb;
  session_title text;
  session_starts_at timestamptz;
  session_ends_at timestamptz;
  session_meeting_url text;
  session_location text;
  expected_delivery_mode text;
  normalized_reason text := trim(coalesce(p_reason, ''));
  before_configuration jsonb;
  after_configuration jsonb;
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
     or target_class.status not in ('open', 'closed')
     or target_class.class_type not in ('instructor_led_online', 'offline_with_video') then
    raise exception 'Only a published scheduled class can use this workflow.';
  end if;
  if p_expected_revision is distinct from target_class.configuration_revision then
    raise exception 'The class was changed by another administrator. Reload before saving again.';
  end if;
  if char_length(normalized_reason) not between 5 and 500 then
    raise exception 'A change reason of at least 5 characters is required.';
  end if;
  if exists (
    select 1 from public.class_sessions
    where class_id = p_class_id and starts_at <= now()
  ) then
    raise exception 'A class with a started session cannot be changed with this simple editor.';
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
       or session_ends_at <= session_starts_at
       or session_starts_at <= now() then
      raise exception 'Every replacement session must have a valid future time.';
    end if;
    if (session_starts_at at time zone 'Asia/Ulaanbaatar')::date < p_starts_on
       or (session_ends_at at time zone 'Asia/Ulaanbaatar')::date > p_ends_on then
      raise exception 'Every session must fall inside the class date range.';
    end if;
    if expected_delivery_mode = 'online'
       and (session_meeting_url is null or session_meeting_url !~* '^https://[^[:space:]]+$') then
      raise exception 'Every online session needs an https meeting link.';
    end if;
    if expected_delivery_mode = 'offline' and char_length(session_location) not between 1 and 1000 then
      raise exception 'Every classroom session needs a location.';
    end if;
  end loop;

  before_configuration := jsonb_build_object(
      'revision', target_class.configuration_revision,
      'name', target_class.name,
      'display_capacity', target_class.display_capacity,
      'tuition_amount_mnt', target_class.tuition_amount_mnt,
      'payment_due_days', target_class.payment_due_days,
      'payment_plan', target_class.payment_plan,
      'schedule_summary', target_class.schedule_summary,
      'location', target_class.location,
      'registration_opens_at', target_class.registration_opens_at,
      'registration_closes_at', target_class.registration_closes_at,
      'starts_on', target_class.starts_on,
      'ends_on', target_class.ends_on,
      'qpay_enabled', target_class.qpay_enabled,
      'manual_transfer_enabled', target_class.manual_transfer_enabled,
      'teacher_user_id', (
        select teacher_user_id from public.class_teacher_assignments
        where class_id = p_class_id and ended_at is null
      ),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'title', title,
          'starts_at', starts_at,
          'ends_at', ends_at,
          'delivery_mode', delivery_mode,
          'meeting_url', meeting_url,
          'location', location
        ) order by starts_at)
        from public.class_sessions where class_id = p_class_id
      ), '[]'::jsonb)
    );

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
      location = case when target_class.class_type = 'offline_with_video' then trim(p_location) else '' end,
      configuration_revision = target_class.configuration_revision + 1
  where id = p_class_id
  returning * into updated_class;

  after_configuration := jsonb_build_object(
      'revision', updated_class.configuration_revision,
      'name', updated_class.name,
      'display_capacity', updated_class.display_capacity,
      'tuition_amount_mnt', updated_class.tuition_amount_mnt,
      'payment_due_days', updated_class.payment_due_days,
      'payment_plan', updated_class.payment_plan,
      'schedule_summary', updated_class.schedule_summary,
      'location', updated_class.location,
      'registration_opens_at', updated_class.registration_opens_at,
      'registration_closes_at', updated_class.registration_closes_at,
      'starts_on', updated_class.starts_on,
      'ends_on', updated_class.ends_on,
      'qpay_enabled', updated_class.qpay_enabled,
      'manual_transfer_enabled', updated_class.manual_transfer_enabled,
      'teacher_user_id', p_teacher_user_id,
      'sessions', (
        select jsonb_agg(jsonb_build_object(
          'title', title,
          'starts_at', starts_at,
          'ends_at', ends_at,
          'delivery_mode', delivery_mode,
          'meeting_url', meeting_url,
          'location', location
        ) order by starts_at)
        from public.class_sessions where class_id = p_class_id
      )
    );

  insert into public.course_offering_configuration_changes (
    offering_id, revision, changed_by, reason,
    before_configuration, after_configuration
  ) values (
    p_class_id, updated_class.configuration_revision, current_user_id,
    normalized_reason, before_configuration, after_configuration
  );

  return query select
    updated_class.configuration_revision,
    (select count(*) from public.course_offering_enrollments
      where offering_id = p_class_id and status = 'active');
end;
$$;

revoke all on function public.update_published_class_schedule(
  uuid, integer, text, uuid, date, date, text, text, jsonb
) from public, anon;
grant execute on function public.update_published_class_schedule(
  uuid, integer, text, uuid, date, date, text, text, jsonb
) to authenticated;
