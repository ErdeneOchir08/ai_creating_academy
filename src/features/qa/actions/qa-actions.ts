'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getLessonQA(lessonId: string) {
    const supabase = await createClient()

    // Fetch questions and their nested answers for this lesson
    const { data: questions, error } = await supabase
        .from('questions')
        .select(`
            id,
            content,
            is_answered,
            created_at,
            user_id,
            profiles:user_id ( display_name, avatar_url ),
            answers (
                id,
                content,
                created_at,
                profiles:user_id ( display_name, role )
            )
        `)
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching Q&A:', error)
        return []
    }

    return questions
}

export async function postQuestion(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('You must be logged in to ask a question.')

    const content = formData.get('content') as string
    const courseId = formData.get('courseId') as string
    const lessonId = formData.get('lessonId') as string

    if (!content || !content.trim()) return

    const { error } = await supabase
        .from('questions')
        .insert([{
            course_id: courseId,
            lesson_id: lessonId,
            user_id: user.id,
            content: content.trim()
        }])

    if (error) {
        console.error('Error posting question:', error)
        throw new Error('Failed to post question')
    }

    revalidatePath(`/courses/${courseId}`)
}
