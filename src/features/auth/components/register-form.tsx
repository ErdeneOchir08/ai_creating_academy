'use client'

import { useTranslations } from '@/components/language-provider'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signup } from '@/features/auth/actions/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { withReturnPath } from '@/lib/auth/return-path'
import Link from 'next/link'
import { ResendConfirmationForm } from './resend-confirmation-form'

function SubmitButton() {
    const t = useTranslations()

    const { pending } = useFormStatus()
    return <Button className="h-11 w-full rounded-xl bg-white font-semibold text-black transition-all duration-300 hover:bg-zinc-200" type="submit" disabled={pending}>{pending ? t("Бүртгэж байна…") : t("Бүртгүүлэх")}</Button>
}

export function RegisterForm({ returnPath }: { returnPath: string | null }) {
    const t = useTranslations()

    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [confirmation, setConfirmation] = useState<{ email: string; requestedAt: number } | null>(null)

    async function clientAction(formData: FormData) {
        setError(null)
        setSuccess(null)
        setConfirmation(null)
        const result = await signup(formData)
        if (result?.error) setError(result.error)
        if (result?.success) {
            setSuccess(result.success)
            setConfirmation({ email: String(formData.get('email') ?? ''), requestedAt: Date.now() })
        }
    }

    return (
        <Card className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border-zinc-800/50 bg-zinc-950/40 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-2 pb-6">
                <CardTitle className="text-2xl font-bold text-white">{t("Бүртгэл үүсгэх")}</CardTitle>
                <CardDescription className="text-zinc-400">{t("Академид нэгдэж, AI сурах аяллаа эхлүүлээрэй.")}</CardDescription>
            </CardHeader>
            <form action={clientAction}>
                <CardContent className="space-y-5">
                    {returnPath && <input type="hidden" name="next" value={returnPath} />}
                    <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-zinc-300">{t("Овог нэр")}</Label>
                        <Input id="full_name" name="full_name" placeholder={t("Жишээ: Бат Болд")} required autoComplete="name" className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 text-white" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-zinc-300">{t("И-мэйл хаяг")}</Label>
                        <Input id="email" name="email" type="email" placeholder="m@example.com" required autoComplete="email" className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 text-white" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-zinc-300">{t("Нууц үг")}</Label>
                        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 text-white" />
                    </div>
                    {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm font-medium text-red-400">{t(error)}</div>}
                    {success && <div role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-300">{t(success)}</div>}
                </CardContent>
                <CardFooter className="flex w-full flex-col space-y-5">
                    <SubmitButton />
                    <div className="w-full space-y-3">
                        <p className="text-center text-sm text-zinc-400">{t("Өмнө нь бүртгүүлсэн үү?")}</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Button asChild variant="outline" className="h-11 border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                                <Link href={withReturnPath('/login', returnPath)}>{t("Нэвтрэх")}</Link>
                            </Button>
                            <Button asChild variant="outline" className="h-11 border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                                <Link href="/forgot-password">{t("Нууц үг сэргээх")}</Link>
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            </form>
            {confirmation && <ResendConfirmationForm key={confirmation.requestedAt} {...confirmation} returnPath={returnPath} />}
        </Card>
    )
}
