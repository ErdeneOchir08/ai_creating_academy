import { describe, expect, it } from 'vitest'
import {
    getEffectiveOfferingCheckoutStatusPresentation,
    getOfferingCheckoutStatusPresentation,
    isOfferingPaymentOverdue,
    selectNonApprovedOfferingCheckoutStatuses,
} from './offering-checkout-status-presentation'

describe('offering checkout status presentation', () => {
    it.each([
        ['draft', 'Мэдээлэл дутуу', 'Үргэлжлүүлэх'],
        ['contract_required', 'Гэрээ зөвшөөрөх шаардлагатай', 'Гэрээг үргэлжлүүлэх'],
        ['ready_for_payment', 'Төлбөрийн баримт хүлээгдэж байна', 'Төлбөрийн алхам руу очих'],
        ['pending_review', 'Төлбөр хянагдаж байна', 'Дэлгэрэнгүй харах'],
        ['correction_required', 'Баримтыг засах шаардлагатай', 'Баримт дахин илгээх'],
        ['approved', 'Элсэлт баталгаажсан', 'Хичээл үзэх'],
        ['withdrawn', 'Хүсэлт цуцлагдсан', 'Дэлгэрэнгүй харах'],
    ] as const)('maps %s to clear Mongolian copy', (status, label, actionLabel) => {
        expect(getOfferingCheckoutStatusPresentation(status)).toMatchObject({
            label,
            actionLabel,
        })
    })

    it('shows rejection details and the payment deadline only when correction is required', () => {
        expect(getOfferingCheckoutStatusPresentation('correction_required')).toMatchObject({
            showPaymentDeadline: true,
            showRejectionReason: true,
        })
        expect(getOfferingCheckoutStatusPresentation('pending_review')).toMatchObject({
            showPaymentDeadline: false,
            showRejectionReason: false,
        })
    })

    it('removes approved applications without changing the remaining order', () => {
        const statuses = [
            { application_status: 'ready_for_payment' as const, id: 'first' },
            { application_status: 'approved' as const, id: 'approved' },
            { application_status: 'pending_review' as const, id: 'second' },
        ]

        expect(selectNonApprovedOfferingCheckoutStatuses(statuses).map((status) => status.id))
            .toEqual(['first', 'second'])
    })

    it.each([
        ['before the deadline', '2026-08-13T23:59:59.999Z', false],
        ['exactly at the deadline', '2026-08-14T00:00:00.000Z', false],
        ['after the deadline', '2026-08-14T00:00:00.001Z', true],
    ] as const)('detects payment state %s using the server timestamp', (_label, serverNow, expected) => {
        expect(isOfferingPaymentOverdue(
            'ready_for_payment',
            '2026-08-14T00:00:00.000Z',
            serverNow,
        )).toBe(expected)
    })

    it('does not expire a submitted payment while admin review is pending', () => {
        expect(isOfferingPaymentOverdue(
            'pending_review',
            '2026-08-12T00:00:00.000Z',
            '2026-08-14T00:00:00.000Z',
        )).toBe(false)
    })

    it('presents an overdue correction without losing the rejection details', () => {
        expect(getEffectiveOfferingCheckoutStatusPresentation('correction_required', {
            paymentDueAt: '2026-08-12T00:00:00.000Z',
            serverNow: '2026-08-14T00:00:00.000Z',
        })).toMatchObject({
            label: 'Төлбөрийн хугацаа дууссан',
            actionLabel: 'Дэлгэрэнгүй харах',
            tone: 'danger',
            showPaymentDeadline: true,
            showRejectionReason: true,
        })
    })
})
