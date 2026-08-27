-- Launch controls for online V2 offerings. Existing application, contract,
-- payment, enrollment, and entitlement snapshots remain immutable.

alter table public.training_cohorts
  add column qpay_enabled boolean not null default true,
  add column manual_transfer_enabled boolean not null default true;

comment on column public.training_cohorts.qpay_enabled is
  'Whether future payment attempts for this offering may use QPay. Existing QPay attempts remain reconcilable.';
comment on column public.training_cohorts.manual_transfer_enabled is
  'Whether future payment attempts for this offering may use manual bank transfer receipt review.';

create or replace function private.v2_offering_configuration_snapshot(
  p_offering public.training_cohorts
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'revision', p_offering.configuration_revision,
    'name', p_offering.name,
    'display_capacity', p_offering.display_capacity,
    'tuition_amount_mnt', p_offering.tuition_amount_mnt,
    'payment_due_days', p_offering.payment_due_days,
    'payment_plan', p_offering.payment_plan,
    'schedule_summary', p_offering.schedule_summary,
    'location', p_offering.location,
    'registration_opens_at', p_offering.registration_opens_at,
    'registration_closes_at', p_offering.registration_closes_at,
    'starts_on', p_offering.starts_on,
    'ends_on', p_offering.ends_on,
    'qpay_enabled', p_offering.qpay_enabled,
    'manual_transfer_enabled', p_offering.manual_transfer_enabled
  );
$$;

revoke all on function private.v2_offering_configuration_snapshot(public.training_cohorts)
from public, anon, authenticated;

create or replace function public.update_v2_course_offering_payment_methods(
  p_offering_id uuid,
  p_expected_revision integer,
  p_qpay_enabled boolean,
  p_manual_transfer_enabled boolean,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_offering public.training_cohorts%rowtype;
  updated_offering public.training_cohorts%rowtype;
  normalized_reason text := trim(coalesce(p_reason, ''));
begin
  if current_user_id is null or coalesce((select private.is_admin()), false) is false then
    raise exception 'Administrator access is required.';
  end if;

  select cohort.* into current_offering
  from public.training_cohorts cohort
  where cohort.id = p_offering_id
  for update;

  if not found or current_offering.checkout_version <> 2 then
    raise exception 'The V2 course offering does not exist.';
  end if;
  if current_offering.status not in ('draft', 'open', 'closed') then
    raise exception 'Payment methods can only be changed for draft, open, or closed offerings.';
  end if;
  if p_expected_revision is distinct from current_offering.configuration_revision then
    raise exception 'The offering was changed by another administrator. Reload before saving again.';
  end if;
  if current_offering.status <> 'draft' and char_length(normalized_reason) < 5 then
    raise exception 'A change reason is required for an active or closed offering.';
  end if;

  update public.training_cohorts
  set
    qpay_enabled = coalesce(p_qpay_enabled, false),
    manual_transfer_enabled = coalesce(p_manual_transfer_enabled, false),
    configuration_revision = current_offering.configuration_revision + 1
  where id = current_offering.id
  returning * into updated_offering;

  insert into public.course_offering_configuration_changes (
    offering_id, revision, changed_by, reason,
    before_configuration, after_configuration
  ) values (
    updated_offering.id,
    updated_offering.configuration_revision,
    current_user_id,
    normalized_reason,
    private.v2_offering_configuration_snapshot(current_offering),
    private.v2_offering_configuration_snapshot(updated_offering)
  );

  return updated_offering.configuration_revision;
end;
$$;

revoke all on function public.update_v2_course_offering_payment_methods(
  uuid, integer, boolean, boolean, text
) from public, anon;
grant execute on function public.update_v2_course_offering_payment_methods(
  uuid, integer, boolean, boolean, text
) to authenticated, service_role;

create or replace function private.enforce_course_offering_payment_method()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  qpay_allowed boolean;
  manual_allowed boolean;
begin
  select cohort.qpay_enabled, cohort.manual_transfer_enabled
  into qpay_allowed, manual_allowed
  from public.training_cohorts cohort
  where cohort.id = new.offering_id;

  if not found then
    raise exception 'The course offering does not exist.';
  end if;
  if new.provider = 'qpay' and not qpay_allowed then
    raise exception 'QPay is disabled for this offering.';
  end if;
  if new.provider = 'manual_transfer' and not manual_allowed then
    raise exception 'Manual transfer is disabled for this offering.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_course_offering_payment_method()
from public, anon, authenticated;

create trigger a00_course_offering_payments_method_enabled
before insert on public.course_offering_payments
for each row execute function private.enforce_course_offering_payment_method();

create or replace function public.get_course_offering_display_metadata(p_offering_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'offering_id', cohort.id,
      'display_capacity', cohort.display_capacity,
      'configuration_revision', cohort.configuration_revision,
      'qpay_enabled', cohort.qpay_enabled,
      'manual_transfer_enabled', cohort.manual_transfer_enabled
    )
    from public.training_cohorts cohort
    join public.training_programs program on program.id = cohort.program_id
    where cohort.id = p_offering_id
      and cohort.checkout_version = 2
      and cohort.course_id is not null
      and not program.is_archived
      and private.course_is_ready(cohort.course_id)
      and (
        (
          cohort.status = 'open'
          and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
          and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
        )
        or (
          (select auth.uid()) is not null
          and exists (
            select 1
            from public.course_offering_applications application
            where application.offering_id = cohort.id
              and application.applicant_user_id = (select auth.uid())
          )
        )
      )
  ), '{}'::jsonb);
$$;

revoke all on function public.get_course_offering_display_metadata(uuid) from public;
grant execute on function public.get_course_offering_display_metadata(uuid)
to anon, authenticated, service_role;
