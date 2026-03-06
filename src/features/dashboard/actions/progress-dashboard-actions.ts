'use server'

import { createClient } from '@/lib/supabase/server'

export async function getUserProgressDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // 1. Get all courses the user is enrolled in
    const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
            course_id,
            courses (
                id,
                title,
                thumbnail_url,
                lessons ( id, title, order_index )
            )
        `)
        .eq('user_id', user.id)

    if (enrollError || !enrollments) {
        console.error('Error fetching enrollments for progress:', enrollError)
        return null
    }

    // 2. Get all completed lessons for this user, ordered by completion date
    const { data: completedLessons, error: progressError } = await supabase
        .from('user_progress')
        .select('lesson_id, completed_at, lessons(course_id)')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('completed_at', { ascending: false })

    if (progressError) {
        console.error('Error fetching completed lessons:', progressError)
        return null
    }

    const completedSet = new Set(completedLessons.map(p => p.lesson_id))

    // 2.5 Get XP Redemptions
    const { data: redemptions, error: redemptionError } = await supabase
        .from('xp_redemptions')
        .select('xp_amount_spent')
        .eq('user_id', user.id)

    let spentXP = 0
    if (!redemptionError && redemptions) {
        spentXP = redemptions.reduce((acc, curr) => acc + curr.xp_amount_spent, 0)
    }

    // Gamification Calculations
    const XP_PER_LESSON = 100
    const XP_PER_COURSE = 500
    const XP_PER_LEVEL = 1000

    let totalXP = 0
    let totalCompletedLessons = completedSet.size

    // 3. Calculate progress for each course and find the "Next Lesson"
    const parsedCourses = enrollments.map((en: any) => {
        const course = en.courses

        // Sort lessons by position to find the correct next lesson
        const sortedLessons = course.lessons ? [...course.lessons].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)) : []
        const totalLessons = sortedLessons.length

        let completedCount = 0
        let nextLessonId = null
        let nextLessonTitle = null

        if (totalLessons > 0) {
            completedCount = sortedLessons.filter((l: any) => completedSet.has(l.id)).length

            // Find the first lesson that is NOT completed
            const nextLesson = sortedLessons.find((l: any) => !completedSet.has(l.id))
            if (nextLesson) {
                nextLessonId = nextLesson.id
                nextLessonTitle = nextLesson.title
            }
        }

        const percentage = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100)

        // Award Course Completion Bonus XP
        if (percentage === 100) {
            totalXP += XP_PER_COURSE
        }

        return {
            courseId: course.id,
            title: course.title,
            thumbnailUrl: course.thumbnail_url,
            totalLessons,
            completedLessons: completedCount,
            percentage,
            nextLessonId,
            nextLessonTitle
        }
    })

    // Add Lesson XP
    totalXP += (totalCompletedLessons * XP_PER_LESSON)

    // Calculate Raw Earned XP before spending
    const rawXP = totalXP

    // Deduct Spent XP
    totalXP = Math.max(0, totalXP - spentXP)

    // Calculate Level based on Raw XP (so they don't lose levels when spending)
    const currentLevel = Math.floor(rawXP / XP_PER_LEVEL) + 1
    const xpIntoCurrentLevel = rawXP % XP_PER_LEVEL
    const xpForNextLevel = XP_PER_LEVEL
    const levelPercentage = Math.round((xpIntoCurrentLevel / xpForNextLevel) * 100)

    // Find the single "Continue Learning" focal course
    // Let's use the most recently interacted with course that is NOT 100% complete
    let focalCourse = null
    const incompleteCourses = parsedCourses.filter(p => p.percentage < 100 && p.percentage > 0)

    if (incompleteCourses.length > 0 && completedLessons.length > 0) {
        // Find the course ID of the most recently completed lesson
        const lastCompletedLesson = completedLessons[0]

        let targetCourseId = null
        if (lastCompletedLesson.lessons) {
            if (Array.isArray(lastCompletedLesson.lessons)) {
                targetCourseId = lastCompletedLesson.lessons[0]?.course_id
            } else {
                targetCourseId = (lastCompletedLesson.lessons as any).course_id
            }
        }

        if (targetCourseId) {
            const mappedCourse = incompleteCourses.find(c => c.courseId === targetCourseId)
            if (mappedCourse) {
                focalCourse = mappedCourse
            } else {
                focalCourse = incompleteCourses[0]
            }
        }
    } else if (parsedCourses.length > 0) {
        // Just grab any uncompleted course, or the first one if all are done
        focalCourse = incompleteCourses[0] || parsedCourses[0]
    }

    return {
        courses: parsedCourses,
        gamification: {
            totalXP,
            rawXP,
            spentXP,
            currentLevel,
            xpIntoCurrentLevel,
            xpForNextLevel,
            levelPercentage,
            totalCompletedLessons
        },
        focalCourse
    }
}
