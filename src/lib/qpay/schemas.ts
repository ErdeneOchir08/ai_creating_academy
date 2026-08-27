import { z } from 'zod'

const numberFromUnknown = z.union([z.number(), z.string()]).transform((value, context) => {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        context.addIssue({ code: 'custom', message: 'Expected a finite number.' })
        return z.NEVER
    }
    return number
})

export const qpayTokenResponseSchema = z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    expires_in: numberFromUnknown,
    refresh_expires_in: numberFromUnknown.optional(),
}).passthrough()

export const qpayBankUrlSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(''),
    logo: z.string().optional().default(''),
    link: z.string().min(1),
}).passthrough()

export const qpayInvoiceResponseSchema = z.object({
    invoice_id: z.string().min(1),
    qr_text: z.string().optional().default(''),
    qr_image: z.string().optional().default(''),
    qPay_shortUrl: z.string().optional(),
    qpay_short_url: z.string().optional(),
    urls: z.array(qpayBankUrlSchema).optional().default([]),
}).passthrough().transform((value) => ({
    invoiceId: value.invoice_id,
    qrText: value.qr_text,
    qrImage: value.qr_image,
    shortUrl: value.qPay_shortUrl ?? value.qpay_short_url ?? '',
    urls: value.urls.map((url) => ({
        name: url.name,
        description: url.description,
        logo: url.logo,
        link: url.link,
    })),
}))

export const qpayPaymentCheckRowSchema = z.object({
    payment_id: z.string().min(1),
    payment_status: z.string().min(1),
    payment_amount: numberFromUnknown,
    payment_currency: z.string().optional(),
    payment_date: z.string().optional(),
}).passthrough()

export const qpayPaymentCheckResponseSchema = z.object({
    count: numberFromUnknown,
    paid_amount: numberFromUnknown.optional().default(0),
    rows: z.array(qpayPaymentCheckRowSchema).optional().default([]),
}).passthrough()

export const qpayPaymentResponseSchema = z.object({
    payment_id: z.string().min(1),
    payment_status: z.string().min(1),
    payment_amount: numberFromUnknown,
    payment_currency: z.string().min(1),
    payment_date: z.string().optional(),
}).passthrough()

export const reservedQpayPaymentSchema = z.object({
    payment_id: z.string().uuid(),
    sender_invoice_no: z.string().min(1),
    amount_mnt: z.coerce.number().int().positive(),
    payment_due_at: z.string().datetime({ offset: true }),
    status: z.enum(['created', 'pending']),
    qpay_invoice_id: z.string().nullable().optional(),
    qpay_short_url: z.string().nullable().optional(),
    qpay_qr_text: z.string().nullable().optional(),
    qpay_qr_image: z.string().nullable().optional(),
    qpay_urls: z.array(qpayBankUrlSchema).optional().default([]),
    expires_at: z.string().datetime({ offset: true }).nullable().optional(),
    reused: z.boolean(),
})

export type QpayInvoicePresentation = {
    paymentId: string
    invoiceId: string
    senderInvoiceNo: string
    amountMnt: number
    qrText: string
    qrImage: string
    shortUrl: string
    urls: Array<{ name: string; description: string; logo: string; link: string }>
    expiresAt: string | null
}
