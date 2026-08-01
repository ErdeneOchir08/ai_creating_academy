create or replace function public.get_question_answer_notification_recipient(p_question_id uuid)
returns table (
  email text,
  display_name text,
  course_title text,
  lesson_title text
)
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  return query
  select
    auth.users.email::text,
    profiles.display_name::text,
    courses.title::text,
    lessons.title::text
  from public.questions
  join auth.users on auth.users.id = questions.user_id
  left join public.profiles on profiles.id = questions.user_id
  join public.courses on courses.id = questions.course_id
  join public.lessons on lessons.id = questions.lesson_id
  where questions.id = p_question_id;
end;
$$;

revoke all on function public.get_question_answer_notification_recipient(uuid) from public, anon;
grant execute on function public.get_question_answer_notification_recipient(uuid) to authenticated;
