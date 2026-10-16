-- Existing rows and requests from the previous deployment remain on legacy.
alter table public.course_offering_payments
  add column merchant_key text not null default 'legacy'
  constraint course_offering_payments_merchant_key_check
  check (merchant_key in ('legacy', 'zurkhai'));

-- Do not repurpose the original singleton token cache: an old deployment may
-- still be completing a request during rollout. New code uses isolated rows.
create table public.qpay_merchant_token_cache (
  merchant_key text primary key check (merchant_key in ('legacy', 'zurkhai')),
  client_id text not null,
  base_url text not null,
  access_token text not null,
  refresh_token text,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.qpay_merchant_token_cache enable row level security;
revoke all on public.qpay_merchant_token_cache from public, anon, authenticated;
grant select, insert, update, delete on public.qpay_merchant_token_cache to service_role;

-- Merchant ownership may only be selected before a provider invoice exists.
create function private.guard_qpay_merchant_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.merchant_key is distinct from old.merchant_key
     and (old.qpay_invoice_id is not null or old.status <> 'created') then
    raise exception 'Cannot change the merchant of an existing QPay invoice';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_qpay_merchant_owner() from public, anon, authenticated;
create trigger guard_qpay_merchant_owner
before update of merchant_key on public.course_offering_payments
for each row execute function private.guard_qpay_merchant_owner();
