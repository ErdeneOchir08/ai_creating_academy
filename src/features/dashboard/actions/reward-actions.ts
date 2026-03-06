'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserProgressDashboard } from './progress-dashboard-actions'

export async function redeemXpForDiscount(xpCost: number, discountPercentage: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Verify they have enough XP
    const progressData = await getUserProgressDashboard()
    if (!progressData) {
        return { error: 'Could not fetch progress data' }
    }

    const { totalXP } = progressData.gamification

    if (totalXP < xpCost) {
        return { error: 'Not enough XP for this reward' }
    }

    // Insert redemption record
    const { error } = await supabase
        .from('xp_redemptions')
        .insert([{
            user_id: user.id,
            xp_amount_spent: xpCost,
            discount_percentage: discountPercentage,
            is_used: false
        }])

    if (error) {
        console.error('Error recording XP redemption:', error)
        return { error: 'Failed to redeem reward. Please try again.' }
    }

    revalidatePath('/dashboard/progress')
    return { success: `Successfully claimed ${discountPercentage}% discount!` }
}
