create or replace function public.reorder_course_lesson(p_course_id uuid, p_lesson_id uuid, p_direction text)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  current_position integer;
  target_lesson_id uuid;
  target_position integer;
  temporary_position integer;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'Invalid lesson direction';
  end if;

  perform 1 from public.lessons where course_id = p_course_id for update;

  select position into current_position
  from public.lessons
  where id = p_lesson_id and course_id = p_course_id;

  if current_position is null then
    raise exception 'Lesson not found in this course';
  end if;

  if p_direction = 'up' then
    select id, position into target_lesson_id, target_position
    from public.lessons
    where course_id = p_course_id and position < current_position
    order by position desc
    limit 1;
  else
    select id, position into target_lesson_id, target_position
    from public.lessons
    where course_id = p_course_id and position > current_position
    order by position asc
    limit 1;
  end if;

  if target_lesson_id is null then
    return;
  end if;

  select coalesce(max(position), 0) + 1 into temporary_position
  from public.lessons
  where course_id = p_course_id;

  update public.lessons set position = temporary_position where id = p_lesson_id;
  update public.lessons set position = current_position where id = target_lesson_id;
  update public.lessons set position = target_position where id = p_lesson_id;
end;
$$;

revoke execute on function public.reorder_course_lesson(uuid, uuid, text) from public, anon;
grant execute on function public.reorder_course_lesson(uuid, uuid, text) to authenticated;
