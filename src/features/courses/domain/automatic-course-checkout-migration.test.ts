import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261011114500_automatic_course_qpay_checkout.sql'), 'utf8')

describe('automatic course checkout safeguards', () => {
    it('uses the existing V2 chain with exactly one managed offer per course', () => {
        expect(sql).toContain('training_cohorts_one_course_managed_idx')
        expect(sql).toContain("'online', 'draft', 2, 'self_paced_online'")
        expect(sql).toContain("set status = 'open'")
        expect(sql).not.toContain('disable trigger')
    })
    it('does not alter historical financial/access records', () => {
        for (const table of ['course_offering_applications', 'course_offering_payments', 'course_access_entitlements', 'enrollments', 'payment_requests']) {
            expect(sql).not.toMatch(new RegExp(`(?:update|delete from) public\\.${table}\\b`, 'i'))
        }
        expect(sql).toContain('public.update_v2_course_offering_configuration(')
    })
    it('keeps existing class-linked content class-only and archived courses closed', () => {
        expect(sql).toContain("set checkout_mode = 'class_only'")
        expect(sql).toContain('new.archived_at is null')
        expect(sql).toContain("set status = 'closed'")
        expect(sql).toContain("contract_policy = 'none'")
    })
    it('requires admin privileges and never introduces a payment finalization shortcut', () => {
        expect(sql).toContain('private.is_admin()')
        expect(sql).toContain('security invoker')
        expect(sql).not.toContain('finalize_course_offering_qpay_payment')
        expect(sql).toContain('A previous course payment receipt is awaiting review')
    })
})
