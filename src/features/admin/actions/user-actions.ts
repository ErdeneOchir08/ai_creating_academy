'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Role = 'student' | 'teacher' | 'admin'

export type AdminUser = {
    id: string
    display_name: string | null
    avatar_url: string | null
    created_at: string
    role: Role
    enrollments: Array<{ count: number }> | null
    enrollment_count: number
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (role?.role !== 'admin') throw new Error('Not authorized')
    return supabase
}

export async function getAllUsers(): Promise<AdminUser[]> {
    const supabase = await requireAdmin()

    // Fetch all profiles
    const [{ data: users, error }, { data: offeringEnrollments, error: offeringEnrollmentError }] = await Promise.all([
        supabase.from('profiles').select(`
            id,
            display_name,
            avatar_url,
            user_roles ( role ),
            created_at,
            enrollments ( count )
        `)
            .order('created_at', { ascending: false }),
        supabase
            .from('course_offering_enrollments')
            .select('content_access_user_id')
            .eq('status', 'active'),
    ])

    if (error || offeringEnrollmentError) {
        console.error('Error fetching users:', error?.message || offeringEnrollmentError?.message)
        return []
    }

    const offeringEnrollmentCountByUser = new Map<string, number>()
    for (const enrollment of offeringEnrollments ?? []) {
        offeringEnrollmentCountByUser.set(
            enrollment.content_access_user_id,
            (offeringEnrollmentCountByUser.get(enrollment.content_access_user_id) ?? 0) + 1,
        )
    }

    return (users || []).map((user) => {
        const roleRelation = Array.isArray(user.user_roles) ? user.user_roles[0] : user.user_roles
        return {
            id: user.id,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            created_at: user.created_at,
            role: (roleRelation?.role || 'student') as Role,
            enrollments: user.enrollments,
            enrollment_count: (user.enrollments?.[0]?.count ?? 0)
                + (offeringEnrollmentCountByUser.get(user.id) ?? 0),
        }
    })
}

export async function updateUserRole(userId: string, targetRole: Role) {
    const supabase = await requireAdmin()

    const { data: currentRole, error: currentRoleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()

    if (currentRoleError || !currentRole) {
        throw new Error('User role record was not found.')
    }

    if (currentRole.role === targetRole) return { success: true }

    if (currentRole.role === 'admin' && targetRole !== 'admin') {
        const { count, error: adminCountError } = await supabase
            .from('user_roles')
            .select('user_id', { count: 'exact', head: true })
            .eq('role', 'admin')

        if (adminCountError) throw new Error(adminCountError.message)
        if ((count ?? 0) <= 1) {
            throw new Error('At least one administrator must remain on the platform.')
        }
    }

    const { data: updatedRole, error } = await supabase
        .from('user_roles')
        .update({ role: targetRole })
        .eq('user_id', userId)
        .select('user_id')
        .maybeSingle()

    if (error || !updatedRole) {
        console.error('Error updating user role:', error)
        throw new Error(error?.message || 'User role could not be updated.')
    }

    revalidatePath('/admin/users')
    return { success: true }
}

export async function deleteUser(userId: string) {
    void userId
    // Auth users must be deleted through a deliberately privileged, audited
    // workflow. Removing only the profile would leave an account that can log in.
    throw new Error('User deletion is not available in this launch version.')
}
