import { describe, expect, it } from 'vitest'

import {
    getOfferingDecisionNotificationIdentity,
    offeringPaymentDecisionErrorMessage,
    offeringPaymentMatchesSearch,
    offeringPaymentRejectionReasonSchema,
    parseAdminOfferingPayment,
    parseOfferingPaymentDecisionRecipient,
} from './offering-payment-review'

const ids = {
    proof: '11111111-1111-4111-8111-111111111111',
    application: '22222222-2222-4222-8222-222222222222',
    offering: '33333333-3333-4333-8333-333333333333',
    applicant: '44444444-4444-4444-8444-444444444444',
    learner: '55555555-5555-4555-8555-555555555555',
    accessUser: '66666666-6666-4666-8666-666666666666',
    course: '77777777-7777-4777-8777-777777777777',
    notification: '88888888-8888-4888-8888-888888888888',
}

function reviewContext() {
    return {
        proof: {
            id: ids.proof,
            application_id: ids.application,
            offering_id: ids.offering,
            applicant_user_id: ids.applicant,
            attempt_number: 2,
            amount_mnt: 650_000,
            status: 'rejected',
            rejection_reason: 'Баримтын дүн харагдахгүй байна.',
            created_at: '2026-08-06T03:00:00.000Z',
            reviewed_at: '2026-08-06T03:10:00.000Z',
        },
        application: {
            id: ids.application,
            offering_id: ids.offering,
            learner_id: ids.learner,
            applicant_user_id: ids.applicant,
            content_access_user_id: ids.accessUser,
            contact_email: 'parent@example.com',
            applicant_relationship: 'parent',
            contract_policy_snapshot: 'required',
            payment_due_at: '2026-08-09T03:10:00.000Z',
            status: 'submitted',
            terms_snapshot: {
                course_id: ids.course,
                program_name: 'TeenCoder',
                offering_name: '2026 оны намрын элсэлт',
                delivery_mode: 'offline',
                course: { title: 'HTML/CSS' },
            },
        },
        learner: { full_name: 'Бат Болд' },
        applicant: { display_name: 'Болд' },
        receiptUrl: 'https://example.com/signed-receipt',
        notification: {
            id: ids.notification,
            status: 'failed',
            attempts: 1,
            available_at: '2026-08-06T03:10:00.000Z',
            locked_at: null,
            sent_at: null,
            last_error: 'SMTP сервертэй холбогдож чадсангүй.',
        },
        notificationTrackingError: null,
    }
}

describe('offering payment admin review domain', () => {
    it('normalizes the immutable offering and learner snapshots for review', () => {
        const payment = parseAdminOfferingPayment(reviewContext())

        expect(payment).toMatchObject({
            id: ids.proof,
            learnerName: 'Бат Болд',
            applicantName: 'Болд',
            programName: 'TeenCoder',
            offeringName: '2026 оны намрын элсэлт',
            courseTitle: 'HTML/CSS',
            contractPolicy: 'required',
            attemptNumber: 2,
        })
    })

    it('uses the database idempotency key contract for each decision', () => {
        expect(getOfferingDecisionNotificationIdentity(ids.proof, 'approved')).toEqual({
            eventType: 'course_offering.checkout_approved',
            idempotencyKey: `course-offering-checkout-approved:${ids.proof}`,
            decision: 'approved',
        })
        expect(getOfferingDecisionNotificationIdentity(ids.proof, 'rejected')).toEqual({
            eventType: 'course_offering.payment_rejected',
            idempotencyKey: `course-offering-payment-rejected:${ids.proof}`,
            decision: 'correction_required',
        })
        expect(getOfferingDecisionNotificationIdentity(ids.proof, 'pending')).toBeNull()
    })

    it('requires a concrete, bounded rejection reason', () => {
        expect(offeringPaymentRejectionReasonSchema.safeParse('   ').success).toBe(false)
        expect(offeringPaymentRejectionReasonSchema.parse('  Дүн зөрсөн.  ')).toBe('Дүн зөрсөн.')
        expect(offeringPaymentRejectionReasonSchema.safeParse('a'.repeat(501)).success).toBe(false)
    })

    it('searches applicant, learner, program, offering, and course details', () => {
        const payment = parseAdminOfferingPayment(reviewContext())

        expect(offeringPaymentMatchesSearch(payment, 'PARENT@EXAMPLE.COM')).toBe(true)
        expect(offeringPaymentMatchesSearch(payment, 'бат болд')).toBe(true)
        expect(offeringPaymentMatchesSearch(payment, 'намрын')).toBe(true)
        expect(offeringPaymentMatchesSearch(payment, 'python')).toBe(false)
    })

    it('builds decision email details from immutable application snapshots', () => {
        const context = reviewContext()
        const recipient = parseOfferingPaymentDecisionRecipient({
            proof: context.proof,
            application: context.application,
            learner: context.learner,
            applicant: context.applicant,
        })

        expect(recipient).toEqual({
            paymentProofId: ids.proof,
            status: 'rejected',
            rejectionReason: 'Баримтын дүн харагдахгүй байна.',
            email: 'parent@example.com',
            recipientName: 'Болд',
            learnerName: 'Бат Болд',
            programName: 'TeenCoder',
            offeringName: '2026 оны намрын элсэлт',
            offeringId: ids.offering,
        })
    })

    it('maps known atomic-review failures without exposing database messages', () => {
        expect(offeringPaymentDecisionErrorMessage(
            'This course offering has no available seats.',
            'approve',
        )).toContain('суудал дүүрсэн')
        expect(offeringPaymentDecisionErrorMessage(
            'The contract acceptance evidence is missing.',
            'approve',
        )).toContain('Гэрээний зөвшөөрлийн нотолгоо')
        expect(offeringPaymentDecisionErrorMessage(
            'This course offering is not operational for approval.',
            'approve',
        )).toContain('Цуцлагдсан эсвэл дууссан')
        expect(offeringPaymentDecisionErrorMessage('internal detail', 'reject'))
            .toBe('Төлбөрийн баримтыг буцааж чадсангүй. Мэдээллийг шинэчлээд дахин оролдоно уу.')
    })
})
