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
import { approvePayment, rejectPayment, resendPaymentDecisionEmail } from '@/features/admin/actions/admin-actions'

export function PaymentReviewActions({ paymentId, status }: { paymentId: string; status?: 'approved' | 'rejected' }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  function review(kind: 'approve' | 'reject', reason?: string) {
    setError(null)
    startTransition(async () => {
      const result = kind === 'approve'
        ? await approvePayment(paymentId)
        : await rejectPayment(paymentId, reason)

      if (result?.error) {
        setError(result.error)
        return
      }

      if (result?.notificationError) {
        setError(`Төлбөрийн төлөв хадгалагдсан боловч имэйл илгээгдсэнгүй: ${result.notificationError}`)
      }

      if (kind === 'reject') setRejectOpen(false)

      router.refresh()
    })
  }

  function resendEmail() {
    setError(null)
    startTransition(async () => {
      const result = await resendPaymentDecisionEmail(paymentId)
      if (result?.error) {
        setError(result.error)
        return
      }
      setError('Суралцагчид имэйл дахин илгээгдлээ.')
    })
  }

  if (status) {
    return (
      <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-36">
        <Button type="button" disabled={isPending} onClick={resendEmail} variant="outline" className="w-full border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-800">
          {isPending ? 'Илгээж байна...' : 'Имэйл дахин илгээх'}
        </Button>
        {error && <p className="text-center text-xs text-amber-300">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-36">
      <Button
        type="button"
        disabled={isPending}
        onClick={() => review('approve')}
        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
      >
        {isPending ? 'Боловсруулж байна…' : 'Зөвшөөрөх'}
      </Button>
      <Button
        type="button"
        disabled={isPending}
        onClick={() => setRejectOpen(true)}
        variant="destructive"
        className="w-full bg-red-900/60 text-white hover:bg-red-700"
      >
        Татгалзах
      </Button>
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Төлбөрөөс татгалзах уу?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">Шалтгаан нь суралцагчийн имэйлд очно. Хоосон орхивол ерөнхий заавар л илгээгдэнэ.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} placeholder="Жишээ: Баримтын дүн тодорхой харагдахгүй байна." className="border-zinc-700 bg-zinc-900 text-white" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white">Болих</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={isPending} onClick={() => review('reject', rejectionReason)}>{isPending ? 'Илгээж байна…' : 'Татгалзах'}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
