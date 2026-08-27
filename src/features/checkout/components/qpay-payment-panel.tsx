'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, Loader2, QrCode, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    createOfferingQpayInvoice,
    reconcileMyOfferingQpayPayment,
} from '@/features/checkout/actions/qpay-payment-actions'
import type { QpayInvoicePresentation } from '@/lib/qpay/schemas'

type StoredQpayPayment = {
    id: string
    status: string
    amount_mnt: number
    sender_invoice_no: string
    qpay_invoice_id: string | null
    qpay_short_url: string | null
    qpay_qr_text: string | null
    qpay_qr_image: string | null
    qpay_urls: QpayInvoicePresentation['urls']
    expires_at: string | null
}

function presentationFromStored(payment: StoredQpayPayment): QpayInvoicePresentation | null {
    if (!payment.qpay_invoice_id) return null
    return {
        paymentId: payment.id,
        invoiceId: payment.qpay_invoice_id,
        senderInvoiceNo: payment.sender_invoice_no,
        amountMnt: payment.amount_mnt,
        qrText: payment.qpay_qr_text ?? '',
        qrImage: payment.qpay_qr_image ?? '',
        shortUrl: payment.qpay_short_url ?? '',
        urls: Array.isArray(payment.qpay_urls) ? payment.qpay_urls : [],
        expiresAt: payment.expires_at,
    }
}

export function QpayPaymentPanel({
    applicationId,
    offeringId,
    amountMnt,
    environment,
}: {
    applicationId: string
    offeringId: string
    amountMnt: number
    environment: 'sandbox' | 'production'
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [invoice, setInvoice] = useState<QpayInvoicePresentation | null>(null)
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const loadStatus = useCallback(async () => {
        const response = await fetch(`/api/payments/qpay/status?applicationId=${encodeURIComponent(applicationId)}`, {
            cache: 'no-store',
        })
        if (!response.ok) return
        const body = await response.json() as { payment: StoredQpayPayment | null }
        if (!body.payment) return
        setPaymentStatus(body.payment.status)
        const storedInvoice = presentationFromStored(body.payment)
        if (storedInvoice) setInvoice(storedInvoice)
        if (body.payment.status === 'paid') {
            setMessage('Төлбөр баталгаажлаа. Хичээл үзэх эрх нээгдсэн.')
            router.refresh()
        }
    }, [applicationId, router])

    useEffect(() => {
        if (paymentStatus !== 'pending') return
        const timer = window.setInterval(() => void loadStatus(), 4_000)
        return () => window.clearInterval(timer)
    }, [loadStatus, paymentStatus])

    function createInvoice() {
        setError(null)
        setMessage(null)
        startTransition(async () => {
            const result = await createOfferingQpayInvoice(applicationId, offeringId)
            if (result.error || !result.invoice) {
                setError(result.error ?? 'QPay нэхэмжлэл үүсгэж чадсангүй.')
                return
            }
            setInvoice(result.invoice)
            setPaymentStatus('pending')
            setMessage('QPay нэхэмжлэл үүслээ. Банкны апп-аар төлнө үү.')
        })
    }

    function reconcile() {
        setError(null)
        setMessage(null)
        startTransition(async () => {
            const result = await reconcileMyOfferingQpayPayment(applicationId, offeringId)
            if (result.error) return setError(result.error)
            setMessage(result.message ?? null)
            if (result.success) {
                setPaymentStatus('paid')
                router.refresh()
            }
        })
    }

    if (paymentStatus === 'paid') {
        return (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-100">
                <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
                    <div>
                        <h3 className="font-semibold text-white">QPay төлбөр баталгаажсан</h3>
                        <p className="mt-1 text-sm text-emerald-100/80">Таны элсэлт болон хичээл үзэх эрх автоматаар нээгдсэн.</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <section className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
            <div className="flex items-start gap-3">
                <QrCode className="mt-0.5 h-6 w-6 shrink-0 text-blue-300" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">QPay-аар төлөх</h3>
                        {environment === 'sandbox' && (
                            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-200">Sandbox</span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-blue-100/75">QR код уншуулах эсвэл банкны апп сонгон төлбөрөө баталгаажуулна.</p>
                </div>
            </div>

            {!invoice ? (
                <Button type="button" onClick={createInvoice} disabled={pending} className="mt-5 w-full bg-blue-600 text-white hover:bg-blue-700">
                    {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Үүсгэж байна…</> : <>₮ {amountMnt.toLocaleString('mn-MN')} · QPay нэхэмжлэл үүсгэх</>}
                </Button>
            ) : (
                <div className="mt-5 space-y-4">
                    <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
                        {invoice.qrImage ? (
                            <div className="overflow-hidden rounded-xl bg-white p-3">
                                <Image
                                    src={`data:image/png;base64,${invoice.qrImage}`}
                                    alt="QPay төлбөрийн QR код"
                                    width={220}
                                    height={220}
                                    unoptimized
                                    className="h-auto w-full"
                                />
                            </div>
                        ) : (
                            <div className="flex aspect-square items-center justify-center rounded-xl border border-blue-400/20 bg-zinc-950 text-blue-200">
                                <QrCode className="h-16 w-16" />
                            </div>
                        )}
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-blue-200/60">Төлөх дүн</p>
                                <p className="mt-1 text-2xl font-bold text-white">₮ {invoice.amountMnt.toLocaleString('mn-MN')}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-blue-200/60">Нэхэмжлэлийн дугаар</p>
                                <code className="mt-1 block break-all text-blue-100">{invoice.senderInvoiceNo}</code>
                            </div>
                            {invoice.shortUrl && (
                                <Button asChild variant="outline" className="w-full border-blue-300/30 bg-transparent text-white hover:bg-blue-500/20 hover:text-white">
                                    <a href={invoice.shortUrl} target="_blank" rel="noreferrer">
                                        QPay холбоос нээх <ExternalLink className="ml-2 h-4 w-4" />
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>

                    {invoice.urls.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {invoice.urls.map((url) => (
                                <a
                                    key={`${url.name}-${url.link}`}
                                    href={url.link}
                                    className="rounded-lg border border-blue-300/20 bg-zinc-950/70 px-3 py-2 text-sm font-medium text-blue-100 transition hover:border-blue-300/40 hover:bg-zinc-900"
                                >
                                    {url.name}
                                </a>
                            ))}
                        </div>
                    )}

                    <div className="flex items-start gap-2 rounded-lg border border-blue-300/20 bg-zinc-950/60 p-3 text-sm text-blue-100/80">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                        <p>Банкны апп амжилттай төлсөн ч дэлгэц шинэчлэгдэхгүй бол доорх товчоор нэг удаа шалгана уу.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={reconcile} disabled={pending} className="w-full border-blue-300/30 bg-transparent text-white hover:bg-blue-500/20 hover:text-white">
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Төлбөрөө шалгах
                    </Button>
                </div>
            )}

            {error && <p role="alert" className="mt-4 text-sm font-medium text-red-300">{error}</p>}
            {message && <p role="status" className="mt-4 text-sm font-medium text-emerald-300">{message}</p>}
        </section>
    )
}
