-- Release gate: all fixtures and reservations are rolled back inside a
-- subtransaction. No external QPay request, email or persistent student exists.
do $$
declare
  actor uuid;
  previous_sub text := current_setting('request.jwt.claim.sub', true);
  previous_role text := current_setting('role');
  test_course_id uuid;
  class_course_id uuid;
  test_lesson_id uuid;
  offer public.training_cohorts%rowtype;
  test_application_id uuid;
  reservation jsonb;
  original_snapshot jsonb;
  blocked boolean;
begin
  select r.user_id into actor from public.user_roles r
  join auth.users u on u.id = r.user_id where r.role = 'admin'
  order by u.created_at, r.user_id limit 1;
  if actor is null then raise exception 'Test requires an existing administrator.'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('role', 'authenticated', true);

  begin
    insert into public.courses(title, description, price_amount_mnt, published)
    values ('ROLLBACK checkout verification', 'Temporary release verification', 69000, false)
    returning id into test_course_id;
    if exists(select 1 from public.training_cohorts c where c.course_id = test_course_id) then
      raise exception 'Draft course unexpectedly created an offer.';
    end if;
    insert into public.lessons(course_id, title, position, is_preview)
    values (test_course_id, 'Temporary lesson', 1, false) returning id into test_lesson_id;
    insert into public.lesson_videos(lesson_id, provider, provider_video_id, playback_status)
    values (test_lesson_id, 'cloudflare', replace(gen_random_uuid()::text, '-', ''), 'ready');
    update public.courses set published = true where id = test_course_id;
    select * into strict offer from public.training_cohorts c where c.course_id = test_course_id and course_managed;
    if offer.status <> 'open' or not offer.qpay_enabled or offer.contract_policy <> 'none'
       or offer.tuition_amount_mnt <> 69000 or offer.class_type <> 'self_paced_online' then
      raise exception 'Automatic checkout has incorrect settings.';
    end if;
    if not public.course_uses_offering_checkout(test_course_id) then
      raise exception 'New course still routes to legacy checkout.';
    end if;
    update public.courses set title = title where id = test_course_id;
    if (select count(*) from public.training_cohorts c where c.course_id = test_course_id and course_managed) <> 1 then
      raise exception 'Repeated save duplicated checkout.';
    end if;

    test_application_id := public.save_course_offering_checkout_draft(offer.id, actor,
      jsonb_build_object('schema_version', 1, 'client_request_id', gen_random_uuid(),
        'learner_full_name', 'Rollback verification learner', 'applicant_relationship', 'self'));
    if not exists (
      select 1 from public.course_offering_applications a
      join public.learners l on l.id = a.learner_id
      where a.id = test_application_id and a.content_access_user_id = actor
        and l.birth_date is null and l.registration_number is null
        and a.signer_full_name is null and a.signer_registration_number is null
        and a.contract_policy_snapshot = 'none'
    ) then raise exception 'Account-only checkout unexpectedly requires identity or contract details.'; end if;
    select a.terms_snapshot into original_snapshot from public.course_offering_applications a where id = test_application_id;
    reservation := public.reserve_course_offering_qpay_payment(test_application_id, repeat('a', 64));
    if (reservation->>'amount_mnt')::integer <> 69000 then
      raise exception 'QPay reservation has wrong course price.';
    end if;

    update public.courses set price_amount_mnt = 79000, title = 'Updated rollback course' where id = test_course_id;
    if (select tuition_amount_mnt from public.training_cohorts where id = offer.id) <> 79000 then
      raise exception 'New checkout price did not synchronize.';
    end if;
    if (select tuition_amount_mnt_snapshot from public.course_offering_applications where id = test_application_id) <> 69000
       or (select terms_snapshot from public.course_offering_applications where id = test_application_id) is distinct from original_snapshot
       or (select amount_mnt from public.course_offering_payments where id = (reservation->>'payment_id')::uuid) <> 69000 then
      raise exception 'Existing application or payment amount was modified.';
    end if;
    if not exists (select 1 from public.course_offering_configuration_changes where offering_id = offer.id) then
      raise exception 'Price change audit was not recorded.';
    end if;

    perform public.set_course_archived(test_course_id, true);
    if (select status from public.training_cohorts where id = offer.id) <> 'closed'
       or exists (select 1 from public.list_public_course_offerings(test_course_id)) then
      raise exception 'Archived course remains on sale.';
    end if;
    perform public.set_course_archived(test_course_id, false);
    if (select status from public.training_cohorts where id = offer.id) <> 'open' then
      raise exception 'Restored course checkout did not reopen.';
    end if;
    update public.courses set checkout_mode = 'class_only' where id = test_course_id;
    if (select status from public.training_cohorts where id = offer.id) <> 'closed' then
      raise exception 'Class-only switch left direct sales open.';
    end if;
    update public.courses set checkout_mode = 'direct' where id = test_course_id;
    blocked := false;
    begin
      update public.training_cohorts set qpay_enabled = false where id = offer.id;
    exception when check_violation then blocked := true;
    end;
    if not blocked then raise exception 'Managed QPay could be disabled accidentally.'; end if;

    -- Different courses may have the same public title; no manual program or
    -- course may hijack another course's checkout through a name collision.
    insert into public.courses(title, description, price_amount_mnt, published)
    values ('Updated rollback course', 'Same title, different course', 39000, false)
    returning id into class_course_id;
    insert into public.lessons(course_id, title, position, is_preview)
    values (class_course_id, 'Temporary second lesson', 1, false) returning id into test_lesson_id;
    insert into public.lesson_videos(lesson_id, provider, provider_video_id, playback_status)
    values (test_lesson_id, 'cloudflare', replace(gen_random_uuid()::text, '-', ''), 'ready');
    update public.courses set published = true where id = class_course_id;
    if not exists (select 1 from public.training_cohorts c where c.course_id = class_course_id and c.course_managed and c.id <> offer.id) then
      raise exception 'Duplicate course title failed to get an independent checkout.';
    end if;

    insert into public.courses(title, description, price_amount_mnt, published, checkout_mode)
    values ('ROLLBACK class-only verification', 'Contract class content', 100000, false, 'class_only')
    returning id into class_course_id;
    update public.courses set published = true where id = class_course_id;
    if exists(select 1 from public.training_cohorts c where c.course_id = class_course_id) then
      raise exception 'Class-only content received an unintended no-contract offer.';
    end if;

    -- Roll back only this inner block, including every fixture above.
    raise exception using errcode = 'ZX001', message = 'All checkout assertions passed';
  exception when sqlstate 'ZX001' then null;
  end;
  perform set_config('role', previous_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(previous_sub, ''), true);
end;
$$;
