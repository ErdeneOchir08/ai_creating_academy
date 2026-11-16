import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    getCheckout: vi.fn(),
    getPaymentConfiguration: vi.fn(),
    hasAccess: vi.fn(),
    reconcile: vi.fn(),
    cancel: vi.fn(),
    createInvoice: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/qpay/client', () => ({
    cancelQpayInvoice: mocks.cancel,
    createQpayInvoice: mocks.createInvoice,
    QpayApiError: Error,
}))
vi.mock('@/lib/qpay/config', () => ({
    isQpayEnabled: () => true,
    getQpayConfig: () => ({ environment: 'production', siteUrl: 'https://mindacademy.mn', merchant: 'zurkhai', sourceSite: 'ai-creator-academy' }),
}))
vi.mock('@/features/checkout/server/qpay-reconciliation', () => ({ reconcileCourseOfferingQpayPayment: mocks.reconcile }))
vi.mock('@/features/courses/actions/effective-course-access', () => ({ hasEffectiveCourseAccess: mocks.hasAccess }))
vi.mock('./offering-checkout-actions', () => ({
    getOfferingCheckoutForm: mocks.getCheckout,
    getOfferingPaymentConfiguration: mocks.getPaymentConfiguration,
}))

import { retryExpiredDirectQpayInvoice } from './qpay-payment-actions'

const applicationId = '23965a59-2c25-4885-b65a-4ab81303118e'
const offeringId = 'c92ba071-c10c-49d5-bd6e-ae46db77217c'
const previousPaymentId = 'ba4990bd-e7a9-44eb-9187-6210dd5686ba'
const nextPaymentId = '84989b64-7ecc-4259-aa98-fdc15c4800d2'
const userId = '0c128552-bef8-4b80-b4c9-f210fdae2a66'
const previous = { id: previousPaymentId, status: 'pending', merchant_key: 'legacy', qpay_invoice_id: 'old-invoice' }
const reopenedDeadline = '2031-06-12T10:12:00Z'

function query(result: unknown) {
    const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: result, error: null }),
        single: vi.fn().mockResolvedValue({ data: result, error: null }),
    }
    return builder
}

describe('retry an expired QPay direct purchase', () => {
    const paymentQuery = query(previous)
    const reserve = vi.fn()
    const adminRpc = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        paymentQuery.maybeSingle.mockResolvedValue({ data: previous, error: null })
        mocks.createClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
            from: (table: string) => table === 'payment_configuration' ? query({ is_test_mode: false }) : paymentQuery,
            rpc: reserve,
        })
        reserve.mockResolvedValue({ data: {
            payment_id: nextPaymentId, sender_invoice_no: 'ACA-TEST-Q2', payment_due_at: reopenedDeadline,
            amount_mnt: 69000, status: 'created', reused: false,
        }, error: null })
        adminRpc.mockImplementation(async (name: string) => ({
            data: name === 'reopen_expired_direct_qpay_checkout' ? { status: 'ready' } : null, error: null,
        }))
        mocks.createAdminClient.mockReturnValue({ rpc: adminRpc, from: () => query({ id: nextPaymentId }) })
        mocks.getCheckout.mockResolvedValue({
            direct_purchase: true, is_accepting_applications: true, qpay_enabled: true, course_id: 'course',
            my_applications: [{ application_id: applicationId, application_status: 'ready_for_payment', payment_due_at: '2020-01-01T00:00:00Z' }],
        })
        mocks.getPaymentConfiguration.mockResolvedValue({ isTestMode: false })
        mocks.hasAccess.mockResolvedValue(false)
        mocks.reconcile.mockResolvedValue({ status: 'pending' })
        mocks.cancel.mockResolvedValue(undefined)
        mocks.createInvoice.mockResolvedValue({ invoiceId: 'new-invoice', qrText: 'new-qr', qrImage: 'data', urls: [], shortUrl: '' })
    })

    it('checks, cancels with the original merchant, reopens, then creates a fresh QR with the active merchant', async () => {
        await expect(retryExpiredDirectQpayInvoice(applicationId, offeringId)).resolves.toMatchObject({
            invoice: { paymentId: nextPaymentId, invoiceId: 'new-invoice', amountMnt: 69000, expiresAt: reopenedDeadline },
        })
        expect(paymentQuery.eq).toHaveBeenCalledWith('applicant_user_id', userId)
        expect(mocks.reconcile).toHaveBeenCalledWith(previousPaymentId, { requireConfirmedUnpaid: true })
        expect(mocks.cancel).toHaveBeenCalledWith('old-invoice', 'legacy')
        expect(adminRpc).toHaveBeenCalledWith('reopen_expired_direct_qpay_checkout', expect.objectContaining({
            p_previous_payment_id: previousPaymentId, p_previous_invoice_id: 'old-invoice', p_applicant_user_id: userId,
        }))
        expect(mocks.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ merchant: 'zurkhai', senderInvoiceNo: 'ACA-TEST-Q2' }))
        const order = [mocks.reconcile, mocks.cancel, adminRpc, reserve, mocks.createInvoice].map((mock) => mock.mock.invocationCallOrder[0])
        expect(order).toEqual([...order].sort((left, right) => left - right))
    })

    it('uses a late payment and leaves cancellation and new invoice creation untouched', async () => {
        mocks.reconcile.mockResolvedValue({ status: 'paid' })
        mocks.hasAccess.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        await expect(retryExpiredDirectQpayInvoice(applicationId, offeringId)).resolves.toEqual({ paid: true })
        expect(mocks.cancel).not.toHaveBeenCalled()
        expect(reserve).not.toHaveBeenCalled()
    })

    it('takes a second payment reading after a cancellation failure and only proceeds when paid', async () => {
        mocks.cancel.mockRejectedValue(new Error('Cancellation not confirmed'))
        mocks.reconcile.mockResolvedValueOnce({ status: 'pending' }).mockResolvedValueOnce({ status: 'paid' })
        mocks.hasAccess.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        await expect(retryExpiredDirectQpayInvoice(applicationId, offeringId)).resolves.toEqual({ paid: true })
        expect(mocks.reconcile).toHaveBeenNthCalledWith(2, previousPaymentId)
        expect(reserve).not.toHaveBeenCalled()
    })

    it('blocks a replacement if cancellation cannot be confirmed', async () => {
        mocks.cancel.mockRejectedValue(new Error('Cancellation not confirmed'))
        await expect(retryExpiredDirectQpayInvoice(applicationId, offeringId)).resolves.toHaveProperty('error')
        expect(adminRpc).not.toHaveBeenCalled()
        expect(reserve).not.toHaveBeenCalled()
    })

    it('never cancels if QPay cannot confirm that the old invoice is unpaid', async () => {
        mocks.reconcile.mockRejectedValue(new Error('QPay did not confirm the invoice is unpaid'))
        await expect(retryExpiredDirectQpayInvoice(applicationId, offeringId)).resolves.toHaveProperty('error')
        expect(mocks.cancel).not.toHaveBeenCalled()
        expect(reserve).not.toHaveBeenCalled()
    })

    it('protects an incomplete prior request that may have created an invoice at QPay', async () => {
        paymentQuery.maybeSingle.mockResolvedValue({ data: { ...previous, status: 'created', qpay_invoice_id: null }, error: null })
        await expect(retryExpiredDirectQpayInvoice(applicationId, offeringId)).resolves.toHaveProperty('error')
        expect(mocks.reconcile).not.toHaveBeenCalled()
        expect(mocks.cancel).not.toHaveBeenCalled()
        expect(reserve).not.toHaveBeenCalled()
    })

    it('keeps the new reservation locked if the provider loses the creation response', async () => {
        mocks.createInvoice.mockRejectedValue(new Error('Request timed out'))
        await expect(retryExpiredDirectQpayInvoice(applicationId, offeringId)).resolves.toHaveProperty('error')
        expect(adminRpc.mock.calls.map(([name]) => name)).toEqual(['reopen_expired_direct_qpay_checkout'])
    })
})
