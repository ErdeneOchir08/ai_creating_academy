import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { directCourseApplication, isDirectCourseCheckout } from './direct-course-checkout'
import { directPurchaseDetails } from '../server/direct-purchase-details'
import type { SavedOfferingApplication } from './offering-checkout'

const direct = { course_managed: true, class_type: 'self_paced_online', contract_policy: 'none', delivery_mode: 'online' }
const application = (status: SavedOfferingApplication['application_status']) => ({ application_status: status }) as SavedOfferingApplication

describe('account-owned direct course purchase', () => {
    it('is limited to managed self-learning courses', () => {
        expect(isDirectCourseCheckout(direct)).toBe(true)
        expect(isDirectCourseCheckout({ ...direct, course_managed: false })).toBe(false)
        expect(isDirectCourseCheckout({ ...direct, class_type: 'teacher_led_online' })).toBe(false)
        expect(isDirectCourseCheckout({ ...direct, contract_policy: 'required' })).toBe(false)
        expect(isDirectCourseCheckout({ ...direct, delivery_mode: 'offline' })).toBe(false)
    })
    it('requires no identity or contract answers', () => {
        const details = directPurchaseDetails('account', 'course', ' Account name ')
        expect(details.learner_full_name).toBe('Account name')
        expect(details.learner_birth_date).toBeNull()
        expect(details.learner_registration_number).toBeNull()
        expect(details.signer_full_name).toBeNull()
        expect(details.signer_email).toBeNull()
        expect(details.answers).toEqual({})
        expect(details.applicant_relationship).toBe('self')
    })
    it('keeps the same request across tabs, retries and profile-name changes', () => {
        const id = directPurchaseDetails('a', 'b', 'Old name').client_request_id
        expect(directPurchaseDetails('a', 'b', 'New name').client_request_id).toBe(id)
        expect(directPurchaseDetails('different', 'b', '').client_request_id).not.toBe(id)
        expect(directPurchaseDetails('a', 'different', '').client_request_id).not.toBe(id)
    })
    it('handles missing and long account labels without an extra form', () => {
        expect(directPurchaseDetails('a', 'b', '').learner_full_name).toBe('Mind Academy account')
        expect(directPurchaseDetails('a', 'b', 'x'.repeat(300)).learner_full_name).toHaveLength(240)
    })
    it('prioritizes a pending receipt or completed order over a new charge', () => {
        const ready = application('ready_for_payment')
        const pending = application('pending_review')
        const approved = application('approved')
        expect(directCourseApplication([ready, approved, pending])).toBe(pending)
        expect(directCourseApplication([ready, approved])).toBe(approved)
        expect(directCourseApplication([application('withdrawn'), ready])).toBe(ready)
        expect(directCourseApplication([])).toBeNull()
    })
    it('does not render enrollment fields or the contract editor in the purchase component', () => {
        const source = readFileSync('src/features/checkout/components/direct-course-purchase.tsx', 'utf8')
        for (const forbidden of ['<Input', '<form', 'OfferingCheckoutEditor', 'acceptOfferingContract', 'newLearner']) {
            expect(source).not.toContain(forbidden)
        }
        expect(source).toContain('prepareDirectCoursePurchase(checkout.offering_id)')
        expect(source).toContain('applicationPaymentAmount(current)')
    })
})
