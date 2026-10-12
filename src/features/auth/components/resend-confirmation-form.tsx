'use client'

import { useEffect, useRef, useState } from 'react'
import { resendConfirmation } from '@/features/auth/actions/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmailDeliveryHelp } from './email-delivery-help'

export function ResendConfirmationForm({ email, returnPath, requestedAt }: {
    email: string; returnPath: string | null; requestedAt: number
}) {
    const [remaining, setRemaining] = useState(60)
    const [pending, setPending] = useState(false)
    const [result, setResult] = useState<{ error?: string; success?: string }>({})
    const nextAllowedAt = useRef(requestedAt + 60_000)
    const inFlight = useRef(false)
    useEffect(() => {
        const timer = setInterval(() => {
            setRemaining(Math.max(0, Math.ceil((nextAllowedAt.current - Date.now()) / 1000)))
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    async function submit(formData: FormData) {
        if (inFlight.current || Date.now() < nextAllowedAt.current) return
        inFlight.current = true
        setPending(true)
        setResult({})
        try {
            setResult(await resendConfirmation(formData))
        } catch {
            setResult({ error: 'Холболт амжилтгүй боллоо. Түр хүлээгээд дахин оролдоно уу.' })
        } finally {
            nextAllowedAt.current = Date.now() + 60_000
            setRemaining(60)
            setPending(false)
            inFlight.current = false
        }
    }

    return (
        <form action={submit} className="space-y-3 border-t border-zinc-800 p-6">
            <EmailDeliveryHelp />
            <Label htmlFor="confirmation-email">Баталгаажуулах и-мэйл хаяг</Label>
            <Input id="confirmation-email" name="email" type="email" autoComplete="email" defaultValue={email} required maxLength={254} />
            {returnPath && <input type="hidden" name="next" value={returnPath} />}
            <Button type="submit" variant="outline" className="h-auto min-h-11 w-full whitespace-normal" disabled={pending || remaining > 0}>
                {pending ? 'Илгээж байна…' : remaining > 0 ? `Дахин илгээх хүртэл ${remaining} секунд` : 'Баталгаажуулах и-мэйл дахин илгээх'}
            </Button>
            {result.error && <p role="alert" className="text-sm text-red-400">{result.error}</p>}
            {result.success && <p role="status" className="text-sm text-emerald-300">{result.success}</p>}
        </form>
    )
}
