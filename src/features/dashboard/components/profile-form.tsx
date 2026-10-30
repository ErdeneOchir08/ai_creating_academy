'use client'

import { useTranslations } from '@/components/language-provider'
import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateProfileName } from '@/features/auth/actions/auth-actions'
import { useFormStatus } from 'react-dom'

function SubmitProfileButton() {
    const t = useTranslations()

    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="bg-indigo-600 hover:bg-indigo-700 text-white mt-2 font-semibold">
            {pending ? t("Хадгалж байна...") : t("Профайл хадгалах")}
        </Button>
    )
}

export function ProfileForm({ userId, email, defaultName }: { userId: string; email: string; defaultName: string }) {
    const t = useTranslations()

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
                <Label htmlFor="email" className="text-zinc-300">{t("И-мэйл хаяг (Зөвхөн харах)")}</Label>
                <Input
                    id="email"
                    type="email"
                    disabled
                    defaultValue={email}
                    className="bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed"
                />
                <p className="text-xs text-zinc-500">{t("Одоогоор и-мэйл хаяг өөрчлөх боломжгүй байна.")}</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="full_name" className="text-zinc-300">{t("Дэлгэцийн нэр")}</Label>
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
                    {t(message.text)}
                </div>
            )}

            <SubmitProfileButton />
        </form>
    )
}
