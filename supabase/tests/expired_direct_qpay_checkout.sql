-- Runs with a local/admin database connection. Every fixture is rolled back.
-- Test invoice and payment IDs are local strings and never reach QPay.
do $$
declare
  actor uuid;
  previous_role text := current_setting('role');
  previous_sub text := current_setting('request.jwt.claim.sub', true);
  course_id_for_test uuid;
  offering_id_for_test uuid;
  lesson_id_for_test uuid;
  application_id_for_test uuid;
  first_payment uuid;
  first_invoice text := 'retry-test-' || gen_random_uuid()::text;
  second_payment uuid;
  second_invoice text := 'retry-test-' || gen_random_uuid()::text;
  original_terms jsonb;
  original_amount integer;
  expired_at timestamptz := now() - interval '1 day';
  result jsonb;
  renewed_deadline timestamptz;
begin
  select roles.user_id into actor
  from public.user_roles as roles join auth.users as users on users.id = roles.user_id
  where roles.role = 'admin' order by users.created_at, roles.user_id limit 1;
  if actor is null then raise exception 'Test requires an existing administrator.'; end if;

  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.courses(title, description, price_amount_mnt, published)
    values ('ROLLBACK expired QPay test', 'Checkout retry fixture', 69000, false)
    returning id into course_id_for_test;
    insert into public.lessons(course_id, title, position, is_preview)
    values (course_id_for_test, 'Retry fixture lesson', 1, false) returning id into lesson_id_for_test;
    insert into public.lesson_videos(lesson_id, provider, provider_video_id, playback_status)
    values (lesson_id_for_test, 'cloudflare', replace(gen_random_uuid()::text, '-', ''), 'ready');
    update public.courses set published = true where id = course_id_for_test;
    select id into strict offering_id_for_test from public.training_cohorts
    where course_id = course_id_for_test and course_managed;

    application_id_for_test := public.save_course_offering_checkout_draft(offering_id_for_test, actor,
      jsonb_build_object('schema_version', 1, 'client_request_id', gen_random_uuid(),
        'learner_full_name', 'Rollback retry verification', 'applicant_relationship', 'self'));
    select terms_snapshot, tuition_amount_mnt_snapshot into original_terms, original_amount
    from public.course_offering_applications where id = application_id_for_test;

    result := public.reserve_course_offering_qpay_payment(application_id_for_test, repeat('a', 64));
    first_payment := (result ->> 'payment_id')::uuid;
    begin
      perform public.reopen_expired_direct_qpay_checkout(application_id_for_test, offering_id_for_test,
        actor, first_payment, first_invoice);
      raise exception 'Authenticated role could call the server-only retry RPC.';
    exception when insufficient_privilege then null;
    end;

    perform set_config('role', 'service_role', true);
    perform public.record_course_offering_qpay_invoice(first_payment, first_invoice, '', '', '', '[]');
    begin
      perform public.reopen_expired_direct_qpay_checkout(application_id_for_test, offering_id_for_test,
        actor, first_payment, first_invoice);
      raise exception 'The RPC accepted a still-valid QPay invoice.';
    exception when raise_exception then
      if sqlerrm <> 'The previous QPay invoice is no longer the current expired attempt.' then raise; end if;
    end;

    update public.course_offering_applications set payment_due_at = expired_at where id = application_id_for_test;
    update public.course_offering_payments set expires_at = expired_at where id = first_payment;
    begin
      perform public.reopen_expired_direct_qpay_checkout(application_id_for_test, offering_id_for_test,
        actor, first_payment, first_invoice || '-wrong');
      raise exception 'The RPC accepted a mismatched provider invoice.';
    exception when raise_exception then
      if sqlerrm <> 'The previous QPay invoice does not match this checkout.' then raise; end if;
    end;

    begin
      insert into public.payment_requests (user_id, course_id, receipt_path, amount_mnt, status)
      values (actor, course_id_for_test, 'rollback/receipt.webp', original_amount, 'pending');
      perform public.reopen_expired_direct_qpay_checkout(application_id_for_test, offering_id_for_test,
        actor, first_payment, first_invoice);
      raise exception 'The RPC accepted a checkout with an earlier receipt awaiting review.';
    exception when raise_exception then
      if sqlerrm <> 'A previous course payment receipt is pending or approved. Do not pay again.' then raise; end if;
    end;

    result := public.reopen_expired_direct_qpay_checkout(application_id_for_test, offering_id_for_test,
      actor, first_payment, first_invoice);
    renewed_deadline := (result ->> 'payment_due_at')::timestamptz;
    if result ->> 'status' is distinct from 'ready' or renewed_deadline is null or renewed_deadline <= now()
       or not exists (
         select 1 from public.course_offering_payments
         where id = first_payment and status = 'expired' and qpay_invoice_id = first_invoice
           and provider_status = 'CANCELLED' and expires_at = expired_at
       ) or not exists (
         select 1 from public.course_offering_applications
         where id = application_id_for_test and payment_due_at = renewed_deadline
           and terms_snapshot = original_terms and tuition_amount_mnt_snapshot = original_amount
       ) then
      raise exception 'Retry did not retire the invoice and reopen the original commercial snapshot.';
    end if;

    result := public.reopen_expired_direct_qpay_checkout(application_id_for_test, offering_id_for_test,
      actor, first_payment, first_invoice);
    if (result ->> 'payment_due_at')::timestamptz is distinct from renewed_deadline then
      raise exception 'Retrying an acknowledged cancellation extended the deadline again.';
    end if;

    perform set_config('role', 'authenticated', true);
    result := public.reserve_course_offering_qpay_payment(application_id_for_test, repeat('b', 64));
    second_payment := (result ->> 'payment_id')::uuid;
    if second_payment = first_payment or not exists (
      select 1 from public.course_offering_payments where id = second_payment and attempt_number = 2
    ) then raise exception 'Checkout did not reserve a new QPay attempt.'; end if;

    perform set_config('role', 'service_role', true);
    perform public.record_course_offering_qpay_invoice(second_payment, second_invoice, '', '', '', '[]');
    perform public.finalize_course_offering_qpay_payment(second_payment, 'verified-' || gen_random_uuid()::text, 'PAID', now());
    result := public.reopen_expired_direct_qpay_checkout(application_id_for_test, offering_id_for_test,
      actor, first_payment, first_invoice);
    if result ->> 'status' is distinct from 'already_paid' then
      raise exception 'An earlier cancellation could reopen a checkout that was already paid.';
    end if;

    raise exception using errcode = 'ZX001', message = 'All expired QPay retry assertions passed';
  exception when sqlstate 'ZX001' then null;
  end;
  perform set_config('role', previous_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(previous_sub, ''), true);
end;
$$;
