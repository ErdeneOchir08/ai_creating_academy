alter table public.lessons
add column is_preview boolean not null default false;

create policy "lesson videos: public previews read"
on public.lesson_videos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = lesson_videos.lesson_id
      and lessons.is_preview = true
      and courses.published = true
  )
);
