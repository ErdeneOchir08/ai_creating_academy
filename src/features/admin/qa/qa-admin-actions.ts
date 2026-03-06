'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAdminQATnbox() {
    const supabase = await createClient()

    // Fetch all questions with course/lesson data and nested answers
    const { data: questions, error } = await supabase
        .from('questions')
        .select(`
            id,
            content,
            is_answered,
            created_at,
            profiles:user_id ( display_name ),
            courses:course_id ( id, title ),
            lessons:lesson_id ( id, title ),
            answers (
                id,
                content,
                created_at,
                profiles:user_id ( display_name )
            )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching admin QA:', error)
        return []
    }

    return questions
}

export async function adminPostAnswer(questionId: string, answerContent: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // 1. Insert the answer
    const { data: insertedAnswer, error: insertError } = await supabase
        .from('answers')
        .insert([{
            question_id: questionId,
            user_id: user.id,
            content: answerContent.trim()
        }])
        .select()
        .single()

    if (insertError) {
        console.error('Error posting answer:', insertError)
        throw new Error('Failed to post answer')
    }

    // 2. Mark the parent question as answered
    const { error: updateError } = await supabase
        .from('questions')
        .update({ is_answered: true })
        .eq('id', questionId)

    if (updateError) {
        console.error('Error updating question status:', updateError)
    }

    // Revalidate Admin Inbox and the specific Course Player page
    revalidatePath('/admin/qa')
    revalidatePath('/courses/[id]', 'page')

    return insertedAnswer
}

export async function adminDeleteQuestion(questionId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // Delete the question. Supabase CASCADE will delete the answers.
    const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

    if (error) {
        console.error('Error deleting question:', error)
        throw new Error('Failed to delete thread')
    }

    revalidatePath('/admin/qa')
    return { success: true }
}
