import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260806150000_add_v2_offering_checkout.sql'),
    'utf8',
)

function functionBody(schema: 'private' | 'public', name: string) {
    const marker = `create or replace function ${schema}.${name}`
    const start = migration.indexOf(marker)
    expect(start, `${marker} must exist`).toBeGreaterThanOrEqual(0)

    const end = migration.indexOf('\n$$;', start)
    expect(end, `${marker} must have a body terminator`).toBeGreaterThan(start)
    return migration.slice(start, end)
}

describe('V2 offering checkout SQL safety contracts', () => {
    it('extends Q&A authorization through the canonical effective-access predicate', () => {
        expect(migration).toContain('create policy "Effective course access can read lesson questions"')
        expect(migration).toContain('create policy "Effective course access can ask lesson questions"')
        expect(migration).toContain('public.has_effective_course_access(questions.course_id)')
        expect(migration).toContain('(select auth.uid()) = user_id')
    })

    it('extends paid-video reads through canonical effective access without replacing legacy policies', () => {
        expect(migration).toContain('create policy "Effective course access can read lesson videos"')
        expect(migration).toContain('on public.lesson_videos')
        expect(migration).toContain('where lesson.id = lesson_videos.lesson_id')
        expect(migration).toContain('public.has_effective_course_access(lesson.course_id)')
    })

    it('fails closed when customer state is attached to a V2 cancellation', () => {
        const lifecycle = functionBody('private', 'enforce_training_cohort_lifecycle')

        expect(lifecycle).toContain("new.checkout_version = 2")
        expect(lifecycle).toContain("new.status = 'cancelled'")
        expect(lifecycle).toContain("application.status <> 'withdrawn'")
        expect(lifecycle).toContain("enrollment.status = 'active'")
        expect(lifecycle).toContain("entitlement.status = 'active'")
        expect(lifecycle).toContain('cannot be cancelled without the atomic cancellation workflow')
    })

    it('allows snapshotted payment work after registration closes but never after cancellation or completion', () => {
        const allowedOperationalStatuses = "target_offering.status not in ('open', 'closed', 'in_progress')"
        const submission = functionBody('public', 'submit_course_offering_checkout')
        const approval = functionBody('public', 'approve_course_offering_checkout')

        expect(submission).toContain(allowedOperationalStatuses)
        expect(submission).toContain('not operational for payment submission')
        expect(approval).toContain(allowedOperationalStatuses)
        expect(approval).toContain('not operational for approval')
    })

    it('returns a concurrent request-id winner only across matching checkout identity boundaries', () => {
        const saveDraft = functionBody('public', 'save_course_offering_checkout_draft')

        expect(saveDraft).toContain('when unique_violation then')
        expect(saveDraft).toContain('application.applicant_user_id = current_user_id')
        expect(saveDraft).toContain('application.client_request_id = parsed_client_request_id')
        expect(saveDraft).toContain('existing_application.offering_id = p_offering_id')
        expect(saveDraft).toContain('existing_application.content_access_user_id = p_content_access_user_id')
        expect(saveDraft).toContain('return existing_application.id')
    })
})
