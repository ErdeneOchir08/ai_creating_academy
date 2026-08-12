alter table public.lessons
add column display_code text;

alter table public.lessons
add constraint lessons_display_code_format_check
check (
  display_code is null
  or (
    display_code = btrim(display_code)
    and char_length(display_code) between 1 and 32
    and display_code !~ '[[:cntrl:]]'
  )
);

create unique index lessons_course_display_code_unique
on public.lessons (course_id, lower(display_code))
where display_code is not null;

comment on column public.lessons.display_code is
'Optional student-facing lesson code. Lesson ordering continues to use position.';
