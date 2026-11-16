'use client'

import { useTranslations } from '@/components/language-provider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { prepareDirectCoursePurchase } from '../actions/offering-checkout-actions'
import { createOfferingQpayInvoice, retryExpiredDirectQpayInvoice } from '../actions/qpay-payment-actions'
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
    const t = useTranslations()
    const router = useRouter()

    const [application, setApplication] = useState(() => directCourseApplication(checkout.my_applications))
    const [hasAccess, setHasAccess] = useState(owned)
    const [invoice, setInvoice] = useState<{ applicationId: string; data: QpayInvoicePresentation } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [elapsedDeadline, setElapsedDeadline] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const current = directCourseApplication(checkout.my_applications) ?? application
    const currentInvoice = invoice && invoice.applicationId === current?.application_id ? invoice.data : undefined
    const deadline = currentInvoice?.expiresAt ?? current?.payment_due_at ?? null
    const expired = Boolean(deadline && (Date.parse(deadline) < Date.parse(serverNow) || elapsedDeadline === deadline))
    const canRetry = current?.application_status === 'ready_for_payment' && qpayEnabled
        && checkout.qpay_enabled && checkout.is_accepting_applications

    useEffect(() => {
        if (!deadline || expired) return
        const timestamp = Date.parse(deadline)
        if (!Number.isFinite(timestamp)) return

        let timer: number
        function scheduleExpiry() {
            const remaining = timestamp - Date.now()
            if (remaining < 0) setElapsedDeadline(deadline)
            else timer = window.setTimeout(scheduleExpiry, Math.min(remaining + 1, 2_147_483_647))
        }
        timer = window.setTimeout(scheduleExpiry, 0)
        return () => window.clearTimeout(timer)
    }, [deadline, expired])

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
                setInvoice({ applicationId: prepared.application.application_id, data: result.invoice })
            } catch {
                setError('Холболтын алдаа гарлаа. Дахин оролдоно уу.')
            }
        })
    }

    function retryPayment(applicationId: string) {
        setError(null)
        startTransition(async () => {
            try {
                const result = await retryExpiredDirectQpayInvoice(applicationId, checkout.offering_id)
                if ('error' in result) setError(result.error)
                else if ('paid' in result) setHasAccess(true)
                else setInvoice({ applicationId, data: result.invoice })
                router.refresh()
            } catch {
                setError('Холболтын алдаа гарлаа. Дахин оролдоно уу.')
            }
        })
    }

    if (owned || hasAccess) return (
        <section className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <h2 className="text-xl font-semibold">{t("Таны хичээл үзэх эрх нээгдсэн")}</h2>
            <Button asChild><Link href={`/courses/${checkout.course_id}`}>{t("Хичээлээ үзэх")}</Link></Button>
        </section>
    )

    if (current?.application_status === 'pending_review') return (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
            <h2 className="text-xl font-semibold">{t("Таны өмнөх төлбөрийг шалгаж байна")}</h2>
            <p className="mt-3 text-zinc-300">{t("Дахин төлөх шаардлагагүй. Шалгаж дуусмагц хичээл үзэх эрх нээгдэнэ.")}</p>
        </section>
    )

    if (current && expired && canRetry) return (
        <section className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
            <div>
                <h2 className="text-xl font-semibold">{t('Төлбөрийн хугацаа дууссан')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{t('QPay өмнөх төлбөрийг шалгаад, шаардлагатай бол шинэ нэхэмжлэл үүсгэнэ.')}</p>
            </div>
            <Button type="button" onClick={() => retryPayment(current.application_id)} disabled={pending} className="w-full bg-blue-600 text-white hover:bg-blue-700">
                {pending ? t('Өмнөх төлбөрийг шалгаж байна…') : t('QPay төлбөрөө үргэлжлүүлэх')}
            </Button>
            {error && <p role="alert" className="text-sm text-red-400">{t(error)}</p>}
        </section>
    )

    if (current && (expired || ['approved', 'withdrawn', 'contract_required', 'draft'].includes(current.application_status))) return (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
            <p>{t("Өмнөх худалдан авалтаа шалгуулахын тулд Mind Academy-тай холбогдоно уу. Дахин төлбөр бүү хийгээрэй.")}</p>
        </section>
    )

    return (
        <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div>
                <h2 className="text-xl font-semibold">{t("Хичээл худалдаж авах")}</h2>
                <p className="mt-2 text-sm text-zinc-400">{t("QPay-аар төлсний дараа энэ бүртгэлээрээ шууд хичээлээ үзнэ.")}</p>
            </div>
            {current && applicationPaymentAmount(current) !== checkout.tuition_amount_mnt && (
                <p className="text-sm text-zinc-400">{t("Таны худалдан авалт эхлэх үеийн үнэ хадгалагдсан: ₮")} {applicationPaymentAmount(current).toLocaleString('mn-MN')}</p>
            )}
            {pending ? <p role="status">{t("QPay бэлдэж байна…")}</p> : !qpayEnabled ? <p>{t("QPay төлбөр түр зогссон байна. Дараа дахин оролдоно уу.")}</p>
                : current ? <QpayPaymentPanel
                    key={`${current.application_id}:${currentInvoice?.paymentId ?? ''}`}
                    applicationId={current.application_id}
                    offeringId={checkout.offering_id}
                    amountMnt={applicationPaymentAmount(current)}
                    environment={environment}
                    allowNewInvoices={checkout.qpay_enabled}
                    initialInvoice={currentInvoice}
                    directPurchase
                /> : checkout.is_accepting_applications && checkout.qpay_enabled ? (
                    <Button onClick={purchase} disabled={pending} className="w-full bg-blue-600 hover:bg-blue-700">
                        {pending ? t("QPay бэлдэж байна…") : t("₮ {value0} · QPay-аар төлөх", { value0: checkout.tuition_amount_mnt.toLocaleString('mn-MN') })}
                    </Button>
                ) : <p>{t("Энэ хичээлийн худалдаа түр хаагдсан байна.")}</p>}
            {error && <p role="alert" className="text-sm text-red-400">{t(error)}</p>}
        </section>
    )
}
