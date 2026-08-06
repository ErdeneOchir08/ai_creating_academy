'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendCohortApplicationDecisionEmail } from '@/lib/email/cohort-status'
import {
    parseAdminApprovedApplicationContractSnapshot,
    type CohortApplicationStatus,
} from '@/features/programs/domain/cohort-application'

type Relation<T> = T | T[] | null

type RawApplication = {
    id: string
    status: CohortApplicationStatus
    contact_email: string
    answers: Record<string, string>
    student_birth_date: string | null
    signer_role: 'self' | 'guardian' | null
    signer_name: string | null
    signer_email: string | null
    signer_phone: string | null
    signer_registration_number: string | null
    signer_relationship: string | null
    submitted_at: string | null
    contract_acknowledged_at: string | null
    signed_at: string | null
    signature_method: 'authenticated_account' | 'email_otp' | null
    signer_email_verified_at: string | null
    signature_statement: string | null
    signature_statement_version: string | null
    reviewed_at: string | null
    payment_due_at: string | null
    rejection_reason: string | null
    created_at: string
    updated_at: string
    applicant: Relation<{ display_name: string | null }>
    cohort: Relation<{
        id: string
        name: string
        tuition_amount_mnt: number | null
        program: Relation<{ name: string }>
    }>
    contract: Relation<{ title: string; version_number: number }>
    contract_snapshot: Relation<{
        id: string
        created_at: string
        unresolved_variable_keys: string[]
    }>
}
export type AdminCohortApplication = Omit<RawApplication, 'applicant' | 'cohort' | 'contract' | 'contract_snapshot'> & {
    applicant: { display_name: string | null } | null
    cohort: {
        id: string
        name: string
        tuition_amount_mnt: number | null
        program: { name: string } | null
    } | null
    contract: { title: string; version_number: number } | null
    contract_snapshot: {
        id: string
        created_at: string
        unresolved_variable_keys: string[]
    } | null
    payment_status: 'not_required' | 'awaiting_receipt' | 'pending' | 'rejected' | 'approved'
}

function first<T>(value: Relation<T>) {
    return Array.isArray(value) ? value[0] ?? null : value
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Нэвтрэх шаардлагатай.')

    const { data: role, error } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')
    return supabase
}

function assertUuid(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error('Өргөдлийн дугаар буруу байна.')
    }
}

export async function getAdminCohortApplications() {
    const supabase = await requireAdmin()
    const [applicationsResult, variablesResult] = await Promise.all([
        supabase
            .from('cohort_applications')
            .select(`
                id, status, contact_email, answers,
                student_birth_date, signer_role, signer_name, signer_email, signer_phone,
                signer_registration_number, signer_relationship,
                submitted_at, contract_acknowledged_at, signed_at, signature_method,
                signer_email_verified_at, signature_statement, signature_statement_version, reviewed_at,
                rejection_reason, payment_due_at, created_at, updated_at,
                applicant:profiles!cohort_applications_applicant_user_id_fkey ( display_name ),
                cohort:training_cohorts!cohort_applications_cohort_id_fkey (
                    id, name, tuition_amount_mnt,
                    program:training_programs!training_cohorts_program_id_fkey ( name )
                ),
                contract:contract_template_versions!cohort_applications_contract_version_id_fkey ( title, version_number ),
                contract_snapshot:cohort_application_contract_snapshots!cohort_application_contract_snapshots_application_id_fkey (
                    id, created_at, unresolved_variable_keys
                )
            `)
            .order('updated_at', { ascending: false }),
        supabase
            .from('contract_variables')
            .select('key, label_mn'),
    ])

    if (applicationsResult.error || variablesResult.error) {
        console.error('Unable to load cohort applications:', applicationsResult.error?.message ?? variablesResult.error?.message)
        throw new Error('Элсэлтийн өргөдлүүдийг уншиж чадсангүй.')
    }

    const rawApplications = (applicationsResult.data ?? []) as unknown as RawApplication[]
    const approvedApplicationIds = rawApplications.filter((application) => application.status === 'approved').map((application) => application.id)
    const [paymentsResult, enrollmentsResult] = approvedApplicationIds.length > 0
        ? await Promise.all([
            supabase
                .from('cohort_payment_requests')
                .select('application_id, status, created_at')
                .in('application_id', approvedApplicationIds)
                .order('created_at', { ascending: false }),
            supabase
                .from('cohort_enrollments')
                .select('application_id')
                .eq('status', 'active')
                .in('application_id', approvedApplicationIds),
        ])
        : [{ data: [], error: null }, { data: [], error: null }]

    if (paymentsResult.error || enrollmentsResult.error) {
        console.error('Unable to load cohort application payment state:', paymentsResult.error?.message ?? enrollmentsResult.error?.message)
        throw new Error('Элсэлтийн төлбөрийн төлөвийг уншиж чадсангүй.')
    }

    const latestPaymentByApplication = new Map<string, 'pending' | 'approved' | 'rejected'>()
    for (const payment of paymentsResult.data ?? []) {
        if (!latestPaymentByApplication.has(payment.application_id)) {
            latestPaymentByApplication.set(payment.application_id, payment.status as 'pending' | 'approved' | 'rejected')
        }
    }
    const enrolledApplicationIds = new Set((enrollmentsResult.data ?? []).map((enrollment) => enrollment.application_id))

    const applications = rawApplications.map((application) => {
        const cohort = first(application.cohort)
        const tuition = cohort?.tuition_amount_mnt ?? null
        const paymentStatus: AdminCohortApplication['payment_status'] = application.status !== 'approved'
            ? 'not_required'
            : enrolledApplicationIds.has(application.id)
                ? 'approved'
                : tuition === 0
                    ? 'approved'
                    : latestPaymentByApplication.get(application.id) ?? 'awaiting_receipt'
        return {
            ...application,
            applicant: first(application.applicant),
            cohort: cohort ? { ...cohort, program: first(cohort.program) } : null,
            contract: first(application.contract),
            contract_snapshot: first(application.contract_snapshot),
            payment_status: paymentStatus,
        }
    }) as AdminCohortApplication[]

    return {
        applications,
        variableLabels: Object.fromEntries((variablesResult.data ?? []).map((variable) => [variable.key, variable.label_mn])),
    }
}

export async function getAdminCohortApplicationSnapshot(applicationId: string) {
    assertUuid(applicationId)
    const supabase = await requireAdmin()
    const [snapshotResult, variablesResult] = await Promise.all([
        supabase
            .from('cohort_application_contract_snapshots')
            .select(`
                id,
                application_id,
                applicant_user_id,
                cohort_id,
                contract_version_id,
                contract_title,
                contract_version_number,
                contract_number,
                contract_date,
                contract_content,
                required_variable_keys,
                unresolved_variable_keys,
                resolved_values,
                application_answers,
                application_details,
                program_details,
                academy_details,
                created_by,
                created_at
            `)
            .eq('application_id', applicationId)
            .maybeSingle(),
        supabase
            .from('contract_variables')
            .select('key, label_mn'),
    ])

    if (snapshotResult.error || variablesResult.error) {
        console.error('Unable to load contract snapshot audit:', snapshotResult.error?.message ?? variablesResult.error?.message)
        throw new Error('Гэрээний түгжигдсэн эхийг уншиж чадсангүй.')
    }

    return {
        snapshot: snapshotResult.data
            ? parseAdminApprovedApplicationContractSnapshot(snapshotResult.data)
            : null,
        variableLabels: Object.fromEntries(
            (variablesResult.data ?? []).map((variable) => [variable.key, variable.label_mn]),
        ),
    }
}

export async function reviewCohortApplication(applicationId: string, decision: 'approved' | 'rejected', rejectionReason?: string) {
    assertUuid(applicationId)
    const supabase = await requireAdmin()
    const { error } = await supabase.rpc('review_cohort_application', {
        p_application_id: applicationId,
        p_decision: decision,
        p_rejection_reason: rejectionReason?.trim() || null,
    })

    if (error) {
        console.error('Unable to review cohort application:', error.message)
        if (error.message.includes('capacity')) throw new Error('Энэ ээлжийн зөвшөөрөгдсөн суралцагчийн тоо суудлын хязгаарт хүрсэн байна.')
        if (error.message.includes('reason')) throw new Error('Буцаах шалтгааныг оруулна уу.')
        if (error.message.includes('Contract variables are unresolved')) {
            throw new Error('Гэрээний шаардлагатай мэдээлэл бүрэн биш байна. Хөтөлбөр, ээлж болон гэрээ байгуулагчийн тохиргоог шалгана уу.')
        }
        throw new Error('Өргөдлийн шийдвэрийг хадгалж чадсангүй.')
    }

    const { data: application, error: recipientError } = await supabase
        .from('cohort_applications')
        .select(`
            contact_email, payment_due_at, answers,
            cohort:training_cohorts!cohort_applications_cohort_id_fkey (
                id, name, tuition_amount_mnt,
                program:training_programs!training_cohorts_program_id_fkey ( name )
            )
        `)
        .eq('id', applicationId)
        .maybeSingle()

    let notificationError: string | undefined
    const cohort = application ? first(application.cohort) : null
    const program = cohort ? first(cohort.program) : null
    if (recipientError || !application || !cohort || !program) {
        console.error('Application decision saved but recipient data could not be loaded:', recipientError?.message)
        notificationError = 'Шийдвэр хадгалагдсан боловч имэйл мэдээллийг уншиж чадсангүй.'
    } else {
        const notification = await sendCohortApplicationDecisionEmail({
            to: application.contact_email,
            recipientName: application.answers?.student_name || 'Суралцагч',
            programName: program.name,
            cohortName: cohort.name,
            cohortId: cohort.id,
            decision,
            amountMnt: cohort.tuition_amount_mnt,
            paymentDueAt: application.payment_due_at,
            rejectionReason,
        })
        if (!notification.sent) notificationError = notification.error
    }

    revalidatePath('/admin/applications')
    revalidatePath('/programs')
    if (cohort) revalidatePath(`/programs/${cohort.id}`)
    return {
        success: decision === 'approved' ? 'Өргөдлийг зөвшөөрлөө.' : 'Өргөдлийг шалтгаантайгаар буцаалаа.',
        notificationError,
    }
}
