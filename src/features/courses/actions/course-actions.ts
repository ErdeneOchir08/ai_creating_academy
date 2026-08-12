'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyEffectiveCourseAccess } from './effective-course-access'

type CourseRow = {
    id: string
    title: string
    description: string
    thumbnail_path: string | null
    price_amount_mnt: number
    original_price_amount_mnt: number | null
    published: boolean
    archived_at: string | null
    created_at: string
}

type CourseCategory = { id: string; name: string }
type CourseCategoryAssignment = {
    category_id: string
    course_categories: CourseCategory | CourseCategory[] | null
}
type PublishedCourseRow = CourseRow & {
    course_category_assignments: CourseCategoryAssignment[] | null
}
type BonusCourseRow = {
    bonus_course_id: string
    courses: Pick<CourseRow, 'id' | 'title' | 'thumbnail_path'> | Array<Pick<CourseRow, 'id' | 'title' | 'thumbnail_path'>> | null
}

function formatMnt(amount: number) {
    return new Intl.NumberFormat('mn-MN', {
        style: 'currency',
        currency: 'MNT',
        maximumFractionDigits: 0,
    }).format(amount)
}

function toCourseView(supabase: Awaited<ReturnType<typeof createClient>>, course: CourseRow) {
    const thumbnail_url = course.thumbnail_path
        ? supabase.storage.from('course-media').getPublicUrl(course.thumbnail_path).data.publicUrl
        : ''

    return {
        ...course,
        thumbnail_url,
        price_display: formatMnt(course.price_amount_mnt),
        original_price_display: course.original_price_amount_mnt === null
            ? null
            : formatMnt(course.original_price_amount_mnt),
    }
}

export async function getPublishedCourses() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: readyCourses, error: readinessError } = await supabase
        .rpc('get_public_ready_course_ids')

    if (readinessError) {
        console.error('Unable to determine ready courses:', readinessError.message)
        return []
    }

    const readyCourseIds = (readyCourses as { course_id: string }[] | null)
        ?.map((row) => row.course_id) ?? []
    if (readyCourseIds.length === 0) return []

    const { data: courses, error } = await supabase
        .from('courses')
        .select('*, course_category_assignments(category_id, course_categories(id, name))')
        .eq('published', true)
        .is('archived_at', null)
        .in('id', readyCourseIds)
        .order('created_at', { ascending: false })

    if (error || !courses) {
        if (error) console.error('Unable to fetch courses:', error.message)
        return []
    }

    const courseViews = (courses as PublishedCourseRow[]).map((course) => ({
        ...toCourseView(supabase, course),
        categories: (course.course_category_assignments ?? []).flatMap((assignment) => {
            const category = Array.isArray(assignment.course_categories)
                ? assignment.course_categories[0]
                : assignment.course_categories
            return category ? [category] : []
        }),
    }))
    if (!user) return courseViews

    const paymentsResult = await supabase
        .from('payment_requests')
        .select('course_id')
        .eq('user_id', user.id)
        .eq('status', 'pending')

    let effectiveAccess: Awaited<ReturnType<typeof getMyEffectiveCourseAccess>> = []
    try {
        effectiveAccess = await getMyEffectiveCourseAccess(supabase)
    } catch (accessError) {
        console.error('Unable to load effective course access:', accessError)
    }

    const enrolled = new Set(effectiveAccess.map(({ course_id }) => course_id))
    const pending = new Set(paymentsResult.data?.map(({ course_id }) => course_id) ?? [])

    return courseViews.map((course) => ({
        ...course,
        payment_status: enrolled.has(course.id) ? 'enrolled' : pending.has(course.id) ? 'pending' : 'none',
    }))
}

export async function getCourseById(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single()

    if (error || !data) {
        if (error) console.error('Unable to fetch course:', error.message)
        return null
    }

    return toCourseView(supabase, data as CourseRow)
}

export async function getCourseBonusCourses(courseId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('course_bonus_courses')
        .select('bonus_course_id, courses!course_bonus_courses_bonus_course_id_fkey ( id, title, thumbnail_path )')
        .eq('source_course_id', courseId)

    if (error) {
        console.error('Unable to fetch course bonus courses:', error.message)
        return []
    }

    return ((data ?? []) as BonusCourseRow[]).flatMap((row) => {
        const course = Array.isArray(row.courses) ? row.courses[0] : row.courses
        if (!course?.id || !course.title) return []

        return [{
            id: course.id as string,
            title: course.title as string,
            thumbnail_url: course.thumbnail_path
                ? supabase.storage.from('course-media').getPublicUrl(course.thumbnail_path).data.publicUrl
                : '',
        }]
    })
}

export async function getCourseLessons(courseId: string) {
    const supabase = await createClient()
    const { data: lessons, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true })

    if (error || !lessons) {
        if (error) console.error('Unable to fetch lessons:', error.message)
        return []
    }

    const { data: videos } = lessons.length === 0
        ? { data: [] as { lesson_id: string; video_url: string | null; provider: 'youtube' | 'cloudflare'; provider_video_id: string | null; playback_status: 'uploading' | 'processing' | 'ready' | 'errored' }[] }
        : await supabase
            .from('lesson_videos')
            .select('lesson_id, video_url, provider, provider_video_id, playback_status')
            .in('lesson_id', lessons.map((lesson) => lesson.id))

    const videoByLesson = new Map(videos?.map((video) => [video.lesson_id, video]) ?? [])
    return lessons.map((lesson) => ({
        ...lesson,
        order_index: lesson.position,
        video_url: videoByLesson.get(lesson.id)?.video_url ?? null,
        video_provider: videoByLesson.get(lesson.id)?.provider ?? null,
        provider_video_id: videoByLesson.get(lesson.id)?.provider_video_id ?? null,
        playback_status: videoByLesson.get(lesson.id)?.playback_status ?? null,
    }))
}
