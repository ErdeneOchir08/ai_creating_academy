import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), fetch: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/qpay/config', () => ({ getQpayConfig: (merchant: string) => ({
    merchant, baseUrl: 'https://merchant.qpay.mn', clientId: merchant,
    clientSecret: 'test-only', invoiceCode: `${merchant}-invoice`,
}) }))
import { cancelQpayInvoice, checkQpayInvoicePayment, createQpayInvoice, verifyQpayInvoicePayment } from './client'

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

    it.each([200, 204])('cancels through the original merchant with an empty HTTP %i response', async (status) => {
        mocks.fetch.mockResolvedValueOnce(new Response(null, { status }))

        await expect(cancelQpayInvoice('old/invoice', 'legacy')).resolves.toBeUndefined()
        expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('https://merchant.qpay.mn/v2/invoice/old%2Finvoice', expect.objectContaining({
            method: 'DELETE', body: undefined, headers: { Authorization: 'Bearer token-legacy' }, redirect: 'error',
        }))
    })

    it.each([200, 400, 409])('treats an explicit already-cancelled response (HTTP %i) as idempotent', async (status) => {
        mocks.fetch.mockResolvedValueOnce(Response.json({ error: 'INVOICE_ALREADY_CANCELED' }, { status }))
        await expect(cancelQpayInvoice('old-invoice', 'legacy')).resolves.toBeUndefined()
    })

    it('recognizes QPay’s current already-cancelled error envelope', async () => {
        mocks.fetch.mockResolvedValueOnce(Response.json({
            status_code: 400, error: 'ValidationError', message: 'INVOICE_ALREADY_CANCELED',
        }, { status: 400 }))
        await expect(cancelQpayInvoice('old-invoice', 'legacy')).resolves.toBeUndefined()
    })

    it('accepts a successful JSON cancellation response', async () => {
        mocks.fetch.mockResolvedValueOnce(Response.json({ status: 'SUCCESS', error: '' }))
        await expect(cancelQpayInvoice('old-invoice', 'legacy')).resolves.toBeUndefined()
    })

    it.each([
        [200, 'INVOICE_PAID'],
        [400, 'INVOICE_PAID'],
        [404, 'INVOICE_NOTFOUND'],
        [404, 'INVOICE_ALREADY_CANCELED'],
        [500, 'INVOICE_ALREADY_CANCELED'],
    ])('does not accept HTTP %i %s as cancellation proof', async (status, code) => {
        mocks.fetch.mockResolvedValueOnce(Response.json({ error: code }, { status }))
        await expect(cancelQpayInvoice('old-invoice', 'legacy')).rejects.toMatchObject({ status, code })
    })

    it('verifies an unrecognized cancellation acknowledgement with the original invoice', async () => {
        mocks.fetch.mockResolvedValueOnce(new Response('{}'))
            .mockResolvedValueOnce(Response.json({ invoice_id: 'old-invoice', invoice_status: 'CANCELLED' }))
        await expect(cancelQpayInvoice('old-invoice', 'legacy')).resolves.toBeUndefined()
        expect(mocks.fetch).toHaveBeenLastCalledWith('https://merchant.qpay.mn/v2/invoice/old-invoice', expect.objectContaining({
            method: 'GET', headers: { Authorization: 'Bearer token-legacy' },
        }))
    })

    it.each([
        { invoice_id: 'old-invoice', invoice_status: 'OPEN' },
        { invoice_id: 'other-invoice', invoice_status: 'CANCELLED' },
    ])('requires the original invoice to be confirmed cancelled (%j)', async (invoice) => {
        mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 202 }))
            .mockResolvedValueOnce(Response.json(invoice))
        await expect(cancelQpayInvoice('old-invoice', 'legacy')).rejects.toMatchObject({ status: 202, code: 'unexpected_cancellation_response' })
    })

    it('does not treat a timed-out provider cancellation as confirmed', async () => {
        mocks.fetch.mockRejectedValueOnce(new DOMException('Request aborted', 'AbortError'))
        await expect(cancelQpayInvoice('old-invoice', 'legacy')).rejects.toThrow('timed out')
    })

    it.each([
        { count: 0, paid_amount: '0.00', rows: [] },
        { count: 0, rows: [] },
        { count: 0, paid_amount: 0 },
        { count: ' 0 ', paid_amount: '0.00', rows: [], error: null },
    ])('recognizes a verified zero-payment result (%j)', async (check) => {
        mocks.fetch.mockResolvedValueOnce(Response.json(check))
        await expect(checkQpayInvoicePayment('old-invoice', 69000, 'legacy')).resolves.toEqual({ status: 'unpaid' })
    })

    it.each([
        { count: 0 },
        { count: ' ', paid_amount: 0, rows: [] },
        { count: 0, paid_amount: '', rows: [] },
        { count: 1, paid_amount: 0, rows: [] },
        { count: 0, paid_amount: 100, rows: [] },
        { count: 0, paid_amount: 0, rows: [], error: 'INVOICE_NOTFOUND' },
        { count: 1, paid_amount: 0, rows: [{ payment_id: 'p', payment_status: 'PENDING', payment_amount: 69000 }] },
    ])('classifies incomplete or unsettled check data as uncertain (%j)', async (check) => {
        mocks.fetch.mockResolvedValueOnce(Response.json(check))
        await expect(checkQpayInvoicePayment('old-invoice', 69000, 'legacy')).resolves.toEqual({ status: 'uncertain' })
        expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })

    it('keeps a reported payment uncertain until its details are verified', async () => {
        const check = { count: 1, paid_amount: 69000, rows: [{ payment_id: 'p', payment_status: 'PAID', payment_amount: 69000 }] }
        const payment = { payment_id: 'p', payment_status: 'PAID', payment_amount: 69000, payment_currency: 'MNT' }
        mocks.fetch.mockResolvedValueOnce(Response.json(check))
            .mockResolvedValueOnce(Response.json({ ...payment, payment_status: 'PENDING' }))
            .mockResolvedValueOnce(Response.json(check))
            .mockResolvedValueOnce(Response.json(payment))

        await expect(checkQpayInvoicePayment('old-invoice', 69000, 'legacy')).resolves.toEqual({ status: 'uncertain' })
        await expect(checkQpayInvoicePayment('old-invoice', 69000, 'legacy')).resolves.toMatchObject({
            status: 'paid', payment: { paymentId: 'p', amountMnt: 69000, currency: 'MNT' },
        })
        expect(mocks.fetch.mock.calls.every(([, init]) => init.headers.Authorization === 'Bearer token-legacy')).toBe(true)
    })
})
