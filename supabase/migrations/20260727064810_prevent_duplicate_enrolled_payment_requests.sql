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
  )
  and not exists (
    select 1
    from public.enrollments
    where enrollments.course_id = payment_requests.course_id
      and enrollments.user_id = (select auth.uid())
      and enrollments.status = 'active'
  )
);
