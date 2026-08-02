'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { sendTelegramTestAlert } from '@/features/admin/actions/settings-actions.admin'

export function TelegramNotificationSettings({ configured }: { configured: boolean }) {
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
    const [sending, setSending] = useState(false)

    async function sendTest() {
        setSending(true)
        setMessage(null)
        const result = await sendTelegramTestAlert()
        setMessage(result.error
            ? { type: 'error', text: result.error }
            : { type: 'success', text: result.success ?? 'Туршилтын мэдэгдэл илгээгдлээ.' })
        setSending(false)
    }

    return (
        <div className="space-y-4">
            <p className={configured ? 'text-sm font-medium text-emerald-400' : 'text-sm font-medium text-amber-300'}>
                {configured ? 'Telegram мэдэгдэл бэлэн байна.' : 'Telegram тохиргоо олдсонгүй.'}
            </p>
            <p className="text-sm text-zinc-400">Шинэ төлбөрийн баримт илгээгдэхэд энэ групп рүү шууд мэдэгдэл очно. Нууц токен дэлгэцэнд хэзээ ч харагдахгүй.</p>
            <Button type="button" disabled={!configured || sending} onClick={sendTest} className="bg-indigo-600 text-white hover:bg-indigo-700">
                {sending ? 'Илгээж байна...' : 'Туршилтын мэдэгдэл илгээх'}
            </Button>
            {message && <p className={message.type === 'error' ? 'text-sm font-medium text-red-400' : 'text-sm font-medium text-emerald-400'}>{message.text}</p>}
        </div>
    )
}
