'use server'

import { createClient } from '@/lib/supabase/server'
import { checkQpayMerchantConnection } from '@/lib/qpay/client'
import { getActiveQpayMerchant, type QpayMerchant } from '@/lib/qpay/config'

export async function checkQpayMerchantConnections() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Нэвтрэх шаардлагатай.')
    const { data: role, error } = await supabase.from('user_roles')
        .select('role').eq('user_id', user.id).maybeSingle()
    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')

    const merchants: QpayMerchant[] = ['legacy', 'zurkhai']
    const connections = await Promise.all(merchants.map(async (merchant) => {
        try {
            await checkQpayMerchantConnection(merchant)
            return { merchant, connected: true }
        } catch {
            // Provider errors may contain sensitive details; expose only status.
            return { merchant, connected: false }
        }
    }))
    return { active: getActiveQpayMerchant(), connections }
}
