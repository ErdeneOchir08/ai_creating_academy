create function public.get_payment_request_notification_recipient_with_bonus(p_request_id uuid)
returns table (
  email text,
  display_name text,
  course_title text,
  bonus_course_titles text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  return query
  select
    auth.users.email::text,
    profiles.display_name::text,
    courses.title::text,
    coalesce(
      (
        select array_agg(bonus_courses.title order by bonus_courses.title)
        from public.enrollments as bonus_enrollments
        join public.courses as bonus_courses on bonus_courses.id = bonus_enrollments.course_id
        where bonus_enrollments.user_id = payment_requests.user_id
          and bonus_enrollments.status = 'active'
          and bonus_enrollments.grant_source = 'bonus'
          and bonus_enrollments.granted_by_course_id = payment_requests.course_id
      ),
      array[]::text[]
    )
  from public.payment_requests as payment_requests
  join auth.users on auth.users.id = payment_requests.user_id
  left join public.profiles as profiles on profiles.id = payment_requests.user_id
  join public.courses as courses on courses.id = payment_requests.course_id
  where payment_requests.id = p_request_id;
end;
$$;

revoke all on function public.get_payment_request_notification_recipient_with_bonus(uuid) from public, anon;
grant execute on function public.get_payment_request_notification_recipient_with_bonus(uuid) to authenticated;
