import { describe, expect, it } from 'vitest'
import {
    deriveOfferingCheckoutStatus,
    parseOfferingCheckoutForm,
    parseOfferingCheckoutDraft,
    parseOfferingCheckoutProgress,
    parseOfferingDraftDetails,
} from './offering-checkout'

const validIds = {
    offeringId: '7fd98a63-0415-4d45-a26d-6ea9bd436f15',
    applicantUserId: '7cb4d882-4a5c-4b24-9b2d-20b79f59ab31',
    contentAccessUserId: 'bfa1263d-c485-4f8c-ad2b-3d728b43d12a',
}

describe('offering checkout domain', () => {
    it('keeps the learner separate from the applicant and content-access account', () => {
        const checkout = parseOfferingCheckoutDraft({
            ...validIds,
            contractPolicy: 'none',
            learner: {
                fullName: '  Бат Болд  ',
                birthDate: '',
                registrationNumber: '',
            },
        })

        expect(checkout.learner).toEqual({
            fullName: 'Бат Болд',
            birthDate: null,
            registrationNumber: null,
        })
        expect(checkout.applicantUserId).not.toBe(checkout.contentAccessUserId)
    })

    it('requires only the learner full name for a no-contract checkout', () => {
        const checkout = parseOfferingCheckoutDraft({
            ...validIds,
            contractPolicy: 'none',
            learner: { fullName: 'Бат Болд' },
        })

        expect(checkout.learner.birthDate).toBeNull()
        expect(checkout.learner.registrationNumber).toBeNull()
    })

    it('allows the applicant account to be the content-access account without making it the learner', () => {
        const checkout = parseOfferingCheckoutDraft({
            ...validIds,
            contentAccessUserId: validIds.applicantUserId,
            contractPolicy: 'none',
            learner: { fullName: 'Бат Болд' },
        })

        expect(checkout.contentAccessUserId).toBe(checkout.applicantUserId)
        expect(checkout.learner.fullName).toBe('Бат Болд')
    })

    it('returns a Mongolian validation message when the learner name is missing', () => {
        const result = parseSafely({
            ...validIds,
            contractPolicy: 'none',
            learner: { fullName: '   ' },
        })

        expect(result).toContain('Суралцагчийн овог нэрийг оруулна уу.')
    })

    it('returns a Mongolian validation message for an invalid optional birth date', () => {
        const result = parseSafely({
            ...validIds,
            contractPolicy: 'none',
            learner: { fullName: 'Бат Болд', birthDate: '2026-13-40' },
        })

        expect(result).toContain('Төрсөн огноо буруу байна.')
    })

    it('exposes a contract-required draft without duplicating signature rules', () => {
        const checkout = parseOfferingCheckoutDraft({
            ...validIds,
            contractPolicy: 'required',
            learner: {
                fullName: 'Бат Болд',
                birthDate: '2010-01-06',
                registrationNumber: 'УЗ00281114',
            },
        })

        expect(checkout.contractPolicy).toBe('required')
        expect(checkout.learner.birthDate).toBe('2010-01-06')
        expect(checkout).not.toHaveProperty('signature')
    })

    it.each([
        [{ contractPolicy: 'none', hasCompletedLearnerDetails: false, hasAcceptedContract: false, paymentReviewState: 'not_submitted', isWithdrawn: false }, 'draft'],
        [{ contractPolicy: 'required', hasCompletedLearnerDetails: true, hasAcceptedContract: false, paymentReviewState: 'not_submitted', isWithdrawn: false }, 'contract_required'],
        [{ contractPolicy: 'none', hasCompletedLearnerDetails: true, hasAcceptedContract: false, paymentReviewState: 'not_submitted', isWithdrawn: false }, 'ready_for_payment'],
        [{ contractPolicy: 'required', hasCompletedLearnerDetails: true, hasAcceptedContract: true, paymentReviewState: 'not_submitted', isWithdrawn: false }, 'ready_for_payment'],
        [{ contractPolicy: 'none', hasCompletedLearnerDetails: true, hasAcceptedContract: false, paymentReviewState: 'pending_review', isWithdrawn: false }, 'pending_review'],
        [{ contractPolicy: 'required', hasCompletedLearnerDetails: true, hasAcceptedContract: true, paymentReviewState: 'correction_required', isWithdrawn: false }, 'correction_required'],
        [{ contractPolicy: 'none', hasCompletedLearnerDetails: true, hasAcceptedContract: false, paymentReviewState: 'approved', isWithdrawn: false }, 'approved'],
        [{ contractPolicy: 'required', hasCompletedLearnerDetails: true, hasAcceptedContract: true, paymentReviewState: 'approved', isWithdrawn: true }, 'withdrawn'],
    ] as const)('derives %s as %s', (progress, expected) => {
        expect(deriveOfferingCheckoutStatus(progress)).toBe(expected)
    })

    it('rejects payment review before a required contract is accepted', () => {
        expect(() => parseOfferingCheckoutProgress({
            contractPolicy: 'required',
            hasCompletedLearnerDetails: true,
            hasAcceptedContract: false,
            paymentReviewState: 'pending_review',
            isWithdrawn: false,
        })).toThrow('Төлбөрийн баримт илгээхийн өмнө гэрээг зөвшөөрнө үү.')
    })

    it('accepts a no-contract offering form only when contract data is absent', () => {
        const checkout = parseOfferingCheckoutForm({
            offering_id: validIds.offeringId,
            course_id: validIds.contentAccessUserId,
            course_title: 'HTML/CSS',
            course_description: '',
            course_thumbnail_path: null,
            program_name: 'TeenCoder',
            program_description: '',
            offering_name: 'TeenCoder намрын элсэлт',
            delivery_mode: 'offline',
            contract_policy: 'none',
            capacity: 20,
            available_seats: 20,
            tuition_amount_mnt: 650000,
            payment_plan: 'Бүтэн төлөлт',
            schedule_summary: 'Даваа, Лхагва, Баасан',
            location: 'Mind Academy',
            registration_closes_at: null,
            starts_on: '2026-09-01',
            ends_on: null,
            is_accepting_applications: true,
            contract_version_id: null,
            contract_title: null,
            contract_version_number: null,
            contract_content: null,
            contract_preview_values: {},
            fields: [],
            my_applications: [],
        })

        expect(checkout.contract_policy).toBe('none')
        expect(checkout.contract_version_id).toBeNull()
    })

    it('requires signer and learner evidence for a contract-required draft', () => {
        expect(() => parseOfferingDraftDetails({
            schema_version: 1,
            client_request_id: '6c63ff95-1052-4cf7-b45f-c5c89e3af810',
            learner_full_name: 'Тест суралцагч',
            learner_birth_date: '2012-01-01',
            learner_registration_number: null,
            applicant_relationship: 'parent',
            signer_full_name: null,
            signer_email: null,
            signer_phone: null,
            signer_registration_number: null,
            answers: {},
        }, 'required')).toThrow()
    })

    it('keeps optional identity fields optional in a no-contract draft', () => {
        const details = parseOfferingDraftDetails({
            schema_version: 1,
            client_request_id: '6c63ff95-1052-4cf7-b45f-c5c89e3af810',
            learner_full_name: 'Тест суралцагч',
            learner_birth_date: null,
            learner_registration_number: null,
            applicant_relationship: 'parent',
            signer_full_name: null,
            signer_email: null,
            signer_phone: null,
            signer_registration_number: null,
            answers: {},
        }, 'none')

        expect(details.learner_birth_date).toBeNull()
        expect(details.signer_email).toBeNull()
    })
})

function parseSafely(value: unknown) {
    try {
        parseOfferingCheckoutDraft(value)
        return ''
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
}
