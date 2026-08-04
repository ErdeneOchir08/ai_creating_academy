insert into public.contract_variables (
  key,
  label_mn,
  description_mn,
  category
)
values (
  'signer_phone',
  'Гэрээнд гарын үсэг зурах төлөөлөгчийн утас',
  'Суралцагчийг төлөөлөн гэрээ байгуулах асран хамгаалагчийн холбоо барих утас.',
  'participant'
)
on conflict (key) do update
set
  label_mn = excluded.label_mn,
  description_mn = excluded.description_mn,
  category = excluded.category,
  is_active = true;

alter function private.create_approved_application_contract_snapshot(uuid, uuid, timestamptz)
rename to create_approved_application_contract_snapshot_once;

create function private.create_approved_application_contract_snapshot(
  p_application_id uuid,
  p_created_by uuid,
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  snapshot_id uuid;
begin
  select snapshot.id into snapshot_id
  from public.cohort_application_contract_snapshots snapshot
  where snapshot.application_id = p_application_id;

  if snapshot_id is not null then
    return snapshot_id;
  end if;

  return private.create_approved_application_contract_snapshot_once(
    p_application_id,
    p_created_by,
    p_created_at
  );
end;
$$;

revoke all on function private.create_approved_application_contract_snapshot_once(uuid, uuid, timestamptz)
from public, anon, authenticated;

revoke all on function private.create_approved_application_contract_snapshot(uuid, uuid, timestamptz)
from public, anon, authenticated;
