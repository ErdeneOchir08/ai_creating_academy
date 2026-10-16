import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/site-url', () => ({ getConfiguredSiteUrl: () => 'https://mindacademy.mn' }))
import { getActiveQpayMerchant, getQpayConfig } from './config'

describe('QPay merchant configuration', () => {
    beforeEach(() => {
        vi.stubEnv('QPAY_ACTIVE_MERCHANT', '')
        vi.stubEnv('QPAY_BASE_URL', 'https://merchant.qpay.mn')
        vi.stubEnv('QPAY_SOURCE_SITE', 'ai-creator-academy')
        vi.stubEnv('QPAY_CLIENT_ID', 'old-client')
        vi.stubEnv('QPAY_CLIENT_SECRET', 'old-test-secret')
        vi.stubEnv('QPAY_INVOICE_CODE', 'OLD_INVOICE')
        vi.stubEnv('QPAY_ZURKHAI_CLIENT_ID', 'new-client')
        vi.stubEnv('QPAY_ZURKHAI_CLIENT_SECRET', 'new-test-secret')
        vi.stubEnv('QPAY_ZURKHAI_INVOICE_CODE', 'NEW_INVOICE')
    })
    afterEach(() => vi.unstubAllEnvs())
    it('keeps the old merchant active until explicitly switched', () => {
        expect(getActiveQpayMerchant()).toBe('legacy')
        expect(getQpayConfig().invoiceCode).toBe('OLD_INVOICE')
    })
    it('uses new credentials for new invoices but old credentials for old invoices', () => {
        vi.stubEnv('QPAY_ACTIVE_MERCHANT', 'zurkhai')
        expect(getQpayConfig()).toMatchObject({ merchant: 'zurkhai', clientId: 'new-client', invoiceCode: 'NEW_INVOICE' })
        expect(getQpayConfig('legacy')).toMatchObject({ merchant: 'legacy', clientId: 'old-client', invoiceCode: 'OLD_INVOICE' })
    })
    it('does not silently fall back when new credentials are missing', () => {
        vi.stubEnv('QPAY_ACTIVE_MERCHANT', 'zurkhai')
        vi.stubEnv('QPAY_ZURKHAI_CLIENT_SECRET', '')
        expect(() => getQpayConfig()).toThrow('configuration')
        expect(() => getQpayConfig('legacy')).not.toThrow()
    })
    it('rejects an unknown active merchant', () => {
        vi.stubEnv('QPAY_ACTIVE_MERCHANT', 'typo')
        expect(() => getQpayConfig()).toThrow('configuration')
    })
})
