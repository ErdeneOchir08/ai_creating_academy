'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function getUserProgress(_courseId?: string) {
    void _courseId
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('lesson_progress')
        .select('lesson_id, completed_at')
        .eq('user_id', user.id)

    if (error) {
        console.error('Unable to fetch lesson progress:', error.message)
        return []
    }

    return (data ?? []).map((progress) => ({ ...progress, completed: true }))
}

export async function toggleLessonComplete(lessonId: string, courseId: string, currentStatus: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const operation = currentStatus
        ? supabase.from('lesson_progress').delete().eq('user_id', user.id).eq('lesson_id', lessonId)
        : supabase.from('lesson_progress').insert({ user_id: user.id, lesson_id: lessonId })

    const { error } = await operation
    if (error) throw new Error(error.message)

    revalidatePath(`/courses/${courseId}`)
    revalidatePath('/dashboard/courses')
}
