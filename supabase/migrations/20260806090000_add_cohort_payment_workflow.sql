alter table public.training_cohorts
  add column if not exists payment_due_days integer;

alter table public.training_cohorts
  drop constraint if exists training_cohorts_payment_due_days_positive;

alter table public.training_cohorts
  add constraint training_cohorts_payment_due_days_positive
  check (payment_due_days is null or payment_due_days > 0);

alter table public.cohort_applications
  add column if not exists payment_due_at timestamptz;

create table public.cohort_payment_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.cohort_applications(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  cohort_id uuid not null references public.training_cohorts(id) on delete restrict,
  receipt_path text not null check (char_length(trim(receipt_path)) > 0),
  amount_mnt integer not null check (amount_mnt > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text check (
    rejection_reason is null or char_length(trim(rejection_reason)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index cohort_payment_requests_one_pending_per_application_idx
on public.cohort_payment_requests (application_id)
where status = 'pending';

create index cohort_payment_requests_applicant_created_idx
on public.cohort_payment_requests (applicant_user_id, created_at desc);

create index cohort_payment_requests_cohort_status_idx
on public.cohort_payment_requests (cohort_id, status, created_at desc);

create index cohort_payment_requests_reviewed_by_idx
on public.cohort_payment_requests (reviewed_by)
where reviewed_by is not null;

create table public.cohort_enrollments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.training_cohorts(id) on delete restrict,
  application_id uuid not null unique references public.cohort_applications(id) on delete restrict,
  student_user_id uuid not null references public.profiles(id) on delete restrict,
  payment_request_id uuid unique references public.cohort_payment_requests(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, student_user_id)
);

create index cohort_enrollments_cohort_status_idx
on public.cohort_enrollments (cohort_id, status, enrolled_at);

create index cohort_enrollments_student_status_idx
on public.cohort_enrollments (student_user_id, status, enrolled_at desc);

alter table public.cohort_payment_requests enable row level security;
alter table public.cohort_enrollments enable row level security;

revoke all on table public.cohort_payment_requests from anon, authenticated;
grant select on table public.cohort_payment_requests to authenticated;
grant all on table public.cohort_payment_requests to service_role;

revoke all on table public.cohort_enrollments from anon, authenticated;
grant select on table public.cohort_enrollments to authenticated;
grant all on table public.cohort_enrollments to service_role;

create policy "cohort payments: applicant or admin reads"
on public.cohort_payment_requests
for select
to authenticated
using (
  applicant_user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy "cohort enrollments: student or admin reads"
on public.cohort_enrollments
for select
to authenticated
using (
  student_user_id = (select auth.uid())
  or (select private.is_admin())
);

create or replace function private.enforce_cohort_payment_request_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending'
       or new.reviewed_by is not null
       or new.reviewed_at is not null
       or new.rejection_reason is not null then
      raise exception 'New cohort payment requests must begin as pending.';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id
     or new.application_id is distinct from old.application_id
     or new.applicant_user_id is distinct from old.applicant_user_id
     or new.cohort_id is distinct from old.cohort_id
     or new.receipt_path is distinct from old.receipt_path
     or new.amount_mnt is distinct from old.amount_mnt
     or new.created_at is distinct from old.created_at then
    raise exception 'Cohort payment request identity and receipt details are immutable.';
  end if;

  if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
    raise exception 'The cohort payment request is no longer pending.';
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

create trigger cohort_payment_requests_lifecycle
before insert or update on public.cohort_payment_requests
for each row execute function private.enforce_cohort_payment_request_lifecycle();

create or replace function public.submit_cohort_payment_request(
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
  target_application public.cohort_applications%rowtype;
  target_cohort public.training_cohorts%rowtype;
  request_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(coalesce(p_receipt_path, '')), '') is null
     or p_receipt_path not like current_user_id::text || '/%' then
    raise exception 'The payment receipt path is invalid.';
  end if;

  if not exists (
    select 1
    from storage.objects receipt_object
    where receipt_object.bucket_id = 'payment-receipts'
      and receipt_object.name = trim(p_receipt_path)
  ) then
    raise exception 'The payment receipt file does not exist.';
  end if;

  select application.* into target_application
  from public.cohort_applications application
  where application.id = p_application_id
    and application.applicant_user_id = current_user_id
    and application.status = 'approved'
  for update;

  if not found then
    raise exception 'An approved application is required before payment.';
  end if;

  if target_application.payment_due_at is null then
    raise exception 'The payment deadline is not configured.';
  end if;

  select cohort.* into strict target_cohort
  from public.training_cohorts cohort
  where cohort.id = target_application.cohort_id;

  if target_cohort.tuition_amount_mnt is null or target_cohort.tuition_amount_mnt <= 0 then
    raise exception 'This cohort does not require a receipt payment.';
  end if;

  if target_application.payment_due_at < now()
     and not exists (
       select 1
       from public.cohort_payment_requests rejected_payment
       where rejected_payment.application_id = target_application.id
         and rejected_payment.status = 'rejected'
         and rejected_payment.reviewed_at is not null
         and rejected_payment.reviewed_at + make_interval(days => target_cohort.payment_due_days) >= now()
     ) then
    raise exception 'The payment deadline has passed.';
  end if;

  if exists (
    select 1 from public.cohort_enrollments enrollment
    where enrollment.application_id = target_application.id
      and enrollment.status = 'active'
  ) then
    raise exception 'The applicant is already enrolled.';
  end if;

  if exists (
    select 1 from public.cohort_payment_requests payment
    where payment.application_id = target_application.id
      and payment.status = 'pending'
  ) then
    raise exception 'A payment request is already pending.';
  end if;

  insert into public.cohort_payment_requests (
    application_id,
    applicant_user_id,
    cohort_id,
    receipt_path,
    amount_mnt
  ) values (
    target_application.id,
    target_application.applicant_user_id,
    target_application.cohort_id,
    trim(p_receipt_path),
    target_cohort.tuition_amount_mnt
  ) returning id into request_id;

  return request_id;
end;
$$;

create or replace function public.approve_cohort_payment_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewer_id uuid := (select auth.uid());
  target_request public.cohort_payment_requests%rowtype;
  target_capacity integer;
  enrolled_count bigint;
begin
  if reviewer_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  select payment.* into target_request
  from public.cohort_payment_requests payment
  where payment.id = p_request_id
    and payment.status = 'pending'
  for update;

  if not found then
    raise exception 'The cohort payment request is no longer pending.';
  end if;

  select capacity into target_capacity
  from public.training_cohorts
  where id = target_request.cohort_id
  for update;

  if target_capacity is not null then
    select count(*) into enrolled_count
    from public.cohort_enrollments
    where cohort_id = target_request.cohort_id
      and status = 'active';

    if enrolled_count >= target_capacity then
      raise exception 'The cohort has reached its enrolled student capacity.';
    end if;
  end if;

  insert into public.cohort_enrollments (
    cohort_id,
    application_id,
    student_user_id,
    payment_request_id
  ) values (
    target_request.cohort_id,
    target_request.application_id,
    target_request.applicant_user_id,
    target_request.id
  );

  update public.cohort_payment_requests
  set status = 'approved', rejection_reason = null
  where id = target_request.id;
end;
$$;

create or replace function public.reject_cohort_payment_request(
  p_request_id uuid,
  p_rejection_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := nullif(trim(coalesce(p_rejection_reason, '')), '');
  target_request public.cohort_payment_requests%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  if reason is null then
    raise exception 'A rejection reason is required.';
  end if;

  if char_length(reason) > 500 then
    raise exception 'The rejection reason must be 500 characters or fewer.';
  end if;

  select payment.* into target_request
  from public.cohort_payment_requests payment
  where payment.id = p_request_id
    and payment.status = 'pending'
  for update;

  if not found then
    raise exception 'The cohort payment request is no longer pending.';
  end if;

  update public.cohort_payment_requests
  set status = 'rejected', rejection_reason = reason
  where id = target_request.id;

end;
$$;

create or replace function public.get_cohort_payment_notification_recipient(p_request_id uuid)
returns table (
  email text,
  display_name text,
  program_name text,
  cohort_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  return query
  select
    users.email::text,
    profiles.display_name::text,
    programs.name::text,
    cohorts.name::text
  from public.cohort_payment_requests payment
  join auth.users users on users.id = payment.applicant_user_id
  left join public.profiles profiles on profiles.id = payment.applicant_user_id
  join public.training_cohorts cohorts on cohorts.id = payment.cohort_id
  join public.training_programs programs on programs.id = cohorts.program_id
  where payment.id = p_request_id;
end;
$$;

revoke all on function private.enforce_cohort_payment_request_lifecycle() from public, anon, authenticated;

revoke all on function public.submit_cohort_payment_request(uuid, text) from public, anon;
grant execute on function public.submit_cohort_payment_request(uuid, text) to authenticated, service_role;

revoke all on function public.approve_cohort_payment_request(uuid) from public, anon;
grant execute on function public.approve_cohort_payment_request(uuid) to authenticated, service_role;

revoke all on function public.reject_cohort_payment_request(uuid, text) from public, anon;
grant execute on function public.reject_cohort_payment_request(uuid, text) to authenticated, service_role;

revoke all on function public.get_cohort_payment_notification_recipient(uuid) from public, anon;
grant execute on function public.get_cohort_payment_notification_recipient(uuid) to authenticated, service_role;

create or replace function private.require_cohort_payment_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'open' then
    if new.tuition_amount_mnt is null then
      raise exception 'The cohort tuition must be configured before registration opens.';
    end if;

    if new.tuition_amount_mnt > 0 and new.payment_due_days is null then
      raise exception 'The payment deadline must be configured before paid registration opens.';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.tuition_amount_mnt > 0
     and new.payment_due_days is null
     and exists (
       select 1
       from public.cohort_applications application
       where application.cohort_id = new.id
         and application.status = 'approved'
     ) then
    raise exception 'The payment deadline cannot be removed while approved applications exist.';
  end if;

  return new;
end;
$$;

create trigger training_cohorts_require_payment_terms
before insert or update on public.training_cohorts
for each row execute function private.require_cohort_payment_terms();

revoke all on function private.require_cohort_payment_terms() from public, anon, authenticated;

create or replace function public.review_cohort_application(
  p_application_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_application public.cohort_applications%rowtype;
  target_cohort public.training_cohorts%rowtype;
  reviewer_id uuid := (select auth.uid());
  committed_count bigint;
  reviewed_time timestamptz := now();
begin
  if reviewer_id is null or not (select private.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'The application decision is invalid.';
  end if;

  if p_decision = 'rejected' and nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  select application.* into target_application
  from public.cohort_applications application
  where application.id = p_application_id
    and application.status = 'submitted'
  for update;

  if not found then
    raise exception 'The submitted application was not found.';
  end if;

  select cohort.* into strict target_cohort
  from public.training_cohorts cohort
  where cohort.id = target_application.cohort_id
  for update;

  if p_decision = 'approved' then
    if target_cohort.tuition_amount_mnt is null then
      raise exception 'The cohort tuition is not configured.';
    end if;

    if target_cohort.tuition_amount_mnt > 0 and target_cohort.payment_due_days is null then
      raise exception 'The cohort payment deadline is not configured.';
    end if;

    if target_cohort.capacity is not null then
      select
        (
          select count(*)
          from public.cohort_enrollments enrollment
          where enrollment.cohort_id = target_cohort.id
            and enrollment.status = 'active'
        ) + (
          select count(*)
          from public.cohort_applications application
          where application.cohort_id = target_cohort.id
            and application.status = 'approved'
            and not exists (
              select 1
              from public.cohort_enrollments enrollment
              where enrollment.application_id = application.id
                and enrollment.status = 'active'
            )
            and (
              application.payment_due_at >= reviewed_time
              or exists (
                select 1
                from public.cohort_payment_requests payment_request
                where payment_request.application_id = application.id
                  and payment_request.status = 'pending'
              )
              or exists (
                select 1
                from public.cohort_payment_requests rejected_payment
                where rejected_payment.application_id = application.id
                  and rejected_payment.status = 'rejected'
                  and rejected_payment.reviewed_at
                    + make_interval(days => target_cohort.payment_due_days) >= reviewed_time
              )
            )
        )
      into committed_count;

      if committed_count >= target_cohort.capacity then
        raise exception 'The cohort has reached its available payment invitation capacity.';
      end if;
    end if;
  end if;

  update public.cohort_applications
  set
    status = p_decision,
    rejection_reason = case when p_decision = 'rejected' then trim(p_rejection_reason) else null end,
    payment_due_at = case
      when p_decision = 'approved' and target_cohort.tuition_amount_mnt > 0
        then reviewed_time + make_interval(days => target_cohort.payment_due_days)
      else null
    end
  where id = target_application.id;

  if p_decision = 'approved' then
    perform private.create_approved_application_contract_snapshot(
      target_application.id,
      reviewer_id,
      reviewed_time
    );

    if target_cohort.tuition_amount_mnt = 0 then
      insert into public.cohort_enrollments (
        cohort_id,
        application_id,
        student_user_id,
        payment_request_id
      ) values (
        target_cohort.id,
        target_application.id,
        target_application.applicant_user_id,
        null
      );
    end if;
  end if;
end;
$$;

revoke all on function public.review_cohort_application(uuid, text, text) from public, anon;
grant execute on function public.review_cohort_application(uuid, text, text) to authenticated, service_role;

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
  where cohort.status = 'open'
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
