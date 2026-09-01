'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Clock3, Loader2, MailCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    resendQpayPaymentConfirmationEmail,
    type AdminQpayNotification,
} from '@/features/admin/actions/qpay-payment-actions.admin'

function NotificationStatus({ notification }: { notification: AdminQpayNotification }) {
    if (notification.status === 'sent') {
        return <p className="flex items-center gap-1.5 text-xs text-emerald-300"><MailCheck className="h-3.5 w-3.5" />Баталгаажуулалтын имэйл хүрсэн · {notification.attempts} оролдлого</p>
    }
    if (notification.status === 'failed') {
        return <p className="flex items-center gap-1.5 text-xs text-red-300"><AlertCircle className="h-3.5 w-3.5" />Имэйл илгээгдээгүй · {notification.attempts} оролдлого</p>
    }
    if (notification.status === 'processing') {
        return <p className="flex items-center gap-1.5 text-xs text-sky-300"><Loader2 className="h-3.5 w-3.5 animate-spin" />Имэйл илгээж байна · {notification.attempts} оролдлого</p>
    }
    return <p className="flex items-center gap-1.5 text-xs text-amber-300"><Clock3 className="h-3.5 w-3.5" />Имэйл илгээхээр хүлээгдэж байна</p>
}

export function QpayPaymentConfirmationAction({
    paymentId,
    notification,
}: {
    paymentId: string
    notification: AdminQpayNotification | null
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [feedback, setFeedback] = useState<string | null>(null)
    const [feedbackIsError, setFeedbackIsError] = useState(false)

    function resend() {
        setFeedback(null)
        startTransition(async () => {
            const result = await resendQpayPaymentConfirmationEmail(paymentId)
            if (result.error) {
                setFeedbackIsError(true)
                setFeedback(result.error)
                return
            }
            setFeedbackIsError(false)
            setFeedback('Баталгаажуулалтын имэйлийг илгээлээ.')
            router.refresh()
        })
    }

    return (
        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
            {notification
                ? <NotificationStatus notification={notification} />
                : <p className="flex items-center gap-1.5 text-xs text-amber-300"><AlertCircle className="h-3.5 w-3.5" />Имэйлийн хүргэлтийн бүртгэл олдсонгүй.</p>}
            {notification?.lastError && <p className="text-xs leading-5 text-red-300">{notification.lastError}</p>}
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={resend}
                className="w-full border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-800 md:w-fit"
            >
                {pending ? 'Илгээж байна…' : 'Баталгаажуулалтын имэйл дахин илгээх'}
            </Button>
            {feedback && <p className={`text-xs ${feedbackIsError ? 'text-red-300' : 'text-emerald-300'}`}>{feedback}</p>}
        </div>
    )
}
