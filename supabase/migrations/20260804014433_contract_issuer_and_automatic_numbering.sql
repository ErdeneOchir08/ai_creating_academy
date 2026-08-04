create table public.contract_issuer_profile (
  id boolean primary key default true check (id),
  legal_name text not null check (char_length(trim(legal_name)) between 1 and 240),
  representative_name text not null check (char_length(trim(representative_name)) between 1 and 240),
  phone text not null check (char_length(trim(phone)) between 1 and 50),
  address text not null check (char_length(trim(address)) between 1 and 500),
  bank_name text not null check (char_length(trim(bank_name)) between 1 and 120),
  bank_account_number text not null check (char_length(trim(bank_account_number)) between 1 and 80),
  bank_account_holder text not null check (char_length(trim(bank_account_holder)) between 1 and 240),
  updated_at timestamptz not null default now()
);

insert into public.contract_issuer_profile (
  id,
  legal_name,
  representative_name,
  phone,
  address,
  bank_name,
  bank_account_number,
  bank_account_holder
) values (
  true,
  'Майнд Аженси Эл И ХХК',
  'Ж.Эрдэнэчимэг',
  '+976 8045 6060',
  'СБД, 1 хороо, орос элчин, 1 сургуулийн замын урд TWIN TOWER-1, 502 тоот, Ulaanbaatar, Mongolia, 15141',
  'Хаан банк',
  'MN560005005475336658',
  'Майнд Аженси Эл И'
);

alter table public.contract_issuer_profile enable row level security;

revoke all on table public.contract_issuer_profile from anon, authenticated;
grant select, update on table public.contract_issuer_profile to authenticated;
grant all on table public.contract_issuer_profile to service_role;

create policy "contract issuer profile: admins read"
on public.contract_issuer_profile
for select
to authenticated
using ((select private.is_admin()));

create policy "contract issuer profile: admins update"
on public.contract_issuer_profile
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create table private.contract_number_sequences (
  contract_year integer primary key check (contract_year between 2000 and 9999),
  last_number bigint not null check (last_number >= 0),
  updated_at timestamptz not null default now()
);

-- The supplied production contract confirms that 26/64 is the latest issued
-- number for 2026. The first automatically allocated number will therefore be
-- 26/65. This is migration data, not application logic.
insert into private.contract_number_sequences (contract_year, last_number)
values (2026, 64)
on conflict (contract_year) do update
set last_number = greatest(private.contract_number_sequences.last_number, excluded.last_number);

revoke all on table private.contract_number_sequences from public, anon, authenticated;
grant all on table private.contract_number_sequences to service_role;

alter table public.cohort_application_contract_snapshots
add column contract_number text not null unique
  check (contract_number ~ '^[0-9]{2}/[1-9][0-9]*$'),
add column contract_date date not null;

create or replace function private.allocate_contract_number(p_created_at timestamptz)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  local_contract_date date := (p_created_at at time zone 'Asia/Ulaanbaatar')::date;
  sequence_year integer := extract(year from local_contract_date)::integer;
  allocated_number bigint;
begin
  insert into private.contract_number_sequences (contract_year, last_number, updated_at)
  values (sequence_year, 1, p_created_at)
  on conflict (contract_year) do update
  set
    last_number = private.contract_number_sequences.last_number + 1,
    updated_at = excluded.updated_at
  returning last_number into allocated_number;

  return right(sequence_year::text, 2) || '/' || allocated_number::text;
end;
$$;

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
  issuer public.contract_issuer_profile%rowtype;
  required_keys text[];
  unresolved_keys text[];
  snapshot_values jsonb;
  snapshot_id uuid;
  local_contract_date date := (p_created_at at time zone 'Asia/Ulaanbaatar')::date;
  allocated_contract_number text;
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

  select profile.* into strict academy
  from public.academy_profile profile
  where profile.id = true;

  select profile.* into strict issuer
  from public.contract_issuer_profile profile
  where profile.id = true;

  allocated_contract_number := private.allocate_contract_number(p_created_at);

  select coalesce(array_agg(variable_key order by variable_key), '{}'::text[])
  into required_keys
  from (
    select distinct match[1] as variable_key
    from regexp_matches(target_contract.content, '\{\{([a-z][a-z0-9_]*)\}\}', 'g') as match
  ) variables;

  snapshot_values := target_application.answers || jsonb_strip_nulls(jsonb_build_object(
    'contract_number', allocated_contract_number,
    'contract_date', format(
      '%s оны %s-р сарын %s өдөр',
      extract(year from local_contract_date)::integer,
      lpad(extract(month from local_contract_date)::integer::text, 2, '0'),
      lpad(extract(day from local_contract_date)::integer::text, 2, '0')
    ),
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
    'academy_name', nullif(trim(issuer.legal_name), ''),
    'academy_representative', nullif(trim(issuer.representative_name), ''),
    'academy_phone', nullif(trim(issuer.phone), ''),
    'academy_address', nullif(trim(issuer.address), ''),
    'bank_name', nullif(trim(issuer.bank_name), ''),
    'bank_account_number', nullif(trim(issuer.bank_account_number), ''),
    'bank_account_holder', nullif(trim(issuer.bank_account_holder), '')
  ));

  select coalesce(array_agg(variable_key order by variable_key), '{}'::text[])
  into unresolved_keys
  from unnest(required_keys) variable_key
  where nullif(trim(snapshot_values ->> variable_key), '') is null;

  if cardinality(unresolved_keys) > 0 then
    raise exception 'Contract variables are unresolved: %', array_to_string(unresolved_keys, ', ');
  end if;

  insert into public.cohort_application_contract_snapshots (
    application_id,
    applicant_user_id,
    cohort_id,
    contract_version_id,
    contract_title,
    contract_version_number,
    contract_number,
    contract_date,
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
    allocated_contract_number,
    local_contract_date,
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
      'website_url', academy.website_url,
      'legal_name', issuer.legal_name,
      'representative_name', issuer.representative_name,
      'contract_phone', issuer.phone,
      'contract_address', issuer.address,
      'bank_name', issuer.bank_name,
      'bank_account_number', issuer.bank_account_number,
      'bank_account_holder', issuer.bank_account_holder
    ),
    p_created_by,
    p_created_at
  )
  returning id into snapshot_id;

  return snapshot_id;
end;
$$;

revoke all on function private.allocate_contract_number(timestamptz) from public, anon, authenticated;
revoke all on function private.create_approved_application_contract_snapshot(uuid, uuid, timestamptz) from public, anon, authenticated;
