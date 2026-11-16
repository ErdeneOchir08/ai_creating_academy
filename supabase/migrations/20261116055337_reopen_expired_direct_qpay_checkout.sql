-- The payment server calls this only after QPay confirms invoice cancellation.
-- Keep the original application and its commercial terms for the replacement.
create function public.reopen_expired_direct_qpay_checkout(
  p_application_id uuid,
  p_offering_id uuid,
  p_applicant_user_id uuid,
  p_previous_payment_id uuid,
  p_previous_invoice_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_payment public.course_offering_payments%rowtype;
  target_application public.course_offering_applications%rowtype;
  target_offering public.training_cohorts%rowtype;
  checked_at timestamptz;
  new_deadline timestamptz;
begin
  -- Match QPay finalization's lock order: payment, application, offering.
  select payment.* into previous_payment
  from public.course_offering_payments as payment
  where payment.id = p_previous_payment_id
    and payment.application_id = p_application_id
    and payment.offering_id = p_offering_id
    and payment.applicant_user_id = p_applicant_user_id
    and payment.provider = 'qpay'
    and payment.qpay_invoice_id = p_previous_invoice_id
  for update;
  if not found then
    raise exception 'The previous QPay invoice does not match this checkout.';
  end if;

  select application.* into target_application
  from public.course_offering_applications as application
  where application.id = p_application_id
    and application.offering_id = p_offering_id
    and application.applicant_user_id = p_applicant_user_id
    and application.content_access_user_id = p_applicant_user_id
  for update;
  if not found then
    raise exception 'The QPay checkout does not belong to this account.';
  end if;

  if previous_payment.status = 'paid' then
    return jsonb_build_object('status', 'already_paid');
  end if;

  select offering.* into target_offering
  from public.training_cohorts as offering
  where offering.id = p_offering_id
  for update;
  if not found
     or not target_offering.course_managed
     or target_offering.class_type <> 'self_paced_online'
     or target_offering.checkout_version <> 2
     or target_offering.contract_policy <> 'none'
     or target_application.contract_policy_snapshot <> 'none'
     or target_application.course_id_snapshot is distinct from target_offering.course_id then
    raise exception 'This checkout is not a direct self-paced course.';
  end if;

  if exists (
    select 1
    from public.course_offering_payments as payment
    join public.course_offering_applications as application on application.id = payment.application_id
    where application.course_id_snapshot = target_offering.course_id and payment.status = 'paid'
      and (payment.applicant_user_id = p_applicant_user_id or application.content_access_user_id = p_applicant_user_id)
  ) or exists (
    select 1 from public.course_access_entitlements as entitlement
    where entitlement.course_id = target_offering.course_id and entitlement.user_id = p_applicant_user_id
      and entitlement.status = 'active'
  ) or exists (
    select 1 from public.enrollments as enrollment
    where enrollment.course_id = target_offering.course_id and enrollment.user_id = p_applicant_user_id
      and enrollment.status = 'active'
  ) then
    return jsonb_build_object('status', 'already_paid');
  end if;

  if target_application.status <> 'submitted' or target_offering.status <> 'open'
     or not target_offering.qpay_enabled or not private.course_is_ready(target_offering.course_id)
     or not exists (
       select 1 from public.courses as course
       where course.id = target_offering.course_id and course.checkout_mode = 'direct' and course.price_amount_mnt > 0
     ) then
    raise exception 'This direct course checkout is no longer available.';
  end if;
  if exists (
    select 1 from public.course_offering_enrollments as enrollment
    where enrollment.application_id = p_application_id and enrollment.status = 'active'
  ) then
    return jsonb_build_object('status','already_paid');
  end if;
  if target_offering.capacity is not null and (
    select count(*) from public.course_offering_enrollments as enrollment
    where enrollment.offering_id = p_offering_id and enrollment.status = 'active'
  ) >= target_offering.capacity then
    raise exception 'This course offering has no available seats.';
  end if;

  if exists (
    select 1
    from public.course_offering_payment_proofs as proof
    join public.course_offering_applications as application on application.id = proof.application_id
    where application.course_id_snapshot = target_offering.course_id and proof.status in ('pending', 'approved')
      and (proof.applicant_user_id = p_applicant_user_id or application.content_access_user_id = p_applicant_user_id)
  ) or exists (
    select 1 from public.payment_requests as receipt
    where receipt.user_id = p_applicant_user_id and receipt.course_id = target_offering.course_id
      and receipt.status in ('pending', 'approved')
  ) then
    raise exception 'A previous course payment receipt is pending or approved. Do not pay again.';
  end if;

  if exists (
    select 1
    from public.course_offering_payments as payment
    join public.course_offering_applications as application on application.id = payment.application_id
    where payment.application_id <> p_application_id and application.course_id_snapshot = target_offering.course_id
      and payment.status in ('created', 'pending')
      and (payment.applicant_user_id = p_applicant_user_id or application.content_access_user_id = p_applicant_user_id)
  ) then
    raise exception 'Another checkout for this course has a pending payment.';
  end if;

  checked_at := clock_timestamp();
  if previous_payment.status = 'expired' and previous_payment.provider_status = 'CANCELLED'
     and target_application.payment_due_at > checked_at then
    return jsonb_build_object('status', 'ready', 'payment_due_at', target_application.payment_due_at);
  end if;

  if previous_payment.status <> 'pending' or previous_payment.qpay_payment_id is not null
     or previous_payment.provider_paid_at is not null
     or previous_payment.expires_at is null or previous_payment.expires_at > checked_at
     or target_application.payment_due_at > checked_at
     or exists (
       select 1 from public.course_offering_payments as payment
       where payment.application_id = p_application_id and payment.id <> previous_payment.id
         and (payment.status in ('created', 'pending') or (
           payment.provider = 'qpay' and payment.attempt_number > previous_payment.attempt_number
         ))
     ) then
    raise exception 'The previous QPay invoice is no longer the current expired attempt.';
  end if;

  new_deadline := checked_at + make_interval(days => target_application.payment_due_days_snapshot);

  update public.course_offering_payments
  set status = 'expired', provider_status = 'CANCELLED',
      failure_reason = 'Expired invoice cancelled by QPay before requesting a replacement.', updated_at = checked_at
  where id = previous_payment.id;

  update public.course_offering_applications
  set payment_due_at = new_deadline
  where id = target_application.id;

  return jsonb_build_object('status', 'ready', 'payment_due_at', new_deadline);
end;
$$;

revoke all on function public.reopen_expired_direct_qpay_checkout(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.reopen_expired_direct_qpay_checkout(uuid, uuid, uuid, uuid, text)
to service_role;
