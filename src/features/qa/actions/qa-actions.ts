'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type StudentQuestion = {
    id: string
    courseId: string
    lessonId: string
    content: string
    isAnswered: boolean
    createdAt: string
    course: { id: string; title: string } | null
    lesson: { id: string; title: string } | null
    answers: { id: string; content: string; createdAt: string }[]
}

export async function getLessonQA(lessonId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('questions')
        .select('id, content, is_answered, created_at, profiles:user_id(display_name), answers(id, content, created_at, profiles:user_id(display_name))')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true })
        .order('created_at', { ascending: true, referencedTable: 'answers' })

    if (error) {
        console.error('Lesson Q&A fetch failed:', error.message)
        return []
    }
    return data
}

export async function postQuestion(formData: FormData) {
    const courseId = String(formData.get('course_id') ?? '')
    const lessonId = String(formData.get('lesson_id') ?? '')
    const content = String(formData.get('content') ?? '').trim()
    if (!courseId || !lessonId || !content) return { error: 'Асуултаа бичнэ үү.' }
    if (content.length > 2000) return { error: 'Асуулт 2000 тэмдэгтээс урт байж болохгүй.' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Асуулт асуухын тулд нэвтэрнэ үү.' }

    const { error } = await supabase.from('questions').insert({
        course_id: courseId,
        lesson_id: lessonId,
        user_id: user.id,
        content,
    })
    if (error) {
        console.error('Lesson question insert failed:', error.message)
        return { error: 'Асуулт илгээж чадсангүй. Та энэ хичээлд элссэн эсэхээ шалгана уу.' }
    }

    revalidatePath('/courses/[id]', 'page')
    revalidatePath('/admin/qa')
    revalidatePath('/admin')
    return { success: true }
}

export async function getMyQuestions(): Promise<StudentQuestion[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('questions')
        .select(`
            id,
            course_id,
            lesson_id,
            content,
            is_answered,
            created_at,
            courses:course_id ( id, title ),
            lessons:lesson_id ( id, title ),
            answers ( id, content, created_at )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Student question history fetch failed:', error.message)
        return []
    }

    return (data ?? []).map((question): StudentQuestion => {
        const course = Array.isArray(question.courses) ? question.courses[0] ?? null : question.courses
        const lesson = Array.isArray(question.lessons) ? question.lessons[0] ?? null : question.lessons

        return {
            id: question.id,
            courseId: question.course_id,
            lessonId: question.lesson_id,
            content: question.content,
            isAnswered: question.is_answered,
            createdAt: question.created_at,
            course,
            lesson,
            answers: (question.answers ?? []).map((answer) => ({
                id: answer.id,
                content: answer.content,
                createdAt: answer.created_at,
            })),
        }
    })
}
