-- Public catalogs must only advertise published courses that contain at least
-- one actual video lesson. This function returns IDs only; it does not expose
-- any private video metadata or URLs.
create or replace function public.get_public_ready_course_ids()
returns table (course_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select course.id
  from public.courses as course
  where course.published = true
    and exists (
      select 1
      from public.lessons as lesson
      join public.lesson_videos as video on video.lesson_id = lesson.id
      where lesson.course_id = course.id
    );
$$;

revoke all on function public.get_public_ready_course_ids() from public;
grant execute on function public.get_public_ready_course_ids() to anon, authenticated;
