-- Direct self-paced sales use the SAME V2 payment/enrollment chain as classes.
-- The course editor owns the direct offer's price; invoices remain snapshots.
alter table public.courses add column checkout_mode text not null default 'direct'
  check (checkout_mode in ('direct', 'class_only'));
alter table public.training_cohorts add column course_managed boolean not null default false;
alter table public.training_cohorts add constraint course_managed_self_paced_check check (
  not course_managed or (
    checkout_version = 2 and course_id is not null
    and class_type = 'self_paced_online' and contract_policy = 'none'
    and delivery_mode = 'online' and qpay_enabled
    and registration_opens_at is null and registration_closes_at is null
    and starts_on is null and ends_on is null and display_capacity is null
  )
);
create unique index training_cohorts_one_course_managed_idx
  on public.training_cohorts(course_id) where course_managed;

comment on column public.courses.checkout_mode is
  'direct: automatically sell self-paced content with QPay when published; class_only: sell only through configured classes (contracts preserved).';
comment on column public.training_cohorts.course_managed is
  'Internal direct-course offer. Edit price/name/sales availability through the course, not the class editor.';

-- Never introduce a no-contract purchase path for existing class-linked content.
update public.courses c set checkout_mode = 'class_only'
where exists (select 1 from public.training_cohorts o where o.course_id = c.id)
   or exists (select 1 from public.course_checkout_ownerships o where o.course_id = c.id);

create function private.sync_direct_course_checkout()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  offer public.training_cohorts%rowtype;
  program_id uuid;
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

  if offer.id is null then
    insert into public.training_programs(name, description, created_by)
    values (left(new.title, 160), left(new.description, 2000), actor)
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
    set name = left(new.title, 160), description = left(new.description, 2000)
    where id = offer.program_id;
    if offer.status = 'closed' then
      update public.training_cohorts set status = 'open' where id = offer.id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_direct_course_checkout() from public, anon, authenticated;

create trigger courses_sync_direct_checkout
after insert or update of title, description, price_amount_mnt, published, archived_at, checkout_mode
on public.courses for each row execute function private.sync_direct_course_checkout();

-- Avoid a second price source, disabling QPay, or moving a managed offer to
-- another course via the advanced class editor. RLS still requires an admin.
create function private.protect_course_managed_checkout()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare source_course public.courses%rowtype;
begin
  if tg_op = 'UPDATE' and (
    new.course_managed is distinct from old.course_managed
    or (old.course_managed and new.course_id is distinct from old.course_id)
  ) then
    raise exception 'Direct course checkout ownership is immutable.';
  end if;
  if not new.course_managed then return new; end if;
  select * into source_course from public.courses where id = new.course_id;
  if (new.status <> 'closed') and (
     new.name is distinct from left(source_course.title, 160)
     or new.tuition_amount_mnt is distinct from source_course.price_amount_mnt) then
    raise exception 'Edit this self-paced course name and price in the course editor.';
  end if;
  if new.status not in ('draft', 'open', 'closed') then
    raise exception 'Archive the course to stop direct sales without changing student access.';
  end if;
  if new.status = 'open' and (
    source_course.checkout_mode <> 'direct' or not source_course.published
    or source_course.archived_at is not null or source_course.price_amount_mnt <= 0
  ) then
    raise exception 'This course is not available for direct sales.';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_course_managed_checkout() from public, anon, authenticated;
create trigger a000_training_cohorts_course_managed
before insert or update on public.training_cohorts
for each row execute function private.protect_course_managed_checkout();

-- Never silently fall back to legacy receipt-only checkout for a paid course.
create or replace function public.course_uses_offering_checkout(p_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_checkout_ownerships where course_id = p_course_id
  ) or exists (
    select 1 from public.courses
    where id = p_course_id and (price_amount_mnt > 0 or checkout_mode = 'class_only')
  );
$$;
revoke all on function public.course_uses_offering_checkout(uuid) from public;
grant execute on function public.course_uses_offering_checkout(uuid) to anon, authenticated, service_role;

-- A legacy receipt already under review is not a reason to charge again.
create function private.guard_direct_checkout_legacy_pending()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_course_id uuid;
begin
  select course_id into target_course_id from public.training_cohorts
  where id = new.offering_id;
  if exists (
    select 1 from public.payment_requests
    where course_id = target_course_id and user_id = new.applicant_user_id
      and status = 'pending'
  ) then
    raise exception 'A previous course payment receipt is awaiting review. Do not pay again.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_direct_checkout_legacy_pending() from public, anon, authenticated;
create trigger a000_course_offering_payments_legacy_pending
before insert on public.course_offering_payments
for each row execute function private.guard_direct_checkout_legacy_pending();

-- Backfill only sellable direct courses. Archived/draft courses and historical
-- class enrollments remain untouched. Use the earliest existing administrator
-- for migration attribution; normal publishes always use the actual editor.
do $$
declare
  actor uuid;
  previous_sub text := current_setting('request.jwt.claim.sub', true);
begin
  select r.user_id into actor from public.user_roles r
  join auth.users u on u.id = r.user_id where r.role = 'admin'
  order by u.created_at, r.user_id limit 1;
  if actor is null then raise exception 'An administrator is required for checkout backfill.'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  update public.courses set checkout_mode = checkout_mode
  where checkout_mode = 'direct' and published and archived_at is null
    and price_amount_mnt > 0 and private.course_is_ready(id);
  perform set_config('request.jwt.claim.sub', coalesce(previous_sub, ''), true);
end;
$$;
