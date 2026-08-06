'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendCohortPaymentDecisionEmail } from '@/lib/email/cohort-status'

type Relation<T> = T | T[] | null
type CohortPaymentStatus = 'pending' | 'approved' | 'rejected'

type RawCohortPayment = {
    id: string
    application_id: string
    applicant_user_id: string
    cohort_id: string
    receipt_path: string
    amount_mnt: number
    status: CohortPaymentStatus
    rejection_reason: string | null
    created_at: string
    reviewed_at: string | null
    applicant: Relation<{ display_name: string | null }>
    application: Relation<{ contact_email: string; answers: Record<string, string> }>
    cohort: Relation<{ name: string; program: Relation<{ name: string }> }>
}

export type AdminCohortPayment = Omit<RawCohortPayment, 'applicant' | 'application' | 'cohort'> & {
    applicant: { display_name: string | null } | null
    application: { contact_email: string; answers: Record<string, string> } | null
    cohort: { name: string; program: { name: string } | null } | null
    receiptUrl: string | null
}

type NotificationRecipient = {
    email: string | null
    display_name: string | null
    program_name: string | null
    cohort_name: string | null
}

function first<T>(value: Relation<T>) {
    return Array.isArray(value) ? value[0] ?? null : value
}

function assertUuid(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error('Төлбөрийн хүсэлтийн дугаар буруу байна.')
    }
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Нэвтрэх шаардлагатай.')
    const { data: role, error } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')
    return supabase
}

export async function getCohortPayments({ status, search }: { status?: string; search?: string } = {}) {
    const supabase = await requireAdmin()
    const allowed = new Set(['pending', 'approved', 'rejected', 'all'])
    const selectedStatus = status && allowed.has(status) ? status : 'pending'
    let query = supabase
        .from('cohort_payment_requests')
        .select(`
            id, application_id, applicant_user_id, cohort_id, receipt_path, amount_mnt,
            status, rejection_reason, created_at, reviewed_at,
            applicant:profiles!cohort_payment_requests_applicant_user_id_fkey ( display_name ),
            application:cohort_applications!cohort_payment_requests_application_id_fkey ( contact_email, answers ),
            cohort:training_cohorts!cohort_payment_requests_cohort_id_fkey (
                name,
                program:training_programs!training_cohorts_program_id_fkey ( name )
            )
        `)
        .order('created_at', { ascending: false })

    if (selectedStatus !== 'all') query = query.eq('status', selectedStatus)
    const { data, error } = await query
    if (error) {
        console.error('Unable to load cohort payments:', error.message)
        throw new Error('Элсэлтийн төлбөрүүдийг уншиж чадсангүй.')
    }

    const payments = await Promise.all(((data ?? []) as unknown as RawCohortPayment[]).map(async (payment) => {
        const cohort = first(payment.cohort)
        const { data: signed, error: signedError } = await supabase.storage
            .from('payment-receipts')
            .createSignedUrl(payment.receipt_path, 300)
        if (signedError) console.error('Unable to sign cohort payment receipt:', signedError.message)

        return {
            ...payment,
            applicant: first(payment.applicant),
            application: first(payment.application),
            cohort: cohort ? { ...cohort, program: first(cohort.program) } : null,
            receiptUrl: signed?.signedUrl ?? null,
        } satisfies AdminCohortPayment
    }))

    const normalizedSearch = search?.trim().toLocaleLowerCase('mn-MN')
    if (!normalizedSearch) return payments
    return payments.filter((payment) => [
        payment.applicant?.display_name,
        payment.application?.contact_email,
        payment.application?.answers?.student_name,
        payment.cohort?.name,
        payment.cohort?.program?.name,
    ].filter(Boolean).join(' ').toLocaleLowerCase('mn-MN').includes(normalizedSearch))
}

async function notifyPaymentDecision(
    supabase: Awaited<ReturnType<typeof createClient>>,
    requestId: string,
    cohortId: string,
    decision: 'approved' | 'rejected',
    rejectionReason?: string | null,
) {
    const { data, error } = await supabase.rpc('get_cohort_payment_notification_recipient', { p_request_id: requestId })
    if (error) {
        console.error('Unable to load cohort payment recipient:', error.message)
        return { sent: false, error: 'Хүлээн авагчийн имэйл мэдээллийг уншиж чадсангүй.' }
    }

    const recipient = (data?.[0] ?? null) as NotificationRecipient | null
    if (!recipient?.email || !recipient.program_name || !recipient.cohort_name) {
        return { sent: false, error: 'Хүлээн авагчийн имэйл мэдээлэл дутуу байна.' }
    }

    return sendCohortPaymentDecisionEmail({
        to: recipient.email,
        recipientName: recipient.display_name || 'Суралцагч',
        programName: recipient.program_name,
        cohortName: recipient.cohort_name,
        cohortId,
        decision,
        rejectionReason,
    })
}

export async function approveCohortPayment(requestId: string, cohortId: string) {
    assertUuid(requestId)
    assertUuid(cohortId)
    const supabase = await requireAdmin()
    const { error } = await supabase.rpc('approve_cohort_payment_request', { p_request_id: requestId })
    if (error) {
        console.error('Unable to approve cohort payment:', error.message)
        if (error.message.includes('capacity')) return { error: 'Энэ ээлжийн суудал дүүрсэн байна. Төлбөрийг зөвшөөрөөгүй.' }
        return { error: 'Төлбөрийг зөвшөөрч чадсангүй. Мэдээллийг шинэчлээд дахин оролдоно уу.' }
    }

    const notification = await notifyPaymentDecision(supabase, requestId, cohortId, 'approved')
    revalidatePath('/admin')
    revalidatePath('/admin/payments')
    revalidatePath('/admin/applications')
    revalidatePath(`/programs/${cohortId}`)
    return { success: true, notificationError: notification.sent ? undefined : notification.error }
}

export async function rejectCohortPayment(requestId: string, cohortId: string, rejectionReason: string) {
    assertUuid(requestId)
    assertUuid(cohortId)
    const reason = rejectionReason.trim()
    if (!reason) return { error: 'Баримтыг буцаах шалтгааныг оруулна уу.' }
    if (reason.length > 500) return { error: 'Буцаах шалтгаан 500 тэмдэгтээс урт байж болохгүй.' }

    const supabase = await requireAdmin()
    const { error } = await supabase.rpc('reject_cohort_payment_request', {
        p_request_id: requestId,
        p_rejection_reason: reason,
    })
    if (error) {
        console.error('Unable to reject cohort payment:', error.message)
        return { error: 'Төлбөрийн баримтыг буцааж чадсангүй. Мэдээллийг шинэчлээд дахин оролдоно уу.' }
    }

    const notification = await notifyPaymentDecision(supabase, requestId, cohortId, 'rejected', reason)
    revalidatePath('/admin/payments')
    revalidatePath('/admin/applications')
    revalidatePath(`/programs/${cohortId}`)
    return { success: true, notificationError: notification.sent ? undefined : notification.error }
}

export async function resendCohortPaymentEmail(requestId: string, cohortId: string) {
    assertUuid(requestId)
    assertUuid(cohortId)
    const supabase = await requireAdmin()
    const { data: payment, error } = await supabase
        .from('cohort_payment_requests')
        .select('status, rejection_reason')
        .eq('id', requestId)
        .eq('cohort_id', cohortId)
        .maybeSingle()
    if (error || !payment || (payment.status !== 'approved' && payment.status !== 'rejected')) {
        return { error: 'Энэ төлбөрийн шийдвэрийн имэйлийг дахин илгээх боломжгүй байна.' }
    }

    const result = await notifyPaymentDecision(supabase, requestId, cohortId, payment.status, payment.rejection_reason)
    return result.sent ? { success: true } : { error: result.error }
}
