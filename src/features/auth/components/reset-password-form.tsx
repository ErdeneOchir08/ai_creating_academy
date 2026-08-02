'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { completePasswordRecovery } from '@/features/auth/actions/auth-actions'

export function ResetPasswordForm() {
    const router = useRouter()
    const [ready, setReady] = useState(false)
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const recoveryLink = new URLSearchParams(window.location.search).get('recovery') === '1'
        const supabase = createClient()
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' && session) setReady(true)
        })

        void supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && recoveryLink) setReady(true)
            else setError('Энэ нууц үг сэргээх холбоос хүчингүй болсон эсвэл хугацаа нь дууссан байна.')
        })

        return () => listener.subscription.unsubscribe()
    }, [])

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        if (password.length < 8) {
            setError('Нууц үг дор хаяж 8 тэмдэгттэй байх ёстой.')
            return
        }
        if (password !== confirmation) {
            setError('Нууц үг хоорондоо таарахгүй байна.')
            return
        }

        setSaving(true)
        const result = await completePasswordRecovery(password)
        if (result.error) {
            setError(result.error)
            setSaving(false)
            return
        }

        router.replace('/login?passwordReset=1')
    }

    return (
        <Card className="mx-auto w-full max-w-md rounded-2xl border-zinc-800/50 bg-zinc-950/40 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-2">
                <CardTitle className="text-2xl font-bold text-white">Шинэ нууц үг үүсгэх</CardTitle>
                <CardDescription className="text-zinc-400">Аюулгүй, өмнө нь ашиглаагүй нууц үг сонгоно уу.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-zinc-300">Шинэ нууц үг</Label>
                        <Input id="password" type="password" autoComplete="new-password" minLength={8} required disabled={!ready || saving} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 text-white" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmation" className="text-zinc-300">Шинэ нууц үг давтах</Label>
                        <Input id="confirmation" type="password" autoComplete="new-password" minLength={8} required disabled={!ready || saving} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 text-white" />
                    </div>
                    {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm font-medium text-red-400">{error}</p>}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="h-11 w-full rounded-xl bg-white font-semibold text-black hover:bg-zinc-200" disabled={!ready || saving}>{saving ? 'Хадгалж байна...' : 'Нууц үг шинэчлэх'}</Button>
                </CardFooter>
            </form>
        </Card>
    )
}
