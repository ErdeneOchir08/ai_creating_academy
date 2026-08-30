import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260830231152_allow_participants_to_read_class_schedules.sql'),
    'utf8',
).toLowerCase()

describe('student class schedule access migration', () => {
    it('limits class reads to admins, the assigned teacher or active enrolled student', () => {
        expect(migration).toContain('training cohorts: participants read')
        expect(migration).toContain('assignment.teacher_user_id = (select auth.uid())')
        expect(migration).toContain('enrollment.content_access_user_id = (select auth.uid())')
        expect(migration).toContain("enrollment.status = 'active'")
    })

    it('lets an enrolled student read only their assigned teacher profile', () => {
        expect(migration).toContain('profiles: account owners, class participants and admins read')
        expect(migration).toContain('assignment.teacher_user_id = profiles.id')
        expect(migration).toContain('join public.course_offering_enrollments')
    })
})
