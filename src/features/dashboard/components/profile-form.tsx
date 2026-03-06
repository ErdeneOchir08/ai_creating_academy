'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateProfileName } from '@/features/auth/actions/auth-actions'
import { useFormStatus } from 'react-dom'

function SubmitProfileButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="bg-indigo-600 hover:bg-indigo-700 text-white mt-2 font-semibold">
            {pending ? 'Saving...' : 'Save Profile'}
        </Button>
    )
}

export function ProfileForm({ userId, email, defaultName }: { userId: string; email: string; defaultName: string }) {
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

    async function handleAction(formData: FormData) {
        setMessage(null)
        const result = await updateProfileName(formData)

        if (result?.error) {
            setMessage({ type: 'error', text: result.error })
        } else if (result?.success) {
            setMessage({ type: 'success', text: result.success })
        }
    }

    return (
        <form action={handleAction} className="space-y-4 max-w-md">
            <input type="hidden" name="userId" value={userId} />

            <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">Email Address (Read-Only)</Label>
                <Input
                    id="email"
                    type="email"
                    disabled
                    defaultValue={email}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed"
                />
                <p className="text-xs text-zinc-500">Your email address cannot be changed at this time.</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="full_name" className="text-zinc-300">Display Name</Label>
                <Input
                    id="full_name"
                    name="full_name"
                    required
                    defaultValue={defaultName}
                    className="bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500 text-white"
                    placeholder="Jane Doe"
                />
            </div>

            {message && (
                <div className={`p-3 rounded-lg border text-sm font-medium ${message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                    {message.text}
                </div>
            )}

            <SubmitProfileButton />
        </form>
    )
}
