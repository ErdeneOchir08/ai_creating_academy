'use server'

import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createQpayInvoice, QpayApiError } from '@/lib/qpay/client'
import { getQpayConfig, isQpayEnabled, type QpayConfig } from '@/lib/qpay/config'
import { reservedQpayPaymentSchema, type QpayInvoicePresentation } from '@/lib/qpay/schemas'
import { reconcileCourseOfferingQpayPayment } from '@/features/checkout/server/qpay-reconciliation'

const uuidSchema = z.string().uuid()

function refreshOffering(offeringId: string) {
    revalidatePath(`/programs/${encodeURIComponent(offeringId)}`)
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/courses')
    revalidatePath('/admin/payments')
}

function safeQpayError(error: unknown) {
    if (error instanceof QpayApiError) return error.message
    if (error instanceof Error && error.message.includes('configuration')) return error.message
    return 'QPay нэхэмжлэл үүсгэж чадсангүй. Дахин оролдоно уу.'
}

export async function createOfferingQpayInvoice(applicationId: string, offeringId: string) {
    if (!uuidSchema.safeParse(applicationId).success || !uuidSchema.safeParse(offeringId).success) {
        return { error: 'Төлбөрийн хүсэлтийн дугаар буруу байна.' }
    }
    if (!isQpayEnabled()) return { error: 'QPay төлбөр одоогоор идэвхгүй байна.' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'QPay-аар төлөхийн тулд нэвтэрнэ үү.' }

    let config: QpayConfig
    try {
        config = getQpayConfig()
    } catch (error) {
        console.error('QPay configuration is incomplete:', error instanceof Error ? error.message : 'unknown error')
        return { error: 'QPay серверийн тохиргоо дутуу байна. Админтай холбогдоно уу.' }
    }
    const { data: paymentConfiguration } = await supabase
        .from('payment_configuration')
        .select('is_test_mode')
        .eq('id', true)
        .maybeSingle()
    if (config.environment === 'production' && paymentConfiguration?.is_test_mode !== false) {
        return { error: 'Төлбөрийн туршилтын горим идэвхтэй тул бодит QPay нэхэмжлэл үүсгэхгүй.' }
    }

    const callbackToken = randomBytes(32).toString('base64url')
    const callbackTokenHash = createHash('sha256').update(callbackToken).digest('hex')
    const { data: rawReservation, error: reserveError } = await supabase.rpc('reserve_course_offering_qpay_payment', {
        p_application_id: applicationId,
        p_callback_token_hash: callbackTokenHash,
    })
    if (reserveError) {
        console.error('Unable to reserve QPay payment:', reserveError.message)
        if (reserveError.message.includes('QPay is disabled')) {
            return { error: 'Энэ элсэлтэд шинэ QPay нэхэмжлэл үүсгэхийг түр зогсоосон байна.' }
        }
        return { error: 'QPay төлбөр эхлүүлэх боломжгүй байна. Хүсэлт, гэрээ болон төлбөрийн хугацаагаа шалгана уу.' }
    }

    let reservation: z.infer<typeof reservedQpayPaymentSchema>
    try {
        reservation = reservedQpayPaymentSchema.parse(rawReservation)
    } catch (error) {
        console.error('Invalid QPay reservation response:', error)
        return { error: 'QPay төлбөрийн мэдээллийг уншиж чадсангүй.' }
    }

    if (reservation.reused && reservation.status === 'pending' && reservation.qpay_invoice_id) {
        return { success: true, invoice: {
            paymentId: reservation.payment_id,
            invoiceId: reservation.qpay_invoice_id,
            senderInvoiceNo: reservation.sender_invoice_no,
            amountMnt: reservation.amount_mnt,
            qrText: reservation.qpay_qr_text ?? '',
            qrImage: reservation.qpay_qr_image ?? '',
            shortUrl: reservation.qpay_short_url ?? '',
            urls: reservation.qpay_urls.map((url) => ({
                name: url.name,
                description: url.description,
                logo: url.logo,
                link: url.link,
            })),
            expiresAt: reservation.expires_at ?? null,
        } satisfies QpayInvoicePresentation }
    }
    if (reservation.reused) {
        return { error: 'Өмнөх QPay нэхэмжлэл бүрэн хадгалагдаагүй байна. Админтай холбогдоно уу.' }
    }

    const callbackUrl = new URL('/api/payments/qpay/callback', config.siteUrl)
    callbackUrl.searchParams.set('attempt', reservation.payment_id)
    callbackUrl.searchParams.set('token', callbackToken)

    const admin = createAdminClient()
    try {
        const invoice = await createQpayInvoice({
            senderInvoiceNo: reservation.sender_invoice_no,
            description: `Mind Academy сургалтын төлбөр ${reservation.sender_invoice_no} · ${config.sourceSite}`,
            amountMnt: reservation.amount_mnt,
            callbackUrl: callbackUrl.toString(),
        })
        const { error: recordError } = await admin.rpc('record_course_offering_qpay_invoice', {
            p_payment_id: reservation.payment_id,
            p_qpay_invoice_id: invoice.invoiceId,
            p_qpay_short_url: invoice.shortUrl,
            p_qpay_qr_text: invoice.qrText,
            p_qpay_qr_image: invoice.qrImage,
            p_qpay_urls: invoice.urls,
        })
        if (recordError) {
            console.error('QPay invoice created but could not be recorded:', recordError.message)
            return { error: 'QPay нэхэмжлэл үүссэн боловч бүртгэл хадгалагдсангүй. Дахин төлөхгүй, админтай холбогдоно уу.' }
        }

        refreshOffering(offeringId)
        return { success: true, invoice: {
            paymentId: reservation.payment_id,
            invoiceId: invoice.invoiceId,
            senderInvoiceNo: reservation.sender_invoice_no,
            amountMnt: reservation.amount_mnt,
            qrText: invoice.qrText,
            qrImage: invoice.qrImage,
            shortUrl: invoice.shortUrl,
            urls: invoice.urls,
            expiresAt: reservation.payment_due_at,
        } satisfies QpayInvoicePresentation }
    } catch (error) {
        console.error('QPay invoice creation failed:', error instanceof Error ? error.message : 'unknown error')
        await admin.rpc('fail_course_offering_qpay_payment', {
            p_payment_id: reservation.payment_id,
            p_reason: error instanceof Error ? error.message : 'QPay invoice creation failed.',
        })
        return { error: safeQpayError(error) }
    }
}

export async function reconcileMyOfferingQpayPayment(applicationId: string, offeringId: string) {
    if (!uuidSchema.safeParse(applicationId).success || !uuidSchema.safeParse(offeringId).success) {
        return { error: 'Төлбөрийн хүсэлтийн дугаар буруу байна.' }
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Төлбөр шалгахын тулд нэвтэрнэ үү.' }

    const { data: payment, error } = await supabase
        .from('course_offering_payments')
        .select('id')
        .eq('application_id', applicationId)
        .eq('provider', 'qpay')
        .in('status', ['pending', 'paid'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (error || !payment) return { error: 'Шалгах QPay төлбөр олдсонгүй.' }

    try {
        const result = await reconcileCourseOfferingQpayPayment(payment.id)
        if (result.status === 'pending') return { pending: true, message: 'QPay төлбөр хараахан баталгаажаагүй байна.' }
        refreshOffering(offeringId)
        return { success: true, message: 'Төлбөр баталгаажлаа. Хичээл үзэх эрх нээгдсэн.' }
    } catch (cause) {
        console.error('Manual QPay reconciliation failed:', cause instanceof Error ? cause.message : 'unknown error')
        return { error: cause instanceof Error ? cause.message : 'QPay төлбөрийг шалгаж чадсангүй.' }
    }
}
