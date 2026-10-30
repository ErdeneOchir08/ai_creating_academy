'use client'

import { useTranslations } from '@/components/language-provider'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { login } from '@/features/auth/actions/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { withReturnPath } from '@/lib/auth/return-path'
import Link from 'next/link'

function SubmitButton() {
    const t = useTranslations()

    const { pending } = useFormStatus()
    return (
        <Button
            className="w-full h-11 bg-white text-black hover:bg-zinc-200 transition-all duration-300 font-semibold rounded-xl"
            type="submit"
            disabled={pending}
        >
            {pending ? t("Нэвтэрч байна...") : t("Нэвтрэх")}
        </Button>
    )
}

export function LoginForm({ returnPath }: { returnPath: string | null }) {
    const t = useTranslations()

    const [error, setError] = useState<string | null>(null)

    async function clientAction(formData: FormData) {
        const result = await login(formData)
        if (result?.error) {
            setError(result.error)
        }
    }

    return (
        <Card className="w-full max-w-md mx-auto bg-zinc-950/40 border-zinc-800/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="space-y-2 pb-6">
                <CardTitle className="text-2xl font-bold text-white">{t("Тавтай морилно уу")}</CardTitle>
                <CardDescription className="text-zinc-400">{t("Бүртгэл рүүгээ нэвтрэхийн тулд и-мэйл болон нууц үгээ оруулна уу.")}</CardDescription>
            </CardHeader>
            <form action={clientAction}>
                <CardContent className="space-y-5">
                    {returnPath && <input type="hidden" name="next" value={returnPath} />}
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-zinc-300">{t("И-мэйл хаяг")}</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="m@example.com"
                            required
                            className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl h-11 focus-visible:ring-indigo-500/50 transition-all duration-300"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-zinc-300">{t("Нууц үг")}</Label>
                            <Link href="/forgot-password" className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300 hover:underline">{t("Нууц үгээ мартсан уу?")}</Link>
                        </div>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl h-11 focus-visible:ring-indigo-500/50 transition-all duration-300"
                        />
                    </div>
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-500 font-medium">
                            {t(error)}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col space-y-5">
                    <SubmitButton />
                    <div className="text-sm text-center text-zinc-400 w-full">{t("Бүртгэлгүй юу?")}{' '}
                        <Link href={withReturnPath('/register', returnPath)} className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium transition-colors">{t("Үнэгүй бүртгүүлэх")}</Link>
                    </div>
                </CardFooter>
            </form>
        </Card>
    )
}
