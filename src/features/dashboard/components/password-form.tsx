'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updatePassword } from '@/features/auth/actions/auth-actions'
import { useFormStatus } from 'react-dom'

function SubmitPasswordButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} variant="secondary" className="bg-zinc-800 text-white hover:bg-zinc-700 mt-2 border border-zinc-700 font-semibold">
            {pending ? 'Шинэчилж байна...' : 'Нууц үг өөрчлөх'}
        </Button>
    )
}

export function PasswordForm() {
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const [confirmation, setConfirmation] = useState('')

    async function handleAction(formData: FormData) {
        setMessage(null)
        const password = String(formData.get('password') ?? '')

        if (password !== confirmation) {
            setMessage({ type: 'error', text: 'Нууц үг хоорондоо таарахгүй байна.' })
            return
        }

        const result = await updatePassword(formData)

        if (result?.error) {
            setMessage({ type: 'error', text: result.error })
        } else if (result?.success) {
            setMessage({ type: 'success', text: result.success })
            // Optional: reset the form via a ref, but simple enough to just leave the stars here.
        }
    }

    return (
        <form action={handleAction} className="space-y-4 max-w-md">
            <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300">Шинэ нууц үг</Label>
                <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500 text-white"
                    placeholder="••••••••"
                />
                <p className="text-xs text-zinc-500">Доод тал нь 6 тэмдэгт байх ёстой.</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="password_confirmation" className="text-zinc-300">Нууц үгээ давтана уу</Label>
                <Input
                    id="password_confirmation"
                    name="password_confirmation"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500 text-white"
                />
            </div>

            {message && (
                <div className={`p-3 rounded-lg border text-sm font-medium ${message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                    {message.text}
                </div>
            )}

            <SubmitPasswordButton />
        </form>
    )
}
