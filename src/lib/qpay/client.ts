import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getQpayConfig } from '@/lib/qpay/config'
import {
    qpayInvoiceResponseSchema,
    qpayPaymentCheckResponseSchema,
    qpayPaymentResponseSchema,
    qpayTokenResponseSchema,
} from '@/lib/qpay/schemas'

const REQUEST_TIMEOUT_MS = 15_000
const TOKEN_EXPIRY_BUFFER_MS = 60_000
let tokenRequest: Promise<string> | null = null

export class QpayApiError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message)
        this.name = 'QpayApiError'
    }
}

function expiryDate(value: number) {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const epochSeconds = value > nowSeconds + 60 ? value : nowSeconds + value
    return new Date(epochSeconds * 1000)
}

async function requestJson(url: string, init: RequestInit) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
            const code = body && typeof body === 'object' && 'error' in body ? String(body.error) : 'request_failed'
            throw new QpayApiError(`QPay request failed: ${code}`, response.status)
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

async function loadOrCreateToken() {
    const admin = createAdminClient()
    const { data: cached } = await admin
        .from('qpay_token_cache')
        .select('access_token, access_expires_at')
        .eq('id', true)
        .maybeSingle()
    if (cached && new Date(cached.access_expires_at).getTime() > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
        return cached.access_token as string
    }

    const config = getQpayConfig()
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64')
    const rawToken = await requestJson(`${config.baseUrl}/v2/auth/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}` },
    })
    const token = qpayTokenResponseSchema.parse(rawToken)
    const accessExpiresAt = expiryDate(token.expires_in)
    const refreshExpiresAt = token.refresh_expires_in ? expiryDate(token.refresh_expires_in) : null

    const { error } = await admin.from('qpay_token_cache').upsert({
        id: true,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        access_expires_at: accessExpiresAt.toISOString(),
        refresh_expires_at: refreshExpiresAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
    })
    if (error) console.error('Unable to cache QPay token:', error.message)
    return token.access_token
}

async function getAccessToken() {
    if (!tokenRequest) tokenRequest = loadOrCreateToken().finally(() => { tokenRequest = null })
    return tokenRequest
}

async function authorizedRequest(path: string, body?: unknown, method = 'POST') {
    const config = getQpayConfig()
    const token = await getAccessToken()
    return requestJson(`${config.baseUrl}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
}

export async function createQpayInvoice(input: {
    senderInvoiceNo: string
    description: string
    amountMnt: number
    callbackUrl: string
}) {
    const config = getQpayConfig()
    const raw = await authorizedRequest('/v2/invoice', {
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

export type VerifiedQpayPayment = {
    paymentId: string
    status: string
    amountMnt: number
    currency: string
    paidAt: string
}

export async function verifyQpayInvoicePayment(invoiceId: string, expectedAmountMnt: number) {
    const rawCheck = await authorizedRequest('/v2/payment/check', {
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 10 },
    })
    const check = qpayPaymentCheckResponseSchema.parse(rawCheck)
    const paidRows = check.rows.filter((row) => row.payment_status.toUpperCase() === 'PAID')
    if (paidRows.length === 0) return null
    if (paidRows.length !== 1) throw new QpayApiError('QPay returned an ambiguous paid-payment result.')

    const rawPayment = await authorizedRequest(`/v2/payment/${encodeURIComponent(paidRows[0].payment_id)}`, undefined, 'GET')
    const payment = qpayPaymentResponseSchema.parse(rawPayment)
    if (payment.payment_status.toUpperCase() !== 'PAID') return null
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
