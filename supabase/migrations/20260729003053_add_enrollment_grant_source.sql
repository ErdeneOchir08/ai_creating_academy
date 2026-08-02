alter table public.enrollments
add column grant_source text not null default 'payment'
  check (grant_source in ('payment', 'bonus')),
add column granted_by_course_id uuid references public.courses(id) on delete set null;

create or replace function public.approve_payment_request(p_request_id uuid)
returns void
language plpgsql
set search_path = public, private
as $$
declare v_request public.payment_requests%rowtype;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access is required'; end if;
  select * into v_request from public.payment_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Payment request is no longer pending'; end if;
  insert into public.enrollments (user_id, course_id, status, grant_source, granted_by_course_id)
  values (v_request.user_id, v_request.course_id, 'active', 'payment', null)
  on conflict (user_id, course_id) do update set status = 'active', grant_source = 'payment', granted_by_course_id = null;
  insert into public.enrollments (user_id, course_id, status, grant_source, granted_by_course_id)
  select v_request.user_id, bonus_course_id, 'active', 'bonus', v_request.course_id from public.course_bonus_courses where source_course_id = v_request.course_id
  on conflict (user_id, course_id) do update set status = 'active';
  update public.payment_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null where id = v_request.id;
end;
$$;
