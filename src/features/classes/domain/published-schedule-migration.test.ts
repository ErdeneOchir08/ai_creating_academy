import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260830234032_add_safe_published_class_schedule_updates.sql'),
    'utf8',
).toLowerCase()

describe('published class schedule update migration', () => {
    it('uses optimistic locking and blocks changes after a session starts', () => {
        expect(migration).toContain('p_expected_revision is distinct from target_class.configuration_revision')
        expect(migration).toContain('starts_at <= now()')
        expect(migration).toContain("status not in ('open', 'closed')")
    })

    it('updates teacher, sessions and class summary atomically', () => {
        expect(migration).toContain('for update')
        expect(migration).toContain('update public.class_teacher_assignments')
        expect(migration).toContain('delete from public.class_sessions')
        expect(migration).toContain('insert into public.class_sessions')
        expect(migration).toContain('update public.training_cohorts')
    })

    it('records before and after schedules without touching financial history', () => {
        expect(migration).toContain('course_offering_configuration_changes')
        expect(migration).toContain('before_configuration')
        expect(migration).toContain('after_configuration')
        expect(migration).not.toMatch(/(update|delete from) public\.(course_offering_payments|course_offering_contract_acceptances|course_access_entitlements)/)
    })

    it('uses RLS and does not expose the writer to anonymous users', () => {
        expect(migration).toContain('security invoker')
        expect(migration).toContain('private.is_admin()')
        expect(migration).toContain('from public, anon')
    })
})
