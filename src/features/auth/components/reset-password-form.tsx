'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recoveryTokenFromHash, verifyRecoveryToken } from '@/lib/auth/recovery'
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
    const [token, setToken] = useState<string | null>(null)
    const [verifying, setVerifying] = useState(false)

    useEffect(() => {
        const recoveryToken = recoveryTokenFromHash(window.location.hash)
        if (recoveryToken) {
            setToken(recoveryToken)
            // Do not redeem on page load: email scanners must not consume the link.
            return
        }
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

    async function verifyLink() {
        if (!token || verifying) return
        setVerifying(true)
        setError(null)
        try {
            const supabase = createClient()
            const verified = await verifyRecoveryToken(token, (input) => supabase.auth.verifyOtp(input))
            if (!verified) {
                setError('Энэ холбоос ашиглагдсан эсвэл хугацаа нь дууссан байна. Доорх холбоосоор шинэ и-мэйл хүснэ үү.')
                return
            }
            window.history.replaceState(null, '', '/auth/reset-password?recovery=1')
            setToken(null)
            setReady(true)
        } catch {
            setError('Холбоосыг шалгаж чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.')
        } finally {
            setVerifying(false)
        }
    }

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

        if (!ready || saving) return
        setSaving(true)
        let result
        try {
            result = await completePasswordRecovery(password)
        } catch {
            setError('Нууц үгийг шинэчилж чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.')
            setSaving(false)
            return
        }
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
            {token && !ready && <div className="px-6 pb-5 space-y-3">
                <p className="text-sm text-zinc-400">Үргэлжлүүлэх товчийг дарж шинэ нууц үгээ оруулна уу. Энэ холбоосыг утас эсвэл компьютер дээрээ ашиглаж болно.</p>
                <Button type="button" onClick={verifyLink} disabled={verifying} className="w-full">{verifying ? 'Шалгаж байна...' : 'Нууц үг сэргээхийг үргэлжлүүлэх'}</Button>
            </div>}
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
                    {!ready && <Link href="/forgot-password" className="block text-sm text-indigo-400 underline">Шинэ сэргээх холбоос авах</Link>}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="h-11 w-full rounded-xl bg-white font-semibold text-black hover:bg-zinc-200" disabled={!ready || saving}>{saving ? 'Хадгалж байна...' : 'Нууц үг шинэчлэх'}</Button>
                </CardFooter>
            </form>
        </Card>
    )
}
