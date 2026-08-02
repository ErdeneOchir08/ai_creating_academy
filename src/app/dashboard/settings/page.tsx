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
        <div className="mx-auto max-w-4xl space-y-8 p-5 sm:p-8">
            <header className="mb-6 sm:mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Бүртгэлийн тохиргоо</h1>
                <p className="text-zinc-400 mt-2">Хувийн мэдээлэл болон аюулгүй байдлын тохиргоогоо удирдах.</p>
            </header>

            <div className="grid gap-8">
                {/* Profile Information */}
                <Card className="bg-zinc-950/50 border-zinc-800 backdrop-blur-sm text-white shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-xl">Профайлын мэдээлэл</CardTitle>
                        <CardDescription className="text-zinc-400">Бүртгэлийнхээ нийтэд харагдах мэдээллийг шинэчлэх.</CardDescription>
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
                        <CardTitle className="text-xl">Аюулгүй байдал</CardTitle>
                        <CardDescription className="text-zinc-400">Бүртгэлийнхээ аюулгүй байдлыг хангах үүднээс нууц үгээ шинэчлээрэй.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PasswordForm />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
