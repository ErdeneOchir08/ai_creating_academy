create table public.cohort_application_contract_snapshots (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.cohort_applications(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  cohort_id uuid not null references public.training_cohorts(id) on delete restrict,
  contract_version_id uuid not null references public.contract_template_versions(id) on delete restrict,
  contract_title text not null check (char_length(trim(contract_title)) between 1 and 240),
  contract_version_number integer not null check (contract_version_number > 0),
  contract_content text not null check (char_length(contract_content) <= 100_000),
  required_variable_keys text[] not null default '{}'::text[],
  unresolved_variable_keys text[] not null default '{}'::text[],
  resolved_values jsonb not null default '{}'::jsonb check (jsonb_typeof(resolved_values) = 'object'),
  application_answers jsonb not null check (jsonb_typeof(application_answers) = 'object'),
  program_details jsonb not null check (jsonb_typeof(program_details) = 'object'),
  academy_details jsonb not null check (jsonb_typeof(academy_details) = 'object'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index cohort_contract_snapshots_applicant_idx
on public.cohort_application_contract_snapshots (applicant_user_id, created_at desc);

create index cohort_contract_snapshots_cohort_idx
on public.cohort_application_contract_snapshots (cohort_id, created_at desc);

create index cohort_contract_snapshots_contract_version_idx
on public.cohort_application_contract_snapshots (contract_version_id);

create index cohort_contract_snapshots_created_by_idx
on public.cohort_application_contract_snapshots (created_by);

create or replace function private.prevent_contract_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Approved application contract snapshots are immutable.';
end;
$$;

create trigger cohort_contract_snapshots_immutable
before update or delete on public.cohort_application_contract_snapshots
for each row execute function private.prevent_contract_snapshot_mutation();

alter table public.cohort_application_contract_snapshots enable row level security;

revoke all on table public.cohort_application_contract_snapshots from anon, authenticated;
grant select on table public.cohort_application_contract_snapshots to authenticated;
grant all on table public.cohort_application_contract_snapshots to service_role;

create policy "contract snapshots: applicant or admin reads"
on public.cohort_application_contract_snapshots
for select
to authenticated
using (
  applicant_user_id = (select auth.uid())
  or (select private.is_admin())
);

create or replace function private.create_approved_application_contract_snapshot(
  p_application_id uuid,
  p_created_by uuid,
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_application public.cohort_applications%rowtype;
  target_cohort public.training_cohorts%rowtype;
  target_program public.training_programs%rowtype;
  target_contract public.contract_template_versions%rowtype;
  academy public.academy_profile%rowtype;
  required_keys text[];
  unresolved_keys text[];
  snapshot_values jsonb;
  snapshot_id uuid;
begin
  select application.* into target_application
  from public.cohort_applications application
  where application.id = p_application_id
    and application.status = 'approved';

  if not found then
    raise exception 'An approved application is required to create a contract snapshot.';
  end if;

  if p_created_by is null then
    raise exception 'The contract snapshot creator is required.';
  end if;

  select cohort.* into strict target_cohort
  from public.training_cohorts cohort
  where cohort.id = target_application.cohort_id;

  select program.* into strict target_program
  from public.training_programs program
  where program.id = target_cohort.program_id;

  select version.* into strict target_contract
  from public.contract_template_versions version
  where version.id = target_application.contract_version_id
    and version.status in ('published', 'retired');

  select profile.* into academy
  from public.academy_profile profile
  where profile.id = true;

  select coalesce(array_agg(variable_key order by variable_key), '{}'::text[])
  into required_keys
  from (
    select distinct match[1] as variable_key
    from regexp_matches(target_contract.content, '\{\{([a-z][a-z0-9_]*)\}\}', 'g') as match
  ) variables;

  snapshot_values := target_application.answers || jsonb_strip_nulls(jsonb_build_object(
    'program_name', target_program.name,
    'cohort_name', target_cohort.name,
    'learning_format', case target_cohort.delivery_mode
      when 'online' then 'Цахим'
      when 'offline' then 'Танхим'
      when 'hybrid' then 'Хосолсон'
    end,
    'schedule', nullif(trim(target_cohort.schedule_summary), ''),
    'start_date', target_cohort.starts_on::text,
    'end_date', target_cohort.ends_on::text,
    'location', nullif(trim(target_cohort.location), ''),
    'tuition_amount', target_cohort.tuition_amount_mnt::text,
    'payment_plan', nullif(trim(target_cohort.payment_plan), ''),
    'academy_name', nullif(trim(academy.display_name), ''),
    'academy_phone', nullif(trim(academy.phone), ''),
    'academy_address', nullif(trim(academy.address), '')
  ));

  select coalesce(array_agg(variable_key order by variable_key), '{}'::text[])
  into unresolved_keys
  from unnest(required_keys) variable_key
  where nullif(trim(snapshot_values ->> variable_key), '') is null;

  insert into public.cohort_application_contract_snapshots (
    application_id,
    applicant_user_id,
    cohort_id,
    contract_version_id,
    contract_title,
    contract_version_number,
    contract_content,
    required_variable_keys,
    unresolved_variable_keys,
    resolved_values,
    application_answers,
    program_details,
    academy_details,
    created_by,
    created_at
  ) values (
    target_application.id,
    target_application.applicant_user_id,
    target_application.cohort_id,
    target_application.contract_version_id,
    target_contract.title,
    target_contract.version_number,
    target_contract.content,
    required_keys,
    unresolved_keys,
    snapshot_values,
    target_application.answers,
    jsonb_build_object(
      'program', jsonb_build_object(
        'id', target_program.id,
        'name', target_program.name,
        'description', target_program.description
      ),
      'cohort', jsonb_build_object(
        'id', target_cohort.id,
        'name', target_cohort.name,
        'delivery_mode', target_cohort.delivery_mode,
        'capacity', target_cohort.capacity,
        'tuition_amount_mnt', target_cohort.tuition_amount_mnt,
        'payment_plan', target_cohort.payment_plan,
        'schedule_summary', target_cohort.schedule_summary,
        'location', target_cohort.location,
        'registration_opens_at', target_cohort.registration_opens_at,
        'registration_closes_at', target_cohort.registration_closes_at,
        'starts_on', target_cohort.starts_on,
        'ends_on', target_cohort.ends_on
      )
    ),
    jsonb_build_object(
      'display_name', academy.display_name,
      'short_description', academy.short_description,
      'public_email', academy.public_email,
      'phone', academy.phone,
      'address', academy.address,
      'business_hours', academy.business_hours,
      'website_url', academy.website_url
    ),
    p_created_by,
    p_created_at
  )
  on conflict (application_id) do nothing
  returning id into snapshot_id;

  if snapshot_id is null then
    select snapshot.id into snapshot_id
    from public.cohort_application_contract_snapshots snapshot
    where snapshot.application_id = p_application_id;
  end if;

  return snapshot_id;
end;
$$;

do $$
declare
  existing_application record;
begin
  for existing_application in
    select id, reviewed_by, reviewed_at
    from public.cohort_applications
    where status = 'approved'
  loop
    perform private.create_approved_application_contract_snapshot(
      existing_application.id,
      existing_application.reviewed_by,
      existing_application.reviewed_at
    );
  end loop;
end;
$$;

create or replace function public.review_cohort_application(
  p_application_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_application public.cohort_applications%rowtype;
  target_capacity integer;
  approved_count bigint;
  reviewer_id uuid := (select auth.uid());
begin
  if reviewer_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'The application decision is invalid.';
  end if;

  if p_decision = 'rejected' and nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  select application.* into target_application
  from public.cohort_applications application
  where application.id = p_application_id
    and application.status = 'submitted'
  for update;

  if not found then
    raise exception 'The submitted application was not found.';
  end if;

  select capacity into target_capacity
  from public.training_cohorts
  where id = target_application.cohort_id
  for update;

  if p_decision = 'approved' and target_capacity is not null then
    select count(*) into approved_count
    from public.cohort_applications
    where cohort_id = target_application.cohort_id
      and status = 'approved';

    if approved_count >= target_capacity then
      raise exception 'The cohort has reached its approved application capacity.';
    end if;
  end if;

  update public.cohort_applications
  set
    status = p_decision,
    rejection_reason = case when p_decision = 'rejected' then trim(p_rejection_reason) else null end
  where id = target_application.id;

  if p_decision = 'approved' then
    perform private.create_approved_application_contract_snapshot(
      target_application.id,
      reviewer_id,
      now()
    );
  end if;
end;
$$;

revoke all on function private.prevent_contract_snapshot_mutation() from public, anon, authenticated;
revoke all on function private.create_approved_application_contract_snapshot(uuid, uuid, timestamptz) from public, anon, authenticated;

revoke all on function public.review_cohort_application(uuid, text, text) from public, anon;
grant execute on function public.review_cohort_application(uuid, text, text) to authenticated, service_role;
