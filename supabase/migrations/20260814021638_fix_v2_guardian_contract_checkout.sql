-- Repair two production blockers in V2 contract checkout without rewriting
-- published contracts or existing application snapshots.
--
-- 1. Local PL/pgSQL signer variables previously shared names with application
--    columns. Existing-draft updates could therefore fail with an ambiguous
--    column reference. The normalized_* names below are explicit and safe.
-- 2. An online offering has no classroom venue by design. When its published
--    contract uses {{location}}, resolve that value from the academy address
--    already locked inside the application's terms snapshot. Offline offerings
--    continue to require their actual snapshotted location.

create or replace function private.build_course_offering_contract_values(
  p_application_id uuid,
  p_contract_number text default null,
  p_contract_date date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  target_application public.course_offering_applications%rowtype;
  target_learner public.learners%rowtype;
  local_contract_date date := coalesce(p_contract_date, timezone('Asia/Ulaanbaatar', now())::date);
  snapshotted_location text;
  snapshotted_academy_address text;
begin
  select application.* into strict target_application
  from public.course_offering_applications application
  where application.id = p_application_id;

  select learner.* into strict target_learner
  from public.learners learner
  where learner.id = target_application.learner_id;

  snapshotted_location := nullif(trim(target_application.terms_snapshot ->> 'location'), '');
  snapshotted_academy_address := nullif(
    trim(target_application.terms_snapshot #>> '{issuer,address}'),
    ''
  );

  return target_application.answers || jsonb_strip_nulls(jsonb_build_object(
    'contract_number', p_contract_number,
    'contract_date', format(
      '%s оны %s-р сарын %s өдөр',
      extract(year from local_contract_date)::integer,
      lpad(extract(month from local_contract_date)::integer::text, 2, '0'),
      lpad(extract(day from local_contract_date)::integer::text, 2, '0')
    ),
    'program_name', target_application.terms_snapshot ->> 'program_name',
    'cohort_name', target_application.terms_snapshot ->> 'offering_name',
    'learning_format', case target_application.terms_snapshot ->> 'delivery_mode'
      when 'online' then 'Цахим'
      when 'offline' then 'Танхим'
    end,
    'schedule', nullif(trim(target_application.terms_snapshot ->> 'schedule_summary'), ''),
    'start_date', target_application.terms_snapshot ->> 'starts_on',
    'end_date', target_application.terms_snapshot ->> 'ends_on',
    'location', case
      when target_application.terms_snapshot ->> 'delivery_mode' = 'online'
        then coalesce(snapshotted_location, snapshotted_academy_address)
      else snapshotted_location
    end,
    'tuition_amount', target_application.tuition_amount_mnt_snapshot::text,
    'payment_plan', nullif(trim(target_application.terms_snapshot ->> 'payment_plan'), ''),
    'academy_name', target_application.terms_snapshot #>> '{issuer,legal_name}',
    'academy_representative', target_application.terms_snapshot #>> '{issuer,representative_name}',
    'academy_phone', target_application.terms_snapshot #>> '{issuer,phone}',
    'academy_address', target_application.terms_snapshot #>> '{issuer,address}',
    'bank_name', target_application.terms_snapshot #>> '{issuer,bank_name}',
    'bank_account_number', target_application.terms_snapshot #>> '{issuer,bank_account_number}',
    'bank_account_holder', target_application.terms_snapshot #>> '{issuer,bank_account_holder}',
    'student_name', target_learner.full_name,
    'student_birth_date', target_learner.birth_date::text,
    'student_registration_number', target_learner.registration_number,
    'signer_name', target_application.signer_full_name,
    'signer_email', target_application.signer_email,
    'signer_phone', target_application.signer_phone,
    'signer_registration_number', target_application.signer_registration_number,
    'signer_relationship', target_application.applicant_relationship,
    'guardian_name', case when target_application.signer_role = 'guardian' then target_application.signer_full_name end,
    'guardian_registration_number', case when target_application.signer_role = 'guardian' then target_application.signer_registration_number end,
    'guardian_relationship', case when target_application.signer_role = 'guardian' then target_application.applicant_relationship end
  ));
end;
$$;

create or replace function public.save_course_offering_checkout_draft(
  p_offering_id uuid,
  p_content_access_user_id uuid,
  p_details jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  target_offering public.training_cohorts%rowtype;
  existing_application public.course_offering_applications%rowtype;
  application_id uuid;
  learner_id uuid;
  parsed_client_request_id uuid;
  schema_version integer;
  learner_name text;
  learner_birth_date date;
  learner_registration_number text;
  normalized_relationship text;
  derived_signer_role text;
  signer_name text;
  normalized_signer_email text;
  normalized_signer_phone text;
  normalized_signer_registration_number text;
  normalized_answers jsonb;
  local_date date := timezone('Asia/Ulaanbaatar', now())::date;
  unknown_keys text[];
  active_count bigint;
  signature_context_unchanged boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Checkout details must be a JSON object.';
  end if;

  select array_agg(key order by key)
  into unknown_keys
  from jsonb_object_keys(p_details) key
  where key <> all(array[
    'schema_version',
    'client_request_id',
    'learner_full_name',
    'learner_birth_date',
    'learner_registration_number',
    'applicant_relationship',
    'signer_full_name',
    'signer_email',
    'signer_phone',
    'signer_registration_number',
    'answers'
  ]::text[]);

  if unknown_keys is not null then
    raise exception 'Unknown checkout detail keys: %', array_to_string(unknown_keys, ', ');
  end if;

  begin
    schema_version := (p_details ->> 'schema_version')::integer;
    parsed_client_request_id := (p_details ->> 'client_request_id')::uuid;
    learner_birth_date := nullif(trim(coalesce(p_details ->> 'learner_birth_date', '')), '')::date;
  exception
    when invalid_text_representation
      or numeric_value_out_of_range
      or datetime_field_overflow then
    raise exception 'The checkout schema version, request identifier or birth date is invalid.';
  end;

  if schema_version <> 1 or parsed_client_request_id is null then
    raise exception 'Checkout details schema version 1 and a client request identifier are required.';
  end if;

  learner_name := nullif(trim(coalesce(p_details ->> 'learner_full_name', '')), '');
  learner_registration_number := nullif(trim(coalesce(p_details ->> 'learner_registration_number', '')), '');
  normalized_relationship := coalesce(nullif(trim(p_details ->> 'applicant_relationship'), ''), 'self');
  signer_name := nullif(trim(coalesce(p_details ->> 'signer_full_name', '')), '');
  normalized_signer_email := nullif(lower(trim(coalesce(p_details ->> 'signer_email', ''))), '');
  normalized_signer_phone := nullif(trim(coalesce(p_details ->> 'signer_phone', '')), '');
  normalized_signer_registration_number := nullif(
    trim(coalesce(p_details ->> 'signer_registration_number', '')),
    ''
  );
  normalized_answers := coalesce(p_details -> 'answers', '{}'::jsonb);

  if learner_name is null or char_length(learner_name) > 240 then
    raise exception 'A valid learner full name is required.';
  end if;

  if normalized_relationship not in ('self', 'parent', 'guardian', 'other') then
    raise exception 'The applicant relationship is invalid.';
  end if;

  if normalized_answers is null or jsonb_typeof(normalized_answers) <> 'object' then
    raise exception 'Checkout answers must be a JSON object.';
  end if;

  if learner_birth_date is not null and learner_birth_date > local_date then
    raise exception 'The learner birth date cannot be in the future.';
  end if;

  select auth_user.email
  into current_email
  from auth.users auth_user
  where auth_user.id = current_user_id;

  if nullif(trim(coalesce(current_email, '')), '') is null then
    raise exception 'The authenticated account has no email address.';
  end if;
  current_email := lower(trim(current_email));

  select cohort.* into target_offering
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  where cohort.id = p_offering_id
    and cohort.checkout_version = 2
    and cohort.status = 'open'
    and cohort.course_id is not null
    and not program.is_archived
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
  for update of cohort;

  if not found then
    raise exception 'This course offering is not accepting applications.';
  end if;

  if target_offering.tuition_amount_mnt is null or target_offering.tuition_amount_mnt <= 0
     or target_offering.payment_due_days is null or target_offering.payment_due_days <= 0 then
    raise exception 'The course offering payment terms are incomplete.';
  end if;

  if not private.course_is_ready(target_offering.course_id) then
    raise exception 'The linked course is not ready for enrollment.';
  end if;

  select count(*) into active_count
  from public.course_offering_enrollments enrollment
  where enrollment.offering_id = target_offering.id
    and enrollment.status = 'active';

  if target_offering.capacity is not null and active_count >= target_offering.capacity then
    raise exception 'This course offering has no available seats.';
  end if;

  if target_offering.contract_policy = 'required' then
    if target_offering.contract_version_id is null or not exists (
      select 1
      from public.contract_template_versions version
      join public.contract_templates template on template.id = version.template_id
      where version.id = target_offering.contract_version_id
        and version.status = 'published'
        and not template.is_archived
    ) then
      raise exception 'A published contract version is required for this offering.';
    end if;

    if learner_birth_date is null or learner_registration_number is null then
      raise exception 'Learner birth date and registration number are required for the contract.';
    end if;

    derived_signer_role := case
      when learner_birth_date + interval '18 years' <= local_date then 'self'
      else 'guardian'
    end;

    if signer_name is null
       or normalized_signer_email is null
       or normalized_signer_phone is null
       or normalized_signer_registration_number is null then
      raise exception 'The contract signer information is incomplete.';
    end if;

    if derived_signer_role = 'self' then
      if normalized_relationship <> 'self' then
        raise exception 'An adult learner must accept their own contract.';
      end if;
      if lower(regexp_replace(signer_name, '\s+', ' ', 'g'))
         <> lower(regexp_replace(learner_name, '\s+', ' ', 'g')) then
        raise exception 'The adult signer name must match the learner name.';
      end if;
      if normalized_signer_registration_number <> learner_registration_number then
        raise exception 'The adult signer registration number must match the learner registration number.';
      end if;
      if normalized_signer_email <> current_email then
        raise exception 'The adult signer email must match the authenticated account email.';
      end if;
    elsif normalized_relationship not in ('parent', 'guardian') then
      raise exception 'A learner under 18 must be represented by a parent or legal guardian.';
    end if;

    normalized_answers := private.merge_course_offering_participant_answers(
      target_offering.contract_version_id,
      normalized_answers,
      learner_name,
      learner_birth_date,
      learner_registration_number,
      signer_name,
      normalized_signer_email,
      normalized_signer_phone,
      normalized_signer_registration_number,
      normalized_relationship
    );
    normalized_answers := private.validate_cohort_application_answers(
      target_offering.contract_version_id,
      normalized_answers,
      false
    );
  else
    derived_signer_role := null;
    signer_name := null;
    normalized_signer_email := null;
    normalized_signer_phone := null;
    normalized_signer_registration_number := null;
    normalized_answers := '{}'::jsonb;
  end if;

  select application.* into existing_application
  from public.course_offering_applications application
  where application.applicant_user_id = current_user_id
    and application.client_request_id = parsed_client_request_id
  for update;

  if found then
    if existing_application.offering_id <> target_offering.id
       or existing_application.content_access_user_id <> p_content_access_user_id then
      raise exception 'The client request identifier already belongs to another checkout.';
    end if;
    if p_content_access_user_id is distinct from current_user_id and not exists (
      select 1
      from public.learner_account_links account_link
      where account_link.learner_id = existing_application.learner_id
        and account_link.user_id = p_content_access_user_id
        and account_link.status = 'verified'
    ) then
      raise exception 'Content access may only be assigned to the applicant or a verified learner account.';
    end if;
    if existing_application.status <> 'draft' then
      raise exception 'This checkout can no longer be edited.';
    end if;
    if exists (
      select 1
      from public.course_offering_contract_acceptances acceptance
      where acceptance.application_id = existing_application.id
    ) then
      raise exception 'The accepted contract checkout can no longer be edited.';
    end if;

    learner_id := existing_application.learner_id;
    select
      learner.full_name is not distinct from learner_name
      and learner.birth_date is not distinct from learner_birth_date
      and learner.registration_number is not distinct from learner_registration_number
      and existing_application.applicant_relationship is not distinct from normalized_relationship
      and existing_application.signer_role is not distinct from derived_signer_role
      and existing_application.signer_full_name is not distinct from signer_name
      and existing_application.signer_email is not distinct from normalized_signer_email
      and existing_application.signer_phone is not distinct from normalized_signer_phone
      and existing_application.signer_registration_number is not distinct from normalized_signer_registration_number
      and existing_application.answers is not distinct from normalized_answers
    into signature_context_unchanged
    from public.learners learner
    where learner.id = learner_id;

    if not found then
      raise exception 'The learner linked to this checkout does not exist.';
    end if;

    update public.learners
    set
      full_name = learner_name,
      birth_date = learner_birth_date,
      registration_number = learner_registration_number
    where id = learner_id;

    update public.course_offering_applications
    set
      applicant_relationship = normalized_relationship,
      signer_role = derived_signer_role,
      signer_full_name = signer_name,
      signer_email = normalized_signer_email,
      signer_phone = normalized_signer_phone,
      signer_registration_number = normalized_signer_registration_number,
      answers = normalized_answers,
      signature_policy_required = case
        when signature_context_unchanged then signature_policy_required else null
      end,
      signature_policy_reason = case
        when signature_context_unchanged then signature_policy_reason else null
      end,
      signature_policy_session_id = case
        when signature_context_unchanged then signature_policy_session_id else null
      end,
      signature_policy_evaluated_at = case
        when signature_context_unchanged then signature_policy_evaluated_at else null
      end,
      signature_verification_sent_at = case
        when signature_context_unchanged then signature_verification_sent_at else null
      end
    where id = existing_application.id
    returning id into application_id;

    return application_id;
  end if;

  if p_content_access_user_id is distinct from current_user_id then
    raise exception 'A new checkout must grant content to the authenticated account.';
  end if;

  insert into public.learners (
    full_name,
    birth_date,
    registration_number,
    created_by_user_id
  ) values (
    learner_name,
    learner_birth_date,
    learner_registration_number,
    current_user_id
  ) returning id into learner_id;

  insert into public.learner_account_links (
    learner_id,
    user_id,
    relationship,
    status,
    created_by_user_id,
    verified_at
  ) values (
    learner_id,
    current_user_id,
    normalized_relationship,
    case when normalized_relationship = 'self' then 'verified' else 'declared' end,
    current_user_id,
    case when normalized_relationship = 'self' then now() else null end
  );

  insert into public.course_offering_applications (
    client_request_id,
    offering_id,
    learner_id,
    applicant_user_id,
    content_access_user_id,
    course_id_snapshot,
    contract_policy_snapshot,
    contract_version_id,
    tuition_amount_mnt_snapshot,
    payment_due_days_snapshot,
    payment_due_at,
    contact_email,
    applicant_relationship,
    signer_role,
    signer_full_name,
    signer_email,
    signer_phone,
    signer_registration_number,
    answers,
    terms_snapshot
  ) values (
    parsed_client_request_id,
    target_offering.id,
    learner_id,
    current_user_id,
    p_content_access_user_id,
    target_offering.course_id,
    target_offering.contract_policy,
    target_offering.contract_version_id,
    target_offering.tuition_amount_mnt,
    target_offering.payment_due_days,
    now() + make_interval(days => target_offering.payment_due_days),
    current_email,
    normalized_relationship,
    derived_signer_role,
    signer_name,
    normalized_signer_email,
    normalized_signer_phone,
    normalized_signer_registration_number,
    normalized_answers,
    private.build_course_offering_terms_snapshot(target_offering.id)
  ) returning id into application_id;

  return application_id;
exception
  when unique_violation then
    -- Preserve the original idempotency boundary for concurrent retries.
    select application.* into existing_application
    from public.course_offering_applications application
    where application.applicant_user_id = current_user_id
      and application.client_request_id = parsed_client_request_id;

    if found
       and existing_application.offering_id = p_offering_id
       and existing_application.content_access_user_id = p_content_access_user_id then
      return existing_application.id;
    end if;

    raise exception 'The client request identifier already belongs to another checkout.';
end;
$$;
