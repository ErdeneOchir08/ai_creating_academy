'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateImageFile } from '@/lib/uploads/image-validation'
import { getCloudflareStreamVideoReadiness } from '@/lib/cloudflare-stream/playback'

type AdminCourseRow = {
    id: string
    title: string
    description: string
    thumbnail_path: string | null
    price_amount_mnt: number
    original_price_amount_mnt: number | null
    published: boolean
    created_at: string
    lessons: Array<{ id: string; lesson_videos: { lesson_id: string } | null }> | null
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Please sign in as an administrator.')

    const { data: role, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

    if (error || role?.role !== 'admin') throw new Error('Administrator access is required.')
    return supabase
}

function amountFromForm(value: FormDataEntryValue | null, fieldName: string) {
    const rawValue = typeof value === 'string' ? value.trim() : ''
    if (!rawValue) return null
    const amount = Number(rawValue.replace(/[^0-9]/g, ''))
    if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new Error(`${fieldName} must be a valid non-negative amount.`)
    }
    return amount
}

function lessonPositionFromForm(value: FormDataEntryValue | null) {
    const position = Number(value)
    if (!Number.isInteger(position) || position < 1) {
        throw new Error('Lesson order must be a whole number greater than zero.')
    }
    return position
}

function normalizeVideoUrl(value: FormDataEntryValue | null) {
    const url = typeof value === 'string' ? value.trim() : ''
    if (!url) return null

    try {
        const parsed = new URL(url)
        const allowedHosts = new Set([
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'youtu.be',
            'www.youtu.be',
            'youtube-nocookie.com',
            'www.youtube-nocookie.com',
        ])

        if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname.toLowerCase())) {
            throw new Error()
        }

        return parsed.toString()
    } catch {
        throw new Error('Зөвхөн хүчинтэй HTTPS YouTube холбоос оруулна уу.')
    }
}

type LessonVideoSource =
    | { provider: 'youtube'; video_url: string; provider_video_id: null; playback_status: 'ready' }
    | { provider: 'cloudflare'; video_url: null; provider_video_id: string; playback_status: 'ready' }

async function lessonVideoSourceFromForm(formData: FormData): Promise<LessonVideoSource | null> {
    const provider = String(formData.get('video_provider') ?? 'youtube')
    const rawValue = String(formData.get('video_source') ?? '').trim()
    if (!rawValue) return null

    if (provider === 'youtube') {
        const videoUrl = normalizeVideoUrl(rawValue)
        if (!videoUrl) return null
        return { provider: 'youtube', video_url: videoUrl, provider_video_id: null, playback_status: 'ready' }
    }

    if (provider === 'cloudflare' && /^[A-Za-z0-9_-]{1,64}$/.test(rawValue)) {
        const readiness = await getCloudflareStreamVideoReadiness(rawValue)
        if (readiness === 'unconfigured') {
            throw new Error('Cloudflare Stream тохируулаагүй байна. Тохиргоог хийсний дараа видеогоо нэмнэ үү.')
        }
        if (readiness === 'processing') {
            throw new Error('Cloudflare Stream видео боловсруулагдаж байна. Бэлэн болсны дараа дахин оролдоно уу.')
        }
        if (readiness === 'unprotected') {
            throw new Error('Cloudflare Stream видеон дээр Require Signed URLs болон Allowed Origins тохируулна уу.')
        }
        if (readiness !== 'ready') {
            throw new Error('Cloudflare Stream видеог олж чадсангүй. Видео ID болон API тохиргоог шалгана уу.')
        }
        return { provider: 'cloudflare', video_url: null, provider_video_id: rawValue, playback_status: 'ready' }
    }

    throw new Error('Cloudflare Stream video ID хүчинтэй биш байна.')
}

async function uploadCourseImage(supabase: Awaited<ReturnType<typeof createClient>>, file: File | null) {
    if (!file || file.size === 0 || file.name === 'undefined') return null

    const extension = await validateImageFile(file, 5 * 1024 * 1024)

    const path = `${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage
        .from('course-media')
        .upload(path, file, { contentType: file.type, upsert: false })

    if (error) {
        console.error('Course image upload failed:', error.message)
        throw new Error(`Course image upload failed: ${error.message}`)
    }

    return path
}

export async function getAllAdminCourses() {
    const supabase = await requireAdmin()

    // Fetch all courses for admins, including drafted/unpublished ones
    const { data, error } = await supabase
        .from('courses')
        .select(`
            *,
            lessons (
                id,
                lesson_videos ( lesson_id )
            )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching admin courses:', error)
        return []
    }

    return ((data || []) as AdminCourseRow[]).map((course) => {
        const lessons = course.lessons ?? []
        const lessonCount = lessons.length
        const videoLessonCount = lessons.filter((lesson) => lesson.lesson_videos !== null).length
        const thumbnail_url = course.thumbnail_path
            ? supabase.storage.from('course-media').getPublicUrl(course.thumbnail_path).data.publicUrl
            : null

        return {
            ...course,
            lesson_count: lessonCount,
            video_lesson_count: videoLessonCount,
            is_ready_for_publication: lessonCount > 0 && videoLessonCount > 0,
            thumbnail_url,
            price_display: new Intl.NumberFormat('mn-MN', { style: 'currency', currency: 'MNT', maximumFractionDigits: 0 }).format(course.price_amount_mnt),
        }
    })
}

export async function createCourse(formData: FormData) {
    const supabase = await requireAdmin()

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()

    if (!title || !description) throw new Error('Course title and description are required.')

    const thumbnail_file = formData.get('thumbnail_image') as File | null
    const thumbnail_path = await uploadCourseImage(supabase, thumbnail_file)
    const priceAmount = amountFromForm(formData.get('price_display'), 'Course price')
    const originalPriceAmount = amountFromForm(formData.get('original_price_display'), 'Original price')

    if (originalPriceAmount !== null && originalPriceAmount < (priceAmount ?? 0)) {
        if (thumbnail_path) await supabase.storage.from('course-media').remove([thumbnail_path])
        throw new Error('Original price cannot be lower than the current course price.')
    }

    const { data, error } = await supabase
        .from('courses')
        .insert([
            {
                title,
                description,
                price_amount_mnt: priceAmount ?? 0,
                original_price_amount_mnt: originalPriceAmount,
                thumbnail_path,
                published: false
            }
        ])
        .select()
        .single()

    if (error) {
        console.error('Error creating course:', error)
        if (thumbnail_path) await supabase.storage.from('course-media').remove([thumbnail_path])
        throw new Error(error.message)
    }

    revalidatePath('/admin/courses')
    revalidatePath('/') // update landing page if published
    return data
}

export async function deleteCourse(id: string) {
    const supabase = await requireAdmin()

    const [{ data: course, error: courseError }, enrollments, payments] = await Promise.all([
        supabase.from('courses').select('thumbnail_path').eq('id', id).maybeSingle(),
        supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('course_id', id),
        supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('course_id', id),
    ])

    if (courseError || !course || enrollments.error || payments.error) {
        console.error('Unable to check whether course can be deleted:', courseError?.message || enrollments.error?.message || payments.error?.message)
        return { error: 'Хичээлийг устгах боломжийг шалгаж чадсангүй. Дахин оролдоно уу.' }
    }

    if ((enrollments.count ?? 0) > 0 || (payments.count ?? 0) > 0) {
        return { error: 'Энэ хичээлд суралцагчийн бүртгэл эсвэл төлбөрийн түүх байна. Устгахын оронд нийтлэлийг нь цуцална уу.' }
    }

    const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting course:', error)
        return { error: 'Хичээлийг устгаж чадсангүй. Дахин оролдоно уу.' }
    }

    if (course.thumbnail_path) {
        const { error: storageError } = await supabase.storage.from('course-media').remove([course.thumbnail_path])
        if (storageError) console.error('Course was deleted but its image could not be removed:', storageError.message)
    }

    revalidatePath('/admin/courses')
    revalidatePath('/')
    revalidatePath(`/course/${id}`)
    revalidatePath(`/courses/${id}`)
    return { success: true }
}

export async function createLesson(formData: FormData) {
    const supabase = await requireAdmin()

    const course_id = String(formData.get('course_id') ?? '')
    const title = String(formData.get('title') ?? '').trim()
    const videoSource = await lessonVideoSourceFromForm(formData)
    const position = lessonPositionFromForm(formData.get('order_index'))
    const is_preview = formData.get('is_preview') === 'true'

    if (!title || !course_id) throw new Error('Title and course ID are required')
    if (is_preview && !videoSource) throw new Error('Үнэ төлбөргүй үзэх хичээлд хүчинтэй видео шаардлагатай.')

    const { data: lesson, error } = await supabase
        .from('lessons')
        .insert([{ course_id, title, position, is_preview }])
        .select('id')
        .single()

    if (error) {
        console.error('Error creating lesson:', error)
        throw new Error(error.message)
    }

    if (videoSource) {
        const { error: videoError } = await supabase.from('lesson_videos').insert({ lesson_id: lesson.id, ...videoSource })
        if (videoError) {
            await supabase.from('lessons').delete().eq('id', lesson.id)
            throw new Error(videoError.message)
        }
    }
    revalidatePath(`/admin/courses/${course_id}`)
    revalidatePath(`/course/${course_id}`)
    revalidatePath(`/courses/${course_id}`)
}

export async function deleteLesson(id: string, courseId: string) {
    const supabase = await requireAdmin()

    const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting lesson:', error)
        throw new Error(error.message)
    }

    revalidatePath(`/admin/courses/${courseId}`)
    revalidatePath(`/course/${courseId}`)
    revalidatePath(`/courses/${courseId}`)
}

export async function updateLesson(id: string, courseId: string, formData: FormData) {
    const supabase = await requireAdmin()

    const title = String(formData.get('title') ?? '').trim()
    const videoSource = await lessonVideoSourceFromForm(formData)
    const position = lessonPositionFromForm(formData.get('order_index'))
    const is_preview = formData.get('is_preview') === 'true'

    if (!title) throw new Error('Lesson title is required.')
    if (is_preview && !videoSource) throw new Error('Үнэ төлбөргүй үзэх хичээлд хүчинтэй видео шаардлагатай.')

    const { error } = await supabase
        .from('lessons')
        .update({
            title,
            position,
            is_preview,
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating lesson:', error)
        throw new Error(error.message)
    }

    if (videoSource) {
        const { error: videoError } = await supabase
            .from('lesson_videos')
            .upsert({ lesson_id: id, ...videoSource }, { onConflict: 'lesson_id' })
        if (videoError) throw new Error(videoError.message)
    } else {
        const { error: videoError } = await supabase.from('lesson_videos').delete().eq('lesson_id', id)
        if (videoError) throw new Error(videoError.message)
    }

    revalidatePath(`/admin/courses/${courseId}`)
    revalidatePath(`/course/${courseId}`)
    revalidatePath(`/courses/${courseId}`)
}

export async function reorderLesson(courseId: string, lessonId: string, direction: 'up' | 'down') {
    const supabase = await requireAdmin()
    const { error } = await supabase.rpc('reorder_course_lesson', {
        p_course_id: courseId,
        p_lesson_id: lessonId,
        p_direction: direction,
    })

    if (error) throw new Error(error.message)

    revalidatePath(`/admin/courses/${courseId}`)
    revalidatePath(`/courses/${courseId}`)
}

export async function updateCourse(id: string, formData: FormData) {
    const supabase = await requireAdmin()

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const published = formData.get('published') === 'true'

    if (!title || !description) throw new Error('Title and description are required')

    if (published) {
        const { count, error: lessonCountError } = await supabase
            .from('lessons')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', id)

        if (lessonCountError) throw new Error('Unable to verify the course lessons before publishing.')
        if ((count ?? 0) === 0) {
            throw new Error('Хичээл нийтлэхийн өмнө дор хаяж нэг хичээлийн агуулга нэмнэ үү.')
        }

        const { count: videoLessonCount, error: videoLessonCountError } = await supabase
            .from('lesson_videos')
            .select('lesson_id, lessons!inner(course_id)', { count: 'exact', head: true })
            .eq('lessons.course_id', id)
            .eq('playback_status', 'ready')

        if (videoLessonCountError) throw new Error('Unable to verify the course videos before publishing.')
        if ((videoLessonCount ?? 0) === 0) {
            throw new Error('Хичээл нийтлэхийн өмнө дор хаяж нэг видео хичээл нэмнэ үү.')
        }
    }

    const thumbnail_file = formData.get('thumbnail_image') as File | null
    const thumbnail_path = await uploadCourseImage(supabase, thumbnail_file)
    const priceAmount = amountFromForm(formData.get('price_display'), 'Course price')
    const originalPriceAmount = amountFromForm(formData.get('original_price_display'), 'Original price')

    if (originalPriceAmount !== null && originalPriceAmount < (priceAmount ?? 0)) {
        if (thumbnail_path) await supabase.storage.from('course-media').remove([thumbnail_path])
        throw new Error('Original price cannot be lower than the current course price.')
    }

    const { error } = await supabase
        .from('courses')
        .update({
            title,
            description,
            price_amount_mnt: priceAmount ?? 0,
            original_price_amount_mnt: originalPriceAmount,
            ...(thumbnail_path ? { thumbnail_path } : {}),
            published
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating course:', error)
        if (thumbnail_path) await supabase.storage.from('course-media').remove([thumbnail_path])
        throw new Error(error.message)
    }

    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${id}`)
    revalidatePath('/')
}
