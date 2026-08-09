-- Keep commercial offerings flexible for future applicants without rewriting
-- the immutable snapshots already held by existing applications, contracts,
-- payments, enrollments, or access grants.

alter table public.training_cohorts
  add column display_capacity integer
    check (display_capacity is null or display_capacity > 0),
  add column configuration_revision integer not null default 1
    check (configuration_revision > 0);

comment on column public.training_cohorts.display_capacity is
  'Informational class-size value shown to customers. V2 checkout never treats this value as an enrollment limit.';

comment on column public.training_cohorts.configuration_revision is
  'Monotonic version for optimistic locking and audited future-applicant configuration changes.';

-- The irreversible checkout-ownership claim is relevant only when an offering
-- is inserted or its activation identity changes. Narrowing the existing
-- trigger prevents ordinary commercial edits (and this migration) from
-- re-running the authenticated activation path.
drop trigger z1_training_cohorts_claim_v2_checkout on public.training_cohorts;
create trigger z1_training_cohorts_claim_v2_checkout
after insert or update of status, course_id, checkout_version on public.training_cohorts
for each row execute function private.claim_v2_course_checkout_ownership();

-- Preserve legacy enforcement while converting every existing V2 offering to
-- the academy-approved display-only class-size policy.
update public.training_cohorts
set
  display_capacity = capacity,
  capacity = null
where checkout_version = 2;

create table public.course_offering_configuration_changes (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.training_cohorts(id) on delete restrict,
  revision integer not null check (revision > 1),
  changed_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null default '' check (char_length(reason) <= 500),
  before_configuration jsonb not null,
  after_configuration jsonb not null,
  changed_at timestamptz not null default now(),
  unique (offering_id, revision)
);

create index course_offering_configuration_changes_offering_idx
on public.course_offering_configuration_changes (offering_id, revision desc);

alter table public.course_offering_configuration_changes enable row level security;

revoke all on table public.course_offering_configuration_changes from anon, authenticated;
grant select on table public.course_offering_configuration_changes to authenticated;
grant all on table public.course_offering_configuration_changes to service_role;

create policy "course offering configuration changes: admins read"
on public.course_offering_configuration_changes for select to authenticated
using ((select private.is_admin()));

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
    'ends_on', p_offering.ends_on
  );
$$;

revoke all on function private.v2_offering_configuration_snapshot(public.training_cohorts)
from public, anon, authenticated;

create or replace function private.enforce_v2_offering_configuration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.checkout_version <> 2 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if new.capacity is not null then
    raise exception 'V2 class size is informational and must use display_capacity.';
  end if;

  if new.status = 'open' then
    if new.tuition_amount_mnt is null or new.tuition_amount_mnt <= 0 then
      raise exception 'A positive tuition amount is required while V2 enrollment is open.';
    end if;
    if new.payment_due_days is null or new.payment_due_days <= 0 then
      raise exception 'A positive payment deadline is required while V2 enrollment is open.';
    end if;
    if new.delivery_mode = 'offline' and nullif(trim(new.location), '') is null then
      raise exception 'A classroom location is required while offline enrollment is open.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_v2_offering_configuration()
from public, anon, authenticated;

create trigger a00_training_cohorts_v2_configuration
before insert or update on public.training_cohorts
for each row execute function private.enforce_v2_offering_configuration();

create or replace function public.update_v2_course_offering_configuration(
  p_offering_id uuid,
  p_expected_revision integer,
  p_name text,
  p_display_capacity integer,
  p_tuition_amount_mnt integer,
  p_payment_due_days integer,
  p_payment_plan text,
  p_schedule_summary text,
  p_location text,
  p_registration_opens_at timestamptz,
  p_registration_closes_at timestamptz,
  p_starts_on date,
  p_ends_on date,
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
    raise exception 'Only draft, open, or closed V2 offerings can be configured.';
  end if;
  if p_expected_revision is distinct from current_offering.configuration_revision then
    raise exception 'The offering was changed by another administrator. Reload before saving again.';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null or char_length(trim(p_name)) > 160 then
    raise exception 'A valid offering name is required.';
  end if;
  if p_display_capacity is not null and p_display_capacity <= 0 then
    raise exception 'The displayed class size must be positive.';
  end if;
  if p_tuition_amount_mnt is not null and p_tuition_amount_mnt < 0 then
    raise exception 'The tuition amount cannot be negative.';
  end if;
  if p_payment_due_days is not null and p_payment_due_days <= 0 then
    raise exception 'The payment deadline must be positive.';
  end if;
  if p_registration_closes_at is not null
     and p_registration_opens_at is not null
     and p_registration_closes_at < p_registration_opens_at then
    raise exception 'Registration cannot close before it opens.';
  end if;
  if p_ends_on is not null and p_starts_on is not null and p_ends_on < p_starts_on then
    raise exception 'Training cannot end before it starts.';
  end if;
  if current_offering.status <> 'draft' and char_length(normalized_reason) < 5 then
    raise exception 'A change reason is required for an active or closed offering.';
  end if;

  update public.training_cohorts
  set
    name = trim(p_name),
    capacity = null,
    display_capacity = p_display_capacity,
    tuition_amount_mnt = p_tuition_amount_mnt,
    payment_due_days = p_payment_due_days,
    payment_plan = trim(coalesce(p_payment_plan, '')),
    schedule_summary = trim(coalesce(p_schedule_summary, '')),
    location = case
      when current_offering.delivery_mode = 'online' then ''
      else trim(coalesce(p_location, ''))
    end,
    registration_opens_at = p_registration_opens_at,
    registration_closes_at = p_registration_closes_at,
    starts_on = p_starts_on,
    ends_on = p_ends_on,
    configuration_revision = current_offering.configuration_revision + 1
  where id = current_offering.id
  returning * into updated_offering;

  insert into public.course_offering_configuration_changes (
    offering_id,
    revision,
    changed_by,
    reason,
    before_configuration,
    after_configuration
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

revoke all on function public.update_v2_course_offering_configuration(
  uuid, integer, text, integer, integer, integer, text, text, text,
  timestamptz, timestamptz, date, date, text
) from public, anon;

grant execute on function public.update_v2_course_offering_configuration(
  uuid, integer, text, integer, integer, integer, text, text, text,
  timestamptz, timestamptz, date, date, text
) to authenticated, service_role;

-- Preserve the display-only value and the exact configuration revision inside
-- every new immutable application terms snapshot.
create or replace function private.capture_v2_offering_configuration_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  offering_configuration_revision integer;
  offering_display_capacity integer;
begin
  select cohort.configuration_revision, cohort.display_capacity
  into offering_configuration_revision, offering_display_capacity
  from public.training_cohorts cohort
  where cohort.id = new.offering_id
    and cohort.checkout_version = 2;

  if not found then
    raise exception 'The V2 course offering does not exist.';
  end if;

  new.terms_snapshot := coalesce(new.terms_snapshot, '{}'::jsonb)
    || jsonb_build_object(
      'offering_configuration_revision', offering_configuration_revision,
      'display_capacity', offering_display_capacity
    );
  return new;
end;
$$;

revoke all on function private.capture_v2_offering_configuration_snapshot()
from public, anon, authenticated;

create trigger a00_course_offering_applications_configuration_snapshot
before insert on public.course_offering_applications
for each row execute function private.capture_v2_offering_configuration_snapshot();

-- Small public metadata functions let the application layer merge display-only
-- class size into the existing stable checkout read models without changing
-- their established database signatures.
create or replace function public.list_public_course_offering_display_metadata(
  p_course_id uuid default null
)
returns table (
  offering_id uuid,
  display_capacity integer,
  configuration_revision integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select cohort.id, cohort.display_capacity, cohort.configuration_revision
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  where cohort.checkout_version = 2
    and cohort.status = 'open'
    and cohort.course_id is not null
    and (p_course_id is null or cohort.course_id = p_course_id)
    and not program.is_archived
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
    and private.course_is_ready(cohort.course_id)
  order by cohort.starts_on nulls last, cohort.registration_closes_at nulls last, cohort.created_at;
$$;

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
      'configuration_revision', cohort.configuration_revision
    )
    from public.training_cohorts cohort
    join public.training_programs program on program.id = cohort.program_id
    where cohort.id = p_offering_id
      and cohort.checkout_version = 2
      and cohort.status = 'open'
      and cohort.course_id is not null
      and not program.is_archived
      and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
      and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
      and private.course_is_ready(cohort.course_id)
  ), '{}'::jsonb);
$$;

revoke all on function public.list_public_course_offering_display_metadata(uuid) from public;
revoke all on function public.get_course_offering_display_metadata(uuid) from public;
grant execute on function public.list_public_course_offering_display_metadata(uuid) to anon, authenticated, service_role;
grant execute on function public.get_course_offering_display_metadata(uuid) to anon, authenticated, service_role;
