'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendPaymentSubmittedAlert } from '@/lib/telegram/notifications'
import { validateImageFile } from '@/lib/uploads/image-validation'
import { removeFailedPaymentReceipt } from '@/lib/uploads/payment-receipt-cleanup'
import { hasEffectiveCourseAccess } from '@/features/courses/actions/effective-course-access'
import { parseCourseUsesOfferingCheckout } from '@/features/courses/domain/public-course-offering'

export async function submitPaymentRequest(courseId: string, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Төлбөрийн баримт илгээхийн өмнө нэвтэрнэ үү.' }

    const ownershipResult = await supabase.rpc('course_uses_offering_checkout', { p_course_id: courseId })
    if (ownershipResult.error) {
        console.error('Unable to verify direct-payment ownership:', ownershipResult.error.message)
        return { success: false, error: 'Төлбөрийн зөв сувгийг шалгаж чадсангүй. Хичээлийн мэдээлэл рүү буцаж дахин оролдоно уу.' }
    }
    try {
        if (parseCourseUsesOfferingCheckout(ownershipResult.data)) {
            return { success: false, error: 'Энэ хичээлийн төлбөрийг нээлттэй элсэлтийн сонголтоор илгээнэ үү.' }
        }
    } catch (error) {
        console.error('Invalid direct-payment ownership response:', error)
        return { success: false, error: 'Төлбөрийн зөв сувгийг шалгаж чадсангүй. Хичээлийн мэдээлэл рүү буцаж дахин оролдоно уу.' }
    }

    const receipt = formData.get('receipt')
    if (!(receipt instanceof File) || receipt.size === 0) {
        return { success: false, error: 'Төлбөрийн баримтын зургаа сонгоно уу.' }
    }

    let extension: string
    try {
        extension = await validateImageFile(receipt, 10 * 1024 * 1024)
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Зургийн файлыг шалгаж чадсангүй.' }
    }

    const receiptPath = `${user.id}/${crypto.randomUUID()}.${extension}`

    const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, title, price_amount_mnt')
        .eq('id', courseId)
        .eq('published', true)
        .maybeSingle()

    if (courseError || !course) {
        return { success: false, error: 'Энэ хичээл одоогоор төлбөр хүлээн авах боломжгүй байна.' }
    }

    const { data: enrollment, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('status', 'active')
        .maybeSingle()

    if (enrollmentError) {
        console.error('Enrollment check failed before payment submission:', enrollmentError.message)
        return { success: false, error: 'Элсэлтийн төлөвийг шалгаж чадсангүй. Дахин оролдоно уу.' }
    }

    if (enrollment) {
        return { success: false, error: 'Та энэ хичээлд аль хэдийн элссэн байна.' }
    }

    const { data: pendingRequest, error: pendingRequestError } = await supabase
        .from('payment_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('status', 'pending')
        .maybeSingle()

    if (pendingRequestError) {
        console.error('Pending payment check failed before payment submission:', pendingRequestError.message)
        return { success: false, error: 'Төлбөрийн хүсэлтийн төлөвийг шалгаж чадсангүй. Дахин оролдоно уу.' }
    }

    if (pendingRequest) {
        return { success: false, error: 'Энэ хичээлийн төлбөрийн хүсэлт аль хэдийн хянагдаж байна.' }
    }

    const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(receiptPath, receipt, { contentType: receipt.type, upsert: false })

    if (uploadError) {
        console.error('Receipt upload failed:', uploadError.message)
        return { success: false, error: 'Баримтыг байршуулж чадсангүй. Дахин оролдоно уу.' }
    }

    const { error: paymentError } = await supabase.from('payment_requests').insert({
        user_id: user.id,
        course_id: courseId,
        receipt_path: receiptPath,
        amount_mnt: course.price_amount_mnt,
        status: 'pending',
    })

    if (paymentError) {
        console.error('Payment request failed:', paymentError.message)
        await removeFailedPaymentReceipt(receiptPath)
        return { success: false, error: paymentError.code === '23505'
            ? 'Энэ хичээлийн төлбөрийн хүсэлт аль хэдийн хянагдаж байна.'
            : 'Төлбөрийн хүсэлтийг илгээж чадсангүй. Дахин оролдоно уу.' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle()

    const adminUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
        ? `${process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, '')}/admin/payments`
        : undefined
    const notification = await sendPaymentSubmittedAlert({
        studentName: profile?.display_name || user.email || 'Суралцагч',
        courseTitle: course.title,
        adminUrl,
    })
    if (!notification.sent) console.error('Payment request saved but Telegram notification failed:', notification.error)

    revalidatePath(`/course/${courseId}`)
    revalidatePath('/dashboard/courses')
    revalidatePath('/admin')
    revalidatePath('/admin/payments')
    return { success: true }
}

export async function checkPaymentStatus(courseId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    try {
        if (await hasEffectiveCourseAccess(supabase, courseId)) return 'enrolled'
    } catch (error) {
        console.error('Effective enrollment check failed:', error)
    }

    const { data: payment } = await supabase
        .from('payment_requests')
        .select('status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    return payment?.status ?? 'none'
}

export async function getRejectedPaymentReason(courseId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
        .from('payment_requests')
        .select('rejection_reason')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    return data?.rejection_reason?.trim() || null
}
