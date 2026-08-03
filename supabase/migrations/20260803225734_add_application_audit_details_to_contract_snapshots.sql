alter table public.cohort_application_contract_snapshots
add column application_details jsonb
check (application_details is null or jsonb_typeof(application_details) = 'object');

create or replace function private.capture_contract_snapshot_application_details()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select jsonb_build_object(
    'contact_email', application.contact_email,
    'status', application.status,
    'submitted_at', application.submitted_at,
    'reviewed_at', application.reviewed_at,
    'created_at', application.created_at,
    'updated_at', application.updated_at
  )
  into new.application_details
  from public.cohort_applications application
  where application.id = new.application_id;

  if not found then
    raise exception 'The source application is required to create a contract snapshot.';
  end if;

  return new;
end;
$$;

create trigger cohort_contract_snapshots_capture_application_details
before insert on public.cohort_application_contract_snapshots
for each row execute function private.capture_contract_snapshot_application_details();

alter table public.cohort_application_contract_snapshots
disable trigger cohort_contract_snapshots_immutable;

update public.cohort_application_contract_snapshots snapshot
set application_details = jsonb_build_object(
  'contact_email', application.contact_email,
  'status', application.status,
  'submitted_at', application.submitted_at,
  'reviewed_at', application.reviewed_at,
  'created_at', application.created_at,
  'updated_at', application.updated_at
)
from public.cohort_applications application
where application.id = snapshot.application_id
  and snapshot.application_details is null;

alter table public.cohort_application_contract_snapshots
enable trigger cohort_contract_snapshots_immutable;

alter table public.cohort_application_contract_snapshots
alter column application_details set not null;

revoke all on function private.capture_contract_snapshot_application_details() from public, anon, authenticated;
