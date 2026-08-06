'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
    approveCohortPayment,
    rejectCohortPayment,
    resendCohortPaymentEmail,
} from '@/features/admin/actions/cohort-payment-actions.admin'

export function CohortPaymentReviewActions({
    paymentId,
    cohortId,
    status,
}: {
    paymentId: string
    cohortId: string
    status?: 'approved' | 'rejected'
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [rejectOpen, setRejectOpen] = useState(false)
    const [reason, setReason] = useState('')
    const [feedback, setFeedback] = useState<string | null>(null)

    function approve() {
        setFeedback(null)
        startTransition(async () => {
            const result = await approveCohortPayment(paymentId, cohortId)
            if (result.error) return setFeedback(result.error)
            if (result.notificationError) setFeedback(`Элсэлт баталгаажсан боловч имэйл илгээгдсэнгүй: ${result.notificationError}`)
            router.refresh()
        })
    }

    function reject() {
        setFeedback(null)
        startTransition(async () => {
            const result = await rejectCohortPayment(paymentId, cohortId, reason)
            if (result.error) return setFeedback(result.error)
            if (result.notificationError) setFeedback(`Баримтыг буцаасан боловч имэйл илгээгдсэнгүй: ${result.notificationError}`)
            setRejectOpen(false)
            router.refresh()
        })
    }

    function resend() {
        setFeedback(null)
        startTransition(async () => {
            const result = await resendCohortPaymentEmail(paymentId, cohortId)
            setFeedback(result.error ?? 'Имэйл дахин илгээгдлээ.')
        })
    }

    if (status) {
        return (
            <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-40">
                <Button type="button" variant="outline" disabled={pending} onClick={resend} className="border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-800">
                    {pending ? 'Илгээж байна…' : 'Имэйл дахин илгээх'}
                </Button>
                {feedback && <p className="text-center text-xs text-amber-300">{feedback}</p>}
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-40">
            <Button type="button" disabled={pending} onClick={approve} className="bg-emerald-600 hover:bg-emerald-700">
                {pending ? 'Боловсруулж байна…' : 'Төлбөр зөвшөөрөх'}
            </Button>
            <Button type="button" disabled={pending} variant="destructive" onClick={() => setRejectOpen(true)} className="bg-red-900/60 hover:bg-red-700">
                Баримт буцаах
            </Button>
            {feedback && <p className="text-center text-xs text-red-300">{feedback}</p>}

            <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Төлбөрийн баримтыг буцаах уу?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Шалтгаан суралцагчийн имэйл болон элсэлтийн хуудсанд харагдана. Дахин баримт илгээх боломж нээлттэй үлдэнэ.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Жишээ: Гүйлгээний дүн эсвэл дансны мэдээлэл тодорхой харагдахгүй байна." className="border-zinc-700 bg-zinc-900" />
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending} className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white">Болих</AlertDialogCancel>
                        <Button type="button" variant="destructive" disabled={pending || !reason.trim()} onClick={reject}>Баримт буцаах</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
