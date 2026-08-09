-- The training-cohort lifecycle trigger runs as the authenticated caller and
-- checks course readiness through this private SECURITY INVOKER helper. The V2
-- foundation migration intentionally revoked the helper from client roles, but
-- that also prevented the trigger from opening an otherwise valid V2 offering.
--
-- Keep the helper private and RLS-aware while granting only the role used by
-- signed-in administrators. The trigger's table policy and lifecycle checks
-- still determine who may change an offering's status.
grant execute on function private.course_is_ready(uuid) to authenticated;

revoke execute on function private.course_is_ready(uuid) from anon, public;
