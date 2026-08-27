alter table public.training_cohorts
add constraint training_cohorts_class_type_rules_check
check (
  class_type is null
  or (
    class_type = 'self_paced_online'
    and delivery_mode = 'online'
    and contract_policy = 'none'
  )
  or (
    class_type = 'instructor_led_online'
    and delivery_mode = 'online'
    and contract_policy = 'required'
  )
  or (
    class_type = 'offline_with_video'
    and delivery_mode = 'offline'
    and contract_policy = 'required'
  )
);

create or replace function public.create_guided_class_draft(
  p_name text,
  p_description text,
  p_class_type text
)
returns table (
  program_id uuid,
  class_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  next_name text := trim(coalesce(p_name, ''));
  next_description text := trim(coalesce(p_description, ''));
  next_delivery_mode text;
  next_contract_policy text;
  next_program_id uuid;
  next_class_id uuid;
begin
  if current_user_id is null
     or coalesce((select private.is_admin()), false) is false then
    raise exception 'Administrator access is required.';
  end if;

  if char_length(next_name) not between 1 and 160 then
    raise exception 'Class name must contain between 1 and 160 characters.';
  end if;

  if char_length(next_description) > 2000 then
    raise exception 'Class description cannot exceed 2000 characters.';
  end if;

  case p_class_type
    when 'self_paced_online' then
      next_delivery_mode := 'online';
      next_contract_policy := 'none';
    when 'instructor_led_online' then
      next_delivery_mode := 'online';
      next_contract_policy := 'required';
    when 'offline_with_video' then
      next_delivery_mode := 'offline';
      next_contract_policy := 'required';
    else
      raise exception 'Unsupported class type.';
  end case;

  insert into public.training_programs (
    name,
    description,
    created_by
  )
  values (
    next_name,
    next_description,
    current_user_id
  )
  returning id into next_program_id;

  insert into public.training_cohorts (
    program_id,
    name,
    delivery_mode,
    status,
    checkout_version,
    class_type,
    contract_policy,
    qpay_enabled,
    manual_transfer_enabled,
    created_by,
    status_changed_by
  )
  values (
    next_program_id,
    next_name,
    next_delivery_mode,
    'draft',
    2,
    p_class_type,
    next_contract_policy,
    true,
    true,
    current_user_id,
    current_user_id
  )
  returning id into next_class_id;

  return query select next_program_id, next_class_id;
end;
$$;

comment on function public.create_guided_class_draft(text, text, text) is
'Atomically creates the hidden program and V2 class draft used by the guided admin wizard.';

revoke all on function public.create_guided_class_draft(text, text, text)
from public, anon;

grant execute on function public.create_guided_class_draft(text, text, text)
to authenticated, service_role;
