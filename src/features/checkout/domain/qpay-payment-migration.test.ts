import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260827040316_add_qpay_course_offering_payments.sql'),
    'utf8',
).toLowerCase()

describe('QPay payment migration security and invariants', () => {
    it('keeps merchant payment and token tables behind RLS', () => {
        expect(migration).toContain('alter table public.course_offering_payments enable row level security')
        expect(migration).toContain('alter table public.qpay_token_cache enable row level security')
        expect(migration).toContain('revoke all on table public.qpay_token_cache from public, anon, authenticated')
        expect(migration).toContain('(select auth.uid()) = applicant_user_id')
    })

    it('prevents duplicate active invoices and duplicate successful payments', () => {
        expect(migration).toContain('course_offering_payments_one_active_idx')
        expect(migration).toContain("where status in ('created', 'pending')")
        expect(migration).toContain('course_offering_payments_one_paid_idx')
        expect(migration).toContain("where status = 'paid'")
    })

    it('uses a source-aware unique sender invoice and backfills manual payments', () => {
        expect(migration).toContain("'aca-' || target_application.payment_reference || '-q'")
        expect(migration).toContain("'manual_transfer'")
        expect(migration).toContain('insert into public.course_offering_payments')
        expect(migration).toContain('update public.course_offering_payment_proofs')
    })

    it('allows only the service role to finalize verified QPay payments', () => {
        expect(migration).toContain('public.finalize_course_offering_qpay_payment')
        expect(migration).toContain('grant execute on function public.finalize_course_offering_qpay_payment')
        expect(migration).toContain('to service_role')
        expect(migration).not.toContain('auth.role()')
    })

    it('links automatic payment to enrollment and entitlement creation atomically', () => {
        expect(migration).toContain('insert into public.course_offering_enrollments')
        expect(migration).toContain('insert into public.course_access_entitlements')
        expect(migration).toContain("approval_source = 'qpay'")
        expect(migration).toContain("status = 'paid'")
    })
})
