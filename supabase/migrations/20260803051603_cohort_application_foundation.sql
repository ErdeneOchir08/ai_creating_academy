insert into public.contract_variables (key, label_mn, description_mn, category)
values (
  'signer_phone',
  'Гэрээнд гарын үсэг зурах талын утас',
  'Суралцагч өөрөө эсвэл түүнийг төлөөлөн гэрээ байгуулах хүний холбоо барих утас.',
  'participant'
)
on conflict (key) do nothing;

create table public.cohort_applications (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.training_cohorts(id) on delete restrict,
  applicant_user_id uuid not null references public.profiles(id) on delete restrict,
  contract_version_id uuid not null references public.contract_template_versions(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn')),
  contact_email text not null check (char_length(trim(contact_email)) between 3 and 320),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(trim(rejection_reason)) between 1 and 2_000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, applicant_user_id),
  check (
    (status in ('draft', 'withdrawn') and submitted_at is null and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'submitted' and submitted_at is not null and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and submitted_at is not null and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and submitted_at is not null and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null)
  )
);

create index cohort_applications_cohort_status_idx
on public.cohort_applications (cohort_id, status, created_at);

create index cohort_applications_applicant_status_idx
on public.cohort_applications (applicant_user_id, status, updated_at desc);

create index cohort_applications_contract_version_idx
on public.cohort_applications (contract_version_id);

create index cohort_applications_reviewed_by_idx
on public.cohort_applications (reviewed_by)
where reviewed_by is not null;

create or replace function private.validate_cohort_application_answers(
  p_contract_version_id uuid,
  p_answers jsonb,
  p_require_complete boolean
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  normalized_answers jsonb := '{}'::jsonb;
  answer_record record;
  allowed_keys text[];
  missing_keys text[];
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Application answers must be a JSON object.';
  end if;

  select coalesce(array_agg(distinct variable_match[1]), '{}'::text[])
  into allowed_keys
  from public.contract_template_versions version
  cross join lateral regexp_matches(
    version.content,
    '\{\{([a-z][a-z0-9_]*)\}\}',
    'g'
  ) as variable_match
  join public.contract_variables variable
    on variable.key = variable_match[1]
   and variable.category = 'participant'
   and variable.is_active
  where version.id = p_contract_version_id;

  if not exists (
    select 1
    from public.contract_template_versions
    where id = p_contract_version_id
      and status in ('published', 'retired')
  ) then
    raise exception 'The cohort contract version is not available.';
  end if;

  for answer_record in select key, value from jsonb_each_text(p_answers)
  loop
    if not (answer_record.key = any(allowed_keys)) then
      raise exception 'Application answer key is not allowed: %', answer_record.key;
    end if;

    if char_length(trim(answer_record.value)) > 500 then
      raise exception 'Application answer is too long: %', answer_record.key;
    end if;

    normalized_answers := normalized_answers || jsonb_build_object(answer_record.key, trim(answer_record.value));
  end loop;

  if p_require_complete then
    select array_agg(required_key)
    into missing_keys
    from unnest(allowed_keys) as required_key
    where nullif(trim(normalized_answers ->> required_key), '') is null;

    if missing_keys is not null then
      raise exception 'Required application answers are missing: %', array_to_string(missing_keys, ', ');
    end if;
  end if;

  return normalized_answers;
end;
$$;

create or replace function private.enforce_cohort_application_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cohort_contract_version_id uuid;
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

  if new.answers is distinct from old.answers and new.status <> 'draft' then
    raise exception 'Application answers may only be edited while the application is a draft.';
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

  new.answers := private.validate_cohort_application_answers(
    new.contract_version_id,
    new.answers,
    new.status in ('submitted', 'approved', 'rejected')
  );

  if new.status = 'draft' then
    new.submitted_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
  elsif new.status = 'submitted' and old.status <> 'submitted' then
    new.submitted_at := now();
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
  elsif new.status = 'withdrawn' then
    new.submitted_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
  elsif new.status in ('approved', 'rejected') then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
    if new.status = 'approved' then
      new.rejection_reason := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger cohort_applications_lifecycle
before insert or update on public.cohort_applications
for each row execute function private.enforce_cohort_application_lifecycle();

alter table public.cohort_applications enable row level security;

revoke all on table public.cohort_applications from anon, authenticated;
grant select on table public.cohort_applications to authenticated;
grant all on table public.cohort_applications to service_role;

create policy "cohort applications: applicants read own"
on public.cohort_applications
for select
to authenticated
using (applicant_user_id = (select auth.uid()));

create policy "cohort applications: admins read all"
on public.cohort_applications
for select
to authenticated
using ((select private.is_admin()));

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
    count(application.id) filter (where application.status = 'approved'),
    cohort.tuition_amount_mnt,
    cohort.payment_plan,
    cohort.schedule_summary,
    cohort.location,
    cohort.registration_closes_at,
    cohort.starts_on,
    cohort.ends_on
  from public.training_cohorts cohort
  join public.training_programs program on program.id = cohort.program_id
  left join public.cohort_applications application on application.cohort_id = cohort.id
  where cohort.status = 'open'
    and not program.is_archived
    and cohort.contract_version_id is not null
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
  group by cohort.id, program.id
  having cohort.capacity is null
      or count(application.id) filter (where application.status = 'approved') < cohort.capacity
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
        'rejection_reason', own_application.rejection_reason,
        'submitted_at', own_application.submitted_at,
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
  group by cohort.id, program.id, contract_version.id;

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

create or replace function public.save_cohort_application_draft(p_cohort_id uuid, p_answers jsonb)
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
  application_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select email into current_email from auth.users where id = current_user_id;
  if nullif(trim(coalesce(current_email, '')), '') is null then
    raise exception 'The authenticated account has no email address.';
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

  normalized_answers := private.validate_cohort_application_answers(
    target_cohort.contract_version_id,
    coalesce(p_answers, '{}'::jsonb),
    false
  );

  insert into public.cohort_applications (
    cohort_id,
    applicant_user_id,
    contract_version_id,
    contact_email,
    answers
  ) values (
    target_cohort.id,
    current_user_id,
    target_cohort.contract_version_id,
    lower(trim(current_email)),
    normalized_answers
  )
  on conflict (cohort_id, applicant_user_id) do update
  set status = 'draft', answers = excluded.answers
  where public.cohort_applications.status in ('draft', 'rejected', 'withdrawn')
  returning id into application_id;

  if application_id is null then
    raise exception 'This application cannot be edited in its current status.';
  end if;

  return application_id;
end;
$$;

create or replace function public.submit_cohort_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_application public.cohort_applications%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select application.* into target_application
  from public.cohort_applications application
  join public.training_cohorts cohort on cohort.id = application.cohort_id
  join public.training_programs program on program.id = cohort.program_id
  where application.id = p_application_id
    and application.applicant_user_id = current_user_id
    and application.status = 'draft'
    and cohort.status = 'open'
    and not program.is_archived
    and (cohort.registration_opens_at is null or cohort.registration_opens_at <= now())
    and (cohort.registration_closes_at is null or cohort.registration_closes_at >= now())
  for update of application;

  if not found then
    raise exception 'The draft application is not available for submission.';
  end if;

  perform private.validate_cohort_application_answers(
    target_application.contract_version_id,
    target_application.answers,
    true
  );

  update public.cohort_applications
  set status = 'submitted'
  where id = target_application.id;
end;
$$;

create or replace function public.withdraw_cohort_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  update public.cohort_applications
  set status = 'withdrawn'
  where id = p_application_id
    and applicant_user_id = (select auth.uid())
    and status in ('draft', 'submitted');

  if not found then
    raise exception 'The application cannot be withdrawn.';
  end if;
end;
$$;

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
  target_capacity integer;
  approved_count bigint;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
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

  select capacity into target_capacity
  from public.training_cohorts
  where id = target_application.cohort_id
  for update;

  if p_decision = 'approved' and target_capacity is not null then
    select count(*) into approved_count
    from public.cohort_applications
    where cohort_id = target_application.cohort_id
      and status = 'approved';

    if approved_count >= target_capacity then
      raise exception 'The cohort has reached its approved application capacity.';
    end if;
  end if;

  update public.cohort_applications
  set
    status = p_decision,
    rejection_reason = case when p_decision = 'rejected' then trim(p_rejection_reason) else null end
  where id = target_application.id;
end;
$$;

revoke all on function public.list_open_training_cohorts() from public;
revoke all on function public.get_open_cohort_application_form(uuid) from public;
revoke all on function public.save_cohort_application_draft(uuid, jsonb) from public;
revoke all on function public.submit_cohort_application(uuid) from public;
revoke all on function public.withdraw_cohort_application(uuid) from public;
revoke all on function public.review_cohort_application(uuid, text, text) from public;

grant execute on function public.list_open_training_cohorts() to anon, authenticated, service_role;
grant execute on function public.get_open_cohort_application_form(uuid) to anon, authenticated, service_role;
grant execute on function public.save_cohort_application_draft(uuid, jsonb) to authenticated, service_role;
grant execute on function public.submit_cohort_application(uuid) to authenticated, service_role;
grant execute on function public.withdraw_cohort_application(uuid) to authenticated, service_role;
grant execute on function public.review_cohort_application(uuid, text, text) to authenticated, service_role;

revoke all on function private.validate_cohort_application_answers(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function private.enforce_cohort_application_lifecycle() from public, anon, authenticated;
