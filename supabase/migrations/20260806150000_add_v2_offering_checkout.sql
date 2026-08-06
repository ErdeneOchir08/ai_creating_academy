-- Phase 2: isolated version-2 course-offering checkout.
--
-- This migration intentionally does not enable V2 offerings for public use.
-- The earlier course-offering foundation trigger continues to reject a V2
-- transition to `open` until a separate activation migration is reviewed and
-- applied after the application integration is deployed.

-- ---------------------------------------------------------------------------
-- Canonical learner identity and account relationships
-- ---------------------------------------------------------------------------

create table public.learners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 1 and 240),
  birth_date date,
  registration_number text check (
    registration_number is null
    or char_length(trim(registration_number)) between 1 and 50
  ),
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learner_account_links (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  relationship text not null check (relationship in ('self', 'parent', 'guardian', 'other')),
  status text not null default 'declared' check (status in ('declared', 'verified', 'revoked')),
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, user_id),
  check (
    (status = 'declared' and verified_at is null and revoked_at is null)
    or (status = 'verified' and verified_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

-- ---------------------------------------------------------------------------
-- V2 checkout records. These do not relax or overload any V1 table.
-- ---------------------------------------------------------------------------

-- A row in this table is the permanent ownership boundary between the legacy
-- direct-course payment flow and the course-offering checkout. Draft offerings
-- do not create ownership. The activation migration claims a course only when
-- its first V2 offering is successfully opened, in the same transaction.
-- Ownership is intentionally immutable so closing or archiving every offering
-- cannot accidentally re-enable the legacy checkout for that course.
create table public.course_checkout_ownerships (
  course_id uuid primary key references public.courses(id) on delete restrict,
  claimed_checkout_version smallint not null check (claimed_checkout_version >= 2),
  claimed_by_offering_id uuid not null unique references public.training_cohorts(id) on delete restrict,
  claimed_by_user_id uuid not null references public.profiles(id) on delete restrict,
  claimed_at timestamptz not null default now()
);

create index course_checkout_ownerships_claimed_by_user_idx
on public.course_checkout_ownerships (claimed_by_user_id);

comment on table public.course_checkout_ownerships is
  'Immutable one-way cutover evidence. Presence means the course permanently uses course-offering checkout.';

create table public.course_offering_applications (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  offering_id uuid not null references public.training_cohorts(id) on delete restrict,
  learner_id uuid not null references public.learners(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  content_access_user_id uuid not null references public.profiles(id) on delete restrict,
  course_id_snapshot uuid not null references public.courses(id) on delete restrict,
  contract_policy_snapshot text not null check (contract_policy_snapshot in ('required', 'none')),
  contract_version_id uuid references public.contract_template_versions(id) on delete restrict,
  tuition_amount_mnt_snapshot integer not null check (tuition_amount_mnt_snapshot > 0),
  payment_due_days_snapshot integer not null check (payment_due_days_snapshot > 0),
  payment_due_at timestamptz not null,
  contact_email text not null check (char_length(trim(contact_email)) between 3 and 320),
  applicant_relationship text not null check (
    applicant_relationship in ('self', 'parent', 'guardian', 'other')
  ),
  signer_role text check (signer_role in ('self', 'guardian')),
  signer_full_name text check (
    signer_full_name is null or char_length(trim(signer_full_name)) between 1 and 240
  ),
  signer_email text check (
    signer_email is null or char_length(trim(signer_email)) between 3 and 320
  ),
  signer_phone text check (
    signer_phone is null or char_length(trim(signer_phone)) between 1 and 50
  ),
  signer_registration_number text check (
    signer_registration_number is null
    or char_length(trim(signer_registration_number)) between 1 and 50
  ),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  terms_snapshot jsonb not null check (jsonb_typeof(terms_snapshot) = 'object'),
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'approved', 'withdrawn')
  ),
  signature_policy_required boolean,
  signature_policy_reason text check (
    signature_policy_reason is null
    or char_length(trim(signature_policy_reason)) between 1 and 80
  ),
  signature_policy_session_id uuid,
  signature_policy_evaluated_at timestamptz,
  signature_verification_sent_at timestamptz,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_user_id, client_request_id),
  unique (offering_id, learner_id),
  check (
    (contract_policy_snapshot = 'required' and contract_version_id is not null)
    or (contract_policy_snapshot = 'none' and contract_version_id is null)
  ),
  check (
    (
      signature_policy_required is null
      and signature_policy_reason is null
      and signature_policy_session_id is null
      and signature_policy_evaluated_at is null
    )
    or (
      signature_policy_required is not null
      and signature_policy_reason is not null
      and signature_policy_session_id is not null
      and signature_policy_evaluated_at is not null
    )
  ),
  check (
    (status = 'draft' and submitted_at is null and reviewed_by is null and reviewed_at is null and withdrawn_at is null)
    or (status = 'submitted' and submitted_at is not null and reviewed_by is null and reviewed_at is null and withdrawn_at is null)
    or (status = 'approved' and submitted_at is not null and reviewed_by is not null and reviewed_at is not null and withdrawn_at is null)
    or (status = 'withdrawn' and withdrawn_at is not null and reviewed_by is null and reviewed_at is null)
  )
);

create table public.course_offering_contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.course_offering_applications(id) on delete restrict,
  offering_id uuid not null references public.training_cohorts(id) on delete restrict,
  learner_id uuid not null references public.learners(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  contract_version_id uuid not null references public.contract_template_versions(id) on delete restrict,
  contract_title text not null,
  contract_version_number integer not null check (contract_version_number > 0),
  contract_number text not null unique check (contract_number ~ '^[0-9]{2}/[1-9][0-9]*$'),
  contract_date date not null,
  contract_content text not null,
  required_variable_keys text[] not null default '{}'::text[],
  unresolved_variable_keys text[] not null default '{}'::text[] check (
    cardinality(unresolved_variable_keys) = 0
  ),
  resolved_values jsonb not null check (jsonb_typeof(resolved_values) = 'object'),
  answers_snapshot jsonb not null check (jsonb_typeof(answers_snapshot) = 'object'),
  learner_snapshot jsonb not null check (jsonb_typeof(learner_snapshot) = 'object'),
  signer_snapshot jsonb not null check (jsonb_typeof(signer_snapshot) = 'object'),
  terms_snapshot jsonb not null check (jsonb_typeof(terms_snapshot) = 'object'),
  signature_method text not null check (
    signature_method in ('authenticated_account', 'email_otp')
  ),
  signer_email_verified_at timestamptz not null,
  signature_statement text not null check (char_length(trim(signature_statement)) between 1 and 1000),
  signature_statement_version text not null check (
    char_length(trim(signature_statement_version)) between 1 and 50
  ),
  contract_content_sha256 text not null check (contract_content_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.course_offering_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.course_offering_applications(id) on delete restrict,
  offering_id uuid not null references public.training_cohorts(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  receipt_path text not null unique check (char_length(trim(receipt_path)) > 0),
  amount_mnt integer not null check (amount_mnt > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text check (
    rejection_reason is null or char_length(trim(rejection_reason)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, attempt_number),
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null)
  )
);

create unique index course_offering_payment_proofs_one_pending_idx
on public.course_offering_payment_proofs (application_id)
where status = 'pending';

create unique index course_offering_payment_proofs_one_approved_idx
on public.course_offering_payment_proofs (application_id)
where status = 'approved';

create table public.course_offering_application_courses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.course_offering_applications(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  item_kind text not null check (item_kind in ('primary', 'bonus')),
  source_course_id uuid references public.courses(id) on delete restrict,
  course_title_snapshot text not null check (
    char_length(trim(course_title_snapshot)) between 1 and 240
  ),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (application_id, course_id),
  check (
    (item_kind = 'primary' and source_course_id is null and position = 0)
    or (item_kind = 'bonus' and source_course_id is not null and position > 0)
  )
);

create unique index course_offering_application_courses_one_primary_idx
on public.course_offering_application_courses (application_id)
where item_kind = 'primary';

create table public.course_offering_enrollments (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.training_cohorts(id) on delete restrict,
  application_id uuid not null unique references public.course_offering_applications(id) on delete restrict,
  payment_proof_id uuid not null unique references public.course_offering_payment_proofs(id) on delete restrict,
  learner_id uuid not null references public.learners(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  content_access_user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  enrolled_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offering_id, learner_id),
  check (
    (status = 'active' and cancelled_at is null and cancelled_by is null)
    or (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null)
  )
);

create table public.course_access_entitlements (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_offering_enrollments(id) on delete restrict,
  application_course_id uuid not null references public.course_offering_application_courses(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  item_kind text not null check (item_kind in ('primary', 'bonus')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, course_id),
  unique (application_course_id),
  check (
    (status = 'active' and revoked_at is null and revoked_by is null)
    or (status = 'revoked' and revoked_at is not null and revoked_by is not null)
  )
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(trim(event_type)) between 1 and 120),
  aggregate_type text not null check (char_length(trim(aggregate_type)) between 1 and 80),
  aggregate_id uuid not null,
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 1 and 240),
  recipient_kind text not null check (recipient_kind in ('user', 'admins')),
  recipient_user_id uuid references public.profiles(id) on delete restrict,
  recipient_email text check (
    recipient_email is null or char_length(trim(recipient_email)) between 3 and 320
  ),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (recipient_kind = 'user' and recipient_user_id is not null and recipient_email is not null)
    or (recipient_kind = 'admins' and recipient_user_id is null)
  ),
  check (
    (status = 'pending' and locked_at is null and sent_at is null)
    or (status = 'processing' and locked_at is not null and sent_at is null)
    or (status = 'sent' and sent_at is not null)
    or (status = 'failed' and sent_at is null)
  )
);

-- Foreign-key and workflow lookup indexes. PostgreSQL does not create these
-- automatically for referencing columns.
create index learners_created_by_user_id_idx on public.learners (created_by_user_id);
create index learner_account_links_user_status_idx on public.learner_account_links (user_id, status, learner_id);
create index learner_account_links_created_by_idx on public.learner_account_links (created_by_user_id);
create index course_offering_applications_offering_status_idx on public.course_offering_applications (offering_id, status, created_at);
create index course_offering_applications_learner_idx on public.course_offering_applications (learner_id, created_at desc);
create index course_offering_applications_content_access_idx on public.course_offering_applications (content_access_user_id, status);
create index course_offering_applications_course_idx on public.course_offering_applications (course_id_snapshot, status);
create index course_offering_applications_contract_idx on public.course_offering_applications (contract_version_id) where contract_version_id is not null;
create index course_offering_applications_reviewed_by_idx on public.course_offering_applications (reviewed_by) where reviewed_by is not null;
create index course_offering_contract_acceptances_offering_idx on public.course_offering_contract_acceptances (offering_id, accepted_at desc);
create index course_offering_contract_acceptances_learner_idx on public.course_offering_contract_acceptances (learner_id, accepted_at desc);
create index course_offering_contract_acceptances_applicant_idx on public.course_offering_contract_acceptances (applicant_user_id, accepted_at desc);
create index course_offering_contract_acceptances_contract_idx on public.course_offering_contract_acceptances (contract_version_id);
create index course_offering_payment_proofs_applicant_idx on public.course_offering_payment_proofs (applicant_user_id, created_at desc);
create index course_offering_payment_proofs_offering_status_idx on public.course_offering_payment_proofs (offering_id, status, created_at);
create index course_offering_payment_proofs_reviewed_by_idx on public.course_offering_payment_proofs (reviewed_by) where reviewed_by is not null;
create index course_offering_application_courses_course_idx on public.course_offering_application_courses (course_id, application_id);
create index course_offering_application_courses_source_idx on public.course_offering_application_courses (source_course_id) where source_course_id is not null;
create index course_offering_enrollments_learner_idx on public.course_offering_enrollments (learner_id, status, enrolled_at desc);
create index course_offering_enrollments_access_user_idx on public.course_offering_enrollments (content_access_user_id, status, enrolled_at desc);
create index course_offering_enrollments_applicant_idx on public.course_offering_enrollments (applicant_user_id, status, enrolled_at desc);
create index course_offering_enrollments_cancelled_by_idx on public.course_offering_enrollments (cancelled_by) where cancelled_by is not null;
create index course_access_entitlements_user_course_idx on public.course_access_entitlements (user_id, course_id, status);
create index course_access_entitlements_course_status_idx on public.course_access_entitlements (course_id, status);
create index course_access_entitlements_revoked_by_idx on public.course_access_entitlements (revoked_by) where revoked_by is not null;
create index notification_outbox_delivery_idx on public.notification_outbox (status, available_at, created_at) where status in ('pending', 'failed');
create index notification_outbox_recipient_user_idx on public.notification_outbox (recipient_user_id, created_at desc) where recipient_user_id is not null;

-- ---------------------------------------------------------------------------
-- Database-enforced lifecycle rules
-- ---------------------------------------------------------------------------

create or replace function private.touch_course_offering_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.enforce_course_offering_application_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft'
       or new.submitted_at is not null
       or new.reviewed_by is not null
       or new.reviewed_at is not null
       or new.withdrawn_at is not null then
      raise exception 'New course offering applications must begin as drafts.';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.client_request_id is distinct from old.client_request_id
     or new.offering_id is distinct from old.offering_id
     or new.learner_id is distinct from old.learner_id
     or new.applicant_user_id is distinct from old.applicant_user_id
     or new.content_access_user_id is distinct from old.content_access_user_id
     or new.course_id_snapshot is distinct from old.course_id_snapshot
     or new.contract_policy_snapshot is distinct from old.contract_policy_snapshot
     or new.contract_version_id is distinct from old.contract_version_id
     or new.tuition_amount_mnt_snapshot is distinct from old.tuition_amount_mnt_snapshot
     or new.payment_due_days_snapshot is distinct from old.payment_due_days_snapshot
     or new.contact_email is distinct from old.contact_email
     or new.terms_snapshot is distinct from old.terms_snapshot
     or new.created_at is distinct from old.created_at then
    raise exception 'Course offering application identity and commercial terms are immutable.';
  end if;

  if old.status = 'approved' then
    raise exception 'Approved course offering applications are immutable.';
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'submitted', 'withdrawn') then
    raise exception 'Invalid course offering application status transition.';
  elsif old.status = 'submitted' and new.status not in ('submitted', 'approved', 'withdrawn') then
    raise exception 'Invalid course offering application status transition.';
  elsif old.status = 'withdrawn' and new.status <> 'withdrawn' then
    raise exception 'Withdrawn course offering applications are immutable.';
  end if;

  if (
    new.applicant_relationship is distinct from old.applicant_relationship
    or new.signer_role is distinct from old.signer_role
    or new.signer_full_name is distinct from old.signer_full_name
    or new.signer_email is distinct from old.signer_email
    or new.signer_phone is distinct from old.signer_phone
    or new.signer_registration_number is distinct from old.signer_registration_number
    or new.answers is distinct from old.answers
  ) and old.status <> 'draft' then
    raise exception 'Participant and signer details may only change while the application is a draft.';
  end if;

  if (
    new.applicant_relationship is distinct from old.applicant_relationship
    or new.signer_role is distinct from old.signer_role
    or new.signer_full_name is distinct from old.signer_full_name
    or new.signer_email is distinct from old.signer_email
    or new.signer_phone is distinct from old.signer_phone
    or new.signer_registration_number is distinct from old.signer_registration_number
    or new.answers is distinct from old.answers
  ) and exists (
    select 1
    from public.course_offering_contract_acceptances acceptance
    where acceptance.application_id = old.id
  ) then
    raise exception 'Accepted contract participant and signer details are immutable.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.reject_immutable_course_offering_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Course offering evidence records are immutable.';
end;
$$;

create or replace function private.enforce_course_checkout_ownership_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  offering_is_valid boolean;
begin
  if current_user_id is null
     or new.claimed_by_user_id is distinct from current_user_id
     or coalesce((select private.is_admin()), false) is false then
    raise exception 'Only an authenticated administrator can claim course checkout ownership.';
  end if;

  select exists (
    select 1
    from public.training_cohorts cohort
    where cohort.id = new.claimed_by_offering_id
      and cohort.course_id = new.course_id
      and cohort.checkout_version = new.claimed_checkout_version
      and cohort.checkout_version = 2
      and cohort.status = 'open'
  )
  into offering_is_valid;

  if not offering_is_valid then
    raise exception 'Course checkout ownership must be claimed by the open V2 offering for the same course.';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_course_offering_payment_proof_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending'
       or new.reviewed_by is not null
       or new.reviewed_at is not null
       or new.rejection_reason is not null then
      raise exception 'New course offering payment proofs must begin as pending.';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.application_id is distinct from old.application_id
     or new.offering_id is distinct from old.offering_id
     or new.applicant_user_id is distinct from old.applicant_user_id
     or new.attempt_number is distinct from old.attempt_number
     or new.receipt_path is distinct from old.receipt_path
     or new.amount_mnt is distinct from old.amount_mnt
     or new.created_at is distinct from old.created_at then
    raise exception 'Payment proof identity, attempt, receipt and amount are immutable.';
  end if;

  if old.status <> 'pending'
     or new.status not in ('approved', 'rejected') then
    raise exception 'The course offering payment proof is no longer pending.';
  end if;

  new.reviewed_by := (select auth.uid());
  new.reviewed_at := now();
  new.rejection_reason := case
    when new.status = 'rejected' then nullif(trim(new.rejection_reason), '')
    else null
  end;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.enforce_course_offering_enrollment_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'active' or new.cancelled_at is not null or new.cancelled_by is not null then
      raise exception 'New course offering enrollments must begin as active.';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.offering_id is distinct from old.offering_id
     or new.application_id is distinct from old.application_id
     or new.payment_proof_id is distinct from old.payment_proof_id
     or new.learner_id is distinct from old.learner_id
     or new.applicant_user_id is distinct from old.applicant_user_id
     or new.content_access_user_id is distinct from old.content_access_user_id
     or new.enrolled_at is distinct from old.enrolled_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Course offering enrollment identity is immutable.';
  end if;

  if old.status <> 'active' or new.status <> 'cancelled' then
    raise exception 'Only an active enrollment can be cancelled.';
  end if;

  new.cancelled_at := now();
  new.cancelled_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.enforce_course_access_entitlement_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'active' or new.revoked_at is not null or new.revoked_by is not null then
      raise exception 'New course access entitlements must begin as active.';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.enrollment_id is distinct from old.enrollment_id
     or new.application_course_id is distinct from old.application_course_id
     or new.user_id is distinct from old.user_id
     or new.course_id is distinct from old.course_id
     or new.item_kind is distinct from old.item_kind
     or new.granted_at is distinct from old.granted_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Course access entitlement identity is immutable.';
  end if;

  if old.status <> 'active' or new.status <> 'revoked' then
    raise exception 'Only an active course access entitlement can be revoked.';
  end if;

  new.revoked_at := now();
  new.revoked_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

create trigger course_offering_applications_lifecycle
before insert or update on public.course_offering_applications
for each row execute function private.enforce_course_offering_application_lifecycle();

create trigger course_checkout_ownerships_insert_guard
before insert on public.course_checkout_ownerships
for each row execute function private.enforce_course_checkout_ownership_insert();

create trigger course_checkout_ownerships_immutable
before update or delete on public.course_checkout_ownerships
for each row execute function private.reject_immutable_course_offering_evidence();

create trigger course_offering_contract_acceptances_immutable
before update or delete on public.course_offering_contract_acceptances
for each row execute function private.reject_immutable_course_offering_evidence();

create trigger course_offering_application_courses_immutable
before update or delete on public.course_offering_application_courses
for each row execute function private.reject_immutable_course_offering_evidence();

create trigger course_offering_payment_proofs_lifecycle
before insert or update on public.course_offering_payment_proofs
for each row execute function private.enforce_course_offering_payment_proof_lifecycle();

create trigger course_offering_enrollments_lifecycle
before insert or update on public.course_offering_enrollments
for each row execute function private.enforce_course_offering_enrollment_lifecycle();

create trigger course_access_entitlements_lifecycle
before insert or update on public.course_access_entitlements
for each row execute function private.enforce_course_access_entitlement_lifecycle();

create trigger learners_updated_at
before update on public.learners
for each row execute function private.touch_course_offering_updated_at();

create trigger learner_account_links_updated_at
before update on public.learner_account_links
for each row execute function private.touch_course_offering_updated_at();

create trigger notification_outbox_updated_at
before update on public.notification_outbox
for each row execute function private.touch_course_offering_updated_at();

revoke all on function private.touch_course_offering_updated_at() from public, anon, authenticated;
revoke all on function private.enforce_course_offering_application_lifecycle() from public, anon, authenticated;
revoke all on function private.enforce_course_checkout_ownership_insert() from public, anon, authenticated;
revoke all on function private.reject_immutable_course_offering_evidence() from public, anon, authenticated;
revoke all on function private.enforce_course_offering_payment_proof_lifecycle() from public, anon, authenticated;
revoke all on function private.enforce_course_offering_enrollment_lifecycle() from public, anon, authenticated;
revoke all on function private.enforce_course_access_entitlement_lifecycle() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security. Authenticated clients can only read their own records;
-- all mutations go through the validated RPC surface below.
-- ---------------------------------------------------------------------------

alter table public.learners enable row level security;
alter table public.learner_account_links enable row level security;
alter table public.course_checkout_ownerships enable row level security;
alter table public.course_offering_applications enable row level security;
alter table public.course_offering_contract_acceptances enable row level security;
alter table public.course_offering_payment_proofs enable row level security;
alter table public.course_offering_application_courses enable row level security;
alter table public.course_offering_enrollments enable row level security;
alter table public.course_access_entitlements enable row level security;
alter table public.notification_outbox enable row level security;

revoke all on table public.learners from public, anon, authenticated;
revoke all on table public.learner_account_links from public, anon, authenticated;
revoke all on table public.course_checkout_ownerships from public, anon, authenticated;
revoke all on table public.course_offering_applications from public, anon, authenticated;
revoke all on table public.course_offering_contract_acceptances from public, anon, authenticated;
revoke all on table public.course_offering_payment_proofs from public, anon, authenticated;
revoke all on table public.course_offering_application_courses from public, anon, authenticated;
revoke all on table public.course_offering_enrollments from public, anon, authenticated;
revoke all on table public.course_access_entitlements from public, anon, authenticated;
revoke all on table public.notification_outbox from public, anon, authenticated;

grant select on table public.learners to authenticated;
grant select on table public.learner_account_links to authenticated;
grant select on table public.course_checkout_ownerships to authenticated;
grant select on table public.course_offering_applications to authenticated;
grant select on table public.course_offering_contract_acceptances to authenticated;
grant select on table public.course_offering_payment_proofs to authenticated;
grant select on table public.course_offering_application_courses to authenticated;
grant select on table public.course_offering_enrollments to authenticated;
grant select on table public.course_access_entitlements to authenticated;

grant all on table public.learners to service_role;
grant all on table public.learner_account_links to service_role;
grant all on table public.course_checkout_ownerships to service_role;
grant all on table public.course_offering_applications to service_role;
grant all on table public.course_offering_contract_acceptances to service_role;
grant all on table public.course_offering_payment_proofs to service_role;
grant all on table public.course_offering_application_courses to service_role;
grant all on table public.course_offering_enrollments to service_role;
grant all on table public.course_access_entitlements to service_role;
grant all on table public.notification_outbox to service_role;

create policy "learners: related users or admins read"
on public.learners for select to authenticated
using (
  (select private.is_admin())
  or created_by_user_id = (select auth.uid())
  or exists (
    select 1 from public.learner_account_links link
    where link.learner_id = learners.id
      and link.user_id = (select auth.uid())
      and link.status <> 'revoked'
  )
);

create policy "learner account links: linked users or admins read"
on public.learner_account_links for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "course checkout ownerships: admins read"
on public.course_checkout_ownerships for select to authenticated
using ((select private.is_admin()));

create policy "offering applications: applicant or admins read"
on public.course_offering_applications for select to authenticated
using (
  applicant_user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy "offering acceptances: applicant or admins read"
on public.course_offering_contract_acceptances for select to authenticated
using (applicant_user_id = (select auth.uid()) or (select private.is_admin()));

create policy "offering proofs: applicant or admins read"
on public.course_offering_payment_proofs for select to authenticated
using (applicant_user_id = (select auth.uid()) or (select private.is_admin()));

create policy "offering course snapshots: applicant, approved recipient or admins read"
on public.course_offering_application_courses for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.course_offering_applications application
    where application.id = course_offering_application_courses.application_id
      and application.applicant_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.course_offering_enrollments enrollment
    where enrollment.application_id = course_offering_application_courses.application_id
      and enrollment.content_access_user_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

create policy "offering enrollments: participant or admins read"
on public.course_offering_enrollments for select to authenticated
using (
  applicant_user_id = (select auth.uid())
  or content_access_user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy "course entitlements: recipient or admins read"
on public.course_access_entitlements for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Shared V2 validation and snapshot helpers
-- ---------------------------------------------------------------------------

create or replace function private.course_is_ready(p_course_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select course.published = true
      and exists (
        select 1
        from public.lessons lesson
        join public.lesson_videos video on video.lesson_id = lesson.id
        where lesson.course_id = course.id
          and video.playback_status = 'ready'
      )
    from public.courses course
    where course.id = p_course_id
  ), false);
$$;

create or replace function private.build_course_offering_terms_snapshot(p_offering_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'schema_version', 1,
    'offering_id', cohort.id,
    'course_id', cohort.course_id,
    'program_id', program.id,
    'program_name', program.name,
    'program_description', program.description,
    'offering_name', cohort.name,
    'delivery_mode', cohort.delivery_mode,
    'contract_policy', cohort.contract_policy,
    'tuition_amount_mnt', cohort.tuition_amount_mnt,
    'payment_due_days', cohort.payment_due_days,
    'payment_plan', cohort.payment_plan,
    'schedule_summary', cohort.schedule_summary,
    'location', cohort.location,
    'registration_opens_at', cohort.registration_opens_at,
    'registration_closes_at', cohort.registration_closes_at,
    'starts_on', cohort.starts_on,
    'ends_on', cohort.ends_on,
    'course', jsonb_build_object(
      'id', course.id,
      'title', course.title,
      'description', course.description,
      'thumbnail_path', course.thumbnail_path
    ),
    'issuer', jsonb_build_object(
      'legal_name', issuer.legal_name,
      'representative_name', issuer.representative_name,
      'phone', issuer.phone,
      'address', issuer.address,
      'bank_name', issuer.bank_name,
      'bank_account_number', issuer.bank_account_number,
      'bank_account_holder', issuer.bank_account_holder
    ),
    'captured_at', now()
  )
  into result
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  join public.courses course on course.id = cohort.course_id
  left join public.contract_issuer_profile issuer on issuer.id = true
  where cohort.id = p_offering_id
    and cohort.checkout_version = 2;

  if result is null then
    raise exception 'The V2 course offering does not exist.';
  end if;

  return result;
end;
$$;

create or replace function private.merge_course_offering_participant_answers(
  p_contract_version_id uuid,
  p_answers jsonb,
  p_learner_name text,
  p_learner_birth_date date,
  p_learner_registration_number text,
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
    'student_name', nullif(trim(p_learner_name), ''),
    'student_birth_date', p_learner_birth_date::text,
    'student_registration_number', nullif(trim(p_learner_registration_number), ''),
    'signer_name', nullif(trim(p_signer_name), ''),
    'signer_email', nullif(lower(trim(p_signer_email)), ''),
    'signer_phone', nullif(trim(p_signer_phone), ''),
    'signer_registration_number', nullif(trim(p_signer_registration_number), ''),
    'signer_relationship', nullif(trim(p_signer_relationship), ''),
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
begin
  select application.* into strict target_application
  from public.course_offering_applications application
  where application.id = p_application_id;

  select learner.* into strict target_learner
  from public.learners learner
  where learner.id = target_application.learner_id;

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
    'location', nullif(trim(target_application.terms_snapshot ->> 'location'), ''),
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

create or replace function private.enqueue_course_offering_notification(
  p_event_type text,
  p_aggregate_id uuid,
  p_idempotency_key text,
  p_recipient_kind text,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_payload jsonb
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  outbox_id uuid;
begin
  insert into public.notification_outbox (
    event_type,
    aggregate_type,
    aggregate_id,
    idempotency_key,
    recipient_kind,
    recipient_user_id,
    recipient_email,
    payload
  ) values (
    trim(p_event_type),
    'course_offering_application',
    p_aggregate_id,
    trim(p_idempotency_key),
    p_recipient_kind,
    p_recipient_user_id,
    case when p_recipient_email is null then null else lower(trim(p_recipient_email)) end,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (idempotency_key) do update
  set idempotency_key = excluded.idempotency_key
  returning id into outbox_id;

  return outbox_id;
end;
$$;

revoke all on function private.course_is_ready(uuid) from public, anon, authenticated;
revoke all on function private.build_course_offering_terms_snapshot(uuid) from public, anon, authenticated;
revoke all on function private.merge_course_offering_participant_answers(uuid, jsonb, text, date, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function private.build_course_offering_contract_values(uuid, text, date) from public, anon, authenticated;
revoke all on function private.enqueue_course_offering_notification(text, uuid, text, text, uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public read models. Every return shape is explicit so application clients
-- do not depend on underlying table layouts.
-- ---------------------------------------------------------------------------

create or replace function public.list_public_course_offerings(p_course_id uuid default null)
returns table (
  offering_id uuid,
  course_id uuid,
  program_name text,
  program_description text,
  offering_name text,
  delivery_mode text,
  contract_policy text,
  capacity integer,
  available_seats bigint,
  tuition_amount_mnt integer,
  payment_plan text,
  schedule_summary text,
  location text,
  registration_closes_at timestamptz,
  starts_on date,
  ends_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cohort.id,
    cohort.course_id,
    program.name,
    program.description,
    cohort.name,
    cohort.delivery_mode,
    cohort.contract_policy,
    cohort.capacity,
    case
      when cohort.capacity is null then null::bigint
      else greatest(cohort.capacity::bigint - count(enrollment.id), 0::bigint)
    end,
    cohort.tuition_amount_mnt,
    cohort.payment_plan,
    cohort.schedule_summary,
    cohort.location,
    cohort.registration_closes_at,
    cohort.starts_on,
    cohort.ends_on
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  left join public.course_offering_enrollments enrollment
    on enrollment.offering_id = cohort.id
   and enrollment.status = 'active'
  where cohort.checkout_version = 2
    and cohort.status = 'open'
    and cohort.course_id is not null
    and (p_course_id is null or cohort.course_id = p_course_id)
    and not program.is_archived
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
    and private.course_is_ready(cohort.course_id)
  group by cohort.id, program.id
  having cohort.capacity is null or count(enrollment.id) < cohort.capacity
  order by cohort.starts_on nulls last, cohort.registration_closes_at nulls last, cohort.created_at;
$$;

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

create or replace function public.get_my_course_offering_checkout_statuses()
returns table (
  application_id uuid,
  offering_id uuid,
  course_id uuid,
  learner_id uuid,
  learner_full_name text,
  content_access_user_id uuid,
  program_name text,
  offering_name text,
  contract_policy text,
  application_status text,
  contract_accepted_at timestamptz,
  payment_due_at timestamptz,
  payment_proof_id uuid,
  payment_status text,
  payment_rejection_reason text,
  payment_created_at timestamptz,
  payment_reviewed_at timestamptz,
  amount_mnt integer,
  enrollment_id uuid,
  enrollment_status text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    application.id,
    application.offering_id,
    application.course_id_snapshot,
    application.learner_id,
    learner.full_name,
    application.content_access_user_id,
    application.terms_snapshot ->> 'program_name',
    application.terms_snapshot ->> 'offering_name',
    application.contract_policy_snapshot,
    case
      when application.status = 'withdrawn' then 'withdrawn'
      when application.status = 'approved' then 'approved'
      when latest_payment.status = 'pending' then 'pending_review'
      when latest_payment.status = 'rejected' then 'correction_required'
      when application.contract_policy_snapshot = 'required' and acceptance.id is null then 'contract_required'
      else 'ready_for_payment'
    end,
    acceptance.accepted_at,
    application.payment_due_at,
    latest_payment.id,
    case latest_payment.status
      when 'pending' then 'pending_review'
      when 'rejected' then 'correction_required'
      when 'approved' then 'approved'
    end,
    latest_payment.rejection_reason,
    latest_payment.created_at,
    latest_payment.reviewed_at,
    application.tuition_amount_mnt_snapshot,
    enrollment.id,
    enrollment.status,
    application.updated_at
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
  where application.applicant_user_id = (select auth.uid())
  order by application.updated_at desc;
$$;

create or replace function public.get_my_effective_course_access()
returns table (
  course_id uuid,
  access_id uuid,
  granted_at timestamptz,
  grant_source text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (access.course_id)
    access.course_id,
    access.access_id,
    access.granted_at,
    access.grant_source
  from (
    select
      enrollment.course_id,
      enrollment.id as access_id,
      enrollment.granted_at,
      'legacy_' || enrollment.grant_source as grant_source
    from public.enrollments enrollment
    where enrollment.user_id = (select auth.uid())
      and enrollment.status::text = 'active'

    union all

    select
      entitlement.course_id,
      entitlement.id,
      entitlement.granted_at,
      'offering_' || entitlement.item_kind
    from public.course_access_entitlements entitlement
    join public.course_offering_enrollments enrollment
      on enrollment.id = entitlement.enrollment_id
     and enrollment.status = 'active'
    where entitlement.user_id = (select auth.uid())
      and entitlement.status = 'active'
  ) access
  order by access.course_id, access.granted_at desc, access.access_id;
$$;

create or replace function public.has_effective_course_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments enrollment
    where enrollment.user_id = (select auth.uid())
      and enrollment.course_id = p_course_id
      and enrollment.status::text = 'active'
  ) or exists (
    select 1
    from public.course_access_entitlements entitlement
    join public.course_offering_enrollments enrollment
      on enrollment.id = entitlement.enrollment_id
     and enrollment.status = 'active'
    where entitlement.user_id = (select auth.uid())
      and entitlement.course_id = p_course_id
      and entitlement.status = 'active'
  );
$$;

create or replace function public.course_uses_offering_checkout(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_checkout_ownerships ownership
    where ownership.course_id = p_course_id
  );
$$;

revoke all on function public.list_public_course_offerings(uuid) from public;
grant execute on function public.list_public_course_offerings(uuid) to anon, authenticated, service_role;
revoke all on function public.get_course_offering_checkout_form(uuid) from public;
grant execute on function public.get_course_offering_checkout_form(uuid) to anon, authenticated, service_role;
revoke all on function public.get_my_course_offering_checkout_statuses() from public, anon;
grant execute on function public.get_my_course_offering_checkout_statuses() to authenticated, service_role;
revoke all on function public.get_my_effective_course_access() from public, anon;
grant execute on function public.get_my_effective_course_access() to authenticated, service_role;
revoke all on function public.has_effective_course_access(uuid) from public, anon;
grant execute on function public.has_effective_course_access(uuid) to authenticated, service_role;
revoke all on function public.course_uses_offering_checkout(uuid) from public, anon;
grant execute on function public.course_uses_offering_checkout(uuid) to anon, authenticated, service_role;

-- The original Q&A policies authorize only rows in the legacy enrollments
-- table. Keep those policies intact for V1 and add the canonical effective
-- access predicate so V2 primary and bonus entitlements receive the same Q&A
-- capability without granting access to any additional course.
create policy "Effective course access can read lesson questions"
on public.questions
for select
to authenticated
using (public.has_effective_course_access(questions.course_id));

create policy "Effective course access can ask lesson questions"
on public.questions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and public.has_effective_course_access(questions.course_id)
);

-- The production paid-video policy is also legacy-enrollment-only. Add V2
-- entitlement access as a separate permissive policy so preview and every V1
-- policy keep their existing behavior.
create policy "Effective course access can read lesson videos"
on public.lesson_videos
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons lesson
    where lesson.id = lesson_videos.lesson_id
      and public.has_effective_course_access(lesson.course_id)
  )
);

-- ---------------------------------------------------------------------------
-- Draft preparation and adaptive contract acceptance
-- ---------------------------------------------------------------------------

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
  signer_email text;
  signer_phone text;
  signer_registration_number text;
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
  signer_email := nullif(lower(trim(coalesce(p_details ->> 'signer_email', ''))), '');
  signer_phone := nullif(trim(coalesce(p_details ->> 'signer_phone', '')), '');
  signer_registration_number := nullif(trim(coalesce(p_details ->> 'signer_registration_number', '')), '');
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

    if signer_name is null or signer_email is null or signer_phone is null or signer_registration_number is null then
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
      if signer_registration_number <> learner_registration_number then
        raise exception 'The adult signer registration number must match the learner registration number.';
      end if;
      if signer_email <> current_email then
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
      signer_email,
      signer_phone,
      signer_registration_number,
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
    signer_email := null;
    signer_phone := null;
    signer_registration_number := null;
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
      select 1 from public.course_offering_contract_acceptances acceptance
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
      and existing_application.signer_email is not distinct from signer_email
      and existing_application.signer_phone is not distinct from signer_phone
      and existing_application.signer_registration_number is not distinct from signer_registration_number
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
      signer_email = signer_email,
      signer_phone = signer_phone,
      signer_registration_number = signer_registration_number,
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
    signer_email,
    signer_phone,
    signer_registration_number,
    normalized_answers,
    private.build_course_offering_terms_snapshot(target_offering.id)
  ) returning id into application_id;

  return application_id;
exception
  when unique_violation then
    -- A concurrent retry can pass the initial lookup before the winning
    -- transaction commits, then wait on the unique request-id constraint. The
    -- exception subtransaction rolls back this attempt's learner/link rows;
    -- return the committed winner only when every checkout identity boundary
    -- still matches. Other unique conflicts remain hard failures.
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

create or replace function public.get_course_offering_contract_verification_policy(
  p_applicant_user_id uuid,
  p_session_id uuid,
  p_application_id uuid
)
returns jsonb
language plpgsql
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
  from public.course_offering_applications application
  where application.id = p_application_id
    and application.applicant_user_id = p_applicant_user_id
    and application.contract_policy_snapshot = 'required'
    and application.status = 'draft'
  for update;

  if not found or nullif(trim(coalesce(target_signer_email, '')), '') is null then
    raise exception 'A prepared contract checkout draft is required.';
  end if;

  if exists (
    select 1 from public.course_offering_contract_acceptances acceptance
    where acceptance.application_id = p_application_id
  ) then
    raise exception 'The contract has already been accepted.';
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

  update public.course_offering_applications
  set
    signature_policy_required = verification_required,
    signature_policy_reason = verification_reason,
    signature_policy_session_id = p_session_id,
    signature_policy_evaluated_at = now()
  where id = p_application_id;

  return jsonb_build_object(
    'verification_required', verification_required,
    'reason', verification_reason,
    'signer_email', lower(trim(target_signer_email))
  );
end;
$$;

create or replace function public.reserve_course_offering_signature_verification(p_application_id uuid)
returns table (
  reserved boolean,
  retry_after_seconds integer,
  reserved_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_application public.course_offering_applications%rowtype;
  reservation_time timestamptz := now();
  seconds_remaining integer;
begin
  select application.* into target_application
  from public.course_offering_applications application
  where application.id = p_application_id
    and application.contract_policy_snapshot = 'required'
    and application.status = 'draft'
  for update;

  if not found
     or target_application.signature_policy_required is distinct from true
     or target_application.signature_policy_evaluated_at is null
     or target_application.signature_policy_evaluated_at < now() - interval '15 minutes'
     or nullif(trim(coalesce(target_application.signer_email, '')), '') is null then
    raise exception 'A current email-verification policy is required.';
  end if;

  if target_application.signature_verification_sent_at is not null
     and target_application.signature_verification_sent_at > now() - interval '60 seconds' then
    seconds_remaining := greatest(
      ceil(extract(epoch from target_application.signature_verification_sent_at + interval '60 seconds' - now()))::integer,
      1
    );
    return query select false, seconds_remaining, target_application.signature_verification_sent_at;
    return;
  end if;

  update public.course_offering_applications
  set signature_verification_sent_at = reservation_time
  where id = target_application.id;

  return query select true, 0, reservation_time;
end;
$$;

create or replace function public.release_course_offering_signature_verification(
  p_application_id uuid,
  p_reserved_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.course_offering_applications
  set signature_verification_sent_at = null
  where id = p_application_id
    and status = 'draft'
    and signature_verification_sent_at = p_reserved_at;

  return found;
end;
$$;

create or replace function public.finalize_course_offering_contract_acceptance(
  p_application_id uuid,
  p_applicant_user_id uuid,
  p_signature_method text,
  p_signature_statement text,
  p_signature_statement_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_application public.course_offering_applications%rowtype;
  target_learner public.learners%rowtype;
  target_contract public.contract_template_versions%rowtype;
  target_offering_id uuid;
  existing_acceptance_id uuid;
  expected_signer_role text;
  normalized_answers jsonb;
  required_keys text[];
  unresolved_keys text[];
  resolved_values jsonb;
  acceptance_id uuid;
  signing_time timestamptz := now();
  local_contract_date date := timezone('Asia/Ulaanbaatar', now())::date;
  allocated_contract_number text;
begin
  if p_signature_method not in ('authenticated_account', 'email_otp') then
    raise exception 'The contract acceptance method is invalid.';
  end if;
  if nullif(trim(coalesce(p_signature_statement, '')), '') is null
     or nullif(trim(coalesce(p_signature_statement_version, '')), '') is null then
    raise exception 'The contract acceptance statement is required.';
  end if;

  select acceptance.id into existing_acceptance_id
  from public.course_offering_contract_acceptances acceptance
  where acceptance.application_id = p_application_id
    and acceptance.applicant_user_id = p_applicant_user_id;
  if found then
    return existing_acceptance_id;
  end if;

  select application.offering_id into target_offering_id
  from public.course_offering_applications application
  where application.id = p_application_id
    and application.applicant_user_id = p_applicant_user_id;
  if not found then
    raise exception 'The prepared contract checkout does not exist.';
  end if;

  perform 1
  from public.training_cohorts cohort
  where cohort.id = target_offering_id
    and cohort.checkout_version = 2
  for update;
  if not found then
    raise exception 'The V2 course offering does not exist.';
  end if;

  select application.* into target_application
  from public.course_offering_applications application
  where application.id = p_application_id
    and application.applicant_user_id = p_applicant_user_id
    and application.contract_policy_snapshot = 'required'
    and application.status = 'draft'
  for update;
  if not found then
    raise exception 'The prepared contract checkout is not available for acceptance.';
  end if;

  if target_application.signature_policy_evaluated_at is null
     or target_application.signature_policy_evaluated_at < now() - interval '15 minutes' then
    raise exception 'The contract verification policy must be evaluated again.';
  end if;
  if target_application.signature_policy_required and p_signature_method <> 'email_otp' then
    raise exception 'Email verification is required for this signer.';
  end if;
  if not target_application.signature_policy_required and p_signature_method <> 'authenticated_account' then
    raise exception 'The selected contract verification method is not required.';
  end if;
  if p_signature_method = 'email_otp' and (
    target_application.signature_verification_sent_at is null
    or target_application.signature_verification_sent_at < now() - interval '15 minutes'
  ) then
    raise exception 'A current verified email code is required.';
  end if;

  select learner.* into strict target_learner
  from public.learners learner
  where learner.id = target_application.learner_id;

  if target_learner.birth_date is null or target_learner.birth_date > local_contract_date then
    raise exception 'A valid learner birth date is required.';
  end if;
  expected_signer_role := case
    when target_learner.birth_date + interval '18 years' <= local_contract_date then 'self'
    else 'guardian'
  end;
  if target_application.signer_role is distinct from expected_signer_role then
    raise exception 'The contract signer role does not match the learner age.';
  end if;
  if nullif(trim(coalesce(target_learner.registration_number, '')), '') is null
     or nullif(trim(coalesce(target_application.signer_full_name, '')), '') is null
     or nullif(trim(coalesce(target_application.signer_email, '')), '') is null
     or nullif(trim(coalesce(target_application.signer_phone, '')), '') is null
     or nullif(trim(coalesce(target_application.signer_registration_number, '')), '') is null then
    raise exception 'The learner or signer identity information is incomplete.';
  end if;
  if expected_signer_role = 'self' then
    if target_application.applicant_relationship <> 'self'
       or lower(regexp_replace(target_application.signer_full_name, '\s+', ' ', 'g'))
          <> lower(regexp_replace(target_learner.full_name, '\s+', ' ', 'g'))
       or target_application.signer_registration_number <> target_learner.registration_number
       or lower(trim(target_application.signer_email)) <> lower(trim(target_application.contact_email)) then
      raise exception 'The adult signer identity must match the learner and authenticated account.';
    end if;
  elsif target_application.applicant_relationship not in ('parent', 'guardian') then
    raise exception 'A learner under 18 must be represented by a parent or legal guardian.';
  end if;

  select version.* into target_contract
  from public.contract_template_versions version
  where version.id = target_application.contract_version_id
    and version.status in ('published', 'retired');
  if not found then
    raise exception 'The selected contract version is not available.';
  end if;

  normalized_answers := private.merge_course_offering_participant_answers(
    target_application.contract_version_id,
    target_application.answers,
    target_learner.full_name,
    target_learner.birth_date,
    target_learner.registration_number,
    target_application.signer_full_name,
    target_application.signer_email,
    target_application.signer_phone,
    target_application.signer_registration_number,
    target_application.applicant_relationship
  );
  normalized_answers := private.validate_cohort_application_answers(
    target_application.contract_version_id,
    normalized_answers,
    true
  );

  update public.course_offering_applications
  set answers = normalized_answers
  where id = target_application.id;

  allocated_contract_number := private.allocate_contract_number(signing_time);
  resolved_values := private.build_course_offering_contract_values(
    target_application.id,
    allocated_contract_number,
    local_contract_date
  );

  select coalesce(array_agg(variable_key order by variable_key), '{}'::text[])
  into required_keys
  from (
    select distinct variable_match[1] as variable_key
    from regexp_matches(
      target_contract.content,
      '\{\{([a-z][a-z0-9_]*)\}\}',
      'g'
    ) variable_match
  ) variables;

  select coalesce(array_agg(variable_key order by variable_key), '{}'::text[])
  into unresolved_keys
  from unnest(required_keys) variable_key
  where nullif(trim(resolved_values ->> variable_key), '') is null;

  if cardinality(unresolved_keys) > 0 then
    raise exception 'Contract variables are unresolved: %', array_to_string(unresolved_keys, ', ');
  end if;

  insert into public.course_offering_contract_acceptances (
    application_id,
    offering_id,
    learner_id,
    applicant_user_id,
    contract_version_id,
    contract_title,
    contract_version_number,
    contract_number,
    contract_date,
    contract_content,
    required_variable_keys,
    unresolved_variable_keys,
    resolved_values,
    answers_snapshot,
    learner_snapshot,
    signer_snapshot,
    terms_snapshot,
    signature_method,
    signer_email_verified_at,
    signature_statement,
    signature_statement_version,
    contract_content_sha256,
    accepted_at,
    created_at
  ) values (
    target_application.id,
    target_application.offering_id,
    target_application.learner_id,
    target_application.applicant_user_id,
    target_application.contract_version_id,
    target_contract.title,
    target_contract.version_number,
    allocated_contract_number,
    local_contract_date,
    target_contract.content,
    required_keys,
    unresolved_keys,
    resolved_values,
    normalized_answers,
    jsonb_build_object(
      'id', target_learner.id,
      'full_name', target_learner.full_name,
      'birth_date', target_learner.birth_date,
      'registration_number', target_learner.registration_number
    ),
    jsonb_build_object(
      'role', target_application.signer_role,
      'relationship', target_application.applicant_relationship,
      'full_name', target_application.signer_full_name,
      'email', lower(trim(target_application.signer_email)),
      'phone', target_application.signer_phone,
      'registration_number', target_application.signer_registration_number
    ),
    target_application.terms_snapshot,
    p_signature_method,
    signing_time,
    trim(p_signature_statement),
    trim(p_signature_statement_version),
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(target_contract.content || E'\n' || resolved_values::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    signing_time,
    signing_time
  ) returning id into acceptance_id;

  return acceptance_id;
end;
$$;

revoke all on function public.save_course_offering_checkout_draft(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_course_offering_checkout_draft(uuid, uuid, jsonb) to authenticated, service_role;
revoke all on function public.get_course_offering_contract_verification_policy(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_course_offering_contract_verification_policy(uuid, uuid, uuid) to service_role;
revoke all on function public.reserve_course_offering_signature_verification(uuid) from public, anon, authenticated;
grant execute on function public.reserve_course_offering_signature_verification(uuid) to service_role;
revoke all on function public.release_course_offering_signature_verification(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.release_course_offering_signature_verification(uuid, timestamptz) to service_role;
revoke all on function public.finalize_course_offering_contract_acceptance(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finalize_course_offering_contract_acceptance(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Receipt submission and atomic administrative review
-- ---------------------------------------------------------------------------

create or replace function public.submit_course_offering_checkout(
  p_application_id uuid,
  p_receipt_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_offering_id uuid;
  target_application public.course_offering_applications%rowtype;
  target_offering public.training_cohorts%rowtype;
  normalized_receipt_path text := trim(coalesce(p_receipt_path, ''));
  payment_proof_id uuid;
  next_attempt integer;
  bonus_snapshot jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select application.offering_id into target_offering_id
  from public.course_offering_applications application
  where application.id = p_application_id
    and application.applicant_user_id = current_user_id;
  if not found then
    raise exception 'The checkout application does not exist.';
  end if;

  select cohort.* into target_offering
  from public.training_cohorts cohort
  where cohort.id = target_offering_id
    and cohort.checkout_version = 2
  for update;
  if not found then
    raise exception 'The V2 course offering does not exist.';
  end if;
  -- Registration may already be closed while an existing applicant is still
  -- inside the immutable payment window (including a correction attempt).
  -- Completed and cancelled offerings must never accept new money evidence.
  if target_offering.status not in ('open', 'closed', 'in_progress') then
    raise exception 'This course offering is not operational for payment submission.';
  end if;

  select application.* into target_application
  from public.course_offering_applications application
  where application.id = p_application_id
    and application.applicant_user_id = current_user_id
    and application.status in ('draft', 'submitted')
  for update;
  if not found then
    raise exception 'This checkout is not available for payment submission.';
  end if;

  if normalized_receipt_path = ''
     or normalized_receipt_path like '%..%'
     or normalized_receipt_path !~ (
       '^' || current_user_id::text || '/offering/' || target_application.id::text || '/[^/]+$'
     ) then
    raise exception 'The payment receipt path is invalid.';
  end if;

  if not exists (
    select 1
    from storage.objects receipt_object
    where receipt_object.bucket_id = 'payment-receipts'
      and receipt_object.name = normalized_receipt_path
      and (
        receipt_object.owner = current_user_id
        or receipt_object.owner_id = current_user_id::text
      )
  ) then
    raise exception 'The authenticated user does not own this payment receipt.';
  end if;

  if target_application.payment_due_at < now() then
    raise exception 'The payment deadline has passed.';
  end if;
  if target_application.contract_policy_snapshot = 'required' and not exists (
    select 1
    from public.course_offering_contract_acceptances acceptance
    where acceptance.application_id = target_application.id
  ) then
    raise exception 'The contract must be accepted before payment submission.';
  end if;
  if exists (
    select 1
    from public.course_offering_payment_proofs proof
    where proof.application_id = target_application.id
      and proof.status in ('pending', 'approved')
  ) then
    raise exception 'This checkout already has a pending or approved payment proof.';
  end if;
  if exists (
    select 1
    from public.course_offering_enrollments enrollment
    where enrollment.application_id = target_application.id
      and enrollment.status = 'active'
  ) then
    raise exception 'This checkout is already enrolled.';
  end if;

  if not exists (
    select 1
    from public.course_offering_application_courses item
    where item.application_id = target_application.id
  ) then
    -- Capture the bonus relationship set exactly once. Later administrative
    -- edits apply to future checkouts, while this application's promised set
    -- remains deterministic and immutable.
    select coalesce(jsonb_agg(jsonb_build_object(
      'course_id', bonus_course.id,
      'course_title', bonus_course.title,
      'position', positioned_bonus.position
    ) order by positioned_bonus.position), '[]'::jsonb)
    into bonus_snapshot
    from (
      select
        relation.bonus_course_id,
        row_number() over (
          order by relation.created_at, relation.bonus_course_id
        )::integer as position
      from public.course_bonus_courses relation
      where relation.source_course_id = target_application.course_id_snapshot
    ) positioned_bonus
    join public.courses bonus_course on bonus_course.id = positioned_bonus.bonus_course_id;

    -- Lock the primary and every currently configured bonus course in one
    -- deterministic order. Administrative approval takes the same locks in
    -- the same order, preventing cross-checkout deadlocks while the promised
    -- access set is snapshotted.
    perform 1
    from public.courses course
    where course.id = target_application.course_id_snapshot
       or course.id in (
         select (bonus_item.value ->> 'course_id')::uuid
         from jsonb_array_elements(bonus_snapshot) as bonus_item(value)
       )
    order by course.id
    for update;

    if not private.course_is_ready(target_application.course_id_snapshot) then
      raise exception 'The primary course is not ready for enrollment.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(bonus_snapshot) as bonus_item(value)
      where not private.course_is_ready((bonus_item.value ->> 'course_id')::uuid)
    ) then
      raise exception 'A configured bonus course is not ready for enrollment.';
    end if;

    insert into public.course_offering_application_courses (
      application_id,
      course_id,
      item_kind,
      source_course_id,
      course_title_snapshot,
      position
    )
    select
      target_application.id,
      course.id,
      'primary',
      null,
      course.title,
      0
    from public.courses course
    where course.id = target_application.course_id_snapshot;

    insert into public.course_offering_application_courses (
      application_id,
      course_id,
      item_kind,
      source_course_id,
      course_title_snapshot,
      position
    )
    select
      target_application.id,
      bonus_item.course_id,
      'bonus',
      target_application.course_id_snapshot,
      bonus_item.course_title,
      bonus_item.position
    from jsonb_to_recordset(bonus_snapshot) as bonus_item(
      course_id uuid,
      course_title text,
      position integer
    )
    order by bonus_item.position;
  end if;

  select coalesce(max(proof.attempt_number), 0) + 1
  into next_attempt
  from public.course_offering_payment_proofs proof
  where proof.application_id = target_application.id;

  insert into public.course_offering_payment_proofs (
    application_id,
    offering_id,
    applicant_user_id,
    attempt_number,
    receipt_path,
    amount_mnt
  ) values (
    target_application.id,
    target_application.offering_id,
    current_user_id,
    next_attempt,
    normalized_receipt_path,
    target_application.tuition_amount_mnt_snapshot
  ) returning id into payment_proof_id;

  update public.course_offering_applications
  set
    status = 'submitted',
    submitted_at = coalesce(submitted_at, now()),
    reviewed_by = null,
    reviewed_at = null,
    withdrawn_at = null
  where id = target_application.id;

  perform private.enqueue_course_offering_notification(
    'course_offering.payment_submitted',
    target_application.id,
    'course-offering-payment-submitted:' || payment_proof_id::text,
    'admins',
    null,
    null,
    jsonb_build_object(
      'application_id', target_application.id,
      'payment_proof_id', payment_proof_id,
      'offering_id', target_application.offering_id,
      'learner_id', target_application.learner_id,
      'amount_mnt', target_application.tuition_amount_mnt_snapshot
    )
  );

  return payment_proof_id;
end;
$$;

create or replace function public.reject_course_offering_checkout_payment(
  p_payment_proof_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_application_id uuid;
  target_offering_id uuid;
  target_application public.course_offering_applications%rowtype;
  target_payment public.course_offering_payment_proofs%rowtype;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if current_user_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;
  if normalized_reason is null or char_length(normalized_reason) > 500 then
    raise exception 'A valid payment rejection reason is required.';
  end if;

  select proof.application_id, proof.offering_id
  into target_application_id, target_offering_id
  from public.course_offering_payment_proofs proof
  where proof.id = p_payment_proof_id;
  if not found then
    raise exception 'The payment proof does not exist.';
  end if;

  perform 1
  from public.training_cohorts cohort
  where cohort.id = target_offering_id
    and cohort.checkout_version = 2
  for update;
  if not found then
    raise exception 'The V2 course offering does not exist.';
  end if;

  select application.* into target_application
  from public.course_offering_applications application
  where application.id = target_application_id
  for update;
  if not found then
    raise exception 'The checkout application does not exist.';
  end if;

  select proof.* into target_payment
  from public.course_offering_payment_proofs proof
  where proof.id = p_payment_proof_id
  for update;
  if not found then
    raise exception 'The payment proof does not exist.';
  end if;

  if target_payment.status = 'rejected' then
    return jsonb_build_object(
      'application_id', target_application.id,
      'payment_proof_id', target_payment.id,
      'status', target_payment.status
    );
  end if;
  if target_payment.status <> 'pending' or target_application.status <> 'submitted' then
    raise exception 'The payment proof is no longer pending review.';
  end if;

  update public.course_offering_payment_proofs
  set
    status = 'rejected',
    rejection_reason = normalized_reason,
    reviewed_by = current_user_id,
    reviewed_at = now()
  where id = target_payment.id;

  update public.course_offering_applications
  set payment_due_at = now() + make_interval(days => payment_due_days_snapshot)
  where id = target_application.id;

  perform private.enqueue_course_offering_notification(
    'course_offering.payment_rejected',
    target_application.id,
    'course-offering-payment-rejected:' || target_payment.id::text,
    'user',
    target_application.applicant_user_id,
    target_application.contact_email,
    jsonb_build_object(
      'application_id', target_application.id,
      'payment_proof_id', target_payment.id,
      'offering_id', target_application.offering_id,
      'reason', normalized_reason,
      'payment_due_at', now() + make_interval(days => target_application.payment_due_days_snapshot)
    )
  );

  return jsonb_build_object(
    'application_id', target_application.id,
    'payment_proof_id', target_payment.id,
    'status', 'rejected'
  );
end;
$$;

create or replace function public.approve_course_offering_checkout(p_payment_proof_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_application_id uuid;
  target_offering_id uuid;
  target_application public.course_offering_applications%rowtype;
  target_payment public.course_offering_payment_proofs%rowtype;
  target_offering public.training_cohorts%rowtype;
  new_enrollment_id uuid;
  active_count bigint;
  primary_count integer;
  entitlement_course_ids jsonb;
begin
  if current_user_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  select proof.application_id, proof.offering_id
  into target_application_id, target_offering_id
  from public.course_offering_payment_proofs proof
  where proof.id = p_payment_proof_id;
  if not found then
    raise exception 'The payment proof does not exist.';
  end if;

  select cohort.* into target_offering
  from public.training_cohorts cohort
  where cohort.id = target_offering_id
    and cohort.checkout_version = 2
  for update;
  if not found then
    raise exception 'The V2 course offering does not exist.';
  end if;

  select application.* into target_application
  from public.course_offering_applications application
  where application.id = target_application_id
  for update;
  if not found then
    raise exception 'The checkout application does not exist.';
  end if;

  select proof.* into target_payment
  from public.course_offering_payment_proofs proof
  where proof.id = p_payment_proof_id
  for update;
  if not found then
    raise exception 'The payment proof does not exist.';
  end if;

  if target_payment.status = 'approved' then
    select enrollment.id into new_enrollment_id
    from public.course_offering_enrollments enrollment
    where enrollment.payment_proof_id = target_payment.id;
    select coalesce(jsonb_agg(entitlement.course_id order by entitlement.course_id), '[]'::jsonb)
    into entitlement_course_ids
    from public.course_access_entitlements entitlement
    where entitlement.enrollment_id = new_enrollment_id;
    return jsonb_build_object(
      'application_id', target_application.id,
      'payment_proof_id', target_payment.id,
      'enrollment_id', new_enrollment_id,
      'entitlement_course_ids', entitlement_course_ids,
      'already_approved', true
    );
  end if;

  -- Preserve an idempotent read of an already-approved decision above, but do
  -- not create a new active enrollment once the offering is cancelled or has
  -- completed. Closed/in-progress offerings remain valid while the immutable
  -- applicant payment deadline is still being administered.
  if target_offering.status not in ('open', 'closed', 'in_progress') then
    raise exception 'This course offering is not operational for approval.';
  end if;

  if target_payment.status <> 'pending' or target_application.status <> 'submitted' then
    raise exception 'The payment proof is no longer pending review.';
  end if;
  if target_payment.amount_mnt <> target_application.tuition_amount_mnt_snapshot then
    raise exception 'The payment amount does not match the checkout snapshot.';
  end if;
  if target_application.contract_policy_snapshot = 'required' and not exists (
    select 1
    from public.course_offering_contract_acceptances acceptance
    where acceptance.application_id = target_application.id
  ) then
    raise exception 'The contract acceptance evidence is missing.';
  end if;

  select count(*) filter (where item.item_kind = 'primary')
  into primary_count
  from public.course_offering_application_courses item
  where item.application_id = target_application.id;
  if primary_count <> 1 then
    raise exception 'The checkout course snapshot is incomplete.';
  end if;

  perform 1
  from public.courses course
  join public.course_offering_application_courses item on item.course_id = course.id
  where item.application_id = target_application.id
  order by course.id
  for update of course;

  if exists (
    select 1
    from public.course_offering_application_courses item
    where item.application_id = target_application.id
      and not private.course_is_ready(item.course_id)
  ) then
    raise exception 'A promised course is not ready for access.';
  end if;

  select count(*) into active_count
  from public.course_offering_enrollments enrollment
  where enrollment.offering_id = target_offering.id
    and enrollment.status = 'active';
  if target_offering.capacity is not null and active_count >= target_offering.capacity then
    raise exception 'This course offering has no available seats.';
  end if;

  insert into public.course_offering_enrollments (
    offering_id,
    application_id,
    payment_proof_id,
    learner_id,
    applicant_user_id,
    content_access_user_id
  ) values (
    target_application.offering_id,
    target_application.id,
    target_payment.id,
    target_application.learner_id,
    target_application.applicant_user_id,
    target_application.content_access_user_id
  ) returning id into new_enrollment_id;

  insert into public.course_access_entitlements (
    enrollment_id,
    application_course_id,
    user_id,
    course_id,
    item_kind
  )
  select
    new_enrollment_id,
    item.id,
    target_application.content_access_user_id,
    item.course_id,
    item.item_kind
  from public.course_offering_application_courses item
  where item.application_id = target_application.id
  order by item.position;

  update public.course_offering_payment_proofs
  set
    status = 'approved',
    rejection_reason = null,
    reviewed_by = current_user_id,
    reviewed_at = now()
  where id = target_payment.id;

  update public.course_offering_applications
  set
    status = 'approved',
    reviewed_by = current_user_id,
    reviewed_at = now()
  where id = target_application.id;

  select coalesce(jsonb_agg(entitlement.course_id order by entitlement.course_id), '[]'::jsonb)
  into entitlement_course_ids
  from public.course_access_entitlements entitlement
  where entitlement.enrollment_id = new_enrollment_id;

  perform private.enqueue_course_offering_notification(
    'course_offering.checkout_approved',
    target_application.id,
    'course-offering-checkout-approved:' || target_payment.id::text,
    'user',
    target_application.applicant_user_id,
    target_application.contact_email,
    jsonb_build_object(
      'application_id', target_application.id,
      'payment_proof_id', target_payment.id,
      'enrollment_id', new_enrollment_id,
      'offering_id', target_application.offering_id,
      'course_ids', entitlement_course_ids,
      'content_access_user_id', target_application.content_access_user_id
    )
  );

  return jsonb_build_object(
    'application_id', target_application.id,
    'payment_proof_id', target_payment.id,
    'enrollment_id', new_enrollment_id,
    'entitlement_course_ids', entitlement_course_ids,
    'already_approved', false
  );
end;
$$;

revoke all on function public.submit_course_offering_checkout(uuid, text) from public, anon;
grant execute on function public.submit_course_offering_checkout(uuid, text) to authenticated, service_role;
revoke all on function public.reject_course_offering_checkout_payment(uuid, text) from public, anon;
grant execute on function public.reject_course_offering_checkout_payment(uuid, text) to authenticated, service_role;
revoke all on function public.approve_course_offering_checkout(uuid) from public, anon;
grant execute on function public.approve_course_offering_checkout(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- V1/V2 isolation. Legacy endpoints and legacy payment tables must never
-- mutate or expose a V2 offering.
-- ---------------------------------------------------------------------------

create or replace function private.require_legacy_cohort_checkout_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_cohort_id uuid;
begin
  target_cohort_id := case
    when tg_table_name = 'cohort_applications' then new.cohort_id
    when tg_table_name = 'cohort_payment_requests' then new.cohort_id
  end;

  if not exists (
    select 1
    from public.training_cohorts cohort
    where cohort.id = target_cohort_id
      and cohort.checkout_version = 1
  ) then
    raise exception 'Legacy cohort checkout cannot mutate a V2 course offering.';
  end if;

  return new;
end;
$$;

create or replace function private.block_legacy_course_payment_for_v2_offering()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.course_id is not distinct from old.course_id then
    return new;
  end if;

  -- Serialize legacy payment creation with the transaction that first opens a
  -- V2 offering. Whichever transaction acquires the course row first defines
  -- the boundary; after a cutover commits, every new legacy request is blocked.
  perform 1
  from public.courses course
  where course.id = new.course_id
  for update;

  if exists (
    select 1
    from public.course_checkout_ownerships ownership
    where ownership.course_id = new.course_id
  ) then
    raise exception 'This course must use the course offering checkout.';
  end if;

  return new;
end;
$$;

create trigger a0_cohort_applications_require_v1
before insert or update on public.cohort_applications
for each row execute function private.require_legacy_cohort_checkout_version();

create trigger a0_cohort_payment_requests_require_v1
before insert or update on public.cohort_payment_requests
for each row execute function private.require_legacy_cohort_checkout_version();

create trigger a0_payment_requests_block_v2_courses
before insert or update of course_id on public.payment_requests
for each row execute function private.block_legacy_course_payment_for_v2_offering();

revoke all on function private.require_legacy_cohort_checkout_version() from public, anon, authenticated;
revoke all on function private.block_legacy_course_payment_for_v2_offering() from public, anon, authenticated;

create or replace function private.enforce_training_cohort_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  contract_is_assignable boolean;
  program_is_active boolean;
  contract_is_required boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft cohorts can be deleted.';
    end if;
    return old;
  end if;

  contract_is_required := new.checkout_version = 1 or new.contract_policy = 'required';

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New cohorts must begin as drafts.';
    end if;
    if new.created_by is distinct from current_user_id
       or new.status_changed_by is distinct from current_user_id then
      raise exception 'Cohort authorship must match the authenticated administrator.';
    end if;

    select not program.is_archived into program_is_active
    from public.training_programs program
    where program.id = new.program_id;
    if coalesce(program_is_active, false) is false then
      raise exception 'New cohorts cannot be created for an archived program.';
    end if;

    if new.contract_version_id is not null then
      select version.status = 'published' and not template.is_archived
      into contract_is_assignable
      from public.contract_template_versions version
      join public.contract_templates template on template.id = version.template_id
      where version.id = new.contract_version_id;
      if coalesce(contract_is_assignable, false) is false then
        raise exception 'Only a published version from an active contract template can be assigned.';
      end if;
      new.contract_assigned_by := current_user_id;
      new.contract_assigned_at := now();
    else
      new.contract_assigned_by := null;
      new.contract_assigned_at := null;
    end if;

    new.status_changed_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.program_id is distinct from old.program_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Cohort identity, program, and authorship are immutable.';
  end if;
  if old.status in ('completed', 'cancelled') then
    raise exception 'Completed or cancelled cohorts are immutable.';
  end if;

  if new.contract_version_id is distinct from old.contract_version_id then
    if old.status <> 'draft' then
      raise exception 'A cohort contract can only be changed while the cohort is a draft.';
    end if;
    if new.contract_version_id is not null then
      select version.status = 'published' and not template.is_archived
      into contract_is_assignable
      from public.contract_template_versions version
      join public.contract_templates template on template.id = version.template_id
      where version.id = new.contract_version_id;
      if coalesce(contract_is_assignable, false) is false then
        raise exception 'Only a published version from an active contract template can be assigned.';
      end if;
      new.contract_assigned_by := current_user_id;
      new.contract_assigned_at := now();
    else
      new.contract_assigned_by := null;
      new.contract_assigned_at := null;
    end if;
  else
    new.contract_assigned_by := old.contract_assigned_by;
    new.contract_assigned_at := old.contract_assigned_at;
  end if;

  if new.status is distinct from old.status then
    -- Cancellation needs a dedicated transaction that reviews applications,
    -- payments, enrollments and entitlements together. Until that flow exists,
    -- fail closed once any customer workflow or active access is attached.
    if new.checkout_version = 2
       and new.status = 'cancelled'
       and (
         exists (
           select 1
           from public.course_offering_applications application
           where application.offering_id = new.id
             and application.status <> 'withdrawn'
         )
         or exists (
           select 1
           from public.course_offering_enrollments enrollment
           where enrollment.offering_id = new.id
             and enrollment.status = 'active'
         )
         or exists (
           select 1
           from public.course_access_entitlements entitlement
           join public.course_offering_enrollments enrollment
             on enrollment.id = entitlement.enrollment_id
           where enrollment.offering_id = new.id
             and entitlement.status = 'active'
         )
       ) then
      raise exception 'A V2 offering with customer activity cannot be cancelled without the atomic cancellation workflow.';
    end if;

    if not (
      (old.status = 'draft' and new.status in ('open', 'cancelled'))
      or (old.status = 'open' and new.status in ('closed', 'cancelled'))
      or (old.status = 'closed' and new.status in ('open', 'in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Invalid cohort status transition from % to %.', old.status, new.status;
    end if;

    if new.status = 'open' then
      if new.checkout_version = 2 then
        if new.delivery_mode not in ('online', 'offline') then
          raise exception 'V2 offerings must use online or offline delivery.';
        end if;
        if new.course_id is null or coalesce(private.course_is_ready(new.course_id), false) is false then
          raise exception 'A published course with at least one ready video is required before opening registration.';
        end if;
        if new.tuition_amount_mnt is null or new.tuition_amount_mnt <= 0 then
          raise exception 'A positive tuition amount is required before opening V2 registration.';
        end if;
        if new.payment_due_days is null or new.payment_due_days <= 0 then
          raise exception 'A positive payment deadline is required before opening V2 registration.';
        end if;
      end if;

      if contract_is_required and new.contract_version_id is null then
        raise exception 'A published contract version is required before opening registration.';
      end if;
      if not contract_is_required and new.contract_version_id is not null then
        raise exception 'A no-contract offering cannot have a contract version assigned.';
      end if;
      if new.contract_version_id is not null then
        select version.status = 'published' and not template.is_archived
        into contract_is_assignable
        from public.contract_template_versions version
        join public.contract_templates template on template.id = version.template_id
        where version.id = new.contract_version_id;
        if coalesce(contract_is_assignable, false) is false then
          raise exception 'The assigned contract must still be published when registration opens.';
        end if;
      end if;

      select not program.is_archived into program_is_active
      from public.training_programs program
      where program.id = new.program_id;
      if coalesce(program_is_active, false) is false then
        raise exception 'Registration cannot open for an archived program.';
      end if;
    end if;

    new.status_changed_by := current_user_id;
    new.status_changed_at := now();
  else
    new.status_changed_by := old.status_changed_by;
    new.status_changed_at := old.status_changed_at;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_training_cohort_lifecycle() from public, anon, authenticated;

create or replace function public.list_open_training_cohorts()
returns table (
  cohort_id uuid,
  program_name text,
  program_description text,
  cohort_name text,
  delivery_mode text,
  capacity integer,
  approved_count bigint,
  tuition_amount_mnt integer,
  payment_plan text,
  schedule_summary text,
  location text,
  registration_closes_at timestamptz,
  starts_on date,
  ends_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cohort.id,
    program.name,
    program.description,
    cohort.name,
    cohort.delivery_mode,
    cohort.capacity,
    enrollment_stats.enrolled_count,
    cohort.tuition_amount_mnt,
    cohort.payment_plan,
    cohort.schedule_summary,
    cohort.location,
    cohort.registration_closes_at,
    cohort.starts_on,
    cohort.ends_on
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  cross join lateral (
    select count(*) as enrolled_count
    from public.cohort_enrollments enrollment
    where enrollment.cohort_id = cohort.id
      and enrollment.status = 'active'
  ) enrollment_stats
  where cohort.checkout_version = 1
    and cohort.status = 'open'
    and not program.is_archived
    and cohort.contract_version_id is not null
    and cohort.tuition_amount_mnt is not null
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
    and (cohort.capacity is null or enrollment_stats.enrolled_count < cohort.capacity)
  order by cohort.starts_on nulls last, cohort.created_at;
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
    'approved_count', enrollment_stats.enrolled_count,
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
      'contract_number', 'Баталгаажуулах үед үүснэ',
      'contract_date', 'Баталгаажуулах өдөр',
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
      and cohort.tuition_amount_mnt is not null
      and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
      and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
      and (cohort.capacity is null or enrollment_stats.enrolled_count < cohort.capacity)
    ),
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', variable.key,
        'label', variable.label_mn,
        'description', variable.description_mn
      ) order by variable.key)
      from (
        select distinct contract_variable.key, contract_variable.label_mn, contract_variable.description_mn
        from regexp_matches(contract_version.content, '\{\{([a-z][a-z0-9_]*)\}\}', 'g') variable_match
        join public.contract_variables contract_variable
          on contract_variable.key = variable_match[1]
         and contract_variable.category = 'participant'
         and contract_variable.is_active
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
        'payment_due_at', own_application.payment_due_at,
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
  cross join lateral (
    select count(*) as enrolled_count
    from public.cohort_enrollments enrollment
    where enrollment.cohort_id = cohort.id
      and enrollment.status = 'active'
  ) enrollment_stats
  where cohort.id = p_cohort_id
    and cohort.checkout_version = 1
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
    );

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

revoke all on function public.list_open_training_cohorts() from public;
grant execute on function public.list_open_training_cohorts() to anon, authenticated, service_role;
revoke all on function public.get_open_cohort_application_form(uuid) from public;
grant execute on function public.get_open_cohort_application_form(uuid) to anon, authenticated, service_role;
