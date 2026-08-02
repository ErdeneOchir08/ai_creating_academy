create or replace function public.get_payment_request_notification_recipient(p_request_id uuid)
returns table (
  email text,
  display_name text,
  course_title text
)
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  return query
  select
    auth.users.email::text,
    profiles.display_name::text,
    courses.title::text
  from public.payment_requests
  join auth.users on auth.users.id = payment_requests.user_id
  left join public.profiles on profiles.id = payment_requests.user_id
  join public.courses on courses.id = payment_requests.course_id
  where payment_requests.id = p_request_id;
end;
$$;

revoke all on function public.get_payment_request_notification_recipient(uuid) from public, anon;
grant execute on function public.get_payment_request_notification_recipient(uuid) to authenticated;
