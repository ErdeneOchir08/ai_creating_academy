'use server'

import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cancelQpayInvoice, createQpayInvoice, QpayApiError } from '@/lib/qpay/client'
import { getQpayConfig, isQpayEnabled, type QpayConfig } from '@/lib/qpay/config'
import { reservedQpayPaymentSchema, type QpayInvoicePresentation } from '@/lib/qpay/schemas'
import { directCourseApplication } from '@/features/checkout/domain/direct-course-checkout'
import { reconcileCourseOfferingQpayPayment } from '@/features/checkout/server/qpay-reconciliation'
import { hasEffectiveCourseAccess } from '@/features/courses/actions/effective-course-access'
import { getOfferingCheckoutForm, getOfferingPaymentConfiguration } from './offering-checkout-actions'

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
        if (reserveError.message.includes('previous course payment receipt')) {
            return { error: 'Таны өмнөх төлбөрийн баримтыг шалгаж байна. Дахин төлөх шаардлагагүй.' }
        }
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
    let invoiceRequestStarted = false
    try {
        // Persist the owner before contacting QPay. Reused pending invoices above
        // retain their original merchant, regardless of the active configuration.
        const { data: assigned, error: assignError } = await admin
            .from('course_offering_payments')
            .update({ merchant_key: config.merchant })
            .eq('id', reservation.payment_id)
            .eq('status', 'created')
            .is('qpay_invoice_id', null)
            .select('id')
            .single()
        if (assignError || !assigned) throw new Error('QPay merchant assignment failed before invoice creation.')
        invoiceRequestStarted = true
        const invoice = await createQpayInvoice({
            merchant: config.merchant,
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
        if (invoiceRequestStarted && !(error instanceof QpayApiError && (error.status === 401 || error.status === 403))) {
            // A lost or malformed response can leave an invoice at QPay. Keep its reservation locked.
            return { error: 'QPay нэхэмжлэл үүссэн эсэхийг баталгаажуулж чадсангүй. Mind Academy-тай холбогдоно уу.' }
        }
        await admin.rpc('fail_course_offering_qpay_payment', {
            p_payment_id: reservation.payment_id,
            p_reason: error instanceof Error ? error.message : 'QPay invoice creation failed.',
        })
        return { error: safeQpayError(error) }
    }
}

const previousPaymentSchema = z.object({
    id: uuidSchema,
    status: z.enum(['created', 'pending', 'paid']),
    merchant_key: z.enum(['legacy', 'zurkhai']),
    qpay_invoice_id: z.string().min(1).nullable(),
})

export async function retryExpiredDirectQpayInvoice(applicationId: string, offeringId: string): Promise<
    { error: string } | { paid: true } | { invoice: QpayInvoicePresentation }
> {
    if (!uuidSchema.safeParse(applicationId).success || !uuidSchema.safeParse(offeringId).success) {
        return { error: 'Төлбөрийн хүсэлтийн дугаар буруу байна.' }
    }
    if (!isQpayEnabled()) return { error: 'QPay төлбөр одоогоор идэвхгүй байна.' }

    const unavailable = 'Өмнөх QPay нэхэмжлэлийн төлөвийг баталгаажуулж чадсангүй. Mind Academy-тай холбогдоно уу.'
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'QPay-аар төлөхийн тулд нэвтэрнэ үү.' }

        const checkout = await getOfferingCheckoutForm(offeringId)
        if (!checkout?.direct_purchase) return { error: unavailable }
        const courseId = checkout.course_id
        if (await hasEffectiveCourseAccess(supabase, courseId)) return { paid: true }
        async function refreshPaidCheckout() {
            refreshOffering(offeringId)
            return await hasEffectiveCourseAccess(supabase, courseId)
                ? { paid: true as const }
                : { error: 'Таны өмнөх төлбөр баталгаажсан байна. Хичээл үзэх эрхээ шалгуулахаар Mind Academy-тай холбогдоно уу.' }
        }
        const application = directCourseApplication(checkout.my_applications)
        if (application?.application_id !== applicationId || application.application_status !== 'ready_for_payment'
            || !checkout.is_accepting_applications || !checkout.qpay_enabled || !application.payment_due_at) {
            return { error: unavailable }
        }

        if (getQpayConfig().environment === 'production' && (await getOfferingPaymentConfiguration()).isTestMode) {
            return { error: 'Төлбөрийн туршилтын горим идэвхтэй тул бодит QPay нэхэмжлэл үүсгэхгүй.' }
        }

        const deadline = Date.parse(application.payment_due_at)
        if (!Number.isFinite(deadline)) return { error: unavailable }
        if (deadline < Date.now()) {
            const { data, error } = await supabase.from('course_offering_payments')
                .select('id, status, merchant_key, qpay_invoice_id')
                .eq('application_id', applicationId).eq('offering_id', offeringId)
                .eq('applicant_user_id', user.id).eq('provider', 'qpay')
                .in('status', ['created', 'pending', 'paid']).order('attempt_number', { ascending: false }).limit(1).maybeSingle()
            const previous = previousPaymentSchema.safeParse(data)
            if (error || !previous.success || !previous.data.qpay_invoice_id || previous.data.status === 'created') {
                return { error: unavailable }
            }

            const payment = previous.data
            const checked = await reconcileCourseOfferingQpayPayment(payment.id, { requireConfirmedUnpaid: true })
            if (checked.status === 'paid') return await refreshPaidCheckout()

            try {
                await cancelQpayInvoice(previous.data.qpay_invoice_id, payment.merchant_key)
            } catch (cancelError) {
                // A bank payment may have settled between the check and the cancellation request.
                const checkedAgain = await reconcileCourseOfferingQpayPayment(payment.id)
                if (checkedAgain.status !== 'paid') throw cancelError
                return await refreshPaidCheckout()
            }

            const { data: reopened, error: reopenError } = await createAdminClient().rpc('reopen_expired_direct_qpay_checkout', {
                p_application_id: applicationId,
                p_offering_id: offeringId,
                p_applicant_user_id: user.id,
                p_previous_payment_id: payment.id,
                p_previous_invoice_id: payment.qpay_invoice_id,
            })
            if (reopenError) throw reopenError
            if (reopened?.status === 'already_paid') return await refreshPaidCheckout()
            refreshOffering(offeringId)
            if (reopened?.status !== 'ready') return { error: unavailable }
        }

        const result = await createOfferingQpayInvoice(applicationId, offeringId)
        if (result.invoice) return { invoice: result.invoice }
        return { error: result.error ?? unavailable }
    } catch (error) {
        console.error('Unable to retry expired direct QPay checkout:', error instanceof Error ? error.message : error)
        return { error: unavailable }
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
