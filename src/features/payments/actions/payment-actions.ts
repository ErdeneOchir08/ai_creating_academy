'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitPaymentRequest(courseId: string, formData: FormData) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Must be logged in to buy a course.")

    const file = formData.get('receipt') as File
    if (!file || file.size === 0) {
        return { success: false, error: 'No receipt file provided.' }
    }

    const discountId = formData.get('discountId') as string | null

    // Mark discount as used if provided
    if (discountId) {
        await supabase
            .from('xp_redemptions')
            .update({ is_used: true })
            .eq('id', discountId)
            .eq('user_id', user.id)
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}-${Date.now()}.${fileExt}`

    // We expect a bucket named 'receipts' to be created in Supabase
    const { error: uploadError } = await supabase
        .storage
        .from('receipts')
        .upload(fileName, file)

    if (uploadError) {
        console.error('Error uploading receipt:', uploadError.message)
        return { success: false, error: `Failed to upload receipt: ${uploadError.message}. Make sure the 'receipts' storage bucket exists.` }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
        .storage
        .from('receipts')
        .getPublicUrl(fileName)

    const { error } = await supabase
        .from('payment_requests')
        .insert({
            course_id: courseId,
            user_id: user.id,
            proof_image_url: publicUrl,
            status: 'pending'
        })

    if (error) {
        console.error('Error submitting payment request:', error.message)
        return { success: false, error: error.message }
    }

    // Try to trigger Telegram notification
    try {
        // Fetch course details for name
        const { data: courseData } = await supabase.from('courses').select('title').eq('id', courseId).single()

        // Fetch settings using secure RPC so logged in students can trigger the notification
        const { data: settingsData } = await supabase.rpc('get_app_settings_secure')

        if (settingsData && courseData) {
            const settings = settingsData.reduce((acc: any, row: any) => {
                acc[row.id] = row.value
                return acc
            }, {})

            const token = settings['telegram_bot_token']
            const chatId = settings['telegram_chat_id']

            if (token && chatId && token.trim() !== '' && chatId.trim() !== '') {
                // Fetch profiles name
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
                const userName = profile?.full_name || user.email

                const message = `🚨 <b>New Payment Request!</b> 💰\n\n<b>Student:</b> ${userName}\n<b>Course:</b> ${courseData.title}\n\n<a href="${publicUrl}">View Receipt Image</a>\n\n<i>Please check the Admin Dashboard to approve their access.</i>`

                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: message,
                        parse_mode: 'HTML'
                    })
                })
            }
        }
    } catch (e) {
        console.error("Failed to send telegram notification", e)
        // We do not throw here, so the payment succeeds even if the notification fails
    }

    revalidatePath('/dashboard')
    revalidatePath('/admin/payments')
    return { success: true }
}

export async function checkPaymentStatus(courseId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // First check if they are already enrolled
    const { data: enrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single()

    if (enrollment) return 'enrolled'

    // If not enrolled, check if there's a pending request
    const { data: request } = await supabase
        .from('payment_requests')
        .select('status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    return request?.status || 'none'
}
