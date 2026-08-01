-- Preserve existing YouTube lessons while allowing a provider-specific, private
-- Cloudflare Stream video identifier for future paid-video playback.
alter table public.lesson_videos
  add column provider text not null default 'youtube',
  add column provider_video_id text,
  add column playback_status text not null default 'ready';

alter table public.lesson_videos
  alter column video_url drop not null,
  drop constraint lesson_videos_video_url_check,
  add constraint lesson_videos_provider_check
    check (provider in ('youtube', 'cloudflare')),
  add constraint lesson_videos_playback_status_check
    check (playback_status in ('uploading', 'processing', 'ready', 'errored')),
  add constraint lesson_videos_provider_source_check
    check (
      (provider = 'youtube' and video_url is not null and provider_video_id is null)
      or
      (provider = 'cloudflare' and video_url is null and provider_video_id is not null)
    );

-- A course with a video still processing must not be advertised as ready.
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
        and video.playback_status = 'ready'
    );
$$;

revoke all on function public.get_public_ready_course_ids() from public;
grant execute on function public.get_public_ready_course_ids() to anon, authenticated;
