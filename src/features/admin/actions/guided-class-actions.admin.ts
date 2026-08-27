'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getQpayPublicState } from '@/lib/qpay/config'
import {
    classTypeRules,
    classTypes,
    type ClassType,
} from '@/features/classes/domain/class-type'
import { guidedClassReadiness } from '@/features/classes/domain/guided-class'
import {
    changeTrainingCohortStatus,
    getOfferingCourseOptions,
    getPublishedContractOptions,
} from '@/features/admin/actions/training-program-actions.admin'

export type GuidedClassDraft = {
    id: string
    programId: string
    name: string
    description: string
    classType: ClassType
    status: 'draft'
    courseId: string | null
    contractVersionId: string | null
    capacity: number | null
    tuitionAmountMnt: number | null
    paymentDueDays: number | null
    paymentPlan: string
    scheduleSummary: string
    location: string
    registrationOpensAt: string | null
    registrationClosesAt: string | null
    startsOn: string | null
    endsOn: string | null
    qpayEnabled: boolean
    manualTransferEnabled: boolean
    teacherUserId: string | null
    teacherName: string | null
    sessions: GuidedClassSession[]
    updatedAt: string
}

export type GuidedClassSession = {
    id: string
    title: string
    startsAt: string
    endsAt: string
    meetingUrl: string | null
    location: string
}

export type TeacherOption = {
    id: string
    name: string
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

function requiredText(formData: FormData, key: string, label: string, maxLength: number) {
    const value = String(formData.get(key) ?? '').trim()
    if (!value) throw new Error(`${label} оруулна уу.`)
    if (value.length > maxLength) throw new Error(`${label} ${maxLength} тэмдэгтээс урт байж болохгүй.`)
    return value
}

function optionalText(formData: FormData, key: string, label: string, maxLength: number) {
    const value = String(formData.get(key) ?? '').trim()
    if (value.length > maxLength) throw new Error(`${label} ${maxLength} тэмдэгтээс урт байж болохгүй.`)
    return value
}

function optionalUuid(formData: FormData, key: string, label: string) {
    const value = String(formData.get(key) ?? '')
    if (!value) return null
    assertUuid(value, label)
    return value
}

function positiveInteger(formData: FormData, key: string, label: string, optional = false) {
    const raw = String(formData.get(key) ?? '')
    if (!raw && optional) return null
    const value = Number(raw)
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} 0-ээс их бүхэл тоо байна.`)
    return value
}

function optionalDate(formData: FormData, key: string, label: string) {
    const value = String(formData.get(key) ?? '')
    if (!value) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} буруу байна.`)
    return value
}

function optionalDateTime(formData: FormData, key: string, label: string) {
    const value = String(formData.get(key) ?? '')
    if (!value) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) throw new Error(`${label} буруу байна.`)
    return parsed.toISOString()
}

function revalidateClass(classId: string, programId?: string) {
    revalidatePath('/admin/classes')
    revalidatePath(`/admin/classes/${classId}`)
    revalidatePath(`/admin/classes/${classId}/setup`)
    if (programId) revalidatePath(`/admin/programs/${programId}`)
}

export async function createGuidedClassDraft(formData: FormData) {
    const { supabase } = await requireAdmin()
    const name = requiredText(formData, 'name', 'Ангийн нэр', 160)
    const description = optionalText(formData, 'description', 'Тайлбар', 2_000)
    const classType = String(formData.get('class_type') ?? '')
    if (!classTypes.includes(classType as ClassType)) throw new Error('Ангийн төрлөө сонгоно уу.')

    const { data, error } = await supabase.rpc('create_guided_class_draft', {
        p_name: name,
        p_description: description,
        p_class_type: classType,
    })

    const result = Array.isArray(data) ? data[0] : data
    if (error || !result?.class_id) {
        if (error?.code === '23505') throw new Error('Ижил нэртэй анги аль хэдийн байна. Одоо байгаа ангийг нээнэ үү.')
        console.error('Unable to create guided class draft:', error?.message)
        throw new Error('Ангийн ноорог үүсгэж чадсангүй.')
    }

    revalidateClass(result.class_id, result.program_id)
    return { classId: result.class_id as string }
}

export async function getGuidedClassDraft(classId: string): Promise<GuidedClassDraft | null> {
    assertUuid(classId, 'Ангийн дугаар')
    const { supabase } = await requireAdmin()
    const { data: cohort, error } = await supabase
        .from('training_cohorts')
        .select('id, program_id, name, class_type, status, checkout_version, course_id, contract_version_id, display_capacity, tuition_amount_mnt, payment_due_days, payment_plan, schedule_summary, location, registration_opens_at, registration_closes_at, starts_on, ends_on, qpay_enabled, manual_transfer_enabled, updated_at')
        .eq('id', classId)
        .maybeSingle()

    if (error) throw new Error('Ангийн нооргийг уншиж чадсангүй.')
    if (!cohort || cohort.status !== 'draft' || cohort.checkout_version !== 2 || !classTypes.includes(cohort.class_type as ClassType)) return null

    const [programResult, assignmentResult, sessionsResult] = await Promise.all([
        supabase
            .from('training_programs')
            .select('name, description')
            .eq('id', cohort.program_id)
            .maybeSingle(),
        supabase
            .from('class_teacher_assignments')
            .select('teacher_user_id')
            .eq('class_id', classId)
            .is('ended_at', null)
            .maybeSingle(),
        supabase
            .from('class_sessions')
            .select('id, title, starts_at, ends_at, meeting_url, location')
            .eq('class_id', classId)
            .order('starts_at'),
    ])
    if (programResult.error || !programResult.data || assignmentResult.error || sessionsResult.error) {
        throw new Error('Ангийн ерөнхий мэдээллийг уншиж чадсангүй.')
    }
    const program = programResult.data
    const teacherUserId = assignmentResult.data?.teacher_user_id ?? null
    const teacherResult = teacherUserId
        ? await supabase.from('profiles').select('display_name').eq('id', teacherUserId).maybeSingle()
        : { data: null, error: null }
    if (teacherResult.error) throw new Error('Багшийн мэдээллийг уншиж чадсангүй.')

    return {
        id: cohort.id,
        programId: cohort.program_id,
        name: cohort.name,
        description: program.description,
        classType: cohort.class_type as ClassType,
        status: 'draft',
        courseId: cohort.course_id,
        contractVersionId: cohort.contract_version_id,
        capacity: cohort.display_capacity,
        tuitionAmountMnt: cohort.tuition_amount_mnt,
        paymentDueDays: cohort.payment_due_days,
        paymentPlan: cohort.payment_plan,
        scheduleSummary: cohort.schedule_summary,
        location: cohort.location,
        registrationOpensAt: cohort.registration_opens_at,
        registrationClosesAt: cohort.registration_closes_at,
        startsOn: cohort.starts_on,
        endsOn: cohort.ends_on,
        qpayEnabled: cohort.qpay_enabled,
        manualTransferEnabled: cohort.manual_transfer_enabled,
        teacherUserId,
        teacherName: teacherResult.data?.display_name ?? null,
        sessions: (sessionsResult.data ?? []).map((session) => ({
            id: session.id,
            title: session.title,
            startsAt: session.starts_at,
            endsAt: session.ends_at,
            meetingUrl: session.meeting_url,
            location: session.location,
        })),
        updatedAt: cohort.updated_at,
    }
}

export async function getTeacherOptions(): Promise<TeacherOption[]> {
    const { supabase } = await requireAdmin()
    const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher')
    if (rolesError) throw new Error('Багшийн жагсаалтыг уншиж чадсангүй.')
    const teacherIds = (roles ?? []).map((role) => role.user_id)
    if (teacherIds.length === 0) return []

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', teacherIds)
        .order('display_name')
    if (error) throw new Error('Багшийн жагсаалтыг уншиж чадсангүй.')
    return (profiles ?? []).map((profile) => ({
        id: profile.id,
        name: profile.display_name?.trim() || 'Нэргүй багш',
    }))
}

async function requireGuidedDraft(classId: string) {
    assertUuid(classId, 'Ангийн дугаар')
    const { supabase } = await requireAdmin()
    const { data: cohort, error } = await supabase
        .from('training_cohorts')
        .select('id, program_id, class_type, status, checkout_version')
        .eq('id', classId)
        .maybeSingle()

    if (error || !cohort || cohort.status !== 'draft' || cohort.checkout_version !== 2 || !classTypes.includes(cohort.class_type as ClassType)) {
        throw new Error('Зөвхөн шинэ ноорог ангийг энэ заавраар засна.')
    }
    return { supabase, cohort: { ...cohort, class_type: cohort.class_type as ClassType } }
}

export async function saveGuidedClassLearning(classId: string, formData: FormData) {
    const { supabase, cohort } = await requireGuidedDraft(classId)
    const courseId = optionalUuid(formData, 'course_id', 'Видео хичээл')
    const { error } = await supabase
        .from('training_cohorts')
        .update({ course_id: courseId })
        .eq('id', classId)
        .eq('status', 'draft')
    if (error) throw new Error('Видео хичээлийн сонголтыг хадгалж чадсангүй.')
    revalidateClass(classId, cohort.program_id)
}

export async function saveGuidedClassSchedule(classId: string, formData: FormData) {
    const { supabase, cohort } = await requireGuidedDraft(classId)
    const isSelfPaced = cohort.class_type === 'self_paced_online'
    const startsOn = optionalDate(formData, 'starts_on', 'Эхлэх өдөр')
    const endsOn = optionalDate(formData, 'ends_on', 'Дуусах өдөр')
    const scheduleSummary = isSelfPaced ? '' : requiredText(formData, 'schedule_summary', 'Хуваарь', 2_000)
    const location = cohort.class_type === 'offline_with_video'
        ? requiredText(formData, 'location', 'Танхимын байршил', 1_000)
        : ''

    if (!isSelfPaced && (!startsOn || !endsOn)) throw new Error('Багштай болон танхимын ангид эхлэх, дуусах өдрийг оруулна уу.')
    if (startsOn && endsOn && endsOn < startsOn) throw new Error('Дуусах өдөр эхлэх өдрөөс өмнө байж болохгүй.')

    if (!isSelfPaced) {
        const teacherUserId = optionalUuid(formData, 'teacher_user_id', 'Багш')
        if (!teacherUserId) throw new Error('Багшаа сонгоно уу.')
        const titles = formData.getAll('session_title').map((value) => String(value).trim())
        const starts = formData.getAll('session_starts_at').map(String)
        const ends = formData.getAll('session_ends_at').map(String)
        const meetingUrls = formData.getAll('session_meeting_url').map((value) => String(value).trim())
        const locations = formData.getAll('session_location').map((value) => String(value).trim())
        if (titles.length === 0 || starts.length !== titles.length || ends.length !== titles.length) {
            throw new Error('Дор хаяж нэг хичээлийн цаг оруулна уу.')
        }
        const sessions = titles.map((title, index) => {
            if (!title || title.length > 160) throw new Error(`${index + 1}-р хичээлийн нэр буруу байна.`)
            const sessionStart = new Date(starts[index])
            const sessionEnd = new Date(ends[index])
            if (Number.isNaN(sessionStart.getTime()) || Number.isNaN(sessionEnd.getTime()) || sessionEnd <= sessionStart) {
                throw new Error(`${index + 1}-р хичээлийн цаг буруу байна.`)
            }
            if (cohort.class_type === 'instructor_led_online' && meetingUrls[index] && !/^https:\/\/\S+$/i.test(meetingUrls[index])) {
                throw new Error(`${index + 1}-р хичээлийн холбоос https:// гэж эхэлнэ.`)
            }
            const sessionLocation = cohort.class_type === 'offline_with_video' ? (locations[index] || location) : ''
            if (cohort.class_type === 'offline_with_video' && !sessionLocation) {
                throw new Error(`${index + 1}-р хичээлийн байршлыг оруулна уу.`)
            }
            return {
                title,
                starts_at: sessionStart.toISOString(),
                ends_at: sessionEnd.toISOString(),
                meeting_url: cohort.class_type === 'instructor_led_online' ? meetingUrls[index] || null : null,
                location: sessionLocation,
            }
        })
        const { error } = await supabase.rpc('save_guided_class_schedule', {
            p_class_id: classId,
            p_teacher_user_id: teacherUserId,
            p_starts_on: startsOn,
            p_ends_on: endsOn,
            p_schedule_summary: scheduleSummary,
            p_location: location,
            p_sessions: sessions,
        })
        if (error) {
            console.error('Unable to save guided schedule:', error.message)
            throw new Error('Багш болон хичээлийн цагийг хадгалж чадсангүй.')
        }
        revalidateClass(classId, cohort.program_id)
        return
    }

    const { error } = await supabase
        .from('training_cohorts')
        .update({ starts_on: startsOn, ends_on: endsOn, schedule_summary: scheduleSummary, location })
        .eq('id', classId)
        .eq('status', 'draft')
    if (error) throw new Error('Хуваарь, байршлыг хадгалж чадсангүй.')
    revalidateClass(classId, cohort.program_id)
}

export async function saveGuidedClassPayment(classId: string, formData: FormData) {
    const { supabase, cohort } = await requireGuidedDraft(classId)
    const rules = classTypeRules[cohort.class_type]
    const tuitionAmountMnt = positiveInteger(formData, 'tuition_amount_mnt', 'Үнэ')
    const paymentDueDays = positiveInteger(formData, 'payment_due_days', 'Төлөх хугацаа')
    const capacity = positiveInteger(formData, 'capacity', 'Суралцагчийн тоо', true)
    const paymentPlan = optionalText(formData, 'payment_plan', 'Төлбөрийн тайлбар', 1_000)
    const registrationOpensAt = optionalDateTime(formData, 'registration_opens_at', 'Бүртгэл нээх хугацаа')
    const registrationClosesAt = optionalDateTime(formData, 'registration_closes_at', 'Бүртгэл хаах хугацаа')
    const qpayEnabled = formData.get('qpay_enabled') === 'on'
    const manualTransferEnabled = formData.get('manual_transfer_enabled') === 'on'
    const contractVersionId = rules.contractPolicy === 'required'
        ? optionalUuid(formData, 'contract_version_id', 'Гэрээ')
        : null

    if (rules.contractPolicy === 'required' && !contractVersionId) throw new Error('Нийтлэгдсэн гэрээ сонгоно уу.')
    if (!qpayEnabled && !manualTransferEnabled) throw new Error('Дор хаяж нэг төлбөрийн арга сонгоно уу.')
    if (registrationOpensAt && registrationClosesAt && registrationClosesAt < registrationOpensAt) {
        throw new Error('Бүртгэл хаах хугацаа нээх хугацаанаас өмнө байж болохгүй.')
    }

    const { error } = await supabase
        .from('training_cohorts')
        .update({
            contract_version_id: contractVersionId,
            display_capacity: capacity,
            tuition_amount_mnt: tuitionAmountMnt,
            payment_due_days: paymentDueDays,
            payment_plan: paymentPlan,
            registration_opens_at: registrationOpensAt,
            registration_closes_at: registrationClosesAt,
            qpay_enabled: qpayEnabled,
            manual_transfer_enabled: manualTransferEnabled,
        })
        .eq('id', classId)
        .eq('status', 'draft')

    if (error) {
        if (error.message.includes('published version')) throw new Error('Сонгосон гэрээ идэвхгүй болсон байна. Өөр нийтлэгдсэн гэрээ сонгоно уу.')
        throw new Error('Гэрээ, төлбөрийн тохиргоог хадгалж чадсангүй.')
    }
    revalidateClass(classId, cohort.program_id)
}

export async function publishGuidedClass(classId: string) {
    const draft = await getGuidedClassDraft(classId)
    if (!draft) throw new Error('Нийтлэх ноорог анги олдсонгүй.')
    const [coursesResult, contractsResult] = await Promise.all([
        getOfferingCourseOptions(),
        getPublishedContractOptions(),
    ])
    const selectedCourse = coursesResult.find((course) => course.id === draft.courseId)
    const selectedContract = contractsResult.find((contract) => contract.id === draft.contractVersionId)
    const readiness = guidedClassReadiness(draft, {
        courseReady: selectedCourse?.is_ready_for_offering === true,
        contractReady: selectedContract?.is_assignable === true,
        qpayAvailable: getQpayPublicState().enabled,
        teacherAssigned: Boolean(draft.teacherUserId),
        sessionsReady: draft.sessions.length > 0 && draft.sessions.every((session) => (
            draft.classType === 'instructor_led_online' ? Boolean(session.meetingUrl) : Boolean(session.location)
        )),
    })
    const incomplete = readiness.find((item) => !item.complete)
    if (incomplete) throw new Error(`${incomplete.label}: ${incomplete.help}`)

    await changeTrainingCohortStatus(classId, draft.programId, 'open')
    revalidateClass(classId, draft.programId)
}
