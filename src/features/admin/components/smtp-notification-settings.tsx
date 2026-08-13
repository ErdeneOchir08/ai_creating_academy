'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendSmtpTestAlert } from '@/features/admin/actions/settings-actions.admin'

export function SmtpNotificationSettings({ configured }: { configured: boolean }) {
    const [recipient, setRecipient] = useState('')
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
    const [sending, setSending] = useState(false)

    async function sendTest() {
        setSending(true)
        setMessage(null)

        const formData = new FormData()
        formData.set('recipient', recipient)
        const result = await sendSmtpTestAlert(formData)

        setMessage(result.error
            ? { type: 'error', text: result.error }
            : { type: 'success', text: result.success ?? 'Туршилтын и-мэйл илгээгдлээ.' })
        setSending(false)
    }

    return (
        <div className="space-y-4">
            <p className={configured ? 'text-sm font-medium text-emerald-400' : 'text-sm font-medium text-amber-300'}>
                {configured ? 'И-мэйл илгээх тохиргоо бэлэн байна.' : 'SMTP тохиргоо бүрэн биш байна.'}
            </p>
            <p className="text-sm text-zinc-400">
                Админ зөвхөн тохиргоог шалгах зорилгоор нэг туршилтын и-мэйл илгээнэ. Нууц үг дэлгэцэнд харагдахгүй.
            </p>
            <div className="space-y-2">
                <Label htmlFor="smtp-test-recipient">Хүлээн авах и-мэйл</Label>
                <Input
                    id="smtp-test-recipient"
                    type="email"
                    autoComplete="email"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="name@example.com"
                    className="border-zinc-700 bg-zinc-900 text-white"
                />
            </div>
            <Button
                type="button"
                disabled={!configured || !recipient.trim() || sending}
                onClick={sendTest}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
                {sending ? 'Илгээж байна...' : 'Туршилтын и-мэйл илгээх'}
            </Button>
            {message && (
                <p className={message.type === 'error' ? 'text-sm font-medium text-red-400' : 'text-sm font-medium text-emerald-400'}>
                    {message.text}
                </p>
            )}
        </div>
    )
}
