'use server'

import { createClient } from '@/lib/supabase/server'

type DashboardCourse = {
    id: string
    title: string
    description: string
    thumbnail_path: string | null
}

type CourseRelation = DashboardCourse | DashboardCourse[] | null
type EnrollmentRow = {
    id: string
    granted_at: string
    grant_source: string | null
    courses: CourseRelation
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

    // Fetch enrollments and inner join with courses
    const { data, error } = await supabase
        .from('enrollments')
        .select(`
      id,
      granted_at,
      grant_source,
      courses!enrollments_course_id_fkey (
        id,
        title,
        description,
        thumbnail_path
      )
    `)
        .eq('user_id', user.id)
        .eq('status', 'active')

    if (error) {
        console.error('Error fetching enrollments:', error.message)
        return []
    }

    return ((data ?? []) as EnrollmentRow[]).map((record) => withCourseThumbnail(supabase, record))
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
