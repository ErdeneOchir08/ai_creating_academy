'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { prepareDirectCoursePurchase } from '../actions/offering-checkout-actions'
import { createOfferingQpayInvoice } from '../actions/qpay-payment-actions'
import { directCourseApplication } from '../domain/direct-course-checkout'
import { applicationPaymentAmount } from '../domain/application-payment-amount'
import type { OfferingCheckoutForm } from '../domain/offering-checkout'
import type { QpayInvoicePresentation } from '@/lib/qpay/schemas'
import { QpayPaymentPanel } from './qpay-payment-panel'

export function DirectCoursePurchase({ checkout, owned, qpayEnabled, environment, serverNow }: {
    checkout: OfferingCheckoutForm
    owned: boolean
    qpayEnabled: boolean
    environment: 'sandbox' | 'production'
    serverNow: string
}) {
    const [application, setApplication] = useState(() => directCourseApplication(checkout.my_applications))
    const [hasAccess, setHasAccess] = useState(owned)
    const [invoice, setInvoice] = useState<QpayInvoicePresentation | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const current = directCourseApplication(checkout.my_applications) ?? application

    function purchase() {
        setError(null)
        startTransition(async () => {
            try {
                const prepared = await prepareDirectCoursePurchase(checkout.offering_id)
                if (prepared.error) return setError(prepared.error)
                if (prepared.owned) return setHasAccess(true)
                if (!prepared.application) return setError('Худалдан авалтын мэдээлэл олдсонгүй.')
                setApplication(prepared.application)
                if (!['ready_for_payment', 'correction_required'].includes(prepared.application.application_status)) return
                const result = await createOfferingQpayInvoice(prepared.application.application_id, checkout.offering_id)
                if (result.error || !result.invoice) return setError(result.error ?? 'QPay нэхэмжлэл үүсгэж чадсангүй.')
                setInvoice(result.invoice)
            } catch {
                setError('Холболтын алдаа гарлаа. Дахин оролдоно уу.')
            }
        })
    }

    if (owned || hasAccess) return (
        <section className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <h2 className="text-xl font-semibold">Таны хичээл үзэх эрх нээгдсэн</h2>
            <Button asChild><Link href={`/courses/${checkout.course_id}`}>Хичээлээ үзэх</Link></Button>
        </section>
    )

    if (current?.application_status === 'pending_review') return (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
            <h2 className="text-xl font-semibold">Таны өмнөх төлбөрийг шалгаж байна</h2>
            <p className="mt-3 text-zinc-300">Дахин төлөх шаардлагагүй. Шалгаж дуусмагц хичээл үзэх эрх нээгдэнэ.</p>
        </section>
    )

    const expired = current?.payment_due_at && new Date(current.payment_due_at).getTime() < new Date(serverNow).getTime()
    if (current && (expired || ['approved', 'withdrawn', 'contract_required', 'draft'].includes(current.application_status))) return (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
            <p>Өмнөх худалдан авалтаа шалгуулахын тулд Mind Academy-тай холбогдоно уу. Дахин төлбөр бүү хийгээрэй.</p>
        </section>
    )

    return (
        <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div>
                <h2 className="text-xl font-semibold">Хичээл худалдаж авах</h2>
                <p className="mt-2 text-sm text-zinc-400">QPay-аар төлсний дараа энэ бүртгэлээрээ шууд хичээлээ үзнэ.</p>
            </div>
            {current && applicationPaymentAmount(current) !== checkout.tuition_amount_mnt && (
                <p className="text-sm text-zinc-400">Таны худалдан авалт эхлэх үеийн үнэ хадгалагдсан: ₮ {applicationPaymentAmount(current).toLocaleString('mn-MN')}</p>
            )}
            {pending ? <p role="status">QPay бэлдэж байна…</p> : !qpayEnabled ? <p>QPay төлбөр түр зогссон байна. Дараа дахин оролдоно уу.</p>
                : current ? <QpayPaymentPanel
                    key={current.application_id}
                    applicationId={current.application_id}
                    offeringId={checkout.offering_id}
                    amountMnt={applicationPaymentAmount(current)}
                    environment={environment}
                    allowNewInvoices={checkout.qpay_enabled}
                    initialInvoice={invoice}
                    directPurchase
                /> : checkout.is_accepting_applications && checkout.qpay_enabled ? (
                    <Button onClick={purchase} disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700">
                        {pending ? 'QPay бэлдэж байна…' : `₮ ${checkout.tuition_amount_mnt.toLocaleString('mn-MN')} · QPay-аар төлөх`}
                    </Button>
                ) : <p>Энэ хичээлийн худалдаа түр хаагдсан байна.</p>}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        </section>
    )
}
