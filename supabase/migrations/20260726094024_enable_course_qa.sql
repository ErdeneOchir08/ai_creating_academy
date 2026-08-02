create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  is_answered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists questions_lesson_created_at_idx
  on public.questions (lesson_id, created_at asc);

create index if not exists questions_course_user_idx
  on public.questions (course_id, user_id);

create index if not exists answers_question_created_at_idx
  on public.answers (question_id, created_at asc);

alter table public.questions enable row level security;
alter table public.answers enable row level security;

grant select, insert, update, delete on public.questions to authenticated;
grant select, insert on public.answers to authenticated;

create policy "Enrolled students can read lesson questions"
on public.questions
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.is_admin())
  or exists (
    select 1
    from public.enrollments
    where enrollments.course_id = questions.course_id
      and enrollments.user_id = (select auth.uid())
      and enrollments.status = 'active'
  )
);

create policy "Enrolled students can ask lesson questions"
on public.questions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.enrollments
    where enrollments.course_id = questions.course_id
      and enrollments.user_id = (select auth.uid())
      and enrollments.status = 'active'
  )
);

create policy "Question authors and admins can delete questions"
on public.questions
for delete
to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin()));

create policy "Admins can update question status"
on public.questions
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Participants can read answers"
on public.answers
for select
to authenticated
using (
  exists (
    select 1
    from public.questions
    where questions.id = answers.question_id
  )
);

create policy "Admins can answer questions"
on public.answers
for insert
to authenticated
with check (
  (select private.is_admin())
  and (select auth.uid()) = user_id
);
