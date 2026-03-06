'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getUserProgress(courseId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('user_progress')
        .select('lesson_id, completed')
        .eq('user_id', user.id)

    if (error) {
        console.error('Error fetching progress:', error)
        return []
    }

    // Return the array of completed lesson IDs for easy checking on the frontend
    return data
}

export async function toggleLessonComplete(lessonId: string, courseId: string, currentStatus: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    if (currentStatus) {
        // If already completed, remove the record (unmark)
        const { error } = await supabase
            .from('user_progress')
            .delete()
            .match({ user_id: user.id, lesson_id: lessonId })

        if (error) throw error
    } else {
        // If not completed, insert or update the record
        const { error } = await supabase
            .from('user_progress')
            .upsert({
                user_id: user.id,
                lesson_id: lessonId,
                completed: true,
                completed_at: new Date().toISOString()
            }, { onConflict: 'user_id, lesson_id' })

        if (error) throw error
    }

    // Revalidate the course player and dashboard progress routes
    revalidatePath(`/courses/${courseId}`)
    revalidatePath('/dashboard/progress')
}
