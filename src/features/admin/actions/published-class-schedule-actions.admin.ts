'use server'

import { revalidatePath } from 'next/cache'

import { sendClassScheduleChangedEmail } from '@/lib/email/class-schedule'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ParsedSession = {
    title: string
    starts_at: string
    ends_at: string
    meeting_url: string | null
    location: string
}

type NotificationRecipient = {
    applicationId: string
    userId: string
    email: string
    learnerName: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const academyLocalDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const notificationClaimTimeoutMs = 10 * 60 * 1000

function assertUuid(value: string, label: string) {
    if (!uuidPattern.test(value)) throw new Error(`${label} буруу байна.`)
}

function requiredText(formData: FormData, key: string, label: string, maxLength: number) {
    const value = String(formData.get(key) ?? '').trim()
    if (!value) throw new Error(`${label} оруулна уу.`)
    if (value.length > maxLength) throw new Error(`${label} ${maxLength} тэмдэгтээс урт байж болохгүй.`)
    return value
}

function requiredDate(formData: FormData, key: string, label: string) {
    const value = requiredText(formData, key, label, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} буруу байна.`)
    return value
}

function academyDateTimeToIso(value: string, label: string) {
    const normalized = academyLocalDateTimePattern.test(value) ? `${value}:00+08:00` : value
    const parsed = new Date(normalized)
    if (Number.isNaN(parsed.getTime())) throw new Error(`${label} буруу байна.`)
    return parsed.toISOString()
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Админаар нэвтэрнэ үү.')

    const { data: role, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')
    return supabase
}

function parseSessions(
    formData: FormData,
    classType: 'instructor_led_online' | 'offline_with_video',
    defaultLocation: string,
    startsOn: string,
    endsOn: string,
) {
    const titles = formData.getAll('session_title').map((value) => String(value).trim())
    const starts = formData.getAll('session_starts_at').map(String)
    const ends = formData.getAll('session_ends_at').map(String)
    const meetingUrls = formData.getAll('session_meeting_url').map((value) => String(value).trim())
    const locations = formData.getAll('session_location').map((value) => String(value).trim())

    if (titles.length === 0 || starts.length !== titles.length || ends.length !== titles.length
        || meetingUrls.length !== titles.length || locations.length !== titles.length) {
        throw new Error('Дор хаяж нэг хичээлийн цагийг бүрэн оруулна уу.')
    }

    return titles.map((title, index): ParsedSession => {
        if (!title || title.length > 160) throw new Error(`${index + 1}-р хичээлийн нэр буруу байна.`)
        const startsAt = academyDateTimeToIso(starts[index], `${index + 1}-р хичээлийн эхлэх цаг`)
        const endsAt = academyDateTimeToIso(ends[index], `${index + 1}-р хичээлийн дуусах цаг`)
        if (Date.parse(endsAt) <= Date.parse(startsAt) || Date.parse(startsAt) <= Date.now()) {
            throw new Error(`${index + 1}-р хичээлийн цаг ирээдүйд, зөв дараалалтай байна.`)
        }
        if (starts[index].slice(0, 10) < startsOn || ends[index].slice(0, 10) > endsOn) {
            throw new Error(`${index + 1}-р хичээл ангийн эхлэх, дуусах өдрийн хооронд байна.`)
        }
        if (classType === 'instructor_led_online' && !/^https:\/\/\S+$/i.test(meetingUrls[index])) {
            throw new Error(`${index + 1}-р хичээлийн онлайн холбоос https:// гэж эхэлнэ.`)
        }
        const location = classType === 'offline_with_video' ? locations[index] || defaultLocation : ''
        if (classType === 'offline_with_video' && !location) {
            throw new Error(`${index + 1}-р хичээлийн байршлыг оруулна уу.`)
        }
        return {
            title,
            starts_at: startsAt,
            ends_at: endsAt,
            meeting_url: classType === 'instructor_led_online' ? meetingUrls[index] : null,
            location,
        }
    })
}

async function loadNotificationRecipients(
    supabase: Awaited<ReturnType<typeof createClient>>,
    classId: string,
): Promise<NotificationRecipient[]> {
    const { data: enrollments, error: enrollmentError } = await supabase
        .from('course_offering_enrollments')
        .select('application_id, learner_id, content_access_user_id')
        .eq('offering_id', classId)
        .eq('status', 'active')
    if (enrollmentError) throw new Error('Суралцагчдын мэдэгдлийн мэдээллийг уншиж чадсангүй.')
    if (!enrollments?.length) return []

    const applicationIds = enrollments.map((row) => row.application_id)
    const learnerIds = [...new Set(enrollments.map((row) => row.learner_id))]
    const [applicationsResult, learnersResult] = await Promise.all([
        supabase.from('course_offering_applications').select('id, contact_email').in('id', applicationIds),
        supabase.from('learners').select('id, full_name').in('id', learnerIds),
    ])
    if (applicationsResult.error || learnersResult.error) {
        throw new Error('Суралцагчдын и-мэйл мэдээллийг уншиж чадсангүй.')
    }
    const applications = new Map((applicationsResult.data ?? []).map((row) => [row.id, row.contact_email]))
    const learners = new Map((learnersResult.data ?? []).map((row) => [row.id, row.full_name]))

    return enrollments.flatMap((enrollment) => {
        const email = applications.get(enrollment.application_id)
        if (!email) return []
        return [{
            applicationId: enrollment.application_id,
            userId: enrollment.content_access_user_id,
            email,
            learnerName: learners.get(enrollment.learner_id) ?? 'Суралцагч',
        }]
    })
}

async function deliverScheduleNotification({
    recipient,
    classId,
    className,
    revision,
    reason,
    sessions,
}: {
    recipient: NotificationRecipient
    classId: string
    className: string
    revision: number
    reason: string
    sessions: ParsedSession[]
}) {
    const admin = createAdminClient()
    const idempotencyKey = `class-schedule:${classId}:${revision}:${recipient.applicationId}`
    const { data: existing, error: existingError } = await admin
        .from('notification_outbox')
        .select('id, status, attempts, locked_at')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()
    if (existingError) throw new Error('Мэдэгдлийн бүртгэлийг уншиж чадсангүй.')

    let row = existing
    if (!row) {
        const { data: inserted, error: insertError } = await admin
            .from('notification_outbox')
            .insert({
                event_type: 'class.schedule_changed',
                aggregate_type: 'training_cohort',
                aggregate_id: classId,
                idempotency_key: idempotencyKey,
                recipient_kind: 'user',
                recipient_user_id: recipient.userId,
                recipient_email: recipient.email,
                payload: { class_name: className, revision, reason, sessions },
            })
            .select('id, status, attempts, locked_at')
            .single()
        if (insertError || !inserted) throw new Error('Мэдэгдлийн бүртгэл үүсгэж чадсангүй.')
        row = inserted
    }
    if (row.status === 'sent') return true

    const lockedAt = row.locked_at ? Date.parse(row.locked_at) : Number.NaN
    if (row.status === 'processing' && Number.isFinite(lockedAt) && Date.now() - lockedAt < notificationClaimTimeoutMs) {
        throw new Error('Мэдэгдлийг өөр процесс илгээж байна.')
    }

    const attempts = Number(row.attempts) + 1
    const now = new Date().toISOString()
    const { data: claimed, error: claimError } = await admin
        .from('notification_outbox')
        .update({ status: 'processing', attempts, locked_at: now, sent_at: null, last_error: null })
        .eq('id', row.id)
        .eq('status', row.status)
        .eq('attempts', row.attempts)
        .select('id')
        .maybeSingle()
    if (claimError || !claimed) throw new Error('Мэдэгдлийг илгээж эхэлж чадсангүй.')

    const result = await sendClassScheduleChangedEmail({
        to: recipient.email,
        learnerName: recipient.learnerName,
        className,
        reason,
        sessions: sessions.map((session) => ({
            title: session.title,
            startsAt: session.starts_at,
            endsAt: session.ends_at,
            meetingUrl: session.meeting_url,
            location: session.location,
        })),
    })
    const finishedAt = new Date().toISOString()
    const { error: finishError } = await admin
        .from('notification_outbox')
        .update(result.sent
            ? { status: 'sent', locked_at: null, sent_at: finishedAt, last_error: null }
            : { status: 'failed', locked_at: null, sent_at: null, available_at: finishedAt, last_error: result.error.slice(0, 4000) })
        .eq('id', row.id)
        .eq('status', 'processing')
        .eq('attempts', attempts)
    if (finishError) throw new Error('Мэдэгдлийн хүргэлтийн төлөвийг хадгалж чадсангүй.')
    if (!result.sent) throw new Error(result.error)
    return true
}

async function deliverWithConcurrency(tasks: Array<() => Promise<boolean>>, limit = 4) {
    const results: PromiseSettledResult<boolean>[] = []
    for (let index = 0; index < tasks.length; index += limit) {
        results.push(...await Promise.allSettled(tasks.slice(index, index + limit).map((task) => task())))
    }
    return results
}

export async function updatePublishedClassSchedule(classId: string, formData: FormData) {
    assertUuid(classId, 'Ангийн дугаар')
    const supabase = await requireAdmin()
    const { data: cohort, error: cohortError } = await supabase
        .from('training_cohorts')
        .select('id, program_id, name, class_type, checkout_version, status, configuration_revision')
        .eq('id', classId)
        .maybeSingle()
    if (cohortError || !cohort || cohort.checkout_version !== 2
        || !['open', 'closed'].includes(cohort.status)
        || !['instructor_led_online', 'offline_with_video'].includes(cohort.class_type ?? '')) {
        throw new Error('Зөвхөн нийтлэгдсэн багштай эсвэл танхимын ангийн хуваарийг энд засна.')
    }

    const expectedRevision = Number(formData.get('expected_revision'))
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new Error('Хувилбарын дугаар буруу байна.')
    const teacherUserId = requiredText(formData, 'teacher_user_id', 'Багш', 36)
    assertUuid(teacherUserId, 'Багш')
    const startsOn = requiredDate(formData, 'starts_on', 'Эхлэх өдөр')
    const endsOn = requiredDate(formData, 'ends_on', 'Дуусах өдөр')
    if (endsOn < startsOn) throw new Error('Дуусах өдөр эхлэх өдрөөс өмнө байж болохгүй.')
    const scheduleSummary = requiredText(formData, 'schedule_summary', 'Хуваарийн товч тайлбар', 2_000)
    const reason = requiredText(formData, 'reason', 'Өөрчлөлтийн шалтгаан', 500)
    if (reason.length < 5) throw new Error('Өөрчлөлтийн шалтгааныг дор хаяж 5 тэмдэгтээр бичнэ үү.')
    const classType = cohort.class_type as 'instructor_led_online' | 'offline_with_video'
    const location = classType === 'offline_with_video'
        ? requiredText(formData, 'location', 'Танхимын байршил', 1_000)
        : ''
    const sessions = parseSessions(formData, classType, location, startsOn, endsOn)

    const { data, error } = await supabase.rpc('update_published_class_schedule', {
        p_class_id: classId,
        p_expected_revision: expectedRevision,
        p_reason: reason,
        p_teacher_user_id: teacherUserId,
        p_starts_on: startsOn,
        p_ends_on: endsOn,
        p_schedule_summary: scheduleSummary,
        p_location: location,
        p_sessions: sessions,
    })
    const result = Array.isArray(data) ? data[0] : data
    if (error || !result?.new_revision) {
        console.error('Unable to update published class schedule:', error?.message)
        if (error?.message.includes('changed by another administrator')) {
            throw new Error('Өөр админ энэ ангийг өөрчилсөн байна. Хуудсаа шинэчлээд дахин оролдоно уу.')
        }
        if (error?.message.includes('started session')) {
            throw new Error('Эхэлсэн хичээлтэй ангийн хуваарийг энэ энгийн хэсгээс өөрчлөхгүй. Тусгай шийдвэр шаардлагатай.')
        }
        throw new Error('Хуваарийг хадгалж чадсангүй. Мэдээллээ шалгаад дахин оролдоно уу.')
    }

    const revision = Number(result.new_revision)
    let recipients: NotificationRecipient[] = []
    let recipientLoadFailed = false
    try {
        recipients = await loadNotificationRecipients(supabase, classId)
    } catch (notificationError) {
        recipientLoadFailed = true
        console.error('Unable to load class schedule recipients:', notificationError)
    }
    const deliveries = recipientLoadFailed ? [] : await deliverWithConcurrency(recipients.map((recipient) => () => (
        deliverScheduleNotification({
            recipient,
            classId,
            className: cohort.name,
            revision,
            reason,
            sessions,
        })
    )))
    const notificationFailureCount = recipientLoadFailed
        ? Number(result.active_enrollment_count ?? 0)
        : deliveries.filter((delivery) => delivery.status === 'rejected').length
    const notifiedCount = recipientLoadFailed
        ? 0
        : deliveries.filter((delivery) => delivery.status === 'fulfilled').length

    revalidatePath('/admin/classes')
    revalidatePath(`/admin/classes/${classId}`)
    revalidatePath(`/admin/classes/${classId}/schedule`)
    revalidatePath(`/admin/programs/${cohort.program_id}`)
    revalidatePath('/dashboard/courses')

    return {
        success: true as const,
        revision,
        notifiedCount,
        notificationFailureCount,
    }
}
