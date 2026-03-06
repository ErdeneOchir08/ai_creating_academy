'use server'

import { createClient } from '@/lib/supabase/server'

export async function getPublishedCourses() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    // 1. Fetch all published courses
    const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching courses:', error.message)
        return []
    }

    if (!user || !courses || courses.length === 0) {
        return courses || []
    }

    // 2. Fetch user's enrollments and pending payment requests to attach status
    const [enrollmentsRes, paymentRequestsRes] = await Promise.all([
        supabase.from('enrollments').select('course_id').eq('user_id', user.id),
        supabase.from('payment_requests').select('course_id, status').eq('user_id', user.id).eq('status', 'pending')
    ])

    const enrolledCourseIds = new Set(enrollmentsRes.data?.map(e => e.course_id) || [])
    const pendingCourseIds = new Set(paymentRequestsRes.data?.map(p => p.course_id) || [])

    // 3. Attach status to each course
    const coursesWithStatus = courses.map(course => {
        let payment_status = 'none'
        if (enrolledCourseIds.has(course.id)) {
            payment_status = 'enrolled'
        } else if (pendingCourseIds.has(course.id)) {
            payment_status = 'pending'
        }

        return {
            ...course,
            payment_status
        }
    })

    return coursesWithStatus
}

export async function getCourseById(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching course:', error.message)
        return null
    }

    return data
}

export async function getCourseLessons(courseId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

    if (error) {
        console.error('Error fetching lessons:', error.message)
        return []
    }

    return data
}
