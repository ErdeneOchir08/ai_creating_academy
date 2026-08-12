import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260812192000_archive_courses_safely.sql'),
    'utf8',
)

describe('safe course archive migration', () => {
    it('preserves operational history while closing new V2 enrollment', () => {
        expect(migration).toContain('add column archived_at timestamptz')
        expect(migration).toContain("set status = 'closed'")
        expect(migration).toContain("and status = 'open'")
        expect(migration).not.toMatch(/delete from public\.(enrollments|payment_requests|course_offering_applications|course_access_entitlements)/)
    })

    it('requires an authenticated administrator', () => {
        expect(migration).toContain('not (select private.is_admin())')
        expect(migration).toContain('revoke all on function public.set_course_archived(uuid, boolean) from public, anon')
    })

    it('removes archived courses from catalogs and both checkout versions', () => {
        expect(migration).toMatch(/get_public_ready_course_ids\(\)[\s\S]*course\.archived_at is null/)
        expect(migration).toMatch(/private\.course_is_ready\(p_course_id uuid\)[\s\S]*course\.archived_at is null/)
        expect(migration).toMatch(/payment requests: students create own[\s\S]*courses\.archived_at is null/)
    })
})
