import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyQpayInvoicePayment } from '@/lib/qpay/client'
import { deliverQpayApprovalNotification } from '@/features/checkout/server/qpay-approval-notification'

const storedQpayPaymentSchema = z.object({
    id: z.string().uuid(),
    application_id: z.string().uuid(),
    applicant_user_id: z.string().uuid(),
    amount_mnt: z.coerce.number().int().positive(),
    currency: z.literal('MNT'),
    status: z.enum(['created', 'pending', 'paid', 'rejected', 'failed', 'expired', 'cancelled', 'refunded']),
    qpay_invoice_id: z.string().min(1).nullable(),
    qpay_payment_id: z.string().min(1).nullable(),
    callback_token_hash: z.string().regex(/^[0-9a-f]{64}$/),
})

function tokenMatches(token: string, expectedHash: string) {
    const actual = createHash('sha256').update(token).digest()
    const expected = Buffer.from(expectedHash, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function deliverApprovalNotification(paymentId: string) {
    const notification = await deliverQpayApprovalNotification(paymentId)
    if (!notification.sent && !notification.skipped) {
        console.error('QPay payment finalized but confirmation email failed:', notification.error)
    }
}

export async function reconcileCourseOfferingQpayPayment(
    paymentId: string,
    options: { callbackToken?: string } = {},
) {
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('course_offering_payments')
        .select('id, application_id, applicant_user_id, amount_mnt, currency, status, qpay_invoice_id, qpay_payment_id, callback_token_hash')
        .eq('id', paymentId)
        .eq('provider', 'qpay')
        .maybeSingle()
    if (error || !data) throw new Error('QPay payment attempt was not found.')

    const payment = storedQpayPaymentSchema.parse(data)
    if (options.callbackToken !== undefined && !tokenMatches(options.callbackToken, payment.callback_token_hash)) {
        throw new Error('QPay callback token is invalid.')
    }
    if (payment.status === 'paid') {
        await deliverApprovalNotification(payment.id)
        return { status: 'paid' as const, paymentId: payment.id, alreadyFinalized: true }
    }
    if (payment.status !== 'pending' || !payment.qpay_invoice_id) {
        throw new Error('QPay payment is not awaiting verification.')
    }

    const verified = await verifyQpayInvoicePayment(payment.qpay_invoice_id, payment.amount_mnt)
    if (!verified) return { status: 'pending' as const, paymentId: payment.id }

    const { data: finalized, error: finalizeError } = await admin.rpc('finalize_course_offering_qpay_payment', {
        p_payment_id: payment.id,
        p_qpay_payment_id: verified.paymentId,
        p_provider_status: verified.status,
        p_paid_at: verified.paidAt,
    })
    if (finalizeError) {
        console.error('Unable to finalize verified QPay payment:', finalizeError.message)
        throw new Error('QPay payment was verified but enrollment needs administrator review.')
    }

    await deliverApprovalNotification(payment.id)

    return {
        status: 'paid' as const,
        paymentId: payment.id,
        alreadyFinalized: Boolean((finalized as { already_finalized?: boolean } | null)?.already_finalized),
    }
}
