import { describe, expect, it } from 'vitest'

import {
    qpayInvoiceResponseSchema,
    qpayPaymentCheckResponseSchema,
    qpayPaymentResponseSchema,
    qpayTokenResponseSchema,
} from './schemas'

describe('QPay Merchant V2 response schemas', () => {
    it('accepts numeric token lifetimes returned as strings', () => {
        const token = qpayTokenResponseSchema.parse({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: '3600',
        })

        expect(token.expires_in).toBe(3600)
    })

    it('normalizes invoice fields and bank links', () => {
        const invoice = qpayInvoiceResponseSchema.parse({
            invoice_id: 'invoice-123',
            qr_text: 'qr-value',
            qr_image: 'data:image/png;base64,abc',
            qPay_shortUrl: 'https://qpay.mn/pay/123',
            urls: [{ name: 'Bank', link: 'bank://pay/123' }],
        })

        expect(invoice).toMatchObject({
            invoiceId: 'invoice-123',
            shortUrl: 'https://qpay.mn/pay/123',
            urls: [{ name: 'Bank', description: '', logo: '', link: 'bank://pay/123' }],
        })
    })

    it('parses payment verification responses without trusting extra fields', () => {
        const check = qpayPaymentCheckResponseSchema.parse({
            count: '1',
            paid_amount: '50000',
            rows: [{
                payment_id: 'payment-123',
                payment_status: 'PAID',
                payment_amount: '50000',
                payment_currency: 'MNT',
            }],
        })
        const payment = qpayPaymentResponseSchema.parse({
            payment_id: 'payment-123',
            payment_status: 'PAID',
            payment_amount: 50000,
            payment_currency: 'MNT',
        })

        expect(check.count).toBe(1)
        expect(check.rows[0]?.payment_amount).toBe(50000)
        expect(payment.payment_currency).toBe('MNT')
    })
})
