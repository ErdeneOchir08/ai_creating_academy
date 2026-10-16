import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), fetch: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/qpay/config', () => ({ getQpayConfig: (merchant: string) => ({
    merchant, baseUrl: 'https://merchant.qpay.mn', clientId: merchant,
    clientSecret: 'test-only', invoiceCode: `${merchant}-invoice`,
}) }))
import { createQpayInvoice, verifyQpayInvoicePayment } from './client'

describe('merchant-specific QPay requests', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mocks.fetch)
        mocks.fetch.mockReset()
        mocks.from.mockReset().mockImplementation(() => {
            const filters: Record<string, string> = {}
            const query = {
                select: () => query,
                eq: (key: string, value: string) => { filters[key] = value; return query },
                maybeSingle: async () => ({ data: {
                    access_token: `token-${filters.merchant_key}`,
                    access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
                } }),
            }
            return query
        })
    })
    afterEach(() => vi.unstubAllGlobals())
    it('keeps concurrent old/new invoice checks on separate cached tokens', async () => {
        mocks.fetch.mockImplementation(async () => ({ ok: true, json: async () => ({ count: 0, rows: [] }) }))
        await Promise.all([
            verifyQpayInvoicePayment('old-invoice', 69000, 'legacy'),
            verifyQpayInvoicePayment('new-invoice', 69000, 'zurkhai'),
        ])
        const requests = mocks.fetch.mock.calls.map(([, init]) => ({
            invoice: JSON.parse(init.body).object_id, authorization: init.headers.Authorization,
        }))
        expect(requests).toEqual(expect.arrayContaining([
            { invoice: 'old-invoice', authorization: 'Bearer token-legacy' },
            { invoice: 'new-invoice', authorization: 'Bearer token-zurkhai' },
        ]))
        expect(mocks.from).toHaveBeenCalledWith('qpay_merchant_token_cache')
    })
    it('creates a new invoice with only its selected merchant invoice code', async () => {
        mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ invoice_id: 'new-id' }) })
        await createQpayInvoice({ merchant: 'zurkhai', senderInvoiceNo: 'ACA-test', description: 'test', amountMnt: 500, callbackUrl: 'https://mindacademy.mn/api/payments/qpay/callback' })
        const [, init] = mocks.fetch.mock.calls[0]
        expect(init.headers.Authorization).toBe('Bearer token-zurkhai')
        expect(JSON.parse(init.body).invoice_code).toBe('zurkhai-invoice')
    })
    it('uses the same merchant to verify payment details and rejects an amount mismatch', async () => {
        mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ count: 1, rows: [{ payment_id: 'p', payment_status: 'PAID', payment_amount: 69000 }] }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ payment_id: 'p', payment_status: 'PAID', payment_amount: 500, payment_currency: 'MNT' }) })
        await expect(verifyQpayInvoicePayment('old-invoice', 69000, 'legacy')).rejects.toThrow('amount')
        expect(mocks.fetch.mock.calls.every(([, init]) => init.headers.Authorization === 'Bearer token-legacy')).toBe(true)
    })
})
