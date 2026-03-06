'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPayments({ status, search }: { status?: string, search?: string } = {}) {
    const supabase = await createClient()

    // Ensure user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return []

    // Build query
    let queryBuilder = supabase
        .from('payment_requests')
        .select(`
      id,
      status,
      proof_image_url,
      created_at,
      user_id,
      course_id,
      profiles ( display_name, email:id ),
      courses ( title, price_display )
    `)
        .order('created_at', { ascending: false })

    if (status && status !== 'all') {
        queryBuilder = queryBuilder.eq('status', status)
    }

    const { data: rawData, error } = await queryBuilder

    if (error) {
        console.error('Error fetching payments:', error.message)
        return []
    }

    let filteredData = rawData || []

    if (search) {
        const lowerSearch = search.toLowerCase()
        filteredData = filteredData.filter((payment: any) => {
            const studentName = (payment.profiles?.display_name || '').toLowerCase()
            const courseTitle = (payment.courses?.title || '').toLowerCase()
            return studentName.includes(lowerSearch) || courseTitle.includes(lowerSearch)
        })
    }

    return filteredData
}

export async function approvePayment(requestId: string, userId: string, courseId: string) {
    const supabase = await createClient()

    // 1. Update request status to approved
    const { error: updateError } = await supabase
        .from('payment_requests')
        .update({ status: 'approved' })
        .eq('id', requestId)

    if (updateError) {
        console.error('Error approving payment:', updateError.message)
        return false
    }

    // 2. Grant access by inserting into enrollments
    const { error: enrollError } = await supabase
        .from('enrollments')
        .insert({ user_id: userId, course_id: courseId })

    if (enrollError) {
        console.error('Error creating enrollment:', enrollError.message)
        return false
    }

    revalidatePath('/admin')
    return true
}

export async function rejectPayment(requestId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('payment_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)

    if (error) {
        console.error('Error rejecting payment:', error.message)
        return false
    }

    revalidatePath('/admin')
    return true
}
