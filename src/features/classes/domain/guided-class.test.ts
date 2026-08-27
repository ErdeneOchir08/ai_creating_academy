import { describe, expect, it } from 'vitest'
import { guidedClassReadiness, type GuidedReadinessClass } from './guided-class'

function draft(overrides: Partial<GuidedReadinessClass> = {}): GuidedReadinessClass {
    return {
        classType: 'self_paced_online',
        courseId: 'course-id',
        contractVersionId: null,
        tuitionAmountMnt: 500,
        paymentDueDays: 3,
        scheduleSummary: '',
        location: '',
        startsOn: null,
        endsOn: null,
        qpayEnabled: true,
        manualTransferEnabled: false,
        ...overrides,
    }
}

describe('guided class readiness', () => {
    it('allows a ready self-paced class without contract or schedule', () => {
        const result = guidedClassReadiness(draft(), {
            courseReady: true,
            contractReady: false,
            qpayAvailable: true,
        })

        expect(result.every((item) => item.complete)).toBe(true)
    })

    it('requires contract and schedule for instructor-led online classes', () => {
        const result = guidedClassReadiness(draft({
            classType: 'instructor_led_online',
        }), {
            courseReady: true,
            contractReady: false,
            qpayAvailable: true,
        })

        expect(result.find((item) => item.key === 'schedule')?.complete).toBe(false)
        expect(result.find((item) => item.key === 'teacher')?.complete).toBe(false)
        expect(result.find((item) => item.key === 'contract')?.complete).toBe(false)
    })

    it('accepts a teacher-led class only after teacher and sessions are ready', () => {
        const result = guidedClassReadiness(draft({
            classType: 'instructor_led_online',
            contractVersionId: 'contract-id',
            startsOn: '2026-09-01',
            endsOn: '2026-09-30',
            scheduleSummary: 'Tuesday and Thursday',
        }), {
            courseReady: true,
            contractReady: true,
            qpayAvailable: true,
            teacherAssigned: true,
            sessionsReady: true,
        })

        expect(result.every((item) => item.complete)).toBe(true)
    })

    it('requires a venue for offline classes', () => {
        const result = guidedClassReadiness(draft({
            classType: 'offline_with_video',
            contractVersionId: 'contract-id',
            startsOn: '2026-09-01',
            endsOn: '2026-09-30',
            scheduleSummary: 'Tuesday and Thursday',
        }), {
            courseReady: true,
            contractReady: true,
            qpayAvailable: true,
        })

        expect(result.find((item) => item.key === 'location')?.complete).toBe(false)
    })

    it('accepts bank transfer when QPay is unavailable', () => {
        const result = guidedClassReadiness(draft({
            qpayEnabled: true,
            manualTransferEnabled: true,
        }), {
            courseReady: true,
            contractReady: false,
            qpayAvailable: false,
        })

        expect(result.find((item) => item.key === 'payment')?.complete).toBe(true)
    })
})
