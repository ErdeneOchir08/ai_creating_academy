import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getQpayConfig, type QpayMerchant } from '@/lib/qpay/config'
import {
    qpayInvoiceResponseSchema,
    qpayPaymentCheckResponseSchema,
    qpayPaymentResponseSchema,
    qpayTokenResponseSchema,
} from './schemas'

const REQUEST_TIMEOUT_MS = 15_000
const TOKEN_EXPIRY_BUFFER_MS = 60_000
const tokenRequests = new Map<QpayMerchant, Promise<string>>()

export class QpayApiError extends Error {
    constructor(message: string, readonly status?: number, readonly code?: string) {
        super(message)
        this.name = 'QpayApiError'
    }
}

function expiryDate(value: number) {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const epochSeconds = value > nowSeconds + 60 ? value : nowSeconds + value
    return new Date(epochSeconds * 1000)
}

async function requestJson(url: string, init: RequestInit, responseType: 'json' | 'cancellation' = 'json') {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
        if (responseType === 'cancellation' && response.ok) {
            if (response.status === 204) return null
            if (response.status === 200) {
                const text = (await response.text()).trim()
                if (!text) return null
                let body: { status?: unknown; error?: unknown } | null = null
                try { body = JSON.parse(text) } catch { /* Check the invoice directly for unfamiliar responses. */ }
                if (body?.error === 'INVOICE_ALREADY_CANCELED') return null
                if (body?.error === 'INVOICE_PAID') {
                    throw new QpayApiError('QPay reports that the invoice was paid.', response.status, body.error)
                }
                if (body?.status === 'SUCCESS' && (body.error == null || body.error === '')) return null
            }
            throw new QpayApiError(`QPay returned an unrecognized cancellation response (HTTP ${response.status}).`,
                response.status, 'unexpected_cancellation_response')
        }

        const body = await response.json().catch(() => null)
        if (!response.ok) {
            let code = body && typeof body === 'object' && typeof body.error === 'string' ? body.error : 'request_failed'
            if (responseType === 'cancellation' && code === 'ValidationError'
                && (body.message === 'INVOICE_ALREADY_CANCELED' || body.message === 'INVOICE_PAID')) code = body.message
            if (responseType === 'cancellation' && (response.status === 400 || response.status === 409)
                && code === 'INVOICE_ALREADY_CANCELED') return null
            throw new QpayApiError(`QPay request failed: ${code}`, response.status, code)
        }
        return body
    } catch (error) {
        if (error instanceof QpayApiError) throw error
        if (error instanceof Error && error.name === 'AbortError') {
            throw new QpayApiError('QPay request timed out.')
        }
        throw new QpayApiError('Unable to connect to QPay.')
    } finally {
        clearTimeout(timeout)
    }
}

async function loadOrCreateToken(merchant: QpayMerchant) {
    const config = getQpayConfig(merchant)
    const admin = createAdminClient()
    const { data: cached } = await admin
        .from('qpay_merchant_token_cache')
        .select('access_token, access_expires_at')
        .eq('merchant_key', merchant)
        .eq('client_id', config.clientId)
        .eq('base_url', config.baseUrl)
        .maybeSingle()
    if (cached && new Date(cached.access_expires_at).getTime() > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
        return cached.access_token as string
    }

    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64')
    const rawToken = await requestJson(`${config.baseUrl}/v2/auth/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}` },
    })
    const token = qpayTokenResponseSchema.parse(rawToken)
    const accessExpiresAt = expiryDate(token.expires_in)
    const refreshExpiresAt = token.refresh_expires_in ? expiryDate(token.refresh_expires_in) : null

    const { error } = await admin.from('qpay_merchant_token_cache').upsert({
        merchant_key: merchant,
        client_id: config.clientId,
        base_url: config.baseUrl,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        access_expires_at: accessExpiresAt.toISOString(),
        refresh_expires_at: refreshExpiresAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
    })
    if (error) console.error('Unable to cache QPay token:', error.message)
    return token.access_token
}

async function getAccessToken(merchant: QpayMerchant) {
    let request = tokenRequests.get(merchant)
    if (!request) {
        request = loadOrCreateToken(merchant).finally(() => { tokenRequests.delete(merchant) })
        tokenRequests.set(merchant, request)
    }
    return request
}

async function authorizedRequest(merchant: QpayMerchant, path: string, body?: unknown, method = 'POST', responseType: 'json' | 'cancellation' = 'json') {
    const config = getQpayConfig(merchant)
    const token = await getAccessToken(merchant)
    return requestJson(`${config.baseUrl}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        ...(responseType === 'cancellation' ? { redirect: 'error' } : {}),
    }, responseType)
}

export async function createQpayInvoice(input: {
    merchant: QpayMerchant
    senderInvoiceNo: string
    description: string
    amountMnt: number
    callbackUrl: string
}) {
    const config = getQpayConfig(input.merchant)
    const raw = await authorizedRequest(input.merchant, '/v2/invoice', {
        invoice_code: config.invoiceCode,
        sender_invoice_no: input.senderInvoiceNo,
        invoice_receiver_code: 'terminal',
        invoice_description: input.description,
        amount: input.amountMnt,
        callback_url: input.callbackUrl,
        enable_expiry: false,
        allow_partial: false,
        allow_exceed: false,
    })
    return qpayInvoiceResponseSchema.parse(raw)
}

/** Resolves only after QPay confirms this invoice is cancelled. */
export async function cancelQpayInvoice(invoiceId: string, merchant: QpayMerchant): Promise<void> {
    const path = `/v2/invoice/${encodeURIComponent(invoiceId)}`
    try {
        await authorizedRequest(merchant, path, undefined, 'DELETE', 'cancellation')
    } catch (error) {
        if (!(error instanceof QpayApiError) || error.code !== 'unexpected_cancellation_response') throw error
        const invoice = await authorizedRequest(merchant, path, undefined, 'GET') as {
            invoice_id?: unknown; invoice_status?: unknown; error?: unknown
        } | null
        if (invoice?.invoice_id === invoiceId && invoice.error == null
            && (invoice.invoice_status === 'CANCELLED' || invoice.invoice_status === 'CANCELED')) return
        throw error
    }
}

export type VerifiedQpayPayment = {
    paymentId: string
    status: string
    amountMnt: number
    currency: string
    paidAt: string
}

async function fetchQpayInvoicePaymentCheck(invoiceId: string, merchant: QpayMerchant) {
    const rawCheck = await authorizedRequest(merchant, '/v2/payment/check', {
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 10 },
    })
    const check = qpayPaymentCheckResponseSchema.parse(rawCheck)
    return { rawCheck, rows: check.rows }
}

async function verifyQpayPaidRow(
    rows: ReturnType<typeof qpayPaymentCheckResponseSchema.parse>['rows'],
    expectedAmountMnt: number,
    merchant: QpayMerchant,
) {
    const paidRows = rows.filter((row) => row.payment_status.toUpperCase() === 'PAID')
    if (paidRows.length === 0) return null
    if (paidRows.length !== 1) throw new QpayApiError('QPay returned an ambiguous paid-payment result.')

    const rawPayment = await authorizedRequest(merchant, `/v2/payment/${encodeURIComponent(paidRows[0].payment_id)}`, undefined, 'GET')
    const payment = qpayPaymentResponseSchema.parse(rawPayment)
    if (payment.payment_status.toUpperCase() !== 'PAID') return null
    if (payment.payment_id !== paidRows[0].payment_id) throw new QpayApiError('QPay returned a different payment ID.')
    if (payment.payment_amount !== expectedAmountMnt) throw new QpayApiError('QPay payment amount does not match the order.')
    if (payment.payment_currency.toUpperCase() !== 'MNT') throw new QpayApiError('QPay payment currency does not match the order.')

    return {
        paymentId: payment.payment_id,
        status: payment.payment_status,
        amountMnt: payment.payment_amount,
        currency: payment.payment_currency,
        paidAt: payment.payment_date ?? new Date().toISOString(),
    } satisfies VerifiedQpayPayment
}

export async function verifyQpayInvoicePayment(invoiceId: string, expectedAmountMnt: number, merchant: QpayMerchant) {
    const { rows } = await fetchQpayInvoicePaymentCheck(invoiceId, merchant)
    return verifyQpayPaidRow(rows, expectedAmountMnt, merchant)
}

function isExplicitZero(value: unknown) {
    return value === 0 || (typeof value === 'string' && /^0+(?:\.0+)?$/u.test(value.trim()))
}

export type QpayInvoicePaymentCheck = { status: 'paid'; payment: VerifiedQpayPayment }
    | { status: 'unpaid' }
    | { status: 'uncertain' }

/** A missing paid result may still include an unsettled transaction. */
export async function checkQpayInvoicePayment(
    invoiceId: string,
    expectedAmountMnt: number,
    merchant: QpayMerchant,
): Promise<QpayInvoicePaymentCheck> {
    const { rawCheck, rows } = await fetchQpayInvoicePaymentCheck(invoiceId, merchant)
    const payment = await verifyQpayPaidRow(rows, expectedAmountMnt, merchant)
    if (payment) return { status: 'paid', payment }

    // Require a real zero count and corroborate it with an empty list or zero total.
    const check = rawCheck as { count: unknown; paid_amount?: unknown; rows?: unknown; error?: unknown }
    const countIsZero = isExplicitZero(check.count)
    const totalIsZero = isExplicitZero(check.paid_amount)
    const rowsAreEmpty = Array.isArray(check.rows) && check.rows.length === 0
    const hasError = check.error !== undefined && check.error !== null
    if (!hasError && countIsZero && rows.length === 0
        && (totalIsZero || (check.paid_amount === undefined && rowsAreEmpty))) return { status: 'unpaid' }

    console.warn('Unexpected QPay invoice payment check:', {
        countIsZero,
        total: check.paid_amount === undefined ? 'absent' : totalIsZero ? 'zero' : 'nonzero or invalid',
        rows: check.rows === undefined ? 'absent' : rows.length,
        hasError,
    })
    return { status: 'uncertain' }
}
