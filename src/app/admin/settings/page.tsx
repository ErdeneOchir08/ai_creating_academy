import { getAppSettings } from '@/features/admin/actions/settings-actions.admin'
import { SettingsForm } from '@/features/admin/components/settings-form'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
    title: 'Settings - Admin Portal',
}

export default async function AdminSettingsPage() {
    const supabase = await createClient()

    // Ensure authorized admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/dashboard')

    const settings = await getAppSettings() || {}

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">App Settings</h1>
                <p className="text-zinc-400 mt-2">Manage global platform configurations and API integrations.</p>
            </div>

            <div className="grid gap-6">
                <SettingsForm initialSettings={settings} />
            </div>
        </div>
    )
}
