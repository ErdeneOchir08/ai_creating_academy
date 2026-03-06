'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAllAdminCourses() {
    const supabase = await createClient()

    // Fetch all courses for admins, including drafted/unpublished ones
    const { data, error } = await supabase
        .from('courses')
        .select(`
            *,
            lessons ( count )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching admin courses:', error)
        return []
    }

    return data
}

export async function createCourse(formData: FormData) {
    const supabase = await createClient()

    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const price_display = formData.get('price_display') as string
    const original_price_display = formData.get('original_price_display') as string
    const published = formData.get('published') === 'true'

    if (!title || !description) throw new Error('Title and description are required')

    // We start with whatever string was parsed or sent back
    let thumbnail_url = formData.get('thumbnail_url') as string

    // Handle new image upload overriding the existing URL
    const thumbnail_file = formData.get('thumbnail_image') as File | null
    if (thumbnail_file && thumbnail_file.size > 0 && thumbnail_file.name !== 'undefined') {
        const fileExt = thumbnail_file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('course-images')
            .upload(filePath, thumbnail_file)

        if (uploadError) {
            console.error('Error uploading image:', uploadError)
            throw new Error('Failed to upload thumbnail image.')
        }

        const { data: { publicUrl } } = supabase.storage
            .from('course-images')
            .getPublicUrl(filePath)

        thumbnail_url = publicUrl
    }

    const { data, error } = await supabase
        .from('courses')
        .insert([
            {
                title,
                description,
                price_display: price_display || 'Free',
                original_price_display: original_price_display || null,
                thumbnail_url: thumbnail_url || '/placeholder.svg', // default placeholder
                published
            }
        ])
        .select()
        .single()

    if (error) {
        console.error('Error creating course:', error)
        throw new Error(error.message)
    }

    revalidatePath('/admin/courses')
    revalidatePath('/') // update landing page if published
    return data
}

export async function deleteCourse(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting course:', error)
        throw new Error(error.message)
    }

    revalidatePath('/admin/courses')
    revalidatePath('/')
}

export async function createLesson(formData: FormData) {
    const supabase = await createClient()

    const course_id = formData.get('course_id') as string
    const title = formData.get('title') as string
    const video_url = formData.get('video_url') as string
    const order_index = parseInt(formData.get('order_index') as string, 10) || 1

    if (!title || !course_id) throw new Error('Title and course ID are required')

    const { error } = await supabase
        .from('lessons')
        .insert([{ course_id, title, video_url, order_index }])

    if (error) {
        console.error('Error creating lesson:', error)
        throw new Error(error.message)
    }

    revalidatePath(`/admin/courses/${course_id}`)
}

export async function deleteLesson(id: string, courseId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting lesson:', error)
        throw new Error(error.message)
    }

    revalidatePath(`/admin/courses/${courseId}`)
}

export async function updateLesson(id: string, courseId: string, formData: FormData) {
    const supabase = await createClient()

    const title = formData.get('title') as string
    const video_url = formData.get('video_url') as string
    const order_index = parseInt(formData.get('order_index') as string, 10)

    if (!title || isNaN(order_index)) throw new Error('Title and order index are required')

    const { error } = await supabase
        .from('lessons')
        .update({
            title,
            video_url,
            order_index
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating lesson:', error)
        throw new Error(error.message)
    }

    revalidatePath(`/admin/courses/${courseId}`)
}

export async function reorderLesson(courseId: string, lessonId: string, direction: 'up' | 'down') {
    const supabase = await createClient()

    // 1. Get all lessons for this course ordered by order_index
    const { data: lessons, error: fetchError } = await supabase
        .from('lessons')
        .select('id, order_index')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

    if (fetchError || !lessons) {
        throw new Error('Could not fetch lessons for reordering')
    }

    const currentIndex = lessons.findIndex(l => l.id === lessonId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    // If out of bounds, do nothing
    if (targetIndex < 0 || targetIndex >= lessons.length) return

    const currentLesson = lessons[currentIndex]
    const swapLesson = lessons[targetIndex]

    // 2. Perform the swap
    const { error: updateError1 } = await supabase
        .from('lessons')
        .update({ order_index: swapLesson.order_index })
        .eq('id', currentLesson.id)

    const { error: updateError2 } = await supabase
        .from('lessons')
        .update({ order_index: currentLesson.order_index })
        .eq('id', swapLesson.id)

    if (updateError1 || updateError2) {
        throw new Error('Failed to update lesson order')
    }

    revalidatePath(`/admin/courses/${courseId}`)
    revalidatePath(`/courses/${courseId}`)
}

export async function updateCourse(id: string, formData: FormData) {
    const supabase = await createClient()

    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const price_display = formData.get('price_display') as string
    const original_price_display = formData.get('original_price_display') as string
    const published = formData.get('published') === 'true'

    if (!title || !description) throw new Error('Title and description are required')

    // We start with whatever string was parsed or sent back
    let thumbnail_url = formData.get('thumbnail_url') as string

    // Handle new image upload overriding the existing URL
    const thumbnail_file = formData.get('thumbnail_image') as File | null
    if (thumbnail_file && thumbnail_file.size > 0 && thumbnail_file.name !== 'undefined') {
        const fileExt = thumbnail_file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('course-images')
            .upload(filePath, thumbnail_file)

        if (uploadError) {
            console.error('Error uploading image:', uploadError)
            throw new Error('Failed to upload thumbnail image.')
        }

        const { data: { publicUrl } } = supabase.storage
            .from('course-images')
            .getPublicUrl(filePath)

        thumbnail_url = publicUrl
    }

    const { error } = await supabase
        .from('courses')
        .update({
            title,
            description,
            price_display: price_display || 'Free',
            original_price_display: original_price_display || null,
            thumbnail_url: thumbnail_url || '/placeholder.svg',
            published
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating course:', error)
        throw new Error(error.message)
    }

    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${id}`)
    revalidatePath('/')
}
