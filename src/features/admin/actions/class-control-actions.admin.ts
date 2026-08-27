'use server'

import { createClient } from '@/lib/supabase/server'
import {
    deriveClassType,
    type DisplayClassType,
} from '@/features/classes/domain/class-type'
import type {
    CohortStatus,
    ContractPolicy,
    DeliveryMode,
} from '@/features/programs/domain/training-program'

export type AdminClassSummary = {
    id: string
    programId: string
    programName: string
    programArchived: boolean
    name: string
    classType: DisplayClassType
    status: CohortStatus
    checkoutVersion: 1 | 2
    deliveryMode: DeliveryMode
    contractPolicy: ContractPolicy
    courseId: string | null
    courseTitle: string | null
    contractVersionId: string | null
    contractTitle: string | null
    tuitionAmountMnt: number | null
    capacity: number | null
    registrationOpensAt: string | null
    registrationClosesAt: string | null
    startsOn: string | null
    endsOn: string | null
    scheduleSummary: string
    location: string
    qpayEnabled: boolean
    manualTransferEnabled: boolean
    teacherName: string | null
    sessionCount: number
    createdAt: string
    updatedAt: string
    applicationCount: number
    activeCheckoutCount: number
    pendingPaymentCount: number
    paymentIssueCount: number
    paidPaymentCount: number
    activeEnrollmentCount: number
    attentionCount: number
}

export type AdminClassStudent = {
    applicationId: string
    learnerName: string
    contactEmail: string
    applicationStatus: string
    paymentStatus: string | null
    enrollmentStatus: string | null
    createdAt: string
}

export type AdminClassControl = AdminClassSummary & {
    students: AdminClassStudent[]
    configurationChanges: Array<{
        revision: number
        reason: string
        changedAt: string
    }>
    sessions: Array<{
        id: string
        title: string
        startsAt: string
        endsAt: string
        meetingUrl: string | null
        location: string
    }>
}

type CohortRow = {
    id: string
    program_id: string
    name: string
    class_type: string | null
    delivery_mode: DeliveryMode
    status: CohortStatus
    checkout_version: 1 | 2
    course_id: string | null
    contract_policy: ContractPolicy
    contract_version_id: string | null
    capacity: number | null
    display_capacity: number | null
    tuition_amount_mnt: number | null
    schedule_summary: string
    location: string
    registration_opens_at: string | null
    registration_closes_at: string | null
    starts_on: string | null
    ends_on: string | null
    qpay_enabled: boolean
    manual_transfer_enabled: boolean
    created_at: string
    updated_at: string
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Админаар нэвтэрнэ үү.')

    const { data: role, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')
    return supabase
}

function countBy<T>(rows: T[], predicate: (row: T) => boolean) {
    return rows.reduce((count, row) => count + (predicate(row) ? 1 : 0), 0)
}

export async function getAdminClassSummaries(): Promise<AdminClassSummary[]> {
    const supabase = await requireAdmin()
    const { data: cohortData, error: cohortsError } = await supabase
        .from('training_cohorts')
        .select('id, program_id, name, class_type, delivery_mode, status, checkout_version, course_id, contract_policy, contract_version_id, capacity, display_capacity, tuition_amount_mnt, schedule_summary, location, registration_opens_at, registration_closes_at, starts_on, ends_on, qpay_enabled, manual_transfer_enabled, created_at, updated_at')
        .order('updated_at', { ascending: false })

    if (cohortsError) {
        console.error('Unable to load class records:', cohortsError.message)
        throw new Error('Ангиудыг уншиж чадсангүй.')
    }

    const cohorts = (cohortData ?? []) as CohortRow[]
    if (cohorts.length === 0) return []

    const cohortIds = cohorts.map((cohort) => cohort.id)
    const programIds = [...new Set(cohorts.map((cohort) => cohort.program_id))]
    const courseIds = [...new Set(cohorts.map((cohort) => cohort.course_id).filter((id): id is string => Boolean(id)))]
    const contractIds = [...new Set(cohorts.map((cohort) => cohort.contract_version_id).filter((id): id is string => Boolean(id)))]

    const [
        programsResult,
        coursesResult,
        contractsResult,
        applicationsResult,
        paymentsResult,
        enrollmentsResult,
        legacyApplicationsResult,
        legacyPaymentsResult,
        legacyEnrollmentsResult,
        assignmentsResult,
        sessionsResult,
    ] = await Promise.all([
        supabase.from('training_programs').select('id, name, is_archived').in('id', programIds),
        courseIds.length > 0
            ? supabase.from('courses').select('id, title').in('id', courseIds)
            : Promise.resolve({ data: [], error: null }),
        contractIds.length > 0
            ? supabase.from('contract_template_versions').select('id, title, version_number').in('id', contractIds)
            : Promise.resolve({ data: [], error: null }),
        supabase.from('course_offering_applications').select('offering_id, status').in('offering_id', cohortIds),
        supabase.from('course_offering_payments').select('offering_id, status').in('offering_id', cohortIds),
        supabase.from('course_offering_enrollments').select('offering_id, status').in('offering_id', cohortIds),
        supabase.from('cohort_applications').select('cohort_id, status').in('cohort_id', cohortIds),
        supabase.from('cohort_payment_requests').select('cohort_id, status').in('cohort_id', cohortIds),
        supabase.from('cohort_enrollments').select('cohort_id, status').in('cohort_id', cohortIds),
        supabase.from('class_teacher_assignments').select('class_id, teacher_user_id').in('class_id', cohortIds).is('ended_at', null),
        supabase.from('class_sessions').select('class_id').in('class_id', cohortIds),
    ])

    const firstError = [
        programsResult.error,
        coursesResult.error,
        contractsResult.error,
        applicationsResult.error,
        paymentsResult.error,
        enrollmentsResult.error,
        legacyApplicationsResult.error,
        legacyPaymentsResult.error,
        legacyEnrollmentsResult.error,
        assignmentsResult.error,
        sessionsResult.error,
    ].find(Boolean)
    if (firstError) {
        console.error('Unable to load class control data:', firstError.message)
        throw new Error('Ангийн удирдлагын мэдээллийг уншиж чадсангүй.')
    }

    const programs = new Map((programsResult.data ?? []).map((program) => [program.id, program]))
    const courses = new Map((coursesResult.data ?? []).map((course) => [course.id, course]))
    const contracts = new Map((contractsResult.data ?? []).map((contract) => [contract.id, contract]))
    const applications = applicationsResult.data ?? []
    const payments = paymentsResult.data ?? []
    const enrollments = enrollmentsResult.data ?? []
    const legacyApplications = legacyApplicationsResult.data ?? []
    const legacyPayments = legacyPaymentsResult.data ?? []
    const legacyEnrollments = legacyEnrollmentsResult.data ?? []
    const assignments = assignmentsResult.data ?? []
    const teacherIds = [...new Set(assignments.map((assignment) => assignment.teacher_user_id))]
    const teacherProfilesResult = teacherIds.length > 0
        ? await supabase.from('profiles').select('id, display_name').in('id', teacherIds)
        : { data: [], error: null }
    if (teacherProfilesResult.error) throw new Error('Багшийн мэдээллийг уншиж чадсангүй.')
    const teacherProfiles = new Map((teacherProfilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]))
    const sessions = sessionsResult.data ?? []

    return cohorts.map((cohort) => {
        const program = programs.get(cohort.program_id)
        const course = cohort.course_id ? courses.get(cohort.course_id) : null
        const contract = cohort.contract_version_id ? contracts.get(cohort.contract_version_id) : null
        const isCurrent = cohort.checkout_version === 2
        const classApplications = isCurrent
            ? applications.filter((row) => row.offering_id === cohort.id)
            : legacyApplications.filter((row) => row.cohort_id === cohort.id)
        const classPayments = isCurrent
            ? payments.filter((row) => row.offering_id === cohort.id)
            : legacyPayments.filter((row) => row.cohort_id === cohort.id)
        const classEnrollments = isCurrent
            ? enrollments.filter((row) => row.offering_id === cohort.id)
            : legacyEnrollments.filter((row) => row.cohort_id === cohort.id)
        const applicationStatuses = classApplications.map((row) => row.status as string)
        const paymentStatuses = classPayments.map((row) => row.status as string)
        const enrollmentStatuses = classEnrollments.map((row) => row.status as string)
        const assignment = assignments.find((row) => row.class_id === cohort.id)
        const pendingPaymentCount = countBy(paymentStatuses, (status) => ['created', 'pending'].includes(status))
        const paymentIssueCount = countBy(paymentStatuses, (status) => ['failed', 'rejected', 'expired'].includes(status))
        const activeCheckoutCount = countBy(applicationStatuses, (status) => ['draft', 'submitted'].includes(status))
        const attentionCount = pendingPaymentCount + paymentIssueCount + (cohort.status === 'draft' ? 1 : 0)

        return {
            id: cohort.id,
            programId: cohort.program_id,
            programName: program?.name ?? 'Нэргүй сургалт',
            programArchived: program?.is_archived ?? false,
            name: cohort.name,
            classType: deriveClassType({
                classType: cohort.class_type,
                deliveryMode: cohort.delivery_mode,
                contractPolicy: cohort.contract_policy,
            }),
            status: cohort.status,
            checkoutVersion: cohort.checkout_version,
            deliveryMode: cohort.delivery_mode,
            contractPolicy: cohort.contract_policy,
            courseId: cohort.course_id,
            courseTitle: course?.title ?? null,
            contractVersionId: cohort.contract_version_id,
            contractTitle: contract ? `${contract.title} · v${contract.version_number}` : null,
            tuitionAmountMnt: cohort.tuition_amount_mnt,
            capacity: cohort.checkout_version === 2 ? cohort.display_capacity : cohort.capacity,
            registrationOpensAt: cohort.registration_opens_at,
            registrationClosesAt: cohort.registration_closes_at,
            startsOn: cohort.starts_on,
            endsOn: cohort.ends_on,
            scheduleSummary: cohort.schedule_summary,
            location: cohort.location,
            qpayEnabled: cohort.qpay_enabled,
            manualTransferEnabled: cohort.manual_transfer_enabled,
            teacherName: assignment ? teacherProfiles.get(assignment.teacher_user_id) ?? 'Нэргүй багш' : null,
            sessionCount: sessions.filter((session) => session.class_id === cohort.id).length,
            createdAt: cohort.created_at,
            updatedAt: cohort.updated_at,
            applicationCount: classApplications.length,
            activeCheckoutCount,
            pendingPaymentCount,
            paymentIssueCount,
            paidPaymentCount: countBy(paymentStatuses, (status) => ['paid', 'approved'].includes(status)),
            activeEnrollmentCount: countBy(enrollmentStatuses, (status) => status === 'active'),
            attentionCount,
        }
    })
}

export async function getAdminClassControl(classId: string): Promise<AdminClassControl | null> {
    const classes = await getAdminClassSummaries()
    const summary = classes.find((item) => item.id === classId)
    if (!summary) return null

    const supabase = await requireAdmin()
    const changesPromise = supabase
        .from('course_offering_configuration_changes')
        .select('revision, reason, changed_at')
        .eq('offering_id', classId)
        .order('revision', { ascending: false })
        .limit(10)

    if (summary.checkoutVersion === 2) {
        const [applicationsResult, paymentsResult, enrollmentsResult, changesResult, sessionsResult] = await Promise.all([
            supabase
                .from('course_offering_applications')
                .select('id, learner_id, contact_email, status, created_at')
                .eq('offering_id', classId)
                .order('created_at', { ascending: false }),
            supabase
                .from('course_offering_payments')
                .select('application_id, status, created_at')
                .eq('offering_id', classId)
                .order('created_at', { ascending: false }),
            supabase
                .from('course_offering_enrollments')
                .select('application_id, status')
                .eq('offering_id', classId),
            changesPromise,
            supabase
                .from('class_sessions')
                .select('id, title, starts_at, ends_at, meeting_url, location')
                .eq('class_id', classId)
                .order('starts_at'),
        ])
        const firstError = applicationsResult.error ?? paymentsResult.error ?? enrollmentsResult.error ?? changesResult.error ?? sessionsResult.error
        if (firstError) throw new Error('Ангийн суралцагчдын мэдээллийг уншиж чадсангүй.')

        const applications = applicationsResult.data ?? []
        const learnerIds = [...new Set(applications.map((application) => application.learner_id))]
        const learnersResult = learnerIds.length > 0
            ? await supabase.from('learners').select('id, full_name').in('id', learnerIds)
            : { data: [], error: null }
        if (learnersResult.error) throw new Error('Суралцагчдын мэдээллийг уншиж чадсангүй.')
        const learners = new Map((learnersResult.data ?? []).map((learner) => [learner.id, learner.full_name]))
        const payments = paymentsResult.data ?? []
        const enrollments = enrollmentsResult.data ?? []

        return {
            ...summary,
            students: applications.map((application) => ({
                applicationId: application.id,
                learnerName: learners.get(application.learner_id) ?? 'Суралцагч',
                contactEmail: application.contact_email,
                applicationStatus: application.status,
                paymentStatus: payments.find((payment) => payment.application_id === application.id)?.status ?? null,
                enrollmentStatus: enrollments.find((enrollment) => enrollment.application_id === application.id)?.status ?? null,
                createdAt: application.created_at,
            })),
            configurationChanges: (changesResult.data ?? []).map((change) => ({
                revision: change.revision,
                reason: change.reason,
                changedAt: change.changed_at,
            })),
            sessions: (sessionsResult.data ?? []).map((session) => ({
                id: session.id,
                title: session.title,
                startsAt: session.starts_at,
                endsAt: session.ends_at,
                meetingUrl: session.meeting_url,
                location: session.location,
            })),
        }
    }

    const [applicationsResult, paymentsResult, enrollmentsResult, changesResult] = await Promise.all([
        supabase
            .from('cohort_applications')
            .select('id, contact_email, answers, status, created_at')
            .eq('cohort_id', classId)
            .order('created_at', { ascending: false }),
        supabase
            .from('cohort_payment_requests')
            .select('application_id, status, created_at')
            .eq('cohort_id', classId)
            .order('created_at', { ascending: false }),
        supabase
            .from('cohort_enrollments')
            .select('application_id, status')
            .eq('cohort_id', classId),
        changesPromise,
    ])
    const firstError = applicationsResult.error ?? paymentsResult.error ?? enrollmentsResult.error ?? changesResult.error
    if (firstError) throw new Error('Ангийн хуучин бүртгэлийг уншиж чадсангүй.')
    const payments = paymentsResult.data ?? []
    const enrollments = enrollmentsResult.data ?? []

    return {
        ...summary,
        students: (applicationsResult.data ?? []).map((application) => {
            const answers = (application.answers ?? {}) as Record<string, unknown>
            return {
                applicationId: application.id,
                learnerName: String(answers.student_name ?? answers.learner_full_name ?? 'Суралцагч'),
                contactEmail: application.contact_email,
                applicationStatus: application.status,
                paymentStatus: payments.find((payment) => payment.application_id === application.id)?.status ?? null,
                enrollmentStatus: enrollments.find((enrollment) => enrollment.application_id === application.id)?.status ?? null,
                createdAt: application.created_at,
            }
        }),
        configurationChanges: (changesResult.data ?? []).map((change) => ({
            revision: change.revision,
            reason: change.reason,
            changedAt: change.changed_at,
        })),
        sessions: [],
    }
}
