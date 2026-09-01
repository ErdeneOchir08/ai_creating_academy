'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { deliverQpayApprovalNotification, getQpayApprovalNotificationKey } from '@/features/checkout/server/qpay-approval-notification'

export type AdminQpayNotification = {
    status: 'pending' | 'processing' | 'sent' | 'failed'
    attempts: number
    sentAt: string | null
    lastError: string | null
}

export type AdminQpayPayment = {
    id: string
    applicationId: string
    status: 'created' | 'pending' | 'paid' | 'rejected' | 'failed' | 'expired' | 'cancelled' | 'refunded'
    paymentReference: string
    senderInvoiceNo: string
    qpayInvoiceId: string | null
    qpayPaymentId: string | null
    sourceSite: string
    amountMnt: number
    applicantEmail: string
    learnerName: string
    programName: string
    offeringName: string
    createdAt: string
    paidAt: string | null
    failureReason: string | null
    notification: AdminQpayNotification | null
}

type PaymentRow = {
    id: string
    application_id: string
    status: AdminQpayPayment['status']
    sender_invoice_no: string
    qpay_invoice_id: string | null
    qpay_payment_id: string | null
    source_site: string
    amount_mnt: number
    created_at: string
    provider_paid_at: string | null
    failure_reason: string | null
}

type ApplicationRow = {
    id: string
    payment_reference: string
    contact_email: string
    terms_snapshot: {
        learner_name?: unknown
        program_name?: unknown
        offering_name?: unknown
    } | null
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Нэвтрэх шаардлагатай.')

    const { data: role, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')
}

function assertUuid(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error('QPay төлбөрийн дугаар буруу байна.')
    }
}

function snapshotText(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export async function getQpayPayments({
    status,
    search,
}: {
    status?: string
    search?: string
} = {}): Promise<AdminQpayPayment[]> {
    await requireAdmin()
    const admin = createAdminClient()
    const selectedStatus = status === 'approved' || status === 'rejected' || status === 'inactive' ? status : 'pending'
    const statusGroups = {
        pending: ['created', 'pending'],
        approved: ['paid'],
        rejected: ['rejected', 'failed', 'refunded'],
        inactive: ['expired', 'cancelled'],
    } as const

    const { data: paymentData, error: paymentError } = await admin
        .from('course_offering_payments')
        .select('id, application_id, status, sender_invoice_no, qpay_invoice_id, qpay_payment_id, source_site, amount_mnt, created_at, provider_paid_at, failure_reason')
        .eq('provider', 'qpay')
        .in('status', [...statusGroups[selectedStatus]])
        .order('created_at', { ascending: false })
        .limit(250)

    if (paymentError) {
        console.error('Unable to load QPay payments:', paymentError.message)
        throw new Error('QPay төлбөрүүдийг уншиж чадсангүй.')
    }

    const payments = (paymentData ?? []) as PaymentRow[]
    if (payments.length === 0) return []

    const { data: applicationData, error: applicationError } = await admin
        .from('course_offering_applications')
        .select('id, payment_reference, contact_email, terms_snapshot')
        .in('id', [...new Set(payments.map((payment) => payment.application_id))])

    if (applicationError) {
        console.error('Unable to load QPay applications:', applicationError.message)
        throw new Error('QPay төлбөрийн элсэлтийн мэдээллийг уншиж чадсангүй.')
    }

    const notificationKeys = payments.map((payment) => getQpayApprovalNotificationKey(payment.id))
    const { data: notificationData, error: notificationError } = await admin
        .from('notification_outbox')
        .select('idempotency_key, status, attempts, sent_at, last_error')
        .in('idempotency_key', notificationKeys)
    if (notificationError) {
        console.error('Unable to load QPay notification delivery status:', notificationError.message)
    }
    const notificationByKey = new Map((notificationData ?? []).map((notification) => [
        notification.idempotency_key,
        {
            status: notification.status,
            attempts: Number(notification.attempts),
            sentAt: notification.sent_at,
            lastError: notification.last_error,
        } as AdminQpayNotification,
    ]))

    const applicationById = new Map(((applicationData ?? []) as ApplicationRow[])
        .map((application) => [application.id, application]))

    const result = payments.flatMap((payment) => {
        const application = applicationById.get(payment.application_id)
        if (!application) return []

        const snapshot = application.terms_snapshot
        return [{
            id: payment.id,
            applicationId: payment.application_id,
            status: payment.status,
            paymentReference: application.payment_reference,
            senderInvoiceNo: payment.sender_invoice_no,
            qpayInvoiceId: payment.qpay_invoice_id,
            qpayPaymentId: payment.qpay_payment_id,
            sourceSite: payment.source_site,
            amountMnt: payment.amount_mnt,
            applicantEmail: application.contact_email,
            learnerName: snapshotText(snapshot?.learner_name, '—'),
            programName: snapshotText(snapshot?.program_name, '—'),
            offeringName: snapshotText(snapshot?.offering_name, '—'),
            createdAt: payment.created_at,
            paidAt: payment.provider_paid_at,
            failureReason: payment.failure_reason,
            notification: notificationByKey.get(getQpayApprovalNotificationKey(payment.id)) ?? null,
        }]
    })

    const needle = search?.trim().toLocaleLowerCase('mn-MN')
    if (!needle) return result

    return result.filter((payment) => [
        payment.paymentReference,
        payment.senderInvoiceNo,
        payment.qpayInvoiceId,
        payment.qpayPaymentId,
        payment.applicantEmail,
        payment.learnerName,
        payment.programName,
        payment.offeringName,
        payment.sourceSite,
    ].some((value) => value?.toLocaleLowerCase('mn-MN').includes(needle)))
}

export async function resendQpayPaymentConfirmationEmail(paymentId: string) {
    assertUuid(paymentId)
    await requireAdmin()

    const result = await deliverQpayApprovalNotification(paymentId, { force: true })
    if (!result.sent) return { error: result.error }
    return { success: true as const }
}
