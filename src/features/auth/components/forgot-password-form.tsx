'use client'

import { useTranslations } from '@/components/language-provider'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { requestPasswordReset } from '@/features/auth/actions/auth-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailDeliveryHelp } from './email-delivery-help'

function SubmitButton() {
    const t = useTranslations()

    const { pending } = useFormStatus()
    return <Button type="submit" className="h-11 w-full rounded-xl bg-white font-semibold text-black hover:bg-zinc-200" disabled={pending}>{pending ? t("Илгээж байна...") : t("Сэргээх холбоос илгээх")}</Button>
}

export function ForgotPasswordForm() {
    const t = useTranslations()

    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    async function clientAction(formData: FormData) {
        setError(null)
        setSuccess(null)
        const result = await requestPasswordReset(formData)
        if (result.error) setError(result.error)
        if (result.success) setSuccess(result.success)
    }

    return (
        <Card className="mx-auto w-full max-w-md rounded-2xl border-zinc-800/50 bg-zinc-950/40 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-2">
                <CardTitle className="text-2xl font-bold text-white">{t("Нууц үг сэргээх")}</CardTitle>
                <CardDescription className="text-zinc-400">{t("Бүртгэлтэй и-мэйл хаягаа оруулна уу. Бид танд нууц үг солих холбоос илгээнэ.")}</CardDescription>
            </CardHeader>
            <form action={clientAction}>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-zinc-300">{t("И-мэйл хаяг")}</Label>
                        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="m@example.com" className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 text-white" />
                    </div>
                    {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm font-medium text-red-400">{t(error)}</p>}
                    {success && <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-300">{t(success)}</p>}
                    {success && <EmailDeliveryHelp />}
                </CardContent>
                <CardFooter className="flex flex-col gap-5">
                    <SubmitButton />
                    <Link href="/login" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline">{t("Нэвтрэх хуудас руу буцах")}</Link>
                </CardFooter>
            </form>
        </Card>
    )
}
