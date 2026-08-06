'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Clock3, Loader2, MailCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    approveCourseOfferingPayment,
    rejectCourseOfferingPayment,
    resendCourseOfferingPaymentDecisionEmail,
} from '@/features/admin/actions/offering-payment-actions.admin'
import type {
    AdminOfferingPaymentNotification,
    AdminOfferingPaymentStatus,
} from '@/features/admin/domain/offering-payment-review'

type Props = {
    paymentId: string
    status: AdminOfferingPaymentStatus
    notification: AdminOfferingPaymentNotification | null
    notificationTrackingError: string | null
}

function NotificationStatus({ notification }: { notification: AdminOfferingPaymentNotification }) {
    if (notification.status === 'sent') {
        return <p className="flex items-center gap-1.5 text-xs text-emerald-300"><MailCheck className="h-3.5 w-3.5" />Шийдвэрийн имэйл хүргэгдсэн · {notification.attempts} оролдлого</p>
    }
    if (notification.status === 'failed') {
        return <p className="flex items-center gap-1.5 text-xs text-red-300"><AlertCircle className="h-3.5 w-3.5" />Имэйл илгээгдээгүй · {notification.attempts} оролдлого</p>
    }
    if (notification.status === 'processing') {
        return <p className="flex items-center gap-1.5 text-xs text-sky-300"><Loader2 className="h-3.5 w-3.5 animate-spin" />Имэйл илгээж байна · {notification.attempts} оролдлого</p>
    }
    return <p className="flex items-center gap-1.5 text-xs text-amber-300"><Clock3 className="h-3.5 w-3.5" />Имэйл илгээгдэхээр хүлээгдэж байна · {notification.attempts} оролдлого</p>
}

export function OfferingPaymentReviewActions({
    paymentId,
    status,
    notification,
    notificationTrackingError,
}: Props) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [rejectOpen, setRejectOpen] = useState(false)
    const [reason, setReason] = useState('')
    const [feedback, setFeedback] = useState<string | null>(null)
    const [feedbackIsError, setFeedbackIsError] = useState(false)

    function approve() {
        setFeedback(null)
        startTransition(async () => {
            const result = await approveCourseOfferingPayment(paymentId)
            if (result.error) {
                setFeedbackIsError(true)
                setFeedback(result.error)
                return
            }

            if (result.notificationError) {
                setFeedbackIsError(true)
                setFeedback(`Төлбөр баталгаажсан боловч имэйлд анхаарах зүйл гарлаа: ${result.notificationError}`)
            } else {
                setFeedbackIsError(false)
                setFeedback('Төлбөр баталгаажиж, сургалтын эрх идэвхжлээ.')
            }
            router.refresh()
        })
    }

    function reject() {
        setFeedback(null)
        startTransition(async () => {
            const result = await rejectCourseOfferingPayment(paymentId, reason)
            if (result.error) {
                setFeedbackIsError(true)
                setFeedback(result.error)
                return
            }

            setRejectOpen(false)
            if (result.notificationError) {
                setFeedbackIsError(true)
                setFeedback(`Баримтыг буцаасан боловч имэйлд анхаарах зүйл гарлаа: ${result.notificationError}`)
            } else {
                setFeedbackIsError(false)
                setFeedback('Баримтыг засварлуулахаар буцаалаа.')
            }
            router.refresh()
        })
    }

    function resend() {
        setFeedback(null)
        startTransition(async () => {
            const result = await resendCourseOfferingPaymentDecisionEmail(paymentId)
            if (result.error) {
                setFeedbackIsError(true)
                setFeedback(result.error)
                return
            }
            setFeedbackIsError(false)
            setFeedback('Шийдвэрийн имэйлийг дахин илгээлээ.')
            router.refresh()
        })
    }

    if (status !== 'pending') {
        return (
            <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-52">
                {notificationTrackingError
                    ? <p className="flex items-start gap-1.5 text-xs text-red-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{notificationTrackingError}</p>
                    : notification
                        ? <NotificationStatus notification={notification} />
                        : <p className="flex items-start gap-1.5 text-xs text-amber-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Имэйлийн хүргэлтийн бүртгэл олдсонгүй.</p>}
                {notification?.last_error && (
                    <p className="max-w-64 text-xs leading-5 text-red-300">{notification.last_error}</p>
                )}
                <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={resend}
                    className="border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-800"
                >
                    {pending ? 'Илгээж байна…' : 'Имэйл дахин илгээх'}
                </Button>
                {feedback && <p className={`text-center text-xs ${feedbackIsError ? 'text-red-300' : 'text-emerald-300'}`}>{feedback}</p>}
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-44">
            <Button type="button" disabled={pending} onClick={approve} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {pending ? 'Боловсруулж байна…' : 'Төлбөр зөвшөөрөх'}
            </Button>
            <Button type="button" disabled={pending} variant="destructive" onClick={() => setRejectOpen(true)} className="bg-red-900/60 hover:bg-red-700">
                Засвар шаардах
            </Button>
            {feedback && <p className={`text-center text-xs ${feedbackIsError ? 'text-red-300' : 'text-emerald-300'}`}>{feedback}</p>}

            <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Баримтыг засварлуулахаар буцаах уу?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Тодорхой шалтгаан заавал бичнэ. Энэ тайлбар суралцагчийн имэйлд очиж, дахин баримт илгээх боломж нээлттэй үлдэнэ.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-1.5">
                        <Textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            maxLength={500}
                            placeholder="Жишээ: Гүйлгээний дүн эсвэл дансны мэдээлэл тодорхой харагдахгүй байна."
                            className="min-h-28 border-zinc-700 bg-zinc-900"
                        />
                        <p className="text-right text-xs text-zinc-500">{reason.length}/500</p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending} className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white">Болих</AlertDialogCancel>
                        <Button type="button" variant="destructive" disabled={pending || !reason.trim()} onClick={reject}>
                            {pending ? 'Буцааж байна…' : 'Засварлуулахаар буцаах'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
