'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    assertCohortTransition,
    cohortStatuses,
    getCohortOpeningReadiness,
    validateTrainingCohortInput,
    validateTrainingProgramInput,
    type CohortStatus,
    type CohortOpeningIssue,
    type ContractPolicy,
    type DeliveryMode,
} from '@/features/programs/domain/training-program'

export type TrainingCohort = {
    id: string
    program_id: string
    name: string
    delivery_mode: DeliveryMode
    status: CohortStatus
    checkout_version: 1 | 2
    course_id: string | null
    contract_policy: ContractPolicy
    contract_version_id: string | null
    capacity: number | null
    display_capacity: number | null
    configuration_revision: number
    tuition_amount_mnt: number | null
    payment_due_days: number | null
    payment_plan: string
    schedule_summary: string
    location: string
    registration_opens_at: string | null
    registration_closes_at: string | null
    starts_on: string | null
    ends_on: string | null
    created_at: string
    updated_at: string
}

export type TrainingProgramSummary = {
    id: string
    name: string
    description: string
    is_archived: boolean
    created_at: string
    updated_at: string
    cohortCount: number
    openCohortCount: number
}

export type TrainingProgramDetail = Omit<TrainingProgramSummary, 'cohortCount' | 'openCohortCount'> & {
    cohorts: TrainingCohort[]
}

export type PublishedContractOption = {
    id: string
    title: string
    version_number: number
    template_id: string
    template_name: string
    is_assignable: boolean
}

export type OfferingCourseOption = {
    id: string
    title: string
    published: boolean
    is_ready_for_offering: boolean
}

type OfferingCourseReadinessRecord = {
    published: boolean
    lessons: Array<{
        lesson_videos: Array<{ playback_status: string }> | { playback_status: string } | null
    }> | null
}

function isCourseReadyForOffering(course: OfferingCourseReadinessRecord | null | undefined) {
    return course?.published === true && (course.lessons ?? []).some((lesson) => {
        const videos = Array.isArray(lesson.lesson_videos)
            ? lesson.lesson_videos
            : lesson.lesson_videos
                ? [lesson.lesson_videos]
                : []
        return videos.some((video) => video.playback_status === 'ready')
    })
}

function cohortOpeningIssueMessage(issue: CohortOpeningIssue) {
    const messages: Record<CohortOpeningIssue, string> = {
        program_archived: 'Архивласан хөтөлбөрийн элсэлтийг нээх боломжгүй.',
        unsupported_delivery_mode: 'Шинэ элсэлтийн сургалтын хэлбэр онлайн эсвэл танхим байх ёстой.',
        course_not_ready: 'Холбосон хичээл нийтлэгдсэн бөгөөд дор хаяж нэг бэлэн видео агуулгатай байх ёстой.',
        contract_not_assignable: 'Гэрээ шаардлагатай элсэлтэд идэвхтэй нийтлэгдсэн гэрээ сонгоно уу.',
        contract_not_allowed: 'Гэрээ шаардлагагүй элсэлтэд гэрээний хувилбар холбоотой байж болохгүй.',
        tuition_not_configured: 'Элсэлт нээхийн өмнө сургалтын төлбөрийг тохируулна уу.',
        payment_deadline_not_configured: 'Төлбөртэй элсэлтэд төлөх хугацааг тохируулна уу.',
    }
    return messages[issue]
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
    return { supabase, user }
}

function assertUuid(value: string, label: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error(`${label} буруу байна.`)
    }
}

function refreshPrograms(programId?: string) {
    revalidatePath('/admin/programs')
    if (programId) revalidatePath(`/admin/programs/${programId}`)
}

function programInput(formData: FormData) {
    return validateTrainingProgramInput({
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
    })
}

function cohortInput(formData: FormData, checkoutVersion: 1 | 2) {
    return validateTrainingCohortInput({
        name: String(formData.get('name') ?? ''),
        deliveryMode: String(formData.get('delivery_mode') ?? ''),
        courseId: String(formData.get('course_id') ?? ''),
        contractPolicy: String(formData.get('contract_policy') ?? ''),
        contractVersionId: String(formData.get('contract_version_id') ?? ''),
        capacity: String(formData.get('capacity') ?? ''),
        tuitionAmountMnt: String(formData.get('tuition_amount_mnt') ?? ''),
        paymentDueDays: String(formData.get('payment_due_days') ?? ''),
        paymentPlan: String(formData.get('payment_plan') ?? ''),
        scheduleSummary: String(formData.get('schedule_summary') ?? ''),
        location: String(formData.get('location') ?? ''),
        registrationOpensAt: String(formData.get('registration_opens_at') ?? ''),
        registrationClosesAt: String(formData.get('registration_closes_at') ?? ''),
        startsOn: String(formData.get('starts_on') ?? ''),
        endsOn: String(formData.get('ends_on') ?? ''),
    }, checkoutVersion)
}

function cohortRecord(input: ReturnType<typeof cohortInput>, checkoutVersion: 1 | 2) {
    return {
        name: input.name,
        delivery_mode: input.deliveryMode,
        course_id: input.courseId,
        contract_policy: input.contractPolicy,
        contract_version_id: input.contractVersionId,
        capacity: checkoutVersion === 1 ? input.capacity : null,
        display_capacity: checkoutVersion === 2 ? input.capacity : null,
        tuition_amount_mnt: input.tuitionAmountMnt,
        payment_due_days: input.paymentDueDays,
        payment_plan: input.paymentPlan,
        schedule_summary: input.scheduleSummary,
        location: input.location,
        registration_opens_at: input.registrationOpensAt,
        registration_closes_at: input.registrationClosesAt,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
    }
}

export async function getTrainingProgramSummaries(): Promise<TrainingProgramSummary[]> {
    const { supabase } = await requireAdmin()
    const [programsResult, cohortsResult] = await Promise.all([
        supabase
            .from('training_programs')
            .select('id, name, description, is_archived, created_at, updated_at')
            .order('updated_at', { ascending: false }),
        supabase.from('training_cohorts').select('program_id, status'),
    ])

    if (programsResult.error || cohortsResult.error) {
        console.error('Unable to load training programs:', programsResult.error?.message ?? cohortsResult.error?.message)
        throw new Error('Хөтөлбөрүүдийг уншиж чадсангүй.')
    }

    const counts = new Map<string, { all: number; open: number }>()
    for (const cohort of cohortsResult.data ?? []) {
        const current = counts.get(cohort.program_id) ?? { all: 0, open: 0 }
        current.all += 1
        if (cohort.status === 'open') current.open += 1
        counts.set(cohort.program_id, current)
    }

    return (programsResult.data ?? []).map((program) => ({
        ...program,
        cohortCount: counts.get(program.id)?.all ?? 0,
        openCohortCount: counts.get(program.id)?.open ?? 0,
    })) as TrainingProgramSummary[]
}

export async function getTrainingProgram(programId: string): Promise<TrainingProgramDetail | null> {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const [programResult, cohortsResult] = await Promise.all([
        supabase
            .from('training_programs')
            .select('id, name, description, is_archived, created_at, updated_at')
            .eq('id', programId)
            .maybeSingle(),
        supabase
            .from('training_cohorts')
            .select('id, program_id, name, delivery_mode, status, checkout_version, course_id, contract_policy, contract_version_id, capacity, display_capacity, configuration_revision, tuition_amount_mnt, payment_due_days, payment_plan, schedule_summary, location, registration_opens_at, registration_closes_at, starts_on, ends_on, created_at, updated_at')
            .eq('program_id', programId)
            .order('created_at', { ascending: false }),
    ])

    if (programResult.error || cohortsResult.error) {
        console.error('Unable to load training program:', programResult.error?.message ?? cohortsResult.error?.message)
        throw new Error('Хөтөлбөрийн мэдээллийг уншиж чадсангүй.')
    }
    if (!programResult.data) return null
    return { ...programResult.data, cohorts: (cohortsResult.data ?? []) as TrainingCohort[] } as TrainingProgramDetail
}

export async function getOfferingCourseOptions(): Promise<OfferingCourseOption[]> {
    const { supabase } = await requireAdmin()
    const { data, error } = await supabase
        .from('courses')
        .select(`
            id,
            title,
            published,
            lessons (
                id,
                lesson_videos ( playback_status )
            )
        `)
        .order('title')

    if (error) {
        console.error('Unable to load offering course options:', error.message)
        throw new Error('Видео хичээлийн багцуудыг уншиж чадсангүй.')
    }

    return (data ?? []).map((course) => ({
        id: course.id,
        title: course.title,
        published: course.published,
        is_ready_for_offering: isCourseReadyForOffering(course),
    }))
}

export async function getPublishedContractOptions(): Promise<PublishedContractOption[]> {
    const { supabase } = await requireAdmin()
    const [versionsResult, templatesResult] = await Promise.all([
        supabase
            .from('contract_template_versions')
            .select('id, title, version_number, template_id, status')
            .in('status', ['published', 'retired'])
            .order('published_at', { ascending: false }),
        supabase
            .from('contract_templates')
            .select('id, name, is_archived'),
    ])

    if (versionsResult.error || templatesResult.error) throw new Error('Нийтлэгдсэн гэрээнүүдийг уншиж чадсангүй.')
    const templates = new Map((templatesResult.data ?? []).map((template) => [template.id, template]))
    return (versionsResult.data ?? [])
        .filter((version) => templates.has(version.template_id))
        .map((version) => {
            const template = templates.get(version.template_id)!
            return {
                id: version.id,
                title: version.title,
                version_number: version.version_number,
                template_id: version.template_id,
                template_name: template.name,
                is_assignable: version.status === 'published' && !template.is_archived,
            }
        })
}

export async function createTrainingProgram(formData: FormData) {
    const { supabase, user } = await requireAdmin()
    const input = programInput(formData)
    const { data, error } = await supabase
        .from('training_programs')
        .insert({ ...input, created_by: user.id })
        .select('id')
        .single()

    if (error) {
        if (error.code === '23505') throw new Error('Ижил нэртэй хөтөлбөр аль хэдийн байна.')
        console.error('Unable to create training program:', error.message)
        throw new Error('Хөтөлбөр үүсгэж чадсангүй.')
    }
    refreshPrograms(data.id)
    return { programId: data.id }
}

export async function updateTrainingProgram(programId: string, formData: FormData) {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const input = programInput(formData)
    const { error } = await supabase.from('training_programs').update(input).eq('id', programId)
    if (error) {
        if (error.code === '23505') throw new Error('Ижил нэртэй хөтөлбөр аль хэдийн байна.')
        throw new Error('Хөтөлбөрийн мэдээллийг хадгалж чадсангүй.')
    }
    refreshPrograms(programId)
}

export async function setTrainingProgramArchived(programId: string, archived: boolean) {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase.from('training_programs').update({ is_archived: archived }).eq('id', programId)
    if (error) throw new Error('Хөтөлбөрийн төлөвийг өөрчилж чадсангүй.')
    refreshPrograms(programId)
}

export async function deleteTrainingProgram(programId: string) {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase.from('training_programs').delete().eq('id', programId)
    if (error) throw new Error(error.code === '23503'
        ? 'Элсэлтийн түүхтэй хөтөлбөрийг устгах боломжгүй. Архивлана уу.'
        : 'Хөтөлбөрийг устгаж чадсангүй.')
    refreshPrograms()
}

export async function createTrainingCohort(programId: string, formData: FormData) {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase, user } = await requireAdmin()
    const input = cohortInput(formData, 2)
    const { data, error } = await supabase
        .from('training_cohorts')
        .insert({
            ...cohortRecord(input, 2),
            program_id: programId,
            checkout_version: 2,
            status: 'draft',
            created_by: user.id,
            status_changed_by: user.id,
        })
        .select('id')
        .single()

    if (error) {
        if (error.code === '23505') throw new Error('Энэ хөтөлбөрт ижил нэртэй элсэлт аль хэдийн байна.')
        if (error.message.includes('archived program')) throw new Error('Архивласан хөтөлбөрт шинэ элсэлт үүсгэх боломжгүй.')
        console.error('Unable to create training cohort:', error.message)
        throw new Error('Элсэлтийн ноорог үүсгэж чадсангүй.')
    }
    refreshPrograms(programId)
    return { cohortId: data.id }
}

export async function updateTrainingCohortDraft(cohortId: string, programId: string, formData: FormData) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const { data: current, error: currentError } = await supabase
        .from('training_cohorts')
        .select('checkout_version')
        .eq('id', cohortId)
        .eq('program_id', programId)
        .eq('status', 'draft')
        .maybeSingle()
    if (currentError || !current) throw new Error('Зөвхөн ноорог элсэлтийн мэдээллийг засах боломжтой.')

    const input = cohortInput(formData, current.checkout_version as 1 | 2)
    const { data, error } = await supabase
        .from('training_cohorts')
        .update(cohortRecord(input, current.checkout_version as 1 | 2))
        .eq('id', cohortId)
        .eq('program_id', programId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle()

    if (error || !data) {
        console.error('Unable to update training cohort:', error?.message)
        throw new Error('Зөвхөн ноорог элсэлтийн мэдээллийг засах боломжтой.')
    }
    refreshPrograms(programId)
}

export async function updateTrainingCohortConfiguration(cohortId: string, programId: string, formData: FormData) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const { data: current, error: currentError } = await supabase
        .from('training_cohorts')
        .select('id, program_id, name, delivery_mode, status, checkout_version, course_id, contract_policy, contract_version_id, display_capacity, configuration_revision, tuition_amount_mnt, payment_due_days, payment_plan, schedule_summary, location, registration_opens_at, registration_closes_at, starts_on, ends_on')
        .eq('id', cohortId)
        .eq('program_id', programId)
        .maybeSingle()

    if (currentError || !current || current.checkout_version !== 2 || !['open', 'closed'].includes(current.status)) {
        throw new Error('Зөвхөн нээлттэй эсвэл хаалттай шинэ урсгалын элсэлтийн нөхцөлийг засах боломжтой.')
    }

    const merged = new FormData()
    merged.set('name', String(formData.get('name') ?? current.name))
    merged.set('delivery_mode', current.delivery_mode)
    merged.set('course_id', current.course_id ?? '')
    merged.set('contract_policy', current.contract_policy)
    merged.set('contract_version_id', current.contract_version_id ?? '')
    for (const key of [
        'capacity',
        'tuition_amount_mnt',
        'payment_due_days',
        'payment_plan',
        'schedule_summary',
        'location',
        'registration_opens_at',
        'registration_closes_at',
        'starts_on',
        'ends_on',
    ]) {
        merged.set(key, String(formData.get(key) ?? ''))
    }
    const input = cohortInput(merged, 2)
    const expectedRevision = Number(formData.get('configuration_revision'))
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
        throw new Error('Өөрчлөлтийн хувилбар буруу байна. Хуудсыг дахин ачаална уу.')
    }

    const { error } = await supabase.rpc('update_v2_course_offering_configuration', {
        p_offering_id: cohortId,
        p_expected_revision: expectedRevision,
        p_name: input.name,
        p_display_capacity: input.capacity,
        p_tuition_amount_mnt: input.tuitionAmountMnt,
        p_payment_due_days: input.paymentDueDays,
        p_payment_plan: input.paymentPlan,
        p_schedule_summary: input.scheduleSummary,
        p_location: input.location,
        p_registration_opens_at: input.registrationOpensAt,
        p_registration_closes_at: input.registrationClosesAt,
        p_starts_on: input.startsOn,
        p_ends_on: input.endsOn,
        p_reason: String(formData.get('change_reason') ?? ''),
    })

    if (error) {
        console.error('Unable to update V2 offering configuration:', error.message)
        if (error.message.includes('changed by another administrator')) {
            throw new Error('Өөр админ энэ элсэлтийг өөрчилсөн байна. Хуудсыг дахин ачаалаад шалгана уу.')
        }
        if (error.message.includes('change reason')) throw new Error('Өөрчлөлтийн шалтгааныг дор хаяж 5 тэмдэгтээр бичнэ үү.')
        if (error.code === '23505') throw new Error('Энэ сургалтад ижил нэртэй элсэлт аль хэдийн байна.')
        throw new Error('Элсэлтийн шинэ нөхцөлийг хадгалж чадсангүй.')
    }
    refreshPrograms(programId)
}

export async function changeTrainingCohortStatus(cohortId: string, programId: string, nextStatus: CohortStatus) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    if (!cohortStatuses.includes(nextStatus)) throw new Error('Элсэлтийн төлөв буруу байна.')
    const { supabase } = await requireAdmin()
    const { data: current, error: readError } = await supabase
        .from('training_cohorts')
        .select('status, checkout_version, delivery_mode, course_id, contract_policy, contract_version_id, tuition_amount_mnt, payment_due_days')
        .eq('id', cohortId)
        .eq('program_id', programId)
        .maybeSingle()

    if (readError || !current) throw new Error('Элсэлт олдсонгүй.')
    assertCohortTransition(current.status as CohortStatus, nextStatus)

    if (nextStatus === 'open') {
        const { data: program, error: programError } = await supabase
            .from('training_programs')
            .select('is_archived')
            .eq('id', programId)
            .maybeSingle()
        if (programError || !program) throw new Error('Хөтөлбөр олдсонгүй.')

        let courseIsReady = current.checkout_version === 1
        if (current.checkout_version === 2 && current.course_id) {
            const { data: course, error: courseError } = await supabase
                .from('courses')
                .select(`
                    published,
                    lessons (
                        lesson_videos ( playback_status )
                    )
                `)
                .eq('id', current.course_id)
                .maybeSingle()
            if (courseError) throw new Error('Холбосон видео хичээлийг шалгаж чадсангүй.')
            courseIsReady = isCourseReadyForOffering(course)
        }

        let contractVersionIsAssignable = false
        if (current.contract_policy === 'required' && current.contract_version_id) {
            const { data: version, error: versionError } = await supabase
                .from('contract_template_versions')
                .select('status, template_id')
                .eq('id', current.contract_version_id)
                .maybeSingle()
            if (!versionError && version?.status === 'published') {
                const { data: template, error: templateError } = await supabase
                    .from('contract_templates')
                    .select('is_archived')
                    .eq('id', version.template_id)
                    .maybeSingle()
                contractVersionIsAssignable = !templateError && template?.is_archived === false
            }
        }

        const readiness = getCohortOpeningReadiness({
            checkoutVersion: current.checkout_version as 1 | 2,
            deliveryMode: current.delivery_mode as DeliveryMode,
            contractPolicy: current.contract_policy as ContractPolicy,
            hasContractVersion: current.contract_version_id !== null,
            contractVersionIsAssignable,
            courseIsReady,
            tuitionAmountMnt: current.tuition_amount_mnt,
            paymentDueDays: current.payment_due_days,
            programIsArchived: program.is_archived,
        })
        if (!readiness.isReady) {
            throw new Error(cohortOpeningIssueMessage(readiness.issues[0]!))
        }
    }

    const { error } = await supabase.from('training_cohorts').update({ status: nextStatus }).eq('id', cohortId)
    if (error) {
        if (error.message.includes('linked course') || error.message.includes('reusable course')) throw new Error('Элсэлт нээхийн өмнө видео хичээлийн багцыг холбоно уу.')
        if (error.message.includes('published') && error.message.includes('video')) throw new Error('Холбосон хичээл нийтлэгдсэн бөгөөд дор хаяж нэг бэлэн видео агуулгатай байх ёстой.')
        if (error.message.includes('contract')) throw new Error('Элсэлт нээхийн өмнө гэрээний бодлого болон гэрээний хувилбарыг шалгана уу.')
        if (error.message.includes('archived program')) throw new Error('Архивласан хөтөлбөрийн элсэлтийг нээх боломжгүй.')
        if (error.message.includes('atomic cancellation workflow')) throw new Error('Идэвхтэй хүсэлт, төлбөр эсвэл хичээл үзэх эрхтэй элсэлтийг тусгай цуцлалтын ажиллагаагүйгээр цуцлах боломжгүй.')
        console.error('Unable to change cohort status:', error.message)
        throw new Error('Элсэлтийн төлөвийг өөрчилж чадсангүй.')
    }
    refreshPrograms(programId)
}

export async function deleteTrainingCohortDraft(cohortId: string, programId: string) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase
        .from('training_cohorts')
        .delete()
        .eq('id', cohortId)
        .eq('program_id', programId)
        .eq('status', 'draft')
    if (error) throw new Error('Зөвхөн ноорог элсэлтийг устгах боломжтой.')
    refreshPrograms(programId)
}
