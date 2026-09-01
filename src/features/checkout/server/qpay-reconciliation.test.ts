import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createAdminClient: vi.fn(),
    verifyPayment: vi.fn(),
    deliverNotification: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/qpay/client', () => ({ verifyQpayInvoicePayment: mocks.verifyPayment }))
vi.mock('@/features/checkout/server/qpay-approval-notification', () => ({
    deliverQpayApprovalNotification: mocks.deliverNotification,
}))

import { reconcileCourseOfferingQpayPayment } from './qpay-reconciliation'

const paymentId = 'f91bc9c0-b64f-44d1-a940-a1ce05d0d8bf'

function paymentQuery(status: 'pending' | 'paid') {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(async () => ({
        data: {
            id: paymentId,
            application_id: '8ed7616b-e839-4b36-858a-2d778dcdd70d',
            applicant_user_id: '9afbd520-0b72-4f3c-9395-964b8798f327',
            amount_mnt: 490000,
            currency: 'MNT',
            status,
            qpay_invoice_id: 'invoice-1',
            qpay_payment_id: status === 'paid' ? 'payment-1' : null,
            callback_token_hash: 'a'.repeat(64),
        },
        error: null,
    }))
    return chain
}

describe('QPay reconciliation notifications', () => {
    beforeEach(() => {
        mocks.createAdminClient.mockReset()
        mocks.verifyPayment.mockReset()
        mocks.deliverNotification.mockReset().mockResolvedValue({ sent: true })
    })

    it('repairs a missed email when an already-paid invoice is checked again', async () => {
        const admin = { from: vi.fn(() => paymentQuery('paid')), rpc: vi.fn() }
        mocks.createAdminClient.mockReturnValue(admin)

        await expect(reconcileCourseOfferingQpayPayment(paymentId)).resolves.toMatchObject({
            status: 'paid',
            alreadyFinalized: true,
        })
        expect(mocks.verifyPayment).not.toHaveBeenCalled()
        expect(mocks.deliverNotification).toHaveBeenCalledWith(paymentId)
    })

    it('delivers the confirmation after QPay is verified and enrollment is finalized', async () => {
        const admin = {
            from: vi.fn(() => paymentQuery('pending')),
            rpc: vi.fn().mockResolvedValue({ data: { already_finalized: false }, error: null }),
        }
        mocks.createAdminClient.mockReturnValue(admin)
        mocks.verifyPayment.mockResolvedValue({
            paymentId: 'payment-1',
            status: 'PAID',
            amountMnt: 490000,
            currency: 'MNT',
            paidAt: '2026-09-01T00:00:00.000Z',
        })

        await expect(reconcileCourseOfferingQpayPayment(paymentId)).resolves.toMatchObject({
            status: 'paid',
            alreadyFinalized: false,
        })
        expect(admin.rpc).toHaveBeenCalledWith('finalize_course_offering_qpay_payment', expect.objectContaining({
            p_payment_id: paymentId,
            p_qpay_payment_id: 'payment-1',
        }))
        expect(mocks.deliverNotification).toHaveBeenCalledWith(paymentId)
    })
})
