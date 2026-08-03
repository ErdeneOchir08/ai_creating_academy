-- Public discovery remains available to signed-out visitors.
-- All application mutations require an authenticated Supabase session.
revoke execute on function public.save_cohort_application_draft(uuid, jsonb) from anon;
revoke execute on function public.submit_cohort_application(uuid) from anon;
revoke execute on function public.withdraw_cohort_application(uuid) from anon;
revoke execute on function public.review_cohort_application(uuid, text, text) from anon;

grant execute on function public.save_cohort_application_draft(uuid, jsonb) to authenticated, service_role;
grant execute on function public.submit_cohort_application(uuid) to authenticated, service_role;
grant execute on function public.withdraw_cohort_application(uuid) to authenticated, service_role;
grant execute on function public.review_cohort_application(uuid, text, text) to authenticated, service_role;
