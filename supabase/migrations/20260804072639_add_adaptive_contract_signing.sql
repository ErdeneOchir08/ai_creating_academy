insert into public.contract_variables (key, label_mn, description_mn, category)
values
  (
    'student_birth_date',
    'Суралцагчийн төрсөн огноо',
    'Суралцагч өөрөө эсвэл асран хамгаалагч гарын үсэг зурахыг тодорхойлоход ашиглах төрсөн огноо.',
    'participant'
  ),
  (
    'signer_name',
    'Гэрээнд гарын үсэг зурах хүний нэр',
    'Суралцагч өөрөө эсвэл түүнийг төлөөлөх эцэг, эх, хууль ёсны асран хамгаалагчийн бүтэн нэр.',
    'participant'
  ),
  (
    'signer_email',
    'Гэрээнд гарын үсэг зурах хүний и-мэйл',
    'Гарын үсгийн баталгаажуулалт хүлээн авах и-мэйл хаяг.',
    'participant'
  ),
  (
    'signer_registration_number',
    'Гэрээнд гарын үсэг зурах хүний регистр',
    'Суралцагч өөрөө эсвэл хууль ёсны төлөөлөгчийн регистрийн дугаар.',
    'participant'
  ),
  (
    'signer_relationship',
    'Суралцагчтай хамаарах холбоо',
    'Өөрөө, эцэг, эх эсвэл хууль ёсны асран хамгаалагчийн холбоо.',
    'participant'
  )
on conflict (key) do update
set
  label_mn = excluded.label_mn,
  description_mn = excluded.description_mn,
  category = excluded.category,
  is_active = true;

alter table public.cohort_applications
add column student_birth_date date,
add column signer_role text check (signer_role in ('self', 'guardian')),
add column signer_name text check (signer_name is null or char_length(trim(signer_name)) between 1 and 240),
add column signer_email text check (signer_email is null or char_length(trim(signer_email)) between 3 and 320),
add column signer_phone text check (signer_phone is null or char_length(trim(signer_phone)) between 1 and 50),
add column signer_registration_number text check (
  signer_registration_number is null
  or char_length(trim(signer_registration_number)) between 1 and 50
),
add column signer_relationship text check (
  signer_relationship is null
  or char_length(trim(signer_relationship)) between 1 and 120
),
add column signed_at timestamptz,
add column signature_method text check (signature_method in ('authenticated_account', 'email_otp')),
add column signer_email_verified_at timestamptz,
add column signature_statement text check (
  signature_statement is null
  or char_length(trim(signature_statement)) between 1 and 1_000
),
add column signature_statement_version text check (
  signature_statement_version is null
  or char_length(trim(signature_statement_version)) between 1 and 50
),
add column signature_verification_sent_at timestamptz;

alter table public.cohort_applications
drop constraint cohort_applications_contract_acknowledgement_check;

alter table public.cohort_applications
add constraint cohort_applications_signature_evidence_check
check (
  (
    status in ('draft', 'withdrawn')
    and contract_acknowledged_at is null
    and signed_at is null
    and signature_method is null
    and signer_email_verified_at is null
    and signature_statement is null
    and signature_statement_version is null
  )
  or
  (
    status in ('submitted', 'approved', 'rejected')
    and student_birth_date is not null
    and signer_role is not null
    and nullif(trim(coalesce(signer_name, '')), '') is not null
    and nullif(trim(coalesce(signer_email, '')), '') is not null
    and nullif(trim(coalesce(signer_phone, '')), '') is not null
    and nullif(trim(coalesce(signer_registration_number, '')), '') is not null
    and nullif(trim(coalesce(signer_relationship, '')), '') is not null
    and contract_acknowledged_at is not null
    and signed_at is not null
    and contract_acknowledged_at = signed_at
    and signature_method is not null
    and signer_email_verified_at is not null
    and nullif(trim(coalesce(signature_statement, '')), '') is not null
    and nullif(trim(coalesce(signature_statement_version, '')), '') is not null
  )
);

create index cohort_applications_signed_at_idx
on public.cohort_applications (signed_at desc)
where signed_at is not null;

create or replace function private.merge_contract_signer_answers(
  p_contract_version_id uuid,
  p_answers jsonb,
  p_student_birth_date date,
  p_signer_name text,
  p_signer_email text,
  p_signer_phone text,
  p_signer_registration_number text,
  p_signer_relationship text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  merged_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  available_keys text[];
  value_map jsonb;
  answer_key text;
begin
  select coalesce(array_agg(distinct variable_match[1]), '{}'::text[])
  into available_keys
  from public.contract_template_versions version
  cross join lateral regexp_matches(
    version.content,
    '\{\{([a-z][a-z0-9_]*)\}\}',
    'g'
  ) as variable_match
  where version.id = p_contract_version_id;

  value_map := jsonb_strip_nulls(jsonb_build_object(
    'student_birth_date', p_student_birth_date::text,
    'signer_name', nullif(trim(p_signer_name), ''),
    'signer_email', nullif(lower(trim(p_signer_email)), ''),
    'signer_phone', nullif(trim(p_signer_phone), ''),
    'signer_registration_number', nullif(trim(p_signer_registration_number), ''),
    'signer_relationship', nullif(trim(p_signer_relationship), ''),
    -- These aliases keep existing guardian-oriented templates compatible while
    -- newer templates can use the generic signer_* variables above.
    'guardian_name', nullif(trim(p_signer_name), ''),
    'guardian_registration_number', nullif(trim(p_signer_registration_number), ''),
    'guardian_relationship', nullif(trim(p_signer_relationship), '')
  ));

  foreach answer_key in array available_keys
  loop
    if value_map ? answer_key then
      merged_answers := merged_answers || jsonb_build_object(answer_key, value_map ->> answer_key);
    end if;
  end loop;

  return merged_answers;
end;
$$;

create or replace function private.enforce_cohort_application_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cohort_contract_version_id uuid;
  signing_evidence_changed boolean;
  signer_identity_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New applications must begin as drafts.';
    end if;

    select contract_version_id
    into cohort_contract_version_id
    from public.training_cohorts
    where id = new.cohort_id;

    if cohort_contract_version_id is null or new.contract_version_id <> cohort_contract_version_id then
      raise exception 'The application must use the cohort contract version.';
    end if;

    if new.student_birth_date is not null
       and new.student_birth_date > timezone('Asia/Ulaanbaatar', now())::date then
      raise exception 'The student birth date cannot be in the future.';
    end if;

    new.answers := private.validate_cohort_application_answers(new.contract_version_id, new.answers, false);
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.cohort_id is distinct from old.cohort_id
     or new.applicant_user_id is distinct from old.applicant_user_id
     or new.contract_version_id is distinct from old.contract_version_id
     or new.contact_email is distinct from old.contact_email
     or new.created_at is distinct from old.created_at then
    raise exception 'Application identity, cohort, contract, and applicant are immutable.';
  end if;

  if old.status = 'approved' then
    raise exception 'Approved applications are immutable.';
  end if;

  if new.student_birth_date is not null
     and new.student_birth_date > timezone('Asia/Ulaanbaatar', now())::date then
    raise exception 'The student birth date cannot be in the future.';
  end if;

  if (new.answers is distinct from old.answers or new.student_birth_date is distinct from old.student_birth_date)
     and not (old.status in ('draft', 'rejected', 'withdrawn') and new.status in ('draft', 'submitted')) then
    raise exception 'Application details may only be edited before submission.';
  end if;

  signing_evidence_changed :=
    new.contract_acknowledged_at is distinct from old.contract_acknowledged_at
    or new.signed_at is distinct from old.signed_at
    or new.signature_method is distinct from old.signature_method
    or new.signer_email_verified_at is distinct from old.signer_email_verified_at
    or new.signature_statement is distinct from old.signature_statement
    or new.signature_statement_version is distinct from old.signature_statement_version;

  if signing_evidence_changed
     and not (old.status = 'draft' and new.status = 'submitted') then
    raise exception 'Contract signing evidence may only be created during submission.';
  end if;

  signer_identity_changed :=
    new.signer_role is distinct from old.signer_role
    or new.signer_name is distinct from old.signer_name
    or new.signer_email is distinct from old.signer_email
    or new.signer_phone is distinct from old.signer_phone
    or new.signer_registration_number is distinct from old.signer_registration_number
    or new.signer_relationship is distinct from old.signer_relationship;

  if signer_identity_changed
     and not (old.status in ('draft', 'rejected', 'withdrawn') and new.status in ('draft', 'submitted')) then
    raise exception 'Contract signer details may only be edited before submission.';
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'submitted', 'withdrawn') then
    raise exception 'Invalid application status transition.';
  elsif old.status = 'submitted' and new.status not in ('submitted', 'approved', 'rejected', 'withdrawn') then
    raise exception 'Invalid application status transition.';
  elsif old.status = 'rejected' and new.status not in ('rejected', 'draft') then
    raise exception 'Invalid application status transition.';
  elsif old.status = 'withdrawn' and new.status not in ('withdrawn', 'draft') then
    raise exception 'Invalid application status transition.';
  end if;

  if new.status in ('draft', 'withdrawn') then
    new.submitted_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
    new.contract_acknowledged_at := null;
    new.signed_at := null;
    new.signature_method := null;
    new.signer_email_verified_at := null;
    new.signature_statement := null;
    new.signature_statement_version := null;
  elsif new.status = 'submitted' and old.status <> 'submitted' then
    new.submitted_at := now();
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
  elsif new.status in ('approved', 'rejected') then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;

  new.answers := private.validate_cohort_application_answers(
    new.contract_version_id,
    new.answers,
    new.status in ('submitted', 'approved', 'rejected')
  );
  new.updated_at := now();
  return new;
end;
$$;

drop function public.save_cohort_application_draft(uuid, jsonb);

create function public.save_cohort_application_draft(
  p_cohort_id uuid,
  p_answers jsonb,
  p_student_birth_date date,
  p_signer_name text,
  p_signer_email text,
  p_signer_phone text,
  p_signer_registration_number text,
  p_signer_relationship text
)
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
  local_date date := timezone('Asia/Ulaanbaatar', now())::date;
  derived_signer_role text;
  normalized_signer_email text;
  normalized_signer_registration_number text;
  normalized_signer_relationship text;
  application_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select email into current_email from auth.users where id = current_user_id;
  if nullif(trim(coalesce(current_email, '')), '') is null then
    raise exception 'The authenticated account has no email address.';
  end if;

  if p_student_birth_date is not null and p_student_birth_date > local_date then
    raise exception 'The student birth date cannot be in the future.';
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

  if p_student_birth_date is not null then
    derived_signer_role := case
      when p_student_birth_date + interval '18 years' <= local_date then 'self'
      else 'guardian'
    end;
  end if;

  if derived_signer_role = 'self' then
    normalized_signer_email := lower(trim(current_email));
    normalized_signer_registration_number := nullif(trim(coalesce(p_answers ->> 'student_registration_number', '')), '');
    normalized_signer_relationship := 'Өөрөө';
  else
    normalized_signer_email := nullif(lower(trim(coalesce(p_signer_email, ''))), '');
    normalized_signer_registration_number := nullif(trim(coalesce(p_signer_registration_number, '')), '');
    normalized_signer_relationship := nullif(trim(coalesce(p_signer_relationship, '')), '');
  end if;

  normalized_answers := private.merge_contract_signer_answers(
    target_cohort.contract_version_id,
    coalesce(p_answers, '{}'::jsonb),
    p_student_birth_date,
    p_signer_name,
    normalized_signer_email,
    p_signer_phone,
    normalized_signer_registration_number,
    normalized_signer_relationship
  );
  normalized_answers := private.validate_cohort_application_answers(
    target_cohort.contract_version_id,
    normalized_answers,
    false
  );

  insert into public.cohort_applications (
    cohort_id,
    applicant_user_id,
    contract_version_id,
    contact_email,
    answers,
    student_birth_date,
    signer_role,
    signer_name,
    signer_email,
    signer_phone,
    signer_registration_number,
    signer_relationship
  ) values (
    target_cohort.id,
    current_user_id,
    target_cohort.contract_version_id,
    lower(trim(current_email)),
    normalized_answers,
    p_student_birth_date,
    derived_signer_role,
    nullif(trim(coalesce(p_signer_name, '')), ''),
    normalized_signer_email,
    nullif(trim(coalesce(p_signer_phone, '')), ''),
    normalized_signer_registration_number,
    normalized_signer_relationship
  )
  on conflict (cohort_id, applicant_user_id) do update
  set
    status = 'draft',
    answers = excluded.answers,
    student_birth_date = excluded.student_birth_date,
    signer_role = excluded.signer_role,
    signer_name = excluded.signer_name,
    signer_email = excluded.signer_email,
    signer_phone = excluded.signer_phone,
    signer_registration_number = excluded.signer_registration_number,
    signer_relationship = excluded.signer_relationship,
    signature_verification_sent_at = case
      when public.cohort_applications.signer_email is distinct from excluded.signer_email then null
      else public.cohort_applications.signature_verification_sent_at
    end
  where public.cohort_applications.status in ('draft', 'rejected', 'withdrawn')
  returning id into application_id;

  if application_id is null then
    raise exception 'This application cannot be edited in its current status.';
  end if;

  return application_id;
end;
$$;

drop function public.submit_cohort_application(uuid, boolean);

create function public.get_contract_signature_verification_policy(
  p_applicant_user_id uuid,
  p_session_id uuid,
  p_application_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_email text;
  account_email_confirmed_at timestamptz;
  session_created_at timestamptz;
  target_signer_email text;
  verification_required boolean;
  verification_reason text;
begin
  select application.signer_email
  into target_signer_email
  from public.cohort_applications application
  where application.id = p_application_id
    and application.applicant_user_id = p_applicant_user_id
    and application.status = 'draft';

  if not found or nullif(trim(coalesce(target_signer_email, '')), '') is null then
    raise exception 'A prepared draft application is required.';
  end if;

  select auth_user.email, auth_user.email_confirmed_at
  into account_email, account_email_confirmed_at
  from auth.users auth_user
  where auth_user.id = p_applicant_user_id;

  select session.created_at
  into session_created_at
  from auth.sessions session
  where session.id = p_session_id
    and session.user_id = p_applicant_user_id;

  if account_email_confirmed_at is null then
    verification_required := true;
    verification_reason := 'account_email_unverified';
  elsif lower(trim(target_signer_email)) <> lower(trim(coalesce(account_email, ''))) then
    verification_required := true;
    verification_reason := 'different_signer_email';
  elsif session_created_at is null or session_created_at < now() - interval '24 hours' then
    verification_required := true;
    verification_reason := 'session_not_recent';
  else
    verification_required := false;
    verification_reason := 'recent_verified_account';
  end if;

  return jsonb_build_object(
    'verification_required', verification_required,
    'reason', verification_reason,
    'signer_email', lower(trim(target_signer_email))
  );
end;
$$;

create function public.finalize_cohort_contract_signature(
  p_application_id uuid,
  p_applicant_user_id uuid,
  p_signature_method text,
  p_signature_statement text,
  p_signature_statement_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_application public.cohort_applications%rowtype;
  local_date date := timezone('Asia/Ulaanbaatar', now())::date;
  student_name text;
  student_registration_number text;
  expected_signer_role text;
  signed_answers jsonb;
  signing_time timestamptz := now();
begin
  if p_signature_method not in ('authenticated_account', 'email_otp') then
    raise exception 'The contract signature method is invalid.';
  end if;

  if nullif(trim(coalesce(p_signature_statement, '')), '') is null
     or nullif(trim(coalesce(p_signature_statement_version, '')), '') is null then
    raise exception 'The contract signature statement is required.';
  end if;

  select application.* into target_application
  from public.cohort_applications application
  join public.training_cohorts cohort on cohort.id = application.cohort_id
  join public.training_programs program on program.id = cohort.program_id
  where application.id = p_application_id
    and application.applicant_user_id = p_applicant_user_id
    and application.status = 'draft'
    and cohort.status = 'open'
    and not program.is_archived
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
  for update of application;

  if not found then
    raise exception 'The prepared draft application is not available for signing.';
  end if;

  if target_application.student_birth_date is null
     or target_application.student_birth_date > local_date then
    raise exception 'A valid student birth date is required.';
  end if;

  expected_signer_role := case
    when target_application.student_birth_date + interval '18 years' <= local_date then 'self'
    else 'guardian'
  end;

  if target_application.signer_role is distinct from expected_signer_role then
    raise exception 'The contract signer role does not match the student age.';
  end if;

  student_name := nullif(trim(coalesce(target_application.answers ->> 'student_name', '')), '');
  student_registration_number := nullif(trim(coalesce(target_application.answers ->> 'student_registration_number', '')), '');

  if student_name is null or student_registration_number is null then
    raise exception 'The student identity information is incomplete.';
  end if;

  if nullif(trim(coalesce(target_application.signer_name, '')), '') is null
     or nullif(trim(coalesce(target_application.signer_email, '')), '') is null
     or nullif(trim(coalesce(target_application.signer_phone, '')), '') is null then
    raise exception 'The signer identity information is incomplete.';
  end if;

  if expected_signer_role = 'self' then
    if lower(regexp_replace(trim(target_application.signer_name), '\s+', ' ', 'g'))
       <> lower(regexp_replace(student_name, '\s+', ' ', 'g')) then
      raise exception 'The adult signer name must match the student name.';
    end if;

    if lower(trim(target_application.signer_email)) <> lower(trim(target_application.contact_email)) then
      raise exception 'The adult signer email must match the authenticated account email.';
    end if;

    target_application.signer_registration_number := student_registration_number;
    target_application.signer_relationship := 'Өөрөө';
  elsif nullif(trim(coalesce(target_application.signer_registration_number, '')), '') is null
        or nullif(trim(coalesce(target_application.signer_relationship, '')), '') is null then
    raise exception 'The parent or guardian information is incomplete.';
  end if;

  signed_answers := private.merge_contract_signer_answers(
    target_application.contract_version_id,
    target_application.answers,
    target_application.student_birth_date,
    target_application.signer_name,
    target_application.signer_email,
    target_application.signer_phone,
    target_application.signer_registration_number,
    target_application.signer_relationship
  );
  signed_answers := private.validate_cohort_application_answers(
    target_application.contract_version_id,
    signed_answers,
    true
  );

  update public.cohort_applications
  set
    answers = signed_answers,
    signer_registration_number = target_application.signer_registration_number,
    signer_relationship = target_application.signer_relationship,
    status = 'submitted',
    contract_acknowledged_at = signing_time,
    signed_at = signing_time,
    signature_method = p_signature_method,
    signer_email_verified_at = signing_time,
    signature_statement = trim(p_signature_statement),
    signature_statement_version = trim(p_signature_statement_version)
  where id = target_application.id;
end;
$$;

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
        'student_birth_date', own_application.student_birth_date,
        'signer_role', own_application.signer_role,
        'signer_name', own_application.signer_name,
        'signer_email', own_application.signer_email,
        'signer_phone', own_application.signer_phone,
        'signer_registration_number', own_application.signer_registration_number,
        'signer_relationship', own_application.signer_relationship,
        'rejection_reason', own_application.rejection_reason,
        'submitted_at', own_application.submitted_at,
        'contract_acknowledged_at', own_application.contract_acknowledged_at,
        'signed_at', own_application.signed_at,
        'signature_method', own_application.signature_method,
        'signer_email_verified_at', own_application.signer_email_verified_at,
        'signature_statement', own_application.signature_statement,
        'signature_statement_version', own_application.signature_statement_version,
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
    'student_birth_date', application.student_birth_date,
    'signer_role', application.signer_role,
    'signer_name', application.signer_name,
    'signer_email', application.signer_email,
    'signer_phone', application.signer_phone,
    'signer_registration_number', application.signer_registration_number,
    'signer_relationship', application.signer_relationship,
    'submitted_at', application.submitted_at,
    'contract_acknowledged_at', application.contract_acknowledged_at,
    'signed_at', application.signed_at,
    'signature_method', application.signature_method,
    'signer_email_verified_at', application.signer_email_verified_at,
    'signature_statement', application.signature_statement,
    'signature_statement_version', application.signature_statement_version,
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

revoke all on function private.merge_contract_signer_answers(uuid, jsonb, date, text, text, text, text, text)
from public, anon, authenticated;
revoke all on function private.enforce_cohort_application_lifecycle()
from public, anon, authenticated;
revoke all on function private.capture_contract_snapshot_application_details()
from public, anon, authenticated;

revoke all on function public.save_cohort_application_draft(uuid, jsonb, date, text, text, text, text, text)
from public, anon;
grant execute on function public.save_cohort_application_draft(uuid, jsonb, date, text, text, text, text, text)
to authenticated, service_role;

revoke all on function public.get_contract_signature_verification_policy(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_contract_signature_verification_policy(uuid, uuid, uuid)
to service_role;

revoke all on function public.finalize_cohort_contract_signature(uuid, uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.finalize_cohort_contract_signature(uuid, uuid, text, text, text)
to service_role;

revoke all on function public.get_open_cohort_application_form(uuid) from public;
grant execute on function public.get_open_cohort_application_form(uuid) to anon, authenticated, service_role;
