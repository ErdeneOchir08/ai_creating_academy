create table public.course_bonus_courses (
  source_course_id uuid not null references public.courses(id) on delete cascade,
  bonus_course_id uuid not null references public.courses(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (source_course_id, bonus_course_id),
  check (source_course_id <> bonus_course_id)
);

create index course_bonus_courses_bonus_course_id_idx on public.course_bonus_courses(bonus_course_id);
grant select on public.course_bonus_courses to authenticated;
grant insert, update, delete on public.course_bonus_courses to authenticated;
alter table public.course_bonus_courses enable row level security;
create policy "course bonuses: admins manage" on public.course_bonus_courses for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

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
  insert into public.enrollments (user_id, course_id, status) values (v_request.user_id, v_request.course_id, 'active') on conflict (user_id, course_id) do update set status = 'active';
  insert into public.enrollments (user_id, course_id, status)
  select v_request.user_id, bonus_course_id, 'active' from public.course_bonus_courses where source_course_id = v_request.course_id
  on conflict (user_id, course_id) do update set status = 'active';
  update public.payment_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null where id = v_request.id;
end;
$$;
