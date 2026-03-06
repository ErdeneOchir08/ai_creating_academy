'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAllUsers() {
    const supabase = await createClient()

    // Fetch all profiles
    const { data: users, error } = await supabase
        .from('profiles')
        .select(`
            id,
            display_name,
            avatar_url,
            role,
            created_at,
            enrollments ( count )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching users:', error)
        return []
    }

    return users
}

export async function updateUserRole(userId: string, targetRole: 'student' | 'admin') {
    const supabase = await createClient()

    const { error } = await supabase
        .from('profiles')
        .update({ role: targetRole })
        .eq('id', userId)

    if (error) {
        console.error('Error updating user role:', error)
        throw new Error(error.message)
    }

    // Usually you need revalidatePath to refresh the users list
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/admin/users')
}

export async function deleteUser(userId: string) {
    // Note: Deleting auth.users requires the Supabase Service Role Key.
    // If not set up, it will just delete the profile or fail if FK constraints exist.
    // First let's try to delete the profile which is all we can do without service role.
    const supabase = await createClient()

    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

    if (error) {
        console.error('Error deleting user profile:', error)
        throw new Error(error.message)
    }

    const { revalidatePath } = await import('next/cache')
    revalidatePath('/admin/users')
}
