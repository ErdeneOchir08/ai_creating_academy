create unique index payment_requests_one_pending_per_course_user_idx
on public.payment_requests (user_id, course_id)
where status = 'pending';
