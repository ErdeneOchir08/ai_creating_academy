'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, ImageUp, TriangleAlert, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    submitCohortPaymentRequest,
    type MyCohortPaymentState,
} from '@/features/payments/actions/cohort-payment-actions'

function formatDeadline(value: string) {
    return new Intl.DateTimeFormat('mn-MN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ulaanbaatar',
    }).format(new Date(value))
}

export function CohortPaymentPanel({ state }: { state: MyCohortPaymentState }) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    if (state.isEnrolled || state.latestRequest?.status === 'approved') {
        return (
            <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
                    <div>
                        <h2 className="text-xl font-semibold text-white">Элсэлт баталгаажсан</h2>
                        <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">Таны төлбөр баталгаажиж, энэ ээлжийн суудал хадгалагдлаа.</p>
                    </div>
                </div>
            </section>
        )
    }

    if (state.latestRequest?.status === 'pending') {
        return (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
                <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
                    <div>
                        <h2 className="text-xl font-semibold text-white">Төлбөр хүлээгдэж байна</h2>
                        <p className="mt-2 text-sm leading-relaxed text-amber-100/70">Таны баримт амжилттай ирсэн. Админ шалгаж баталгаажуулсны дараа суудал хадгалагдана.</p>
                    </div>
                </div>
            </section>
        )
    }

    return (
        <section className="rounded-2xl border border-indigo-500/30 bg-zinc-950 p-6">
            <div className="flex items-start gap-3">
                {state.latestRequest?.status === 'rejected' ? <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" /> : <ImageUp className="mt-0.5 h-6 w-6 shrink-0 text-indigo-400" />}
                <div>
                    <h2 className="text-xl font-semibold text-white">{state.latestRequest?.status === 'rejected' ? 'Баримтаа дахин илгээнэ үү' : 'Төлбөрийн баримт илгээх'}</h2>
                    <p className="mt-2 text-sm text-zinc-400">Төлөх дүн: <strong className="text-emerald-400">₮ {state.amountMnt.toLocaleString('mn-MN')}</strong></p>
                    <p className="mt-1 text-sm text-zinc-400">Эцсийн хугацаа: <strong className="text-zinc-200">{formatDeadline(state.paymentDueAt)}</strong></p>
                </div>
            </div>

            {state.latestRequest?.status === 'rejected' && (
                <p className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                    <strong>Буцаасан шалтгаан:</strong> {state.latestRequest.rejectionReason || 'Баримтын мэдээллийг шалгаад дахин илгээнэ үү.'}
                </p>
            )}

            {state.isTestMode && (
                <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />Төлбөрийн систем туршилтын горимд байна. Бодит шилжүүлэг хийхээс өмнө академийн админтай холбогдоно уу.
                </p>
            )}

            <div className="mt-5 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm leading-6 text-zinc-300">
                {state.paymentInstructions || 'Төлбөрийн дансны мэдээлэл одоогоор тохируулагдаагүй байна. Академийн админтай холбогдоно уу.'}
            </div>

            {state.paymentOverdue ? (
                <p className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">Төлбөр төлөх хугацаа дууссан байна. Хугацааг сунгуулахын тулд академийн админтай холбогдоно уу.</p>
            ) : !state.paymentInstructions ? null : (
                <form
                    ref={formRef}
                    className="mt-5 space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        setError(null)
                        const formData = new FormData(event.currentTarget)
                        startTransition(async () => {
                            const result = await submitCohortPaymentRequest(state.applicationId, formData)
                            if (!result.success) return setError(result.error ?? 'Төлбөрийн баримтыг илгээж чадсангүй.')
                            formRef.current?.reset()
                            router.refresh()
                        })
                    }}
                >
                    <label className="block space-y-2 text-sm text-zinc-300">
                        <span className="font-medium">Төлбөрийн баримтын зураг</span>
                        <input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-white" />
                        <span className="block text-xs text-zinc-600">JPEG, PNG эсвэл WebP зураг · 10 MB хүртэл</span>
                    </label>
                    <Button type="submit" disabled={pending} className="bg-indigo-600 hover:bg-indigo-700">
                        {pending ? 'Илгээж байна…' : 'Баримт илгээх'}
                    </Button>
                    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                </form>
            )}
        </section>
    )
}
