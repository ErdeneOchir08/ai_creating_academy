import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260827075711_add_class_teachers_and_sessions.sql'),
    'utf8',
).toLowerCase()

describe('class teacher and session migration', () => {
    it('keeps one active teacher while preserving assignment history', () => {
        expect(migration).toContain('class_teacher_assignments')
        expect(migration).toContain('where ended_at is null')
        expect(migration).toContain('ended_at = now()')
    })

    it('protects session access for class participants', () => {
        expect(migration).toContain('alter table public.class_sessions enable row level security')
        expect(migration).toContain('course_offering_enrollments')
        expect(migration).toContain('content_access_user_id = (select auth.uid())')
        expect(migration).toContain('teacher_user_id = (select auth.uid())')
    })

    it('saves the teacher, sessions and class dates atomically', () => {
        expect(migration).toContain('function public.save_guided_class_schedule')
        expect(migration).toContain('for update')
        expect(migration).toContain('delete from public.class_sessions')
        expect(migration).toContain('insert into public.class_sessions')
        expect(migration).toContain('security invoker')
    })

    it('does not expose the schedule writer to anonymous users', () => {
        expect(migration).toContain('from public, anon')
        expect(migration).toContain('to authenticated')
        expect(migration).not.toContain('security definer')
    })
})
