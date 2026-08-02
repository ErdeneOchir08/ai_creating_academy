alter table public.payment_requests
  add column if not exists amount_mnt integer;

alter table public.payment_requests
  drop constraint if exists payment_requests_amount_mnt_nonnegative;

alter table public.payment_requests
  add constraint payment_requests_amount_mnt_nonnegative
  check (amount_mnt is null or amount_mnt >= 0);

drop function if exists public.reject_payment_request(uuid);

create function public.reject_payment_request(
  p_request_id uuid,
  p_rejection_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_reason text := nullif(btrim(p_rejection_reason), '');
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Rejection reason must be 500 characters or fewer';
  end if;

  update public.payment_requests
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = v_reason
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'Payment request is no longer pending';
  end if;
end;
$$;

revoke execute on function public.reject_payment_request(uuid, text) from public, anon;
grant execute on function public.reject_payment_request(uuid, text) to authenticated;
