import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/features/dashboard/components/profile-form'
import { PasswordForm } from '@/features/dashboard/components/password-form'

export default async function SettingsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch the profile for the current display_name
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Account Settings</h1>
                <p className="text-zinc-400 mt-2">Manage your personal information and security preferences.</p>
            </header>

            <div className="grid gap-8">
                {/* Profile Information */}
                <Card className="bg-zinc-950/50 border-zinc-800 backdrop-blur-sm text-white shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-xl">Profile Information</CardTitle>
                        <CardDescription className="text-zinc-400">Update your account&apos;s public-facing details.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ProfileForm
                            userId={user.id}
                            email={user.email || ''}
                            defaultName={profile?.display_name || ''}
                        />
                    </CardContent>
                </Card>

                {/* Password Security */}
                <Card className="bg-zinc-950/50 border-zinc-800 backdrop-blur-sm text-white shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-xl">Security</CardTitle>
                        <CardDescription className="text-zinc-400">Update your password to keep your account secure.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PasswordForm />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
