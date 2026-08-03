import { describe, expect, it } from 'vitest'
import {
    assertCohortTransition,
    validateTrainingCohortInput,
    validateTrainingProgramInput,
} from './training-program'

const validCohort = {
    name: 'TeenCoder 2026 намар',
    deliveryMode: 'hybrid',
    contractVersionId: '',
    capacity: '20',
    tuitionAmountMnt: '450000',
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
        expect(validateTrainingCohortInput({ ...validCohort, capacity: '', tuitionAmountMnt: '' }))
            .toMatchObject({ capacity: null, tuitionAmountMnt: null, contractVersionId: null })
    })

    it('rejects an invalid registration window', () => {
        expect(() => validateTrainingCohortInput({
            ...validCohort,
            registrationClosesAt: '2026-07-20T00:00:00.000Z',
        })).toThrow('Бүртгэл хаах хугацаа')
    })

    it('rejects an invalid training date range', () => {
        expect(() => validateTrainingCohortInput({ ...validCohort, endsOn: '2026-08-01' }))
            .toThrow('Сургалт дуусах өдөр')
    })

    it('allows only explicit lifecycle transitions', () => {
        expect(() => assertCohortTransition('draft', 'open')).not.toThrow()
        expect(() => assertCohortTransition('open', 'completed')).toThrow('дарааллаар')
    })
})
