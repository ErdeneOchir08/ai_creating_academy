import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260814010943_add_course_offering_payment_references.sql'),
    'utf8',
)
const foundationMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260806150000_add_v2_offering_checkout.sql'),
    'utf8',
)

function checkoutFormFunction(source: string) {
    return source.match(
        /create or replace function public\.get_course_offering_checkout_form\(p_offering_id uuid\)[\s\S]*?\n\$\$;/i,
    )?.[0] ?? ''
}

describe('course offering payment-reference migration', () => {
    it('allocates concurrency-safe human references from a private sequence', () => {
        expect(migration).toContain('create sequence private.course_offering_payment_reference_seq')
        expect(migration).toContain("nextval('private.course_offering_payment_reference_seq'::regclass)")
        expect(migration).toContain("return 'MA-' || case")
        expect(migration).toContain('revoke all on sequence private.course_offering_payment_reference_seq')
    })

    it('backfills and constrains every application reference without rewriting application history', () => {
        expect(migration).toMatch(
            /alter table public\.course_offering_applications\s+add column payment_reference text\s+not null\s+default private\.allocate_course_offering_payment_reference\(\)/i,
        )
        expect(migration).not.toMatch(/update public\.course_offering_applications/i)
        expect(migration).toContain('unique (payment_reference)')
        expect(migration).toContain("payment_reference ~ '^MA-[0-9]{8,19}$'")
        expect(migration).not.toMatch(/alter table public\.course_offering_payment_proofs[\s\S]*payment_reference/i)
    })

    it('makes the reference immutable and returns it with learner checkout state', () => {
        expect(migration).toContain('course_offering_applications_payment_reference_immutable')
        expect(migration).toContain('new.payment_reference is distinct from old.payment_reference')
        expect(migration).toContain("'payment_reference', application.payment_reference")
    })

    it('preserves the existing checkout query except for the added reference field', () => {
        const original = checkoutFormFunction(foundationMigration)
        const replacement = checkoutFormFunction(migration)

        expect(original).not.toBe('')
        expect(replacement.replace(
            "          'payment_reference', application.payment_reference,\n",
            '',
        )).toBe(original)
    })
})
