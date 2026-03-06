'use server'

import { createClient } from '@/lib/supabase/server'

export async function getEnrolledCourses() {
    const supabase = await createClient()

    // Ensure user is logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Fetch enrollments and inner join with courses
    const { data, error } = await supabase
        .from('enrollments')
        .select(`
      id,
      granted_at,
      courses (
        id,
        title,
        description,
        thumbnail_url
      )
    `)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error fetching enrollments:', error.message)
        return []
    }

    return data
}

export async function getPendingCourses() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Fetch pending payment requests and inner join with courses
    const { data, error } = await supabase
        .from('payment_requests')
        .select(`
      id,
      created_at,
      courses (
        id,
        title,
        description,
        thumbnail_url
      )
    `)
        .eq('user_id', user.id)
        .eq('status', 'pending')

    if (error) {
        console.error('Error fetching pending courses:', error.message)
        return []
    }

    return data
}

export async function getStudentProfile() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('Error fetching profile:', error.message)
        return null
    }

    return data
}
