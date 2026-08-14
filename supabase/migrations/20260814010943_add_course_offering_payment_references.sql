-- Permanent, human-readable bank transfer references for unified V2 checkout.
-- A sequence guarantees uniqueness under concurrent application creation. Gaps
-- are expected after rolled-back transactions and have no business meaning.

create sequence private.course_offering_payment_reference_seq
as bigint
start with 1
increment by 1
no minvalue
no maxvalue
cache 1;

create or replace function private.allocate_course_offering_payment_reference()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  allocated_value bigint := nextval('private.course_offering_payment_reference_seq'::regclass);
  allocated_text text;
begin
  allocated_text := allocated_value::text;
  return 'MA-' || case
    when char_length(allocated_text) < 8 then lpad(allocated_text, 8, '0')
    else allocated_text
  end;
end;
$$;

revoke all on sequence private.course_offering_payment_reference_seq
from public, anon, authenticated;
grant usage, select on sequence private.course_offering_payment_reference_seq
to service_role;

revoke all on function private.allocate_course_offering_payment_reference()
from public, anon, authenticated;
grant execute on function private.allocate_course_offering_payment_reference()
to service_role;

alter table public.course_offering_applications
add column payment_reference text
not null
default private.allocate_course_offering_payment_reference();

-- PostgreSQL evaluates this volatile default separately for each existing row
-- while adding the column. That backfills permanent references without issuing
-- row UPDATEs, so historical updated_at values and lifecycle evidence remain
-- untouched. Later receipt-correction attempts retain the application value.

alter table public.course_offering_applications
add constraint course_offering_applications_payment_reference_format_check
check (payment_reference ~ '^MA-[0-9]{8,19}$');

alter table public.course_offering_applications
add constraint course_offering_applications_payment_reference_key
unique (payment_reference);

comment on column public.course_offering_applications.payment_reference is
  'Permanent bank-transfer reference allocated once per V2 checkout application.';

create or replace function private.enforce_course_offering_payment_reference_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.payment_reference is distinct from old.payment_reference then
    raise exception 'The course offering payment reference is immutable.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_course_offering_payment_reference_immutability()
from public, anon, authenticated;

create trigger course_offering_applications_payment_reference_immutable
before update on public.course_offering_applications
for each row execute function private.enforce_course_offering_payment_reference_immutability();

-- Return the permanent reference with the learner's existing checkout state.
-- The function signature remains unchanged, so this migration is compatible
-- with the currently deployed application and can safely be installed first.
create or replace function public.get_course_offering_checkout_form(p_offering_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  result jsonb;
begin
  select jsonb_build_object(
    'offering_id', cohort.id,
    'course_id', course.id,
    'course_title', course.title,
    'course_description', course.description,
    'course_thumbnail_path', course.thumbnail_path,
    'program_name', program.name,
    'program_description', program.description,
    'offering_name', cohort.name,
    'delivery_mode', cohort.delivery_mode,
    'contract_policy', cohort.contract_policy,
    'capacity', cohort.capacity,
    'available_seats', case
      when cohort.capacity is null then null
      else greatest(cohort.capacity::bigint - count(active_enrollment.id), 0::bigint)
    end,
    'tuition_amount_mnt', cohort.tuition_amount_mnt,
    'payment_plan', cohort.payment_plan,
    'schedule_summary', cohort.schedule_summary,
    'location', cohort.location,
    'registration_closes_at', cohort.registration_closes_at,
    'starts_on', cohort.starts_on,
    'ends_on', cohort.ends_on,
    'is_accepting_applications', (
      cohort.status = 'open'
      and not program.is_archived
      and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
      and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
      and private.course_is_ready(course.id)
      and (cohort.capacity is null or count(active_enrollment.id) < cohort.capacity)
    ),
    'contract_version_id', contract_version.id,
    'contract_title', contract_version.title,
    'contract_version_number', contract_version.version_number,
    'contract_content', contract_version.content,
    'contract_preview_values', case
      when cohort.contract_policy = 'none' then '{}'::jsonb
      else jsonb_strip_nulls(jsonb_build_object(
        'contract_number', 'Баталгаажуулах үед үүснэ',
        'contract_date', 'Баталгаажуулах өдөр',
        'program_name', program.name,
        'cohort_name', cohort.name,
        'learning_format', case cohort.delivery_mode
          when 'online' then 'Цахим'
          when 'offline' then 'Танхим'
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
      ))
    end,
    'fields', case
      when cohort.contract_policy = 'none' then '[]'::jsonb
      else coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', variable.key,
          'label', variable.label_mn,
          'description', variable.description_mn
        ) order by variable.key)
        from (
          select distinct contract_variable.key, contract_variable.label_mn, contract_variable.description_mn
          from regexp_matches(
            contract_version.content,
            '\{\{([a-z][a-z0-9_]*)\}\}',
            'g'
          ) variable_match
          join public.contract_variables contract_variable
            on contract_variable.key = variable_match[1]
           and contract_variable.category = 'participant'
           and contract_variable.is_active
        ) variable
      ), '[]'::jsonb)
    end,
    'my_applications', case
      when current_user_id is null then '[]'::jsonb
      else coalesce((
        select jsonb_agg(jsonb_build_object(
          'application_id', application.id,
          'client_request_id', application.client_request_id,
          'payment_reference', application.payment_reference,
          'learner_id', learner.id,
          'content_access_user_id', application.content_access_user_id,
          'learner', jsonb_build_object(
            'full_name', learner.full_name,
            'birth_date', learner.birth_date,
            'registration_number', learner.registration_number
          ),
          'applicant_relationship', application.applicant_relationship,
          'signer', jsonb_build_object(
            'full_name', application.signer_full_name,
            'email', application.signer_email,
            'phone', application.signer_phone,
            'registration_number', application.signer_registration_number
          ),
          'answers', application.answers,
          'application_status', case
            when application.status = 'withdrawn' then 'withdrawn'
            when application.status = 'approved' then 'approved'
            when latest_payment.status = 'pending' then 'pending_review'
            when latest_payment.status = 'rejected' then 'correction_required'
            when application.contract_policy_snapshot = 'required' and acceptance.id is null
              then 'contract_required'
            else 'ready_for_payment'
          end,
          'contract_accepted_at', acceptance.accepted_at,
          'payment_due_at', application.payment_due_at,
          'payment', case when latest_payment.id is null then null else jsonb_build_object(
            'payment_proof_id', latest_payment.id,
            'attempt_number', latest_payment.attempt_number,
            'status', case latest_payment.status
              when 'pending' then 'pending_review'
              when 'rejected' then 'correction_required'
              when 'approved' then 'approved'
            end,
            'amount_mnt', latest_payment.amount_mnt,
            'rejection_reason', latest_payment.rejection_reason,
            'created_at', latest_payment.created_at,
            'reviewed_at', latest_payment.reviewed_at
          ) end,
          'enrollment_id', enrollment.id,
          'enrollment_status', enrollment.status,
          'created_at', application.created_at,
          'updated_at', application.updated_at
        ) order by application.created_at desc)
        from public.course_offering_applications application
        join public.learners learner on learner.id = application.learner_id
        left join public.course_offering_contract_acceptances acceptance
          on acceptance.application_id = application.id
        left join lateral (
          select proof.*
          from public.course_offering_payment_proofs proof
          where proof.application_id = application.id
          order by proof.attempt_number desc
          limit 1
        ) latest_payment on true
        left join public.course_offering_enrollments enrollment
          on enrollment.application_id = application.id
        where application.offering_id = cohort.id
          and application.applicant_user_id = current_user_id
      ), '[]'::jsonb)
    end
  )
  into result
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  join public.courses course on course.id = cohort.course_id
  left join public.contract_issuer_profile issuer on issuer.id = true
  left join public.contract_template_versions contract_version
    on contract_version.id = cohort.contract_version_id
   and contract_version.status in ('published', 'retired')
  left join public.course_offering_enrollments active_enrollment
    on active_enrollment.offering_id = cohort.id
   and active_enrollment.status = 'active'
  where cohort.id = p_offering_id
    and cohort.checkout_version = 2
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
          from public.course_offering_applications own_application
          where own_application.offering_id = cohort.id
            and own_application.applicant_user_id = current_user_id
        )
      )
    )
    and (
      cohort.contract_policy = 'none'
      or contract_version.id is not null
    )
  group by cohort.id, program.id, course.id, contract_version.id, issuer.id;

  return result;
end;
$$;
