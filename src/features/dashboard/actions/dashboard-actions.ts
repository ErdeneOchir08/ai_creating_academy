'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyEffectiveCourseAccess } from '@/features/courses/actions/effective-course-access'

type DashboardCourse = {
    id: string
    title: string
    description: string
    thumbnail_path: string | null
}

type CourseRelation = DashboardCourse | DashboardCourse[] | null
type EnrollmentRow = {
    id: string
    course_id: string
    granted_at: string | null
    grant_source: string | null
}
type PendingPaymentRow = {
    id: string
    created_at: string
    courses: CourseRelation
}

function withCourseThumbnail<T extends { courses: CourseRelation }>(
    supabase: Awaited<ReturnType<typeof createClient>>,
    record: T,
) {
    const course = Array.isArray(record.courses) ? record.courses[0] : record.courses
    if (!course) return { ...record, courses: null }

    const thumbnail_url = course.thumbnail_path
        ? supabase.storage.from('course-media').getPublicUrl(course.thumbnail_path).data.publicUrl
        : null

    return { ...record, courses: { ...course, thumbnail_url } }
}

export async function getEnrolledCourses() {
    const supabase = await createClient()

    // Ensure user is logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let effectiveAccess: Awaited<ReturnType<typeof getMyEffectiveCourseAccess>>
    try {
        effectiveAccess = await getMyEffectiveCourseAccess(supabase)
    } catch (error) {
        console.error('Error fetching effective course access:', error)
        return []
    }

    if (effectiveAccess.length === 0) return []

    const courseIds = effectiveAccess.map((access) => access.course_id)
    const [coursesResult, legacyMetadataResult] = await Promise.all([
        supabase
            .from('courses')
            .select('id, title, description, thumbnail_path')
            .in('id', courseIds),
        // Access is decided by the RPC. This legacy query preserves only the
        // existing V1 card date and bonus badge while both systems coexist.
        supabase
            .from('enrollments')
            .select('id, course_id, granted_at, grant_source')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .in('course_id', courseIds),
    ])

    if (coursesResult.error || legacyMetadataResult.error) {
        console.error(
            'Error fetching enrolled course details:',
            coursesResult.error?.message || legacyMetadataResult.error?.message,
        )
        return []
    }

    const coursesById = new Map(
        ((coursesResult.data ?? []) as DashboardCourse[]).map((course) => [course.id, course]),
    )
    const legacyMetadataByCourse = new Map(
        ((legacyMetadataResult.data ?? []) as EnrollmentRow[]).map((row) => [row.course_id, row]),
    )

    return effectiveAccess.flatMap((access) => {
        const course = coursesById.get(access.course_id)
        if (!course) return []

        const legacyMetadata = legacyMetadataByCourse.get(access.course_id)
        return [withCourseThumbnail(supabase, {
            id: access.access_id
                ?? access.enrollment_id
                ?? legacyMetadata?.id
                ?? `effective:${access.course_id}`,
            granted_at: access.granted_at ?? legacyMetadata?.granted_at ?? null,
            grant_source: access.grant_source ?? legacyMetadata?.grant_source ?? null,
            courses: course,
        })]
    })
}

export async function getPendingCourses() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Fetch pending payment requests and inner join with courses
    const { data, error } = await supabase
        .from('payment_requests')
        .select(`
      id,
      created_at,
      courses!payment_requests_course_id_fkey (
        id,
        title,
        description,
        thumbnail_path
      )
    `)
        .eq('user_id', user.id)
        .eq('status', 'pending')

    if (error) {
        console.error('Error fetching pending courses:', error.message)
        return []
    }

    return ((data ?? []) as PendingPaymentRow[]).map((record) => withCourseThumbnail(supabase, record))
}

export async function getStudentProfile() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('Error fetching profile:', error.message)
        return null
    }

    return data
}

export type MyClassSchedule = {
    classId: string
    className: string
    classType: 'instructor_led_online' | 'offline_with_video'
    teacherName: string
    scheduleSummary: string
    startsOn: string | null
    endsOn: string | null
    sessions: Array<{
        id: string
        title: string
        startsAt: string
        endsAt: string
        meetingUrl: string | null
        location: string
    }>
}

export async function getMyClassSchedules(): Promise<MyClassSchedule[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: enrollments, error: enrollmentError } = await supabase
        .from('course_offering_enrollments')
        .select('offering_id')
        .eq('content_access_user_id', user.id)
        .eq('status', 'active')
    if (enrollmentError) {
        console.error('Error fetching class schedule enrollments:', enrollmentError.message)
        return []
    }
    const classIds = [...new Set((enrollments ?? []).map((enrollment) => enrollment.offering_id))]
    if (classIds.length === 0) return []

    const [classesResult, assignmentsResult, sessionsResult] = await Promise.all([
        supabase
            .from('training_cohorts')
            .select('id, name, class_type, schedule_summary, starts_on, ends_on')
            .in('id', classIds)
            .in('class_type', ['instructor_led_online', 'offline_with_video']),
        supabase
            .from('class_teacher_assignments')
            .select('class_id, teacher_user_id')
            .in('class_id', classIds)
            .is('ended_at', null),
        supabase
            .from('class_sessions')
            .select('id, class_id, title, starts_at, ends_at, meeting_url, location')
            .in('class_id', classIds)
            .order('starts_at'),
    ])
    const firstError = classesResult.error ?? assignmentsResult.error ?? sessionsResult.error
    if (firstError) {
        console.error('Error fetching enrolled class schedules:', firstError.message)
        return []
    }

    const assignments = assignmentsResult.data ?? []
    const teacherIds = [...new Set(assignments.map((assignment) => assignment.teacher_user_id))]
    const profilesResult = teacherIds.length > 0
        ? await supabase.from('profiles').select('id, display_name').in('id', teacherIds)
        : { data: [], error: null }
    if (profilesResult.error) {
        console.error('Error fetching enrolled class teachers:', profilesResult.error.message)
        return []
    }
    const teacherNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]))
    const assignmentByClass = new Map(assignments.map((assignment) => [assignment.class_id, assignment]))
    const sessionsByClass = new Map<string, typeof sessionsResult.data>()
    for (const session of sessionsResult.data ?? []) {
        const classSessions = sessionsByClass.get(session.class_id) ?? []
        classSessions.push(session)
        sessionsByClass.set(session.class_id, classSessions)
    }

    return (classesResult.data ?? []).flatMap((classRow) => {
        if (classRow.class_type !== 'instructor_led_online' && classRow.class_type !== 'offline_with_video') return []
        const assignment = assignmentByClass.get(classRow.id)
        return [{
            classId: classRow.id,
            className: classRow.name,
            classType: classRow.class_type,
            teacherName: assignment ? teacherNames.get(assignment.teacher_user_id)?.trim() || 'Багш' : 'Багш',
            scheduleSummary: classRow.schedule_summary,
            startsOn: classRow.starts_on,
            endsOn: classRow.ends_on,
            sessions: (sessionsByClass.get(classRow.id) ?? []).map((session) => ({
                    id: session.id,
                    title: session.title,
                    startsAt: session.starts_at,
                    endsAt: session.ends_at,
                    meetingUrl: session.meeting_url,
                    location: session.location,
            })),
        }]
    })
}
