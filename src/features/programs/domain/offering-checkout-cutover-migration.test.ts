import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const foundationMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260806150000_add_v2_offering_checkout.sql'),
    'utf8',
)
const activationMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260806160000_enable_v2_offering_checkout.sql'),
    'utf8',
)

function sqlFunction(source: string, qualifiedName: string) {
    const escapedName = qualifiedName.replaceAll('.', '\\.')
    return source.match(new RegExp(`create or replace function ${escapedName}\\b[\\s\\S]*?\\$\\$;`, 'i'))?.[0] ?? ''
}

describe('course-offering checkout cutover migration', () => {
    it('stores a durable, immutable ownership record with restricted reads', () => {
        expect(foundationMigration).toMatch(/create table public\.course_checkout_ownerships/)
        expect(foundationMigration).toMatch(
            /create trigger course_checkout_ownerships_immutable[\s\S]*?before update or delete on public\.course_checkout_ownerships/,
        )
        expect(foundationMigration).toMatch(/alter table public\.course_checkout_ownerships enable row level security/)
        expect(foundationMigration).toMatch(
            /create policy "course checkout ownerships: admins read"[\s\S]*?using \(\(select private\.is_admin\(\)\)\)/,
        )
        expect(foundationMigration).toMatch(
            /revoke all on table public\.course_checkout_ownerships from public, anon, authenticated/,
        )
    })

    it('does not route a course by the mere presence of a draft V2 offering', () => {
        const routingFunction = sqlFunction(foundationMigration, 'public.course_uses_offering_checkout')

        expect(routingFunction).toContain('from public.course_checkout_ownerships ownership')
        expect(routingFunction).not.toContain('from public.training_cohorts')
    })

    it('claims ownership only for an open V2 offering and keeps the first claim', () => {
        const claimFunction = sqlFunction(activationMigration, 'private.claim_v2_course_checkout_ownership')

        expect(claimFunction).toMatch(/new\.checkout_version <> 2 or new\.status <> 'open'/)
        expect(claimFunction).toContain('insert into public.course_checkout_ownerships')
        expect(claimFunction).toContain('on conflict (course_id) do nothing')
        expect(activationMigration).toMatch(
            /create trigger z1_training_cohorts_claim_v2_checkout[\s\S]*?after insert or update on public\.training_cohorts/,
        )
    })

    it('serializes legacy payment creation with the irreversible cutover', () => {
        const legacyGuard = sqlFunction(
            foundationMigration,
            'private.block_legacy_course_payment_for_v2_offering',
        )
        const courseLock = legacyGuard.indexOf('from public.courses course')
        const ownershipCheck = legacyGuard.indexOf('from public.course_checkout_ownerships ownership')

        expect(legacyGuard).toContain('security definer')
        expect(courseLock).toBeGreaterThan(-1)
        expect(legacyGuard.slice(courseLock, ownershipCheck)).toContain('for update')
        expect(ownershipCheck).toBeGreaterThan(courseLock)
    })
})
