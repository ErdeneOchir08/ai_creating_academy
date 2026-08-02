'use server'

import { createClient } from '@/lib/supabase/server'

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

type ProgressEnrollment = {
    course_id: string
    courses: ProgressCourse | ProgressCourse[] | null
}

type CompletedLesson = {
    lesson_id: string
    completed_at: string
}

export async function getUserProgressDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const [{ data: enrollments, error: enrollmentError }, { data: completed, error: progressError }] = await Promise.all([
        supabase
            .from('enrollments')
            .select('course_id, courses(id, title, thumbnail_path, lessons(id, title, position))')
            .eq('user_id', user.id)
            .eq('status', 'active'),
        supabase
            .from('lesson_progress')
            .select('lesson_id, completed_at')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false }),
    ])

    if (enrollmentError || progressError) {
        console.error('Unable to load course progress:', enrollmentError?.message || progressError?.message)
        return null
    }

    const completedLessonIds = new Set(
        ((completed ?? []) as CompletedLesson[]).map((item) => item.lesson_id),
    )
    const courseSummaries = ((enrollments ?? []) as ProgressEnrollment[]).map((enrollment) => {
        const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses
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
    }
}
