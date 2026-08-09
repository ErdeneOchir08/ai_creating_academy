import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260809092202_add_versioned_offering_configuration.sql'),
    'utf8',
)

describe('versioned V2 offering configuration migration', () => {
    it('converts only V2 capacity into informational class size', () => {
        expect(migration).toMatch(
            /update public\.training_cohorts[\s\S]*?display_capacity = capacity,[\s\S]*?capacity = null[\s\S]*?where checkout_version = 2/,
        )
        expect(migration).toContain('V2 checkout never treats this value as an enrollment limit.')
    })

    it('does not rerun the irreversible checkout claim for ordinary configuration edits', () => {
        expect(migration).toContain('drop trigger z1_training_cohorts_claim_v2_checkout')
        expect(migration).toContain('after insert or update of status, course_id, checkout_version on public.training_cohorts')
    })

    it('locks, version-checks and audits every published configuration update', () => {
        expect(migration).toContain('for update;')
        expect(migration).toContain('p_expected_revision is distinct from current_offering.configuration_revision')
        expect(migration).toContain('configuration_revision = current_offering.configuration_revision + 1')
        expect(migration).toContain('insert into public.course_offering_configuration_changes')
        expect(migration).toContain('private.v2_offering_configuration_snapshot(current_offering)')
        expect(migration).toContain('private.v2_offering_configuration_snapshot(updated_offering)')
    })

    it('keeps the exact display configuration on each immutable application snapshot', () => {
        expect(migration).toContain('create trigger a00_course_offering_applications_configuration_snapshot')
        expect(migration).toContain("'offering_configuration_revision', offering_configuration_revision")
        expect(migration).toContain("'display_capacity', offering_display_capacity")
    })

    it('uses RLS and explicit least-privilege grants for the audit trail', () => {
        expect(migration).toContain('alter table public.course_offering_configuration_changes enable row level security')
        expect(migration).toContain('revoke all on table public.course_offering_configuration_changes from anon, authenticated')
        expect(migration).toContain('grant select on table public.course_offering_configuration_changes to authenticated')
        expect(migration).toContain('using ((select private.is_admin()))')
        expect(migration).toMatch(
            /security definer[\s\S]*?current_user_id is null or coalesce\(\(select private\.is_admin\(\)\), false\) is false/,
        )
    })

    it('does not expose draft or scheduled offerings through display metadata', () => {
        expect(migration).toMatch(
            /get_course_offering_display_metadata[\s\S]*?cohort\.status = 'open'[\s\S]*?registration_opens_at[\s\S]*?registration_closes_at[\s\S]*?private\.course_is_ready/,
        )
    })
})
