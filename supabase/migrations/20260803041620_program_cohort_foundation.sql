create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2_000),
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index training_programs_name_unique
on public.training_programs (lower(trim(name)));

create table public.training_cohorts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  delivery_mode text not null check (delivery_mode in ('online', 'offline', 'hybrid')),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'in_progress', 'completed', 'cancelled')),
  contract_version_id uuid references public.contract_template_versions(id) on delete restrict,
  capacity integer check (capacity is null or capacity > 0),
  tuition_amount_mnt integer check (tuition_amount_mnt is null or tuition_amount_mnt >= 0),
  payment_plan text not null default '' check (char_length(payment_plan) <= 1_000),
  schedule_summary text not null default '' check (char_length(schedule_summary) <= 2_000),
  location text not null default '' check (char_length(location) <= 1_000),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  starts_on date,
  ends_on date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  contract_assigned_by uuid references public.profiles(id) on delete restrict,
  contract_assigned_at timestamptz,
  status_changed_by uuid not null references public.profiles(id) on delete restrict,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_closes_at is null or registration_opens_at is null or registration_closes_at >= registration_opens_at),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (
    (contract_version_id is null and contract_assigned_by is null and contract_assigned_at is null)
    or
    (contract_version_id is not null and contract_assigned_by is not null and contract_assigned_at is not null)
  )
);

create unique index training_cohorts_program_name_unique
on public.training_cohorts (program_id, lower(trim(name)));

create index training_cohorts_program_status_idx
on public.training_cohorts (program_id, status, starts_on);

create index training_cohorts_contract_version_id_idx
on public.training_cohorts (contract_version_id)
where contract_version_id is not null;

create index training_cohorts_created_by_idx
on public.training_cohorts (created_by);

create index training_cohorts_contract_assigned_by_idx
on public.training_cohorts (contract_assigned_by)
where contract_assigned_by is not null;

create index training_cohorts_status_changed_by_idx
on public.training_cohorts (status_changed_by);

create or replace function private.set_training_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.enforce_training_program_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Training program identity and authorship are immutable.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.enforce_training_cohort_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  contract_is_assignable boolean;
  program_is_active boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft cohorts can be deleted.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New cohorts must begin as drafts.';
    end if;

    if new.created_by is distinct from current_user_id
       or new.status_changed_by is distinct from current_user_id then
      raise exception 'Cohort authorship must match the authenticated administrator.';
    end if;

    select not is_archived into program_is_active
    from public.training_programs
    where id = new.program_id;

    if coalesce(program_is_active, false) is false then
      raise exception 'New cohorts cannot be created for an archived program.';
    end if;

    if new.contract_version_id is not null then
      select versions.status = 'published' and not templates.is_archived
      into contract_is_assignable
      from public.contract_template_versions as versions
      join public.contract_templates as templates on templates.id = versions.template_id
      where versions.id = new.contract_version_id;

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
      select versions.status = 'published' and not templates.is_archived
      into contract_is_assignable
      from public.contract_template_versions as versions
      join public.contract_templates as templates on templates.id = versions.template_id
      where versions.id = new.contract_version_id;

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
    if not (
      (old.status = 'draft' and new.status in ('open', 'cancelled'))
      or (old.status = 'open' and new.status in ('closed', 'cancelled'))
      or (old.status = 'closed' and new.status in ('open', 'in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Invalid cohort status transition from % to %.', old.status, new.status;
    end if;

    if new.status = 'open' then
      if new.contract_version_id is null then
        raise exception 'A published contract version is required before opening registration.';
      end if;

      select versions.status = 'published' and not templates.is_archived
      into contract_is_assignable
      from public.contract_template_versions as versions
      join public.contract_templates as templates on templates.id = versions.template_id
      where versions.id = new.contract_version_id;

      if coalesce(contract_is_assignable, false) is false then
        raise exception 'The assigned contract must still be published when registration opens.';
      end if;

      select not is_archived into program_is_active
      from public.training_programs
      where id = new.program_id;

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

create trigger a_training_programs_lifecycle
before update or delete on public.training_programs
for each row execute function private.enforce_training_program_lifecycle();

create trigger z_training_programs_updated_at
before update on public.training_programs
for each row execute function private.set_training_updated_at();

create trigger a_training_cohorts_lifecycle
before insert or update or delete on public.training_cohorts
for each row execute function private.enforce_training_cohort_lifecycle();

create trigger z_training_cohorts_updated_at
before update on public.training_cohorts
for each row execute function private.set_training_updated_at();

alter table public.training_programs enable row level security;
alter table public.training_cohorts enable row level security;

revoke all on table public.training_programs from anon, authenticated;
revoke all on table public.training_cohorts from anon, authenticated;

grant select, insert, update, delete on table public.training_programs to authenticated;
grant select, insert, update, delete on table public.training_cohorts to authenticated;
grant all on table public.training_programs to service_role;
grant all on table public.training_cohorts to service_role;

create policy "training programs: admins read"
on public.training_programs for select to authenticated
using ((select private.is_admin()));

create policy "training programs: admins create"
on public.training_programs for insert to authenticated
with check ((select private.is_admin()) and created_by = (select auth.uid()));

create policy "training programs: admins update"
on public.training_programs for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "training programs: admins delete unused"
on public.training_programs for delete to authenticated
using ((select private.is_admin()));

create policy "training cohorts: admins read"
on public.training_cohorts for select to authenticated
using ((select private.is_admin()));

create policy "training cohorts: admins create"
on public.training_cohorts for insert to authenticated
with check (
  (select private.is_admin())
  and created_by = (select auth.uid())
  and status_changed_by = (select auth.uid())
  and status = 'draft'
);

create policy "training cohorts: admins update"
on public.training_cohorts for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "training cohorts: admins delete drafts"
on public.training_cohorts for delete to authenticated
using ((select private.is_admin()) and status = 'draft');

revoke all on function private.set_training_updated_at() from public, anon, authenticated;
revoke all on function private.enforce_training_program_lifecycle() from public, anon, authenticated;
revoke all on function private.enforce_training_cohort_lifecycle() from public, anon, authenticated;
