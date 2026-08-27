alter table public.training_cohorts
add column class_type text;

alter table public.training_cohorts
add constraint training_cohorts_class_type_check
check (
  class_type is null
  or class_type in (
    'self_paced_online',
    'instructor_led_online',
    'offline_with_video'
  )
);

comment on column public.training_cohorts.class_type is
'Mind Academy business class type. Null is reserved for historical records that cannot be mapped safely.';

update public.training_cohorts
set class_type = case
  when delivery_mode = 'online' and contract_policy = 'none'
    then 'self_paced_online'
  when delivery_mode = 'online' and contract_policy = 'required'
    then 'instructor_led_online'
  when delivery_mode = 'offline' and contract_policy = 'required'
    then 'offline_with_video'
  else null
end
where class_type is null;
