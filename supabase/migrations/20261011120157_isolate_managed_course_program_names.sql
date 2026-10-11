-- Preserve existing program uniqueness while allowing independent courses with
-- the same title to receive independent QPay checkouts.
create or replace function private.sync_direct_course_checkout()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  offer public.training_cohorts%rowtype;
  program_id uuid;
  next_program_name text;
  offer_id uuid;
  should_sell boolean;
begin
  -- Called only after the course row is locked by its INSERT/UPDATE.
  if actor is null or coalesce((select private.is_admin()), false) is false then
    raise exception 'Administrator access is required to configure course checkout.';
  end if;

  select * into offer from public.training_cohorts
  where course_id = new.id and course_managed for update;

  should_sell := new.checkout_mode = 'direct' and new.published
    and new.archived_at is null and new.price_amount_mnt > 0;

  if not should_sell then
    if offer.id is not null and offer.status = 'open' then
      update public.training_cohorts set status = 'closed' where id = offer.id;
    end if;
    return new;
  end if;

  if not private.course_is_ready(new.id) then
    raise exception 'Add a ready video lesson before publishing a paid course.';
  end if;

  -- Keep the existing unique manual-program name constraint intact. Only the
  -- internal program label needs disambiguation; the student's course/offer
  -- title and price are unchanged. Serialize same-title automated publishes.
  next_program_name := left(new.title, 160);
  perform pg_advisory_xact_lock(hashtextextended('direct-course-name:' || lower(trim(next_program_name)), 0));
  if exists (
    select 1 from public.training_programs p
    where lower(trim(p.name)) = lower(trim(next_program_name))
      and p.id is distinct from offer.program_id
  ) then
    next_program_name := left(new.title, 120) || ' · ' || new.id::text;
  end if;

  if offer.id is null then
    insert into public.training_programs(name, description, created_by)
    values (next_program_name, left(new.description, 2000), actor)
    returning id into program_id;

    insert into public.training_cohorts(
      program_id, name, delivery_mode, status, checkout_version, class_type,
      course_id, contract_policy, tuition_amount_mnt, payment_due_days,
      schedule_summary, qpay_enabled, manual_transfer_enabled, course_managed,
      created_by, status_changed_by
    ) values (
      program_id, left(new.title, 160), 'online', 'draft', 2, 'self_paced_online',
      new.id, 'none', new.price_amount_mnt, 7,
      'Өөрийн хурдаар суралцах видео хичээл', true, true, true,
      actor, actor
    ) returning id into offer_id;

    -- Existing lifecycle and permanent-ownership triggers still validate opening.
    update public.training_cohorts set status = 'open' where id = offer_id;
  else
    if offer.status not in ('open', 'closed') then
      raise exception 'The direct course checkout needs administrator review.';
    end if;
    if offer.name is distinct from left(new.title, 160)
       or offer.tuition_amount_mnt is distinct from new.price_amount_mnt then
      -- Existing RPC increments the revision and writes an immutable change audit.
      -- It does NOT rewrite application amounts, invoice amounts or entitlements.
      perform public.update_v2_course_offering_configuration(
        offer.id, offer.configuration_revision, left(new.title, 160), null,
        new.price_amount_mnt, offer.payment_due_days, offer.payment_plan,
        offer.schedule_summary, '', null, null, null, null,
        'Direct course title/price updated from course editor'
      );
    end if;
    update public.training_programs
    set name = next_program_name, description = left(new.description, 2000)
    where id = offer.program_id;
    if offer.status = 'closed' then
      update public.training_cohorts set status = 'open' where id = offer.id;
    end if;
  end if;
  return new;
end;
$$;

