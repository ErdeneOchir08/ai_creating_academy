create index if not exists enrollments_granted_by_course_id_idx
on public.enrollments (granted_by_course_id);

drop index if exists public.payment_requests_one_pending_per_course;
