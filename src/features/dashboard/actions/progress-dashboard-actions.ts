'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyEffectiveCourseAccess } from '@/features/courses/actions/effective-course-access'
import { PROGRESS_COURSE_SELECT } from './progress-dashboard-query'

type ProgressLesson = {
    id: string
    title: string
    position: number
}

type ProgressCourse = {
    id: string
    title: string
    thumbnail_path: string | null
    lessons: ProgressLesson[] | null
}

type CompletedLesson = {
    lesson_id: string
    completed_at: string
}

export async function getUserProgressDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: 'unauthenticated' as const }

    let effectiveAccess: Awaited<ReturnType<typeof getMyEffectiveCourseAccess>>
    try {
        effectiveAccess = await getMyEffectiveCourseAccess(supabase)
    } catch (accessError) {
        console.error('Unable to load effective course access for progress:', accessError)
        return { status: 'error' as const }
    }

    const courseIds = effectiveAccess.map((access) => access.course_id)
    const [coursesResult, { data: completed, error: progressError }] = await Promise.all([
        courseIds.length === 0
            ? Promise.resolve({ data: [] as ProgressCourse[], error: null })
            : supabase
                .from('courses')
                .select(PROGRESS_COURSE_SELECT)
                .in('id', courseIds),
        supabase
            .from('lesson_progress')
            .select('lesson_id, completed_at')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false }),
    ])

    if (coursesResult.error || progressError) {
        console.error('Unable to load course progress:', coursesResult.error?.message || progressError?.message)
        return { status: 'error' as const }
    }

    const completedLessonIds = new Set(
        ((completed ?? []) as CompletedLesson[]).map((item) => item.lesson_id),
    )
    const coursesById = new Map(
        ((coursesResult.data ?? []) as ProgressCourse[]).map((course) => [course.id, course]),
    )
    const courseSummaries = courseIds.map((courseId) => {
        const course = coursesById.get(courseId)
        if (!course) return null
        const lessons = [...(course.lessons ?? [])].sort((a, b) => a.position - b.position)
        const completedLessons = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length
        const nextLesson = lessons.find((lesson) => !completedLessonIds.has(lesson.id))
        const thumbnailUrl = course.thumbnail_path
            ? supabase.storage.from('course-media').getPublicUrl(course.thumbnail_path).data.publicUrl
            : null

        return {
            courseId: course.id,
            title: course.title,
            thumbnailUrl,
            totalLessons: lessons.length,
            completedLessons,
            percentage: lessons.length === 0 ? 0 : Math.round((completedLessons / lessons.length) * 100),
            nextLessonId: nextLesson?.id ?? null,
            nextLessonTitle: nextLesson?.title ?? null,
        }
    })
    const courses = courseSummaries.filter((course): course is NonNullable<typeof course> => course !== null)

    const focalCourse = courses.find((course) => course.percentage < 100) ?? courses[0] ?? null
    const totalCompletedLessons = completedLessonIds.size

    // Keep the existing dashboard contract while the optional rewards system is
    // intentionally out of the launch scope.
    return {
        status: 'success' as const,
        data: {
            courses,
            gamification: {
                totalXP: 0,
                rawXP: 0,
                spentXP: 0,
                currentLevel: 1,
                xpIntoCurrentLevel: 0,
                xpForNextLevel: 0,
                levelPercentage: 0,
                totalCompletedLessons,
            },
            focalCourse,
        },
    }
}
