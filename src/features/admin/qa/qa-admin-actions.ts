'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendQuestionAnswerEmail } from '@/lib/email/question-answer'

type QuestionAnswerNotificationRecipient = {
    email: string | null
    display_name: string | null
    course_title: string | null
    lesson_title: string | null
}

export async function getAdminQATnbox() {
    const supabase = await createClient()

    // Fetch all questions with course/lesson data and nested answers
    const { data: questions, error } = await supabase
        .from('questions')
        .select(`
            id,
            course_id,
            lesson_id,
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
    const content = answerContent.trim()

    if (!questionId || !content) {
        throw new Error('Хариултаа бичнэ үү.')
    }

    if (content.length > 4000) {
        throw new Error('Хариулт 4000 тэмдэгтээс урт байж болохгүй.')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // 1. Insert the answer
    const { data: insertedAnswer, error: insertError } = await supabase
        .from('answers')
        .insert([{
            question_id: questionId,
            user_id: user.id,
            content,
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

    const { data: recipientData, error: recipientError } = await supabase
        .rpc('get_question_answer_notification_recipient', { p_question_id: questionId })

    let emailNotification: { sent: boolean; error?: string } = { sent: false }
    const recipient = (recipientData?.[0] ?? null) as QuestionAnswerNotificationRecipient | null

    if (recipientError) {
        console.error('Unable to load question answer notification recipient:', recipientError.message)
        emailNotification = { sent: false, error: 'Суралцагчийн имэйл хаягийг ачаалж чадсангүй.' }
    } else if (!recipient?.email || !recipient.course_title || !recipient.lesson_title) {
        console.error('Question answer email skipped because recipient data is incomplete.')
        emailNotification = { sent: false, error: 'Суралцагчийн имэйл мэдээлэл дутуу байна.' }
    } else {
        const result = await sendQuestionAnswerEmail({
            to: recipient.email,
            studentName: recipient.display_name || 'Суралцагч',
            courseTitle: recipient.course_title,
            lessonTitle: recipient.lesson_title,
            answerContent: content,
        })
        emailNotification = result

        if (!result.sent) {
            console.error('Question answer was saved but email delivery failed:', result.error)
        }
    }

    // Revalidate Admin Inbox and the specific Course Player page
    revalidatePath('/admin/qa')
    revalidatePath('/admin')
    revalidatePath('/courses/[id]', 'page')

    return { ...insertedAnswer, emailNotification }
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
    revalidatePath('/admin')
    return { success: true }
}
