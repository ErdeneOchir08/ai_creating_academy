grant select on public.course_bonus_courses to anon;

create policy "course bonuses: published courses visible"
on public.course_bonus_courses
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.courses as source_course
    where source_course.id = course_bonus_courses.source_course_id
      and source_course.published = true
  )
  and exists (
    select 1
    from public.courses as bonus_course
    where bonus_course.id = course_bonus_courses.bonus_course_id
      and bonus_course.published = true
  )
);
