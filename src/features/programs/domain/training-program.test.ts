import { describe, expect, it } from 'vitest'
import {
    assertCohortTransition,
    getCohortOpeningReadiness,
    validateCohortPaymentDueDays,
    validateTrainingCohortInput,
    validateTrainingProgramInput,
} from './training-program'

const validCohort = {
    name: 'TeenCoder 2026 намар',
    deliveryMode: 'offline',
    courseId: '15bd35fa-161f-4f7c-b41a-2432eb0c638c',
    contractPolicy: 'required',
    contractVersionId: '',
    capacity: '20',
    tuitionAmountMnt: '450000',
    paymentDueDays: '3',
    paymentPlan: '2 хувааж төлнө',
    scheduleSummary: 'Бямба, Ням',
    location: 'Улаанбаатар',
    registrationOpensAt: '2026-08-01T00:00:00.000Z',
    registrationClosesAt: '2026-08-20T00:00:00.000Z',
    startsOn: '2026-09-01',
    endsOn: '2026-12-01',
}

describe('training program validation', () => {
    it('normalizes program metadata', () => {
        expect(validateTrainingProgramInput({ name: '  TeenCoder  ', description: '  Өсвөрийн анги  ' }))
            .toEqual({ name: 'TeenCoder', description: 'Өсвөрийн анги' })
    })

    it('normalizes optional cohort values', () => {
        expect(validateTrainingCohortInput({ ...validCohort, courseId: '', capacity: '', tuitionAmountMnt: '', paymentDueDays: '' }, 2))
            .toMatchObject({ courseId: null, capacity: null, tuitionAmountMnt: null, paymentDueDays: null, contractVersionId: null })
    })

    it('keeps delivery and contract policy separate from course subject data', () => {
        expect(validateTrainingCohortInput({
            ...validCohort,
            deliveryMode: 'online',
            contractPolicy: 'none',
            contractVersionId: '',
        }, 2)).toMatchObject({ deliveryMode: 'online', contractPolicy: 'none', contractVersionId: null })
    })

    it('continues to parse historical hybrid cohorts during the staged migration', () => {
        expect(validateTrainingCohortInput({
            ...validCohort,
            deliveryMode: 'hybrid',
            courseId: '',
        }, 1)).toMatchObject({ deliveryMode: 'hybrid', contractPolicy: 'required' })
    })

    it('limits V2 offering delivery to the two supported customer choices', () => {
        expect(validateTrainingCohortInput({ ...validCohort, deliveryMode: 'online' }, 2))
            .toMatchObject({ deliveryMode: 'online' })
        expect(() => validateTrainingCohortInput({ ...validCohort, deliveryMode: 'hybrid' }, 2))
            .toThrow('онлайн эсвэл танхим')
    })

    it('prevents V1 drafts from adopting V2-only course or contract settings', () => {
        expect(() => validateTrainingCohortInput(validCohort, 1))
            .toThrow('баталгаажсан урсгалын тохиргоог')
        expect(() => validateTrainingCohortInput({
            ...validCohort,
            courseId: '',
            contractPolicy: 'none',
        }, 1)).toThrow('баталгаажсан урсгалын тохиргоог')
    })

    it('rejects a contract version on a no-contract offering', () => {
        expect(() => validateTrainingCohortInput({
            ...validCohort,
            contractPolicy: 'none',
            contractVersionId: '44021b7b-7547-462f-b755-fc6a529201f7',
        }, 2)).toThrow('Гэрээгүй элсэлтэд')
    })

    it('requires a positive whole-number payment deadline when configured', () => {
        expect(validateCohortPaymentDueDays('5')).toBe(5)
        expect(validateCohortPaymentDueDays('')).toBeNull()
        expect(() => validateCohortPaymentDueDays('0')).toThrow('0-ээс их')
        expect(() => validateCohortPaymentDueDays('1.5')).toThrow()
    })

    it('rejects an invalid registration window', () => {
        expect(() => validateTrainingCohortInput({
            ...validCohort,
            registrationClosesAt: '2026-07-20T00:00:00.000Z',
        }, 2)).toThrow('Бүртгэл хаах хугацаа')
    })

    it('rejects an invalid training date range', () => {
        expect(() => validateTrainingCohortInput({ ...validCohort, endsOn: '2026-08-01' }, 2))
            .toThrow('Сургалт дуусах өдөр')
    })

    it('allows only explicit lifecycle transitions', () => {
        expect(() => assertCohortTransition('draft', 'open')).not.toThrow()
        expect(() => assertCohortTransition('open', 'completed')).toThrow('дарааллаар')
    })

    it('opens a V2 contract offering only with every operational prerequisite', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 2,
            deliveryMode: 'offline',
            contractPolicy: 'required',
            hasContractVersion: true,
            contractVersionIsAssignable: true,
            courseIsReady: true,
            tuitionAmountMnt: 650_000,
            paymentDueDays: 3,
            programIsArchived: false,
        })).toEqual({ isReady: true, issues: [] })
    })

    it('opens a V2 no-contract offering without a contract version', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 2,
            deliveryMode: 'online',
            contractPolicy: 'none',
            hasContractVersion: false,
            contractVersionIsAssignable: false,
            courseIsReady: true,
            tuitionAmountMnt: 100_000,
            paymentDueDays: 3,
            programIsArchived: false,
        })).toEqual({ isReady: true, issues: [] })
    })

    it('does not open an otherwise-ready V2 offering under an archived program', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 2,
            deliveryMode: 'offline',
            contractPolicy: 'none',
            hasContractVersion: false,
            contractVersionIsAssignable: false,
            courseIsReady: true,
            tuitionAmountMnt: 650_000,
            paymentDueDays: 3,
            programIsArchived: true,
        }).issues).toEqual(['program_archived'])
    })

    it('does not open a V2 offering with zero tuition', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 2,
            deliveryMode: 'online',
            contractPolicy: 'none',
            hasContractVersion: false,
            contractVersionIsAssignable: false,
            courseIsReady: true,
            tuitionAmountMnt: 0,
            paymentDueDays: null,
            programIsArchived: false,
        }).issues).toEqual(['tuition_not_configured'])
    })

    it('reports every missing V2 opening prerequisite', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 2,
            deliveryMode: 'hybrid',
            contractPolicy: 'required',
            hasContractVersion: false,
            contractVersionIsAssignable: false,
            courseIsReady: false,
            tuitionAmountMnt: 450_000,
            paymentDueDays: null,
            programIsArchived: true,
        }).issues).toEqual([
            'program_archived',
            'unsupported_delivery_mode',
            'course_not_ready',
            'contract_not_assignable',
            'payment_deadline_not_configured',
        ])
    })

    it('forbids a retained contract version on a no-contract offering', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 2,
            deliveryMode: 'online',
            contractPolicy: 'none',
            hasContractVersion: true,
            contractVersionIsAssignable: true,
            courseIsReady: true,
            tuitionAmountMnt: 100_000,
            paymentDueDays: 2,
            programIsArchived: false,
        }).issues).toContain('contract_not_allowed')
    })

    it('does not open an offering until tuition is explicitly configured', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 2,
            deliveryMode: 'online',
            contractPolicy: 'none',
            hasContractVersion: false,
            contractVersionIsAssignable: false,
            courseIsReady: true,
            tuitionAmountMnt: null,
            paymentDueDays: null,
            programIsArchived: false,
        }).issues).toEqual(['tuition_not_configured'])
    })

    it('keeps V1 course-independent while retaining its contract and payment requirements', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 1,
            deliveryMode: 'hybrid',
            contractPolicy: 'required',
            hasContractVersion: true,
            contractVersionIsAssignable: true,
            courseIsReady: false,
            tuitionAmountMnt: 450_000,
            paymentDueDays: 3,
            programIsArchived: false,
        })).toEqual({ isReady: true, issues: [] })
    })

    it('preserves the existing V1 zero-tuition opening behavior', () => {
        expect(getCohortOpeningReadiness({
            checkoutVersion: 1,
            deliveryMode: 'hybrid',
            contractPolicy: 'required',
            hasContractVersion: true,
            contractVersionIsAssignable: true,
            courseIsReady: false,
            tuitionAmountMnt: 0,
            paymentDueDays: null,
            programIsArchived: false,
        })).toEqual({ isReady: true, issues: [] })
    })
})
