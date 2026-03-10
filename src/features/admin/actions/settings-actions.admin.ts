'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAppSettings() {
    const supabase = await createClient()

    // No admin check here: setting values like 'landing_title_main' and 'app_logo_url' 
    // must be publicly readable by anyone visiting the site.
    // Note: If you do not see settings logged out, ensure the 'app_settings' table
    // in Supabase has a permissive SELECT policy for 'public'.

    const { data, error } = await supabase
        .from('app_settings')
        .select('*')

    if (error) {
        console.error('Error fetching settings:', error)
        return null
    }

    const settings = data.reduce((acc: any, row: any) => {
        acc[row.id] = row.value
        return acc
    }, {})

    return settings
}

export async function updateAppSetting(id: string, value: string) {
    const supabase = await createClient()

    // Ensure user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return { success: false, error: 'Unauthorized' }

    const { error } = await supabase
        .from('app_settings')
        .upsert({ id, value, updated_at: new Date().toISOString() })

    if (error) {
        console.error('Error updating setting:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/admin/settings')
    revalidatePath('/', 'layout') // Revalidate entire app so Navbar and Home page see the new settings
    return { success: true }
}
