-- Canonical V2 offering payments with QPay Merchant V2 support.
-- Manual receipt proofs remain audit evidence and are linked into the same
-- payment/enrollment chain. QPay callbacks finalize only verified payments.

create table public.course_offering_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.course_offering_applications(id) on delete restrict,
  offering_id uuid not null references public.training_cohorts(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (provider in ('manual_transfer', 'qpay')),
  source_site text not null default 'ai-creator-academy' check (source_site = 'ai-creator-academy'),
  attempt_number integer not null check (attempt_number > 0),
  amount_mnt integer not null check (amount_mnt > 0),
  currency text not null default 'MNT' check (currency = 'MNT'),
  status text not null check (
    status in ('created', 'pending', 'paid', 'rejected', 'failed', 'expired', 'cancelled', 'refunded')
  ),
  sender_invoice_no text unique,
  qpay_invoice_id text unique,
  qpay_payment_id text unique,
  qpay_short_url text,
  qpay_qr_text text,
  qpay_qr_image text,
  qpay_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(qpay_urls) = 'array'),
  callback_token_hash text check (
    callback_token_hash is null or callback_token_hash ~ '^[0-9a-f]{64}$'
  ),
  provider_status text,
  provider_paid_at timestamptz,
  expires_at timestamptz,
  failure_reason text check (
    failure_reason is null or char_length(trim(failure_reason)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, provider, attempt_number),
  check (
    (provider = 'manual_transfer'
      and sender_invoice_no is null
      and qpay_invoice_id is null
      and qpay_payment_id is null
      and qpay_short_url is null
      and qpay_qr_text is null
      and qpay_qr_image is null
      and qpay_urls = '[]'::jsonb
      and callback_token_hash is null)
    or
    (provider = 'qpay'
      and sender_invoice_no is not null
      and callback_token_hash is not null)
  ),
  check (
    provider <> 'qpay'
    or status in ('created', 'failed')
    or qpay_invoice_id is not null
  ),
  check (
    status <> 'paid'
    or provider <> 'qpay'
    or (qpay_payment_id is not null and provider_paid_at is not null)
  )
);

create unique index course_offering_payments_one_active_idx
on public.course_offering_payments (application_id)
where status in ('created', 'pending');

create unique index course_offering_payments_one_paid_idx
on public.course_offering_payments (application_id)
where status = 'paid';

create index course_offering_payments_applicant_created_idx
on public.course_offering_payments (applicant_user_id, created_at desc);

create index course_offering_payments_offering_status_idx
on public.course_offering_payments (offering_id, status, created_at desc);

create index course_offering_payments_source_status_idx
on public.course_offering_payments (source_site, status, created_at desc);

alter table public.course_offering_payments enable row level security;
revoke all on table public.course_offering_payments from public, anon, authenticated;
grant select on table public.course_offering_payments to authenticated;
grant all on table public.course_offering_payments to service_role;

create policy "Applicants read their own offering payments"
on public.course_offering_payments for select to authenticated
using ((select auth.uid()) = applicant_user_id);

create table public.qpay_token_cache (
  id boolean primary key default true check (id),
  access_token text not null,
  refresh_token text,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.qpay_token_cache enable row level security;
revoke all on table public.qpay_token_cache from public, anon, authenticated;
grant all on table public.qpay_token_cache to service_role;

alter table public.course_offering_payment_proofs
add column payment_id uuid references public.course_offering_payments(id) on delete restrict;

insert into public.course_offering_payments (
  application_id,
  offering_id,
  applicant_user_id,
  provider,
  attempt_number,
  amount_mnt,
  status,
  provider_status,
  provider_paid_at,
  failure_reason,
  created_at,
  updated_at
)
select
  proof.application_id,
  proof.offering_id,
  proof.applicant_user_id,
  'manual_transfer',
  proof.attempt_number,
  proof.amount_mnt,
  case proof.status when 'approved' then 'paid' else proof.status end,
  proof.status,
  case when proof.status = 'approved' then proof.reviewed_at else null end,
  proof.rejection_reason,
  proof.created_at,
  proof.updated_at
from public.course_offering_payment_proofs proof;

-- Existing reviewed proofs are immutable through their normal lifecycle
-- trigger. Disable only that trigger for this one-time canonical-link
-- backfill; the trigger is restored immediately and the new link is made
-- NOT NULL plus immutable below.
alter table public.course_offering_payment_proofs
disable trigger course_offering_payment_proofs_lifecycle;

update public.course_offering_payment_proofs proof
set payment_id = payment.id
from public.course_offering_payments payment
where payment.application_id = proof.application_id
  and payment.provider = 'manual_transfer'
  and payment.attempt_number = proof.attempt_number;

alter table public.course_offering_payment_proofs
enable trigger course_offering_payment_proofs_lifecycle;

alter table public.course_offering_payment_proofs
alter column payment_id set not null;

alter table public.course_offering_payment_proofs
add constraint course_offering_payment_proofs_payment_id_key unique (payment_id);

alter table public.course_offering_enrollments
add column payment_id uuid references public.course_offering_payments(id) on delete restrict;

alter table public.course_offering_enrollments
disable trigger course_offering_enrollments_lifecycle;

update public.course_offering_enrollments enrollment
set payment_id = proof.payment_id
from public.course_offering_payment_proofs proof
where proof.id = enrollment.payment_proof_id;

alter table public.course_offering_enrollments
enable trigger course_offering_enrollments_lifecycle;

alter table public.course_offering_enrollments
alter column payment_id set not null,
alter column payment_proof_id drop not null;

alter table public.course_offering_enrollments
add constraint course_offering_enrollments_payment_id_key unique (payment_id);

alter table public.course_offering_applications
add column approval_source text check (approval_source in ('admin', 'qpay'));

alter table public.course_offering_applications
disable trigger course_offering_applications_lifecycle;

update public.course_offering_applications
set approval_source = 'admin'
where status = 'approved';

alter table public.course_offering_applications
enable trigger course_offering_applications_lifecycle;

-- Replace the original unnamed lifecycle check without relying on its generated
-- name. Other checks on this table remain untouched.
do $$
declare
  target_constraint text;
begin
  select constraint_row.conname
  into target_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.course_offering_applications'::regclass
    and constraint_row.contype = 'c'
    and pg_get_constraintdef(constraint_row.oid) ilike '%status%approved%reviewed_by%not null%'
  limit 1;

  if target_constraint is null then
    raise exception 'Unable to locate the course offering application lifecycle constraint.';
  end if;

  execute format(
    'alter table public.course_offering_applications drop constraint %I',
    target_constraint
  );
end;
$$;

alter table public.course_offering_applications
add constraint course_offering_applications_payment_decision_check
check (
  (status = 'draft' and submitted_at is null and reviewed_by is null and reviewed_at is null and withdrawn_at is null and approval_source is null)
  or (status = 'submitted' and submitted_at is not null and reviewed_by is null and reviewed_at is null and withdrawn_at is null and approval_source is null)
  or (status = 'approved' and submitted_at is not null and reviewed_at is not null and withdrawn_at is null and (
    (approval_source = 'admin' and reviewed_by is not null)
    or (approval_source = 'qpay' and reviewed_by is null)
  ))
  or (status = 'withdrawn' and withdrawn_at is not null and reviewed_by is null and reviewed_at is null and approval_source is null)
);

create or replace function private.set_course_offering_application_approval_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.approval_source is not null then
      raise exception 'New applications cannot begin with an approval source.';
    end if;
    return new;
  end if;

  if old.approval_source is not null and new.approval_source is distinct from old.approval_source then
    raise exception 'Application approval source is immutable.';
  end if;

  if old.status <> 'approved' and new.status = 'approved' and new.approval_source is null then
    if (select auth.uid()) is null then
      raise exception 'A system approval must declare its source.';
    end if;
    new.approval_source := 'admin';
  end if;
  return new;
end;
$$;

revoke all on function private.set_course_offering_application_approval_source()
from public, anon, authenticated;

create trigger a_course_offering_application_approval_source
before insert or update on public.course_offering_applications
for each row execute function private.set_course_offering_application_approval_source();

create or replace function private.link_manual_course_offering_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.payment_id is not null then
    return new;
  end if;

  insert into public.course_offering_payments (
    application_id,
    offering_id,
    applicant_user_id,
    provider,
    attempt_number,
    amount_mnt,
    status,
    provider_status
  ) values (
    new.application_id,
    new.offering_id,
    new.applicant_user_id,
    'manual_transfer',
    new.attempt_number,
    new.amount_mnt,
    'pending',
    'pending'
  ) returning id into new.payment_id;

  return new;
end;
$$;

revoke all on function private.link_manual_course_offering_payment()
from public, anon, authenticated;

create trigger a_course_offering_payment_proof_payment_link
before insert on public.course_offering_payment_proofs
for each row execute function private.link_manual_course_offering_payment();

create or replace function private.sync_manual_course_offering_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.payment_id is distinct from old.payment_id then
    raise exception 'Payment proof canonical payment link is immutable.';
  end if;

  if new.status is distinct from old.status then
    update public.course_offering_payments
    set
      status = case new.status when 'approved' then 'paid' else new.status end,
      provider_status = new.status,
      provider_paid_at = case when new.status = 'approved' then new.reviewed_at else null end,
      failure_reason = new.rejection_reason,
      updated_at = now()
    where id = new.payment_id
      and provider = 'manual_transfer';
  end if;
  return new;
end;
$$;

revoke all on function private.sync_manual_course_offering_payment()
from public, anon, authenticated;

create trigger z_course_offering_payment_proof_payment_sync
after update on public.course_offering_payment_proofs
for each row execute function private.sync_manual_course_offering_payment();

create or replace function private.validate_course_offering_enrollment_payment_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_provider text;
begin
  if tg_op = 'UPDATE' then
    if new.payment_id is distinct from old.payment_id
       or new.payment_proof_id is distinct from old.payment_proof_id then
      raise exception 'Enrollment payment evidence is immutable.';
    end if;
    return new;
  end if;

  if new.payment_id is null and new.payment_proof_id is not null then
    select proof.payment_id into new.payment_id
    from public.course_offering_payment_proofs proof
    where proof.id = new.payment_proof_id;
  end if;

  select payment.provider into linked_provider
  from public.course_offering_payments payment
  where payment.id = new.payment_id
    and payment.application_id = new.application_id
    and payment.offering_id = new.offering_id
    and payment.applicant_user_id = new.applicant_user_id
    and payment.status = 'paid';
  if not found then
    raise exception 'Enrollment requires a matching paid canonical payment.';
  end if;

  if (linked_provider = 'manual_transfer' and new.payment_proof_id is null)
     or (linked_provider = 'qpay' and new.payment_proof_id is not null) then
    raise exception 'Enrollment payment evidence does not match its provider.';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_course_offering_enrollment_payment_link()
from public, anon, authenticated;

create trigger a_course_offering_enrollment_payment_link
before insert or update on public.course_offering_enrollments
for each row execute function private.validate_course_offering_enrollment_payment_link();

create or replace function private.ensure_course_offering_course_snapshot(p_application_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_application public.course_offering_applications%rowtype;
  bonus_snapshot jsonb;
begin
  select application.* into target_application
  from public.course_offering_applications application
  where application.id = p_application_id
  for update;
  if not found then
    raise exception 'The checkout application does not exist.';
  end if;

  if exists (
    select 1 from public.course_offering_application_courses item
    where item.application_id = target_application.id
  ) then
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'course_id', bonus_course.id,
    'course_title', bonus_course.title,
    'position', positioned_bonus.position
  ) order by positioned_bonus.position), '[]'::jsonb)
  into bonus_snapshot
  from (
    select relation.bonus_course_id,
      row_number() over (order by relation.created_at, relation.bonus_course_id)::integer as position
    from public.course_bonus_courses relation
    where relation.source_course_id = target_application.course_id_snapshot
  ) positioned_bonus
  join public.courses bonus_course on bonus_course.id = positioned_bonus.bonus_course_id;

  perform 1
  from public.courses course
  where course.id = target_application.course_id_snapshot
     or course.id in (
       select (bonus_item.value ->> 'course_id')::uuid
       from jsonb_array_elements(bonus_snapshot) bonus_item(value)
     )
  order by course.id
  for update;

  if not private.course_is_ready(target_application.course_id_snapshot) then
    raise exception 'The primary course is not ready for enrollment.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(bonus_snapshot) bonus_item(value)
    where not private.course_is_ready((bonus_item.value ->> 'course_id')::uuid)
  ) then
    raise exception 'A configured bonus course is not ready for enrollment.';
  end if;

  insert into public.course_offering_application_courses (
    application_id, course_id, item_kind, source_course_id, course_title_snapshot, position
  )
  select target_application.id, course.id, 'primary', null, course.title, 0
  from public.courses course
  where course.id = target_application.course_id_snapshot;

  insert into public.course_offering_application_courses (
    application_id, course_id, item_kind, source_course_id, course_title_snapshot, position
  )
  select target_application.id, item.course_id, 'bonus', target_application.course_id_snapshot,
    item.course_title, item.position
  from jsonb_to_recordset(bonus_snapshot) item(course_id uuid, course_title text, position integer)
  order by item.position;
end;
$$;

revoke all on function private.ensure_course_offering_course_snapshot(uuid)
from public, anon, authenticated;

create or replace function public.reserve_course_offering_qpay_payment(
  p_application_id uuid,
  p_callback_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_application public.course_offering_applications%rowtype;
  target_offering public.training_cohorts%rowtype;
  existing_payment public.course_offering_payments%rowtype;
  new_payment_id uuid;
  next_attempt integer;
  sender_invoice_no text;
  active_enrollment_count bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(p_callback_token_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'The callback token hash is invalid.';
  end if;

  select application.* into target_application
  from public.course_offering_applications application
  where application.id = p_application_id
    and application.applicant_user_id = current_user_id
    and application.status in ('draft', 'submitted')
  for update;
  if not found then
    raise exception 'This checkout is not available for QPay payment.';
  end if;

  select cohort.* into target_offering
  from public.training_cohorts cohort
  where cohort.id = target_application.offering_id
    and cohort.checkout_version = 2
  for update;
  if not found or target_offering.status not in ('open', 'closed', 'in_progress') then
    raise exception 'This course offering is not operational for payment.';
  end if;
  select count(*) into active_enrollment_count
  from public.course_offering_enrollments enrollment
  where enrollment.offering_id = target_offering.id
    and enrollment.status = 'active';
  if target_offering.capacity is not null and active_enrollment_count >= target_offering.capacity then
    raise exception 'This course offering has no available seats.';
  end if;
  if target_application.payment_due_at < now() then
    raise exception 'The payment deadline has passed.';
  end if;
  if target_application.contract_policy_snapshot = 'required' and not exists (
    select 1 from public.course_offering_contract_acceptances acceptance
    where acceptance.application_id = target_application.id
  ) then
    raise exception 'The contract must be accepted before payment.';
  end if;
  if exists (
    select 1 from public.course_offering_payment_proofs proof
    where proof.application_id = target_application.id
      and proof.status in ('pending', 'approved')
  ) then
    raise exception 'This checkout already has a pending or approved manual payment.';
  end if;
  if exists (
    select 1 from public.course_offering_enrollments enrollment
    where enrollment.application_id = target_application.id
      and enrollment.status = 'active'
  ) then
    raise exception 'This checkout is already enrolled.';
  end if;

  select payment.* into existing_payment
  from public.course_offering_payments payment
  where payment.application_id = target_application.id
    and payment.provider = 'qpay'
    and payment.status in ('created', 'pending')
  order by payment.created_at desc
  limit 1;
  if found then
    return jsonb_build_object(
      'payment_id', existing_payment.id,
      'sender_invoice_no', existing_payment.sender_invoice_no,
      'amount_mnt', existing_payment.amount_mnt,
      'payment_due_at', target_application.payment_due_at,
      'status', existing_payment.status,
      'qpay_invoice_id', existing_payment.qpay_invoice_id,
      'qpay_short_url', existing_payment.qpay_short_url,
      'qpay_qr_text', existing_payment.qpay_qr_text,
      'qpay_qr_image', existing_payment.qpay_qr_image,
      'qpay_urls', existing_payment.qpay_urls,
      'expires_at', existing_payment.expires_at,
      'reused', true
    );
  end if;

  perform private.ensure_course_offering_course_snapshot(target_application.id);

  select coalesce(max(payment.attempt_number), 0) + 1
  into next_attempt
  from public.course_offering_payments payment
  where payment.application_id = target_application.id
    and payment.provider = 'qpay';

  sender_invoice_no := 'ACA-' || target_application.payment_reference || '-Q' || next_attempt::text;

  insert into public.course_offering_payments (
    application_id, offering_id, applicant_user_id, provider, attempt_number,
    amount_mnt, status, sender_invoice_no, callback_token_hash, expires_at
  ) values (
    target_application.id, target_application.offering_id, current_user_id, 'qpay', next_attempt,
    target_application.tuition_amount_mnt_snapshot, 'created', sender_invoice_no,
    p_callback_token_hash, target_application.payment_due_at
  ) returning id into new_payment_id;

  update public.course_offering_applications
  set status = 'submitted', submitted_at = coalesce(submitted_at, now())
  where id = target_application.id;

  return jsonb_build_object(
    'payment_id', new_payment_id,
    'sender_invoice_no', sender_invoice_no,
    'amount_mnt', target_application.tuition_amount_mnt_snapshot,
    'payment_due_at', target_application.payment_due_at,
    'status', 'created',
    'reused', false
  );
end;
$$;

revoke all on function public.reserve_course_offering_qpay_payment(uuid, text)
from public, anon;
grant execute on function public.reserve_course_offering_qpay_payment(uuid, text)
to authenticated, service_role;

create or replace function public.record_course_offering_qpay_invoice(
  p_payment_id uuid,
  p_qpay_invoice_id text,
  p_qpay_short_url text,
  p_qpay_qr_text text,
  p_qpay_qr_image text,
  p_qpay_urls jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.course_offering_payments
  set
    status = 'pending',
    qpay_invoice_id = nullif(trim(p_qpay_invoice_id), ''),
    qpay_short_url = nullif(trim(p_qpay_short_url), ''),
    qpay_qr_text = nullif(trim(p_qpay_qr_text), ''),
    qpay_qr_image = nullif(trim(p_qpay_qr_image), ''),
    qpay_urls = coalesce(p_qpay_urls, '[]'::jsonb),
    provider_status = 'PENDING',
    updated_at = now()
  where id = p_payment_id
    and provider = 'qpay'
    and status = 'created';
  if not found then
    raise exception 'The QPay payment reservation is no longer creatable.';
  end if;
end;
$$;

revoke all on function public.record_course_offering_qpay_invoice(uuid, text, text, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.record_course_offering_qpay_invoice(uuid, text, text, text, text, jsonb)
to service_role;

create or replace function public.fail_course_offering_qpay_payment(
  p_payment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.course_offering_payments
  set status = 'failed', failure_reason = left(trim(coalesce(p_reason, 'QPay invoice creation failed.')), 500), updated_at = now()
  where id = p_payment_id and provider = 'qpay' and status = 'created';
end;
$$;

revoke all on function public.fail_course_offering_qpay_payment(uuid, text)
from public, anon, authenticated;
grant execute on function public.fail_course_offering_qpay_payment(uuid, text)
to service_role;

create or replace function public.finalize_course_offering_qpay_payment(
  p_payment_id uuid,
  p_qpay_payment_id text,
  p_provider_status text,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_payment public.course_offering_payments%rowtype;
  target_application public.course_offering_applications%rowtype;
  target_offering public.training_cohorts%rowtype;
  existing_enrollment_id uuid;
  new_enrollment_id uuid;
  active_count bigint;
  primary_count integer;
  entitlement_course_ids jsonb;
begin
  if nullif(trim(coalesce(p_qpay_payment_id, '')), '') is null then
    raise exception 'A verified QPay payment ID is required.';
  end if;

  select payment.* into target_payment
  from public.course_offering_payments payment
  where payment.id = p_payment_id and payment.provider = 'qpay'
  for update;
  if not found then
    raise exception 'The QPay payment does not exist.';
  end if;

  select enrollment.id into existing_enrollment_id
  from public.course_offering_enrollments enrollment
  where enrollment.payment_id = target_payment.id;
  if found then
    select coalesce(jsonb_agg(entitlement.course_id order by entitlement.course_id), '[]'::jsonb)
    into entitlement_course_ids
    from public.course_access_entitlements entitlement
    where entitlement.enrollment_id = existing_enrollment_id;
    return jsonb_build_object(
      'application_id', target_payment.application_id,
      'payment_id', target_payment.id,
      'enrollment_id', existing_enrollment_id,
      'entitlement_course_ids', entitlement_course_ids,
      'already_finalized', true
    );
  end if;
  if target_payment.status not in ('pending', 'paid') then
    raise exception 'The QPay payment is not pending verification.';
  end if;

  select application.* into target_application
  from public.course_offering_applications application
  where application.id = target_payment.application_id
  for update;
  select cohort.* into target_offering
  from public.training_cohorts cohort
  where cohort.id = target_payment.offering_id and cohort.checkout_version = 2
  for update;

  if target_application.status <> 'submitted' then
    raise exception 'The checkout application is not awaiting payment.';
  end if;
  if target_offering.status not in ('open', 'closed', 'in_progress') then
    raise exception 'This course offering is not operational for enrollment.';
  end if;
  if target_payment.amount_mnt <> target_application.tuition_amount_mnt_snapshot
     or target_payment.currency <> 'MNT' then
    raise exception 'The verified payment does not match the checkout snapshot.';
  end if;
  if target_application.contract_policy_snapshot = 'required' and not exists (
    select 1 from public.course_offering_contract_acceptances acceptance
    where acceptance.application_id = target_application.id
  ) then
    raise exception 'The contract acceptance evidence is missing.';
  end if;

  select count(*) filter (where item.item_kind = 'primary') into primary_count
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
    select 1 from public.course_offering_application_courses item
    where item.application_id = target_application.id
      and not private.course_is_ready(item.course_id)
  ) then
    raise exception 'A promised course is not ready for access.';
  end if;

  select count(*) into active_count
  from public.course_offering_enrollments enrollment
  where enrollment.offering_id = target_offering.id and enrollment.status = 'active';
  if target_offering.capacity is not null and active_count >= target_offering.capacity then
    raise exception 'This course offering has no available seats.';
  end if;

  update public.course_offering_payments
  set
    status = 'paid',
    qpay_payment_id = trim(p_qpay_payment_id),
    provider_status = left(trim(coalesce(p_provider_status, 'PAID')), 120),
    provider_paid_at = coalesce(p_paid_at, now()),
    failure_reason = null,
    updated_at = now()
  where id = target_payment.id;

  insert into public.course_offering_enrollments (
    offering_id, application_id, payment_id, payment_proof_id,
    learner_id, applicant_user_id, content_access_user_id
  ) values (
    target_application.offering_id, target_application.id, target_payment.id, null,
    target_application.learner_id, target_application.applicant_user_id,
    target_application.content_access_user_id
  ) returning id into new_enrollment_id;

  insert into public.course_access_entitlements (
    enrollment_id, application_course_id, user_id, course_id, item_kind
  )
  select new_enrollment_id, item.id, target_application.content_access_user_id,
    item.course_id, item.item_kind
  from public.course_offering_application_courses item
  where item.application_id = target_application.id
  order by item.position;

  update public.course_offering_applications
  set status = 'approved', approval_source = 'qpay', reviewed_by = null, reviewed_at = now()
  where id = target_application.id;

  select coalesce(jsonb_agg(entitlement.course_id order by entitlement.course_id), '[]'::jsonb)
  into entitlement_course_ids
  from public.course_access_entitlements entitlement
  where entitlement.enrollment_id = new_enrollment_id;

  perform private.enqueue_course_offering_notification(
    'course_offering.checkout_approved',
    target_application.id,
    'course-offering-qpay-approved:' || target_payment.id::text,
    'user',
    target_application.applicant_user_id,
    target_application.contact_email,
    jsonb_build_object(
      'application_id', target_application.id,
      'payment_id', target_payment.id,
      'qpay_payment_id', trim(p_qpay_payment_id),
      'enrollment_id', new_enrollment_id,
      'offering_id', target_application.offering_id,
      'course_ids', entitlement_course_ids,
      'content_access_user_id', target_application.content_access_user_id
    )
  );

  return jsonb_build_object(
    'application_id', target_application.id,
    'payment_id', target_payment.id,
    'enrollment_id', new_enrollment_id,
    'entitlement_course_ids', entitlement_course_ids,
    'already_finalized', false
  );
end;
$$;

revoke all on function public.finalize_course_offering_qpay_payment(uuid, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.finalize_course_offering_qpay_payment(uuid, text, text, timestamptz)
to service_role;

comment on table public.course_offering_payments is
  'Canonical Version 2 offering payment attempts across manual transfer and QPay.';
comment on column public.course_offering_payments.sender_invoice_no is
  'Globally unique merchant invoice reference including academy source and QPay attempt.';
