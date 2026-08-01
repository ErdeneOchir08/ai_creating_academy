create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  position integer not null default 0 check (position >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index course_categories_name_lower_key
  on public.course_categories (lower(name));

create table public.course_category_assignments (
  course_id uuid not null references public.courses(id) on delete cascade,
  category_id uuid not null references public.course_categories(id) on delete cascade,
  primary key (course_id, category_id)
);

create index course_category_assignments_category_id_idx
  on public.course_category_assignments(category_id);

grant select on public.course_categories to anon, authenticated;
grant select on public.course_category_assignments to anon, authenticated;
grant insert, update, delete on public.course_categories to authenticated;
grant insert, update, delete on public.course_category_assignments to authenticated;

alter table public.course_categories enable row level security;
alter table public.course_category_assignments enable row level security;

create policy "course categories: public read visible"
on public.course_categories
for select
to anon, authenticated
using (is_visible = true);

create policy "course categories: admins manage"
on public.course_categories
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "course category assignments: public read published visible"
on public.course_category_assignments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.courses
    join public.course_categories on course_categories.id = course_category_assignments.category_id
    where courses.id = course_category_assignments.course_id
      and courses.published = true
      and course_categories.is_visible = true
  )
);

create policy "course category assignments: admins manage"
on public.course_category_assignments
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
