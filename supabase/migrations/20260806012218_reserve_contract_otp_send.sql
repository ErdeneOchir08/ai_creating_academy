create or replace function public.reserve_cohort_signature_verification(
  p_application_id uuid
)
returns table (
  reserved boolean,
  reserved_at timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_sent_at timestamptz;
  reservation_time timestamptz := clock_timestamp();
  resend_interval_seconds constant integer := 60;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select application.signature_verification_sent_at
  into current_sent_at
  from public.cohort_applications application
  where application.id = p_application_id
    and application.applicant_user_id = current_user_id
    and application.status = 'draft'
  for update;

  if not found then
    raise exception 'An editable draft application is required.';
  end if;

  if current_sent_at is not null
     and current_sent_at > reservation_time - make_interval(secs => resend_interval_seconds) then
    return query
    select
      false,
      current_sent_at,
      greatest(
        1,
        ceil(extract(epoch from (
          current_sent_at + make_interval(secs => resend_interval_seconds) - reservation_time
        )))::integer
      );
    return;
  end if;

  update public.cohort_applications
  set signature_verification_sent_at = reservation_time
  where id = p_application_id;

  return query select true, reservation_time, 0;
end;
$$;

create or replace function public.release_cohort_signature_verification(
  p_application_id uuid,
  p_reserved_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  released boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  update public.cohort_applications
  set signature_verification_sent_at = null
  where id = p_application_id
    and applicant_user_id = current_user_id
    and status = 'draft'
    and signature_verification_sent_at = p_reserved_at;

  released := found;
  return released;
end;
$$;

revoke all on function public.reserve_cohort_signature_verification(uuid)
from public, anon, authenticated;
grant execute on function public.reserve_cohort_signature_verification(uuid)
to authenticated;

revoke all on function public.release_cohort_signature_verification(uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.release_cohort_signature_verification(uuid, timestamptz)
to authenticated;
