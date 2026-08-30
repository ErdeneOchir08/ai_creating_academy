drop policy if exists "training cohorts: admins read" on public.training_cohorts;

create policy "training cohorts: participants read"
on public.training_cohorts for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.class_teacher_assignments assignment
    where assignment.class_id = training_cohorts.id
      and assignment.teacher_user_id = (select auth.uid())
      and assignment.ended_at is null
  )
  or exists (
    select 1
    from public.course_offering_enrollments enrollment
    where enrollment.offering_id = training_cohorts.id
      and enrollment.content_access_user_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

drop policy if exists "profiles: users read own; admins read all" on public.profiles;

create policy "profiles: account owners, class participants and admins read"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1
    from public.class_teacher_assignments assignment
    join public.course_offering_enrollments enrollment
      on enrollment.offering_id = assignment.class_id
    where assignment.teacher_user_id = profiles.id
      and assignment.ended_at is null
      and enrollment.content_access_user_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

