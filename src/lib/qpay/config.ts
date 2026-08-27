import 'server-only'

import { z } from 'zod'
import { getConfiguredSiteUrl } from '@/lib/site-url'

const qpayEnvironmentSchema = z.object({
    QPAY_BASE_URL: z.string().url(),
    QPAY_CLIENT_ID: z.string().min(1),
    QPAY_CLIENT_SECRET: z.string().min(1),
    QPAY_INVOICE_CODE: z.string().min(1),
    QPAY_SOURCE_SITE: z.literal('ai-creator-academy'),
})

export type QpayConfig = {
    baseUrl: string
    clientId: string
    clientSecret: string
    invoiceCode: string
    sourceSite: 'ai-creator-academy'
    siteUrl: string
    environment: 'sandbox' | 'production'
}

export function isQpayEnabled() {
    return process.env.QPAY_ENABLED?.trim().toLowerCase() === 'true'
}

export function getQpayPublicState() {
    const baseUrl = process.env.QPAY_BASE_URL?.trim() ?? ''
    return {
        enabled: isQpayEnabled(),
        environment: baseUrl.includes('sandbox') ? 'sandbox' as const : 'production' as const,
    }
}

export function getQpayConfig(): QpayConfig {
    const parsed = qpayEnvironmentSchema.safeParse({
        QPAY_BASE_URL: process.env.QPAY_BASE_URL?.trim(),
        QPAY_CLIENT_ID: process.env.QPAY_CLIENT_ID?.trim(),
        QPAY_CLIENT_SECRET: process.env.QPAY_CLIENT_SECRET?.trim(),
        QPAY_INVOICE_CODE: process.env.QPAY_INVOICE_CODE?.trim(),
        QPAY_SOURCE_SITE: process.env.QPAY_SOURCE_SITE?.trim(),
    })
    if (!parsed.success) throw new Error('QPay server configuration is incomplete.')

    const siteUrl = getConfiguredSiteUrl()
    if (!siteUrl) throw new Error('A valid HTTPS NEXT_PUBLIC_SITE_URL is required for QPay callbacks.')

    return {
        baseUrl: parsed.data.QPAY_BASE_URL.replace(/\/$/, ''),
        clientId: parsed.data.QPAY_CLIENT_ID,
        clientSecret: parsed.data.QPAY_CLIENT_SECRET,
        invoiceCode: parsed.data.QPAY_INVOICE_CODE,
        sourceSite: parsed.data.QPAY_SOURCE_SITE,
        siteUrl,
        environment: parsed.data.QPAY_BASE_URL.includes('sandbox') ? 'sandbox' : 'production',
    }
}
