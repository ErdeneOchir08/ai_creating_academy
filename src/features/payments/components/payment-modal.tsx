'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2 } from 'lucide-react'
import { submitPaymentRequest } from '@/features/payments/actions/payment-actions'

type PaymentModalProps = { courseId: string; coursePrice: string; paymentInstructions: string; isTestMode: boolean; rejectionReason?: string | null }

export function PaymentModal({ courseId, coursePrice, paymentInstructions, isTestMode, rejectionReason }: PaymentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const isConfigured = paymentInstructions.trim().length > 0

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setLoading(true)
    try {
      const result = await submitPaymentRequest(courseId, new FormData(event.currentTarget))
      if (result.success) setSuccess(true)
      else setErrorMessage(result.error || 'Баримтыг илгээж чадсангүй.')
    } catch {
      setErrorMessage('Баримтыг илгээж чадсангүй. Дахин оролдоно уу.')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) { setSuccess(false); setErrorMessage('') }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-auto w-full bg-indigo-600 py-3 text-lg font-semibold text-white hover:bg-indigo-700">
          Хичээлд бүртгүүлэх · {coursePrice}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-white sm:max-w-md">
        {success ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-500" />
            <DialogTitle className="mb-2 text-2xl">Баримт илгээгдлээ</DialogTitle>
            <p className="mb-6 text-zinc-400">Админ төлбөрийг шалгасны дараа энэ хичээлд автоматаар элсүүлнэ.</p>
            <Button onClick={() => setOpen(false)} variant="outline" className="border-zinc-700 bg-transparent text-white hover:bg-zinc-800">Хаах</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Төлбөрийн мэдээлэл</DialogTitle>
              <DialogDescription className="mt-2 text-zinc-400">Төлөх дүн: <strong className="text-white">{coursePrice}</strong></DialogDescription>
            </DialogHeader>
            {isConfigured ? (
              <>
                {isTestMode && (
                  <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-amber-200">Туршилтын горим идэвхтэй байна. Бодит мөнгө шилжүүлж болохгүй.</p>
                )}
                <div className="mt-4 whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-900 p-4 text-sm leading-6 text-zinc-200">{paymentInstructions}</div>
              </>
            ) : (
              <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Төлбөрийн мэдээлэл хараахан тохируулагдаагүй байна. Академийн админтай холбогдоно уу.</p>
            )}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {rejectionReason && <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"><strong>Өмнөх хүсэлт татгалзсан шалтгаан:</strong> {rejectionReason}</p>}
              <div className="space-y-2">
                <Label htmlFor="receipt">Төлбөрийн баримт</Label>
                <Input id="receipt" name="receipt" type="file" required accept="image/jpeg,image/png,image/webp" className="border-zinc-700 bg-zinc-800 file:text-indigo-400" />
                <p className="text-xs text-zinc-500">JPG, PNG эсвэл WebP; хамгийн ихдээ 10 MB.</p>
              </div>
              {errorMessage && <p className="text-sm font-medium text-red-400">{errorMessage}</p>}
              <Button type="submit" className="h-10 w-full bg-indigo-600 text-white hover:bg-indigo-700" disabled={loading || !isConfigured}>{loading ? 'Илгээж байна…' : 'Баримт илгээх'}</Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
