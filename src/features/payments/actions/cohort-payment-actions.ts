'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendCohortPaymentSubmittedAlert } from '@/lib/telegram/notifications'
import { validateImageFile } from '@/lib/uploads/image-validation'
import { removeFailedPaymentReceipt } from '@/lib/uploads/payment-receipt-cleanup'

type CohortPaymentStatus = 'pending' | 'approved' | 'rejected'

export type MyCohortPaymentState = {
    applicationId: string
    cohortId: string
    programName: string
    cohortName: string
    amountMnt: number
    paymentDueAt: string
    paymentOverdue: boolean
    isEnrolled: boolean
    latestRequest: {
        id: string
        status: CohortPaymentStatus
        rejectionReason: string | null
        createdAt: string
        reviewedAt: string | null
    } | null
    paymentInstructions: string
    isTestMode: boolean
}

function assertUuid(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error('Өргөдлийн дугаар буруу байна.')
    }
}

export async function getMyCohortPaymentState(applicationId: string): Promise<MyCohortPaymentState | null> {
    assertUuid(applicationId)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: application, error: applicationError } = await supabase
        .from('cohort_applications')
        .select(`
            id, status, payment_due_at,
            cohort:training_cohorts!cohort_applications_cohort_id_fkey (
                id, name, tuition_amount_mnt, payment_due_days,
                program:training_programs!training_cohorts_program_id_fkey ( name )
            )
        `)
        .eq('id', applicationId)
        .eq('applicant_user_id', user.id)
        .maybeSingle()

    if (applicationError) throw new Error('Төлбөрийн мэдээллийг уншиж чадсангүй.')
    if (!application || application.status !== 'approved') return null

    const cohort = Array.isArray(application.cohort) ? application.cohort[0] : application.cohort
    const program = cohort && (Array.isArray(cohort.program) ? cohort.program[0] : cohort.program)
    if (!cohort || !program || cohort.tuition_amount_mnt == null || cohort.tuition_amount_mnt <= 0 || !application.payment_due_at) {
        return null
    }

    const [paymentResult, enrollmentResult, configurationResult] = await Promise.all([
        supabase
            .from('cohort_payment_requests')
            .select('id, status, rejection_reason, created_at, reviewed_at')
            .eq('application_id', applicationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('cohort_enrollments')
            .select('id')
            .eq('application_id', applicationId)
            .eq('status', 'active')
            .maybeSingle(),
        supabase
            .from('payment_configuration')
            .select('instructions, is_test_mode')
            .eq('id', true)
            .maybeSingle(),
    ])

    const failure = [paymentResult, enrollmentResult, configurationResult].find((result) => result.error)
    if (failure?.error) {
        console.error('Unable to load cohort payment state:', failure.error.message)
        throw new Error('Төлбөрийн төлөвийг уншиж чадсангүй.')
    }

    const configuredDeadline = new Date(application.payment_due_at).getTime()
    const resubmissionDeadline = paymentResult.data?.status === 'rejected'
        && paymentResult.data.reviewed_at
        && cohort.payment_due_days
        ? new Date(paymentResult.data.reviewed_at).getTime() + cohort.payment_due_days * 24 * 60 * 60 * 1_000
        : 0
    const effectiveDeadline = Math.max(configuredDeadline, resubmissionDeadline)

    return {
        applicationId: application.id,
        cohortId: cohort.id,
        programName: program.name,
        cohortName: cohort.name,
        amountMnt: cohort.tuition_amount_mnt,
        paymentDueAt: new Date(effectiveDeadline).toISOString(),
        paymentOverdue: effectiveDeadline < Date.now(),
        isEnrolled: Boolean(enrollmentResult.data),
        latestRequest: paymentResult.data ? {
            id: paymentResult.data.id,
            status: paymentResult.data.status as CohortPaymentStatus,
            rejectionReason: paymentResult.data.rejection_reason,
            createdAt: paymentResult.data.created_at,
            reviewedAt: paymentResult.data.reviewed_at,
        } : null,
        paymentInstructions: configurationResult.data?.instructions?.trim() ?? '',
        isTestMode: configurationResult.data?.is_test_mode ?? true,
    }
}

export async function submitCohortPaymentRequest(applicationId: string, formData: FormData) {
    assertUuid(applicationId)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Төлбөрийн баримт илгээхийн тулд нэвтэрнэ үү.' }

    const receipt = formData.get('receipt')
    if (!(receipt instanceof File) || receipt.size === 0) {
        return { success: false, error: 'Төлбөрийн баримтын зургаа сонгоно уу.' }
    }

    let extension: string
    try {
        extension = await validateImageFile(receipt, 10 * 1024 * 1024)
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Зургийн файлыг шалгаж чадсангүй.' }
    }

    const state = await getMyCohortPaymentState(applicationId)
    if (!state) return { success: false, error: 'Төлбөр төлөх боломжтой зөвшөөрөгдсөн өргөдөл олдсонгүй.' }
    if (state.isEnrolled) return { success: false, error: 'Таны элсэлт аль хэдийн баталгаажсан байна.' }
    if (state.latestRequest?.status === 'pending') return { success: false, error: 'Таны төлбөрийн баримтыг админ хянаж байна.' }
    if (new Date(state.paymentDueAt).getTime() < Date.now()) {
        return { success: false, error: 'Төлбөр төлөх хугацаа дууссан байна. Академийн админтай холбогдоно уу.' }
    }

    const receiptPath = `${user.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(receiptPath, receipt, { contentType: receipt.type, upsert: false })

    if (uploadError) {
        console.error('Cohort receipt upload failed:', uploadError.message)
        return { success: false, error: 'Баримтыг байршуулж чадсангүй. Дахин оролдоно уу.' }
    }

    const { error: requestError } = await supabase.rpc('submit_cohort_payment_request', {
        p_application_id: applicationId,
        p_receipt_path: receiptPath,
    })

    if (requestError) {
        console.error('Cohort payment request failed:', requestError.message)
        await removeFailedPaymentReceipt(receiptPath)
        const message = requestError.message.includes('deadline has passed')
            ? 'Төлбөр төлөх хугацаа дууссан байна. Академийн админтай холбогдоно уу.'
            : requestError.message.includes('already pending')
                ? 'Таны төлбөрийн баримтыг админ хянаж байна.'
                : 'Төлбөрийн хүсэлтийг хадгалж чадсангүй. Дахин оролдоно уу.'
        return { success: false, error: message }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
    const notification = await sendCohortPaymentSubmittedAlert({
        studentName: profile?.display_name || user.email || 'Суралцагч',
        programName: state.programName,
        cohortName: state.cohortName,
        adminUrl: siteUrl ? `${siteUrl}/admin/payments?type=cohort&status=pending` : undefined,
    })
    if (!notification.sent) console.error('Cohort payment saved but Telegram notification failed:', notification.error)

    revalidatePath(`/programs/${state.cohortId}`)
    revalidatePath('/admin')
    revalidatePath('/admin/payments')
    return { success: true }
}
