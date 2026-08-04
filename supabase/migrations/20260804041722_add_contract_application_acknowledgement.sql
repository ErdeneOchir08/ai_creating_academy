alter table public.cohort_applications
add column contract_acknowledged_at timestamptz;

-- Preserve the closest available acknowledgement evidence for any application
-- that was submitted before this column existed.
update public.cohort_applications
set contract_acknowledged_at = submitted_at
where status in ('submitted', 'approved', 'rejected');

alter table public.cohort_applications
add constraint cohort_applications_contract_acknowledgement_check
check (
  (status in ('draft', 'withdrawn') and contract_acknowledged_at is null)
  or
  (status in ('submitted', 'approved', 'rejected') and contract_acknowledged_at is not null)
);

create or replace function public.get_open_cohort_application_form(p_cohort_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  current_user_id uuid := (select auth.uid());
begin
  select jsonb_build_object(
    'cohort_id', cohort.id,
    'program_name', program.name,
    'program_description', program.description,
    'cohort_name', cohort.name,
    'delivery_mode', cohort.delivery_mode,
    'capacity', cohort.capacity,
    'approved_count', count(application_count.id) filter (where application_count.status = 'approved'),
    'tuition_amount_mnt', cohort.tuition_amount_mnt,
    'payment_plan', cohort.payment_plan,
    'schedule_summary', cohort.schedule_summary,
    'location', cohort.location,
    'registration_closes_at', cohort.registration_closes_at,
    'starts_on', cohort.starts_on,
    'ends_on', cohort.ends_on,
    'contract_title', contract_version.title,
    'contract_version_number', contract_version.version_number,
    'contract_content', contract_version.content,
    'contract_preview_values', jsonb_strip_nulls(jsonb_build_object(
      'contract_number', 'Зөвшөөрөх үед үүснэ',
      'contract_date', 'Зөвшөөрсөн өдөр',
      'program_name', program.name,
      'cohort_name', cohort.name,
      'learning_format', case cohort.delivery_mode
        when 'online' then 'Цахим'
        when 'offline' then 'Танхим'
        when 'hybrid' then 'Хосолсон'
      end,
      'schedule', nullif(trim(cohort.schedule_summary), ''),
      'start_date', cohort.starts_on::text,
      'end_date', cohort.ends_on::text,
      'location', nullif(trim(cohort.location), ''),
      'tuition_amount', cohort.tuition_amount_mnt::text,
      'payment_plan', nullif(trim(cohort.payment_plan), ''),
      'academy_name', nullif(trim(issuer.legal_name), ''),
      'academy_representative', nullif(trim(issuer.representative_name), ''),
      'academy_phone', nullif(trim(issuer.phone), ''),
      'academy_address', nullif(trim(issuer.address), ''),
      'bank_name', nullif(trim(issuer.bank_name), ''),
      'bank_account_number', nullif(trim(issuer.bank_account_number), ''),
      'bank_account_holder', nullif(trim(issuer.bank_account_holder), '')
    )),
    'is_accepting_applications', (
      cohort.status = 'open'
      and not program.is_archived
      and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
      and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
      and (
        cohort.capacity is null
        or count(application_count.id) filter (where application_count.status = 'approved') < cohort.capacity
      )
    ),
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', variable.key,
        'label', variable.label_mn,
        'description', variable.description_mn
      ) order by variable.key)
      from (
        select distinct variable.key, variable.label_mn, variable.description_mn
        from regexp_matches(
          contract_version.content,
          '\{\{([a-z][a-z0-9_]*)\}\}',
          'g'
        ) as variable_match
        join public.contract_variables variable
          on variable.key = variable_match[1]
         and variable.category = 'participant'
         and variable.is_active
      ) variable
    ), '[]'::jsonb),
    'my_application', case when current_user_id is null then null else (
      select jsonb_build_object(
        'id', own_application.id,
        'status', own_application.status,
        'answers', own_application.answers,
        'rejection_reason', own_application.rejection_reason,
        'submitted_at', own_application.submitted_at,
        'contract_acknowledged_at', own_application.contract_acknowledged_at,
        'updated_at', own_application.updated_at
      )
      from public.cohort_applications own_application
      where own_application.cohort_id = cohort.id
        and own_application.applicant_user_id = current_user_id
    ) end
  )
  into result
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  join public.contract_template_versions contract_version on contract_version.id = cohort.contract_version_id
  join public.contract_issuer_profile issuer on issuer.id = true
  left join public.cohort_applications application_count on application_count.cohort_id = cohort.id
  where cohort.id = p_cohort_id
    and contract_version.status in ('published', 'retired')
    and (
      (
        cohort.status = 'open'
        and not program.is_archived
        and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
        and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
      )
      or (
        current_user_id is not null
        and exists (
          select 1
          from public.cohort_applications existing_application
          where existing_application.cohort_id = cohort.id
            and existing_application.applicant_user_id = current_user_id
        )
      )
    )
  group by cohort.id, program.id, contract_version.id, issuer.id;

  if result is null then
    return null;
  end if;

  if not (result ->> 'is_accepting_applications')::boolean
     and result -> 'my_application' = 'null'::jsonb then
    return null;
  end if;

  return result;
end;
$$;

create or replace function public.save_cohort_application_draft(p_cohort_id uuid, p_answers jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  target_cohort public.training_cohorts%rowtype;
  normalized_answers jsonb;
  application_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select email into current_email from auth.users where id = current_user_id;
  if nullif(trim(coalesce(current_email, '')), '') is null then
    raise exception 'The authenticated account has no email address.';
  end if;

  select cohort.* into target_cohort
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  where cohort.id = p_cohort_id
    and cohort.status = 'open'
    and not program.is_archived
    and cohort.contract_version_id is not null
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
  for share of cohort;

  if not found then
    raise exception 'This cohort is not accepting applications.';
  end if;

  normalized_answers := private.validate_cohort_application_answers(
    target_cohort.contract_version_id,
    coalesce(p_answers, '{}'::jsonb),
    false
  );

  insert into public.cohort_applications (
    cohort_id,
    applicant_user_id,
    contract_version_id,
    contact_email,
    answers
  ) values (
    target_cohort.id,
    current_user_id,
    target_cohort.contract_version_id,
    lower(trim(current_email)),
    normalized_answers
  )
  on conflict (cohort_id, applicant_user_id) do update
  set
    status = 'draft',
    answers = excluded.answers,
    contract_acknowledged_at = null
  where public.cohort_applications.status in ('draft', 'rejected', 'withdrawn')
  returning id into application_id;

  if application_id is null then
    raise exception 'This application cannot be edited in its current status.';
  end if;

  return application_id;
end;
$$;

drop function public.submit_cohort_application(uuid);

create function public.submit_cohort_application(
  p_application_id uuid,
  p_contract_acknowledged boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_application public.cohort_applications%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_contract_acknowledged is distinct from true then
    raise exception 'Contract acknowledgement is required.';
  end if;

  select application.* into target_application
  from public.cohort_applications application
  join public.training_cohorts cohort on cohort.id = application.cohort_id
  join public.training_programs program on program.id = cohort.program_id
  where application.id = p_application_id
    and application.applicant_user_id = current_user_id
    and application.status = 'draft'
    and cohort.status = 'open'
    and not program.is_archived
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
  for update of application;

  if not found then
    raise exception 'The draft application is not available for submission.';
  end if;

  perform private.validate_cohort_application_answers(
    target_application.contract_version_id,
    target_application.answers,
    true
  );

  update public.cohort_applications
  set
    status = 'submitted',
    contract_acknowledged_at = now()
  where id = target_application.id;
end;
$$;

revoke all on function public.submit_cohort_application(uuid, boolean) from public, anon;
grant execute on function public.submit_cohort_application(uuid, boolean) to authenticated, service_role;

create or replace function public.withdraw_cohort_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  update public.cohort_applications
  set
    status = 'withdrawn',
    contract_acknowledged_at = null
  where id = p_application_id
    and applicant_user_id = (select auth.uid())
    and status in ('draft', 'submitted');

  if not found then
    raise exception 'The application cannot be withdrawn.';
  end if;
end;
$$;

create or replace function private.capture_contract_snapshot_application_details()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select jsonb_build_object(
    'contact_email', application.contact_email,
    'status', application.status,
    'submitted_at', application.submitted_at,
    'contract_acknowledged_at', application.contract_acknowledged_at,
    'reviewed_at', application.reviewed_at,
    'created_at', application.created_at,
    'updated_at', application.updated_at
  )
  into new.application_details
  from public.cohort_applications application
  where application.id = new.application_id;

  if not found then
    raise exception 'The source application is required to create a contract snapshot.';
  end if;

  return new;
end;
$$;

alter table public.cohort_application_contract_snapshots
disable trigger cohort_contract_snapshots_immutable;

update public.cohort_application_contract_snapshots snapshot
set application_details = snapshot.application_details || jsonb_build_object(
  'contract_acknowledged_at', application.contract_acknowledged_at
)
from public.cohort_applications application
where application.id = snapshot.application_id;

alter table public.cohort_application_contract_snapshots
enable trigger cohort_contract_snapshots_immutable;

revoke all on function private.capture_contract_snapshot_application_details() from public, anon, authenticated;
