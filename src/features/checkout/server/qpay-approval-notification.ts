import 'server-only'

import { z } from 'zod'

import { sendOfferingPaymentDecisionEmail } from '@/lib/email/offering-status'
import { createAdminClient } from '@/lib/supabase/admin'

const uuidSchema = z.string().uuid()
const notificationClaimTimeoutMs = 10 * 60 * 1000

const notificationSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(['pending', 'processing', 'sent', 'failed']),
    attempts: z.coerce.number().int().nonnegative(),
    locked_at: z.string().nullable(),
})

const paymentSchema = z.object({
    application_id: z.string().uuid(),
    provider: z.literal('qpay'),
    status: z.literal('paid'),
})

const applicationSchema = z.object({
    offering_id: z.string().uuid(),
    learner_id: z.string().uuid(),
    applicant_user_id: z.string().uuid(),
    contact_email: z.string().trim().min(3).max(320),
    terms_snapshot: z.object({
        program_name: z.string().trim().min(1),
        offering_name: z.string().trim().min(1),
    }).passthrough(),
})

export type QpayApprovalNotificationResult =
    | { sent: true; alreadySent?: boolean }
    | { sent: false; skipped?: boolean; error: string }

export function getQpayApprovalNotificationKey(paymentId: string) {
    return `course-offering-qpay-approved:${paymentId}`
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

async function loadRecipientContext(
    admin: ReturnType<typeof createAdminClient>,
    paymentId: string,
) {
    const { data: rawPayment, error: paymentError } = await admin
        .from('course_offering_payments')
        .select('application_id, provider, status')
        .eq('id', paymentId)
        .maybeSingle()
    if (paymentError || !rawPayment) throw new Error('QPay төлбөрийн мэдээлэл олдсонгүй.')

    const payment = paymentSchema.parse(rawPayment)
    const { data: rawApplication, error: applicationError } = await admin
        .from('course_offering_applications')
        .select('offering_id, learner_id, applicant_user_id, contact_email, terms_snapshot')
        .eq('id', payment.application_id)
        .maybeSingle()
    if (applicationError || !rawApplication) throw new Error('QPay элсэлтийн мэдээлэл олдсонгүй.')

    const application = applicationSchema.parse(rawApplication)
    const [learnerResult, applicantResult] = await Promise.all([
        admin.from('learners').select('full_name').eq('id', application.learner_id).maybeSingle(),
        admin.from('profiles').select('display_name').eq('id', application.applicant_user_id).maybeSingle(),
    ])
    if (learnerResult.error || !learnerResult.data?.full_name) {
        throw new Error('QPay суралцагчийн мэдээлэл олдсонгүй.')
    }
    if (applicantResult.error) throw new Error('QPay төлбөр төлөгчийн мэдээллийг уншиж чадсангүй.')

    return {
        to: application.contact_email,
        recipientName: applicantResult.data?.display_name?.trim() || learnerResult.data.full_name,
        learnerName: learnerResult.data.full_name,
        programName: application.terms_snapshot.program_name,
        offeringName: application.terms_snapshot.offering_name,
        offeringId: application.offering_id,
    }
}

export async function deliverQpayApprovalNotification(
    paymentId: string,
    { force = false }: { force?: boolean } = {},
): Promise<QpayApprovalNotificationResult> {
    if (!uuidSchema.safeParse(paymentId).success) {
        return { sent: false, error: 'QPay төлбөрийн дугаар буруу байна.' }
    }

    try {
        const admin = createAdminClient()
        const idempotencyKey = getQpayApprovalNotificationKey(paymentId)
        const { data: rawNotification, error: notificationError } = await admin
            .from('notification_outbox')
            .select('id, status, attempts, locked_at')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle()
        if (notificationError || !rawNotification) {
            return { sent: false, error: 'QPay баталгаажуулалтын имэйлийн бүртгэл олдсонгүй.' }
        }

        const notification = notificationSchema.parse(rawNotification)
        if (notification.status === 'sent' && !force) return { sent: true, alreadySent: true }

        const lockedAt = notification.locked_at ? Date.parse(notification.locked_at) : Number.NaN
        const processingIsCurrent = notification.status === 'processing'
            && Number.isFinite(lockedAt)
            && Date.now() - lockedAt < notificationClaimTimeoutMs
        if (processingIsCurrent) {
            return { sent: false, skipped: true, error: 'QPay баталгаажуулалтын имэйлийг өөр процесс илгээж байна.' }
        }

        const recipient = await loadRecipientContext(admin, paymentId)
        const attempts = notification.attempts + 1
        const now = new Date().toISOString()
        const { data: claimed, error: claimError } = await admin
            .from('notification_outbox')
            .update({
                status: 'processing',
                attempts,
                locked_at: now,
                sent_at: null,
                last_error: null,
            })
            .eq('id', notification.id)
            .eq('status', notification.status)
            .eq('attempts', notification.attempts)
            .select('id')
            .maybeSingle()
        if (claimError) return { sent: false, error: 'QPay баталгаажуулалтын имэйлийг эхлүүлж чадсангүй.' }
        if (!claimed) {
            return { sent: false, skipped: true, error: 'QPay баталгаажуулалтын имэйлийг өөр процесс эхлүүлсэн байна.' }
        }

        const result = await sendOfferingPaymentDecisionEmail({
            ...recipient,
            decision: 'approved',
        })
        const finishedAt = new Date().toISOString()
        const values = result.sent
            ? { status: 'sent', locked_at: null, sent_at: finishedAt, last_error: null }
            : {
                status: 'failed',
                locked_at: null,
                sent_at: null,
                available_at: finishedAt,
                last_error: result.error.slice(0, 4000),
            }
        const { error: finishError } = await admin
            .from('notification_outbox')
            .update(values)
            .eq('id', notification.id)
            .eq('status', 'processing')
            .eq('attempts', attempts)

        if (finishError) {
            if (result.sent) {
                console.error('QPay confirmation email sent but delivery status could not be saved:', finishError.message)
                return { sent: true }
            }
            return { sent: false, error: `${result.error} Хүргэлтийн төлөв хадгалагдсангүй.` }
        }
        return result
    } catch (error) {
        console.error('QPay approval notification failed:', errorMessage(error))
        return { sent: false, error: 'QPay баталгаажуулалтын имэйлийг бэлтгэж чадсангүй.' }
    }
}
