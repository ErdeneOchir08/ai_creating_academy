'use server'

import { revalidatePath } from 'next/cache'

import {
    type AdminOfferingPayment,
    type AdminOfferingPaymentNotification,
    type AdminOfferingPaymentStatus,
    getOfferingDecisionNotificationIdentity,
    offeringPaymentDecisionErrorMessage,
    offeringPaymentMatchesSearch,
    offeringPaymentRejectionReasonSchema,
    parseAdminOfferingPayment,
    parseOfferingPaymentDecisionRecipient,
} from '@/features/admin/domain/offering-payment-review'
import { sendOfferingPaymentDecisionEmail } from '@/lib/email/offering-status'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type RawPaymentProof = {
    id: string
    application_id: string
    offering_id: string
    applicant_user_id: string
    attempt_number: number
    receipt_path: string
    amount_mnt: number
    status: AdminOfferingPaymentStatus
    rejection_reason: string | null
    created_at: string
    reviewed_at: string | null
}

type RawApplication = {
    id: string
    payment_reference: string
    offering_id: string
    learner_id: string
    applicant_user_id: string
    content_access_user_id: string
    contact_email: string
    applicant_relationship: 'self' | 'parent' | 'guardian' | 'other'
    contract_policy_snapshot: 'required' | 'none'
    payment_due_at: string
    status: 'draft' | 'submitted' | 'approved' | 'withdrawn'
    terms_snapshot: unknown
}

type RawNotification = AdminOfferingPaymentNotification & {
    idempotency_key: string
}

type NotificationClaim = {
    id: string
    attempts: number
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const notificationClaimTimeoutMs = 10 * 60 * 1000

function assertUuid(value: string) {
    if (!uuidPattern.test(value)) {
        throw new Error('Төлбөрийн хүсэлтийн дугаар буруу байна.')
    }
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
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

    return supabase
}

async function loadDecisionNotifications(idempotencyKeys: string[]) {
    if (idempotencyKeys.length === 0) {
        return { notifications: [] as RawNotification[], error: null as string | null }
    }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('notification_outbox')
            .select('id, idempotency_key, status, attempts, available_at, locked_at, sent_at, last_error')
            .in('idempotency_key', idempotencyKeys)

        if (error) {
            console.error('Unable to load offering payment notification status:', error.message)
            return {
                notifications: [] as RawNotification[],
                error: 'Имэйлийн хүргэлтийн төлөвийг уншиж чадсангүй.',
            }
        }

        return {
            notifications: (data ?? []) as RawNotification[],
            error: null as string | null,
        }
    } catch (error) {
        console.error('Unable to initialize offering notification tracking:', errorMessage(error))
        return {
            notifications: [] as RawNotification[],
            error: 'Имэйлийн хүргэлтийн хяналт тохируулагдаагүй байна.',
        }
    }
}

export async function getCourseOfferingPayments({
    status,
    search,
}: {
    status?: string
    search?: string
} = {}): Promise<AdminOfferingPayment[]> {
    const supabase = await requireAdmin()
    const selectedStatus = status === 'approved' || status === 'rejected' || status === 'all'
        ? status
        : 'pending'

    let proofQuery = supabase
        .from('course_offering_payment_proofs')
        .select(`
            id, application_id, offering_id, applicant_user_id, attempt_number,
            receipt_path, amount_mnt, status, rejection_reason, created_at, reviewed_at
        `)
        .order('created_at', { ascending: false })

    if (selectedStatus !== 'all') proofQuery = proofQuery.eq('status', selectedStatus)

    const { data: proofData, error: proofError } = await proofQuery
    if (proofError) {
        console.error('Unable to load V2 offering payment proofs:', proofError.message)
        throw new Error('V2 элсэлтийн төлбөрүүдийг уншиж чадсангүй.')
    }

    const proofs = (proofData ?? []) as unknown as RawPaymentProof[]
    if (proofs.length === 0) return []

    const applicationIds = [...new Set(proofs.map((proof) => proof.application_id))]
    const { data: applicationData, error: applicationError } = await supabase
        .from('course_offering_applications')
        .select(`
            id, payment_reference, offering_id, learner_id, applicant_user_id, content_access_user_id,
            contact_email, applicant_relationship, contract_policy_snapshot,
            payment_due_at, status, terms_snapshot
        `)
        .in('id', applicationIds)

    if (applicationError) {
        console.error('Unable to load V2 offering payment applications:', applicationError.message)
        throw new Error('Төлбөрийн элсэлтийн мэдээллийг уншиж чадсангүй.')
    }

    const applications = (applicationData ?? []) as unknown as RawApplication[]
    const applicationById = new Map(applications.map((application) => [application.id, application]))
    const missingApplication = proofs.find((proof) => !applicationById.has(proof.application_id))
    if (missingApplication) {
        console.error('V2 offering payment has no readable application:', missingApplication.id)
        throw new Error('Төлбөрийн хүсэлтийн холбоотой элсэлтийн мэдээлэл дутуу байна.')
    }

    const learnerIds = [...new Set(applications.map((application) => application.learner_id))]
    const applicantIds = [...new Set(applications.map((application) => application.applicant_user_id))]
    const receiptPaths = [...new Set(proofs.map((proof) => proof.receipt_path))]
    const decisionKeys = proofs.flatMap((proof) => {
        const identity = getOfferingDecisionNotificationIdentity(proof.id, proof.status)
        return identity ? [identity.idempotencyKey] : []
    })

    const [learnerResult, applicantResult, receiptResult, notificationResult] = await Promise.all([
        supabase.from('learners').select('id, full_name').in('id', learnerIds),
        supabase.from('profiles').select('id, display_name').in('id', applicantIds),
        supabase.storage.from('payment-receipts').createSignedUrls(receiptPaths, 300),
        loadDecisionNotifications(decisionKeys),
    ])

    if (learnerResult.error) {
        console.error('Unable to load V2 payment learners:', learnerResult.error.message)
        throw new Error('Суралцагчийн мэдээллийг уншиж чадсангүй.')
    }
    if (applicantResult.error) {
        console.error('Unable to load V2 payment applicants:', applicantResult.error.message)
        throw new Error('Өргөдөл гаргагчийн мэдээллийг уншиж чадсангүй.')
    }
    if (receiptResult.error) {
        console.error('Unable to sign V2 offering payment receipts:', receiptResult.error.message)
    }

    const learnerById = new Map(((learnerResult.data ?? []) as Array<{ id: string; full_name: string }>)
        .map((learner) => [learner.id, learner]))
    const applicantById = new Map(((applicantResult.data ?? []) as Array<{ id: string; display_name: string | null }>)
        .map((applicant) => [applicant.id, applicant]))
    const receiptByPath = new Map((receiptResult.data ?? [])
        .filter((receipt) => Boolean(receipt.signedUrl))
        .map((receipt) => [receipt.path, receipt.signedUrl]))
    const notificationByKey = new Map(notificationResult.notifications
        .map((notification) => [notification.idempotency_key, notification]))

    const payments = proofs.map((proof) => {
        const application = applicationById.get(proof.application_id)
        const learner = application ? learnerById.get(application.learner_id) : null
        if (!application || !learner) {
            console.error('V2 offering payment has incomplete learner context:', proof.id)
            throw new Error('Төлбөрийн хүсэлтийн суралцагчийн мэдээлэл дутуу байна.')
        }

        const notificationIdentity = getOfferingDecisionNotificationIdentity(proof.id, proof.status)
        const notification = notificationIdentity
            ? notificationByKey.get(notificationIdentity.idempotencyKey) ?? null
            : null

        return parseAdminOfferingPayment({
            proof,
            application,
            learner,
            applicant: applicantById.get(application.applicant_user_id) ?? null,
            receiptUrl: receiptByPath.get(proof.receipt_path) ?? null,
            notification,
            notificationTrackingError: notificationResult.error,
        })
    })

    const normalizedSearch = search?.trim() ?? ''
    return normalizedSearch
        ? payments.filter((payment) => offeringPaymentMatchesSearch(payment, normalizedSearch))
        : payments
}

async function loadDecisionRecipient(supabase: SupabaseClient, paymentProofId: string) {
    const { data: proof, error: proofError } = await supabase
        .from('course_offering_payment_proofs')
        .select('id, application_id, status, rejection_reason')
        .eq('id', paymentProofId)
        .maybeSingle()
    if (proofError || !proof) {
        if (proofError) console.error('Unable to load V2 payment decision proof:', proofError.message)
        throw new Error('Төлбөрийн хүсэлтийн мэдээллийг уншиж чадсангүй.')
    }

    const { data: application, error: applicationError } = await supabase
        .from('course_offering_applications')
        .select('offering_id, learner_id, applicant_user_id, contact_email, terms_snapshot')
        .eq('id', proof.application_id)
        .maybeSingle()
    if (applicationError || !application) {
        if (applicationError) console.error('Unable to load V2 payment decision application:', applicationError.message)
        throw new Error('Элсэлтийн мэдээллийг уншиж чадсангүй.')
    }

    const [learnerResult, applicantResult] = await Promise.all([
        supabase.from('learners').select('full_name').eq('id', application.learner_id).maybeSingle(),
        supabase.from('profiles').select('display_name').eq('id', application.applicant_user_id).maybeSingle(),
    ])
    if (learnerResult.error || !learnerResult.data) {
        if (learnerResult.error) console.error('Unable to load V2 payment decision learner:', learnerResult.error.message)
        throw new Error('Суралцагчийн мэдээллийг уншиж чадсангүй.')
    }
    if (applicantResult.error) {
        console.error('Unable to load V2 payment decision applicant:', applicantResult.error.message)
        throw new Error('Өргөдөл гаргагчийн мэдээллийг уншиж чадсангүй.')
    }

    return parseOfferingPaymentDecisionRecipient({
        proof,
        application,
        learner: learnerResult.data,
        applicant: applicantResult.data,
    })
}

async function claimDecisionNotification(idempotencyKey: string, forceResend: boolean) {
    try {
        const admin = createAdminClient()
        const { data: row, error } = await admin
            .from('notification_outbox')
            .select('id, status, attempts, locked_at')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle()

        if (error) {
            console.error('Unable to read V2 decision notification:', error.message)
            return { error: 'Имэйлийн хүргэлтийн бүртгэлийг уншиж чадсангүй.' } as const
        }
        if (!row) {
            return { error: 'Имэйлийн хүргэлтийн бүртгэл үүсээгүй байна.' } as const
        }
        if (row.status === 'sent' && !forceResend) return { skipped: true } as const
        const lockTime = row.locked_at ? Date.parse(row.locked_at) : Number.NaN
        const processingIsCurrent = row.status === 'processing'
            && Number.isFinite(lockTime)
            && Date.now() - lockTime < notificationClaimTimeoutMs
        if (processingIsCurrent) {
            return { error: 'Энэ имэйлийг өөр процесс илгээж байна. Түр хүлээгээд хуудсыг шинэчилнэ үү.' } as const
        }

        const nextAttempts = Number(row.attempts) + 1
        const now = new Date().toISOString()
        const { data: claimed, error: claimError } = await admin
            .from('notification_outbox')
            .update({
                status: 'processing',
                attempts: nextAttempts,
                locked_at: now,
                sent_at: null,
                last_error: null,
            })
            .eq('id', row.id)
            .eq('status', row.status)
            .eq('attempts', row.attempts)
            .select('id')
            .maybeSingle()

        if (claimError) {
            console.error('Unable to claim V2 decision notification:', claimError.message)
            return { error: 'Имэйлийн хүргэлтийг эхлүүлж чадсангүй.' } as const
        }
        if (!claimed) {
            return { error: 'Имэйлийн хүргэлтийг өөр процесс эхлүүлсэн байна. Түр хүлээнэ үү.' } as const
        }

        return {
            admin,
            claim: { id: row.id, attempts: nextAttempts } satisfies NotificationClaim,
        } as const
    } catch (error) {
        console.error('Unable to initialize V2 decision notification:', errorMessage(error))
        return { error: 'Имэйлийн хүргэлтийн хяналт тохируулагдаагүй байна.' } as const
    }
}

async function finishDecisionNotification(
    admin: ReturnType<typeof createAdminClient>,
    claim: NotificationClaim,
    result: Awaited<ReturnType<typeof sendOfferingPaymentDecisionEmail>>,
) {
    const now = new Date().toISOString()
    const values = result.sent
        ? {
            status: 'sent',
            locked_at: null,
            sent_at: now,
            last_error: null,
        }
        : {
            status: 'failed',
            locked_at: null,
            sent_at: null,
            last_error: result.error.slice(0, 4000),
            available_at: now,
        }
    const { error } = await admin
        .from('notification_outbox')
        .update(values)
        .eq('id', claim.id)
        .eq('status', 'processing')
        .eq('attempts', claim.attempts)

    if (error) {
        console.error('Unable to finalize V2 decision notification:', error.message)
        return result.sent
            ? 'Имэйл илгээгдсэн боловч хүргэлтийн төлөвийг хадгалж чадсангүй.'
            : `${result.error} Хүргэлтийн төлөвийг хадгалж чадсангүй.`
    }
    return result.sent ? null : result.error
}

async function deliverDecisionEmail(
    supabase: SupabaseClient,
    paymentProofId: string,
    forceResend: boolean,
) {
    const recipient = await loadDecisionRecipient(supabase, paymentProofId)
    const identity = getOfferingDecisionNotificationIdentity(paymentProofId, recipient.status)
    if (!identity) {
        return {
            sent: false,
            error: 'Хүлээгдэж буй төлбөрт шийдвэрийн имэйл илгээх боломжгүй.',
            offeringId: recipient.offeringId,
        }
    }

    const claimed = await claimDecisionNotification(identity.idempotencyKey, forceResend)
    if ('error' in claimed) return { sent: false, error: claimed.error, offeringId: recipient.offeringId }
    if ('skipped' in claimed) return { sent: true, offeringId: recipient.offeringId }

    const result = await sendOfferingPaymentDecisionEmail({
        to: recipient.email,
        recipientName: recipient.recipientName,
        learnerName: recipient.learnerName,
        programName: recipient.programName,
        offeringName: recipient.offeringName,
        offeringId: recipient.offeringId,
        decision: identity.decision,
        rejectionReason: recipient.rejectionReason,
    })
    const trackingError = await finishDecisionNotification(claimed.admin, claimed.claim, result)

    return {
        sent: result.sent,
        error: trackingError ?? undefined,
        offeringId: recipient.offeringId,
    }
}

function revalidateOfferingPaymentPaths(offeringId?: string) {
    revalidatePath('/admin')
    revalidatePath('/admin/payments')
    revalidatePath('/dashboard/courses')
    if (offeringId) revalidatePath(`/programs/${offeringId}`)
}

export async function approveCourseOfferingPayment(paymentProofId: string) {
    assertUuid(paymentProofId)
    const supabase = await requireAdmin()
    const { error } = await supabase.rpc('approve_course_offering_checkout', {
        p_payment_proof_id: paymentProofId,
    })
    if (error) {
        console.error('Unable to approve V2 offering payment:', error.message)
        return { error: offeringPaymentDecisionErrorMessage(error.message, 'approve') }
    }

    try {
        const notification = await deliverDecisionEmail(supabase, paymentProofId, false)
        revalidateOfferingPaymentPaths(notification.offeringId)
        return {
            success: true,
            notificationError: notification.error,
        }
    } catch (error) {
        console.error('V2 offering payment was approved but follow-up failed:', errorMessage(error))
        revalidateOfferingPaymentPaths()
        return {
            success: true,
            notificationError: 'Төлбөр баталгаажсан боловч шийдвэрийн имэйл бэлтгэж чадсангүй.',
        }
    }
}

export async function rejectCourseOfferingPayment(paymentProofId: string, rejectionReason: string) {
    assertUuid(paymentProofId)
    const parsedReason = offeringPaymentRejectionReasonSchema.safeParse(rejectionReason)
    if (!parsedReason.success) {
        return { error: parsedReason.error.issues[0]?.message ?? 'Баримт буцаах шалтгааныг оруулна уу.' }
    }

    const supabase = await requireAdmin()
    const { error } = await supabase.rpc('reject_course_offering_checkout_payment', {
        p_payment_proof_id: paymentProofId,
        p_reason: parsedReason.data,
    })
    if (error) {
        console.error('Unable to reject V2 offering payment:', error.message)
        return { error: offeringPaymentDecisionErrorMessage(error.message, 'reject') }
    }

    try {
        const notification = await deliverDecisionEmail(supabase, paymentProofId, false)
        revalidateOfferingPaymentPaths(notification.offeringId)
        return {
            success: true,
            notificationError: notification.error,
        }
    } catch (error) {
        console.error('V2 offering payment was rejected but follow-up failed:', errorMessage(error))
        revalidateOfferingPaymentPaths()
        return {
            success: true,
            notificationError: 'Баримтыг буцаасан боловч шийдвэрийн имэйл бэлтгэж чадсангүй.',
        }
    }
}

export async function resendCourseOfferingPaymentDecisionEmail(paymentProofId: string) {
    assertUuid(paymentProofId)
    const supabase = await requireAdmin()

    try {
        const result = await deliverDecisionEmail(supabase, paymentProofId, true)
        revalidatePath('/admin/payments')
        return result.sent && !result.error
            ? { success: true }
            : { error: result.error ?? 'Шийдвэрийн имэйлийг дахин илгээж чадсангүй.' }
    } catch (error) {
        console.error('Unable to resend V2 offering payment decision email:', errorMessage(error))
        return { error: 'Шийдвэрийн имэйлийг дахин илгээж чадсангүй.' }
    }
}
