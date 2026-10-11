import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { OfferingCheckoutForm, SavedOfferingApplication } from '../domain/offering-checkout'

vi.mock('@/components/ui/button', () => ({ Button: ({ children }: { children: ReactNode }) => createElement('button', null, children) }))
vi.mock('../actions/offering-checkout-actions', () => ({ prepareDirectCoursePurchase: vi.fn() }))
vi.mock('../actions/qpay-payment-actions', () => ({ createOfferingQpayInvoice: vi.fn() }))
vi.mock('./qpay-payment-panel', () => ({ QpayPaymentPanel: ({ amountMnt }: { amountMnt: number }) => createElement('div', null, `QR payment: ${amountMnt}`) }))
import { DirectCoursePurchase } from './direct-course-purchase'

const checkout = {
    offering_id: 'offer', course_id: 'course', tuition_amount_mnt: 69000,
    is_accepting_applications: true, qpay_enabled: true, my_applications: [],
} as unknown as OfferingCheckoutForm

function render(applications: Partial<SavedOfferingApplication>[] = [], owned = false) {
    return renderToStaticMarkup(createElement(DirectCoursePurchase, {
        checkout: { ...checkout, my_applications: applications as SavedOfferingApplication[] },
        owned, qpayEnabled: true, environment: 'production', serverNow: '2026-10-11T12:00:00Z',
    }))
}

describe('direct purchase screen', () => {
    it('renders the pay button without any student input or contract', () => {
        const html = render()
        expect(html).toContain('QPay-аар төлөх')
        expect(html).not.toContain('<input')
        expect(html).not.toContain('<select')
        expect(html).not.toContain('Регистр')
        expect(html).not.toContain('Гэрээ')
    })
    it('shows learning access rather than another charge to an owner', () => {
        const html = render([], true)
        expect(html).toContain('/courses/course')
        expect(html).not.toContain('QPay-аар төлөх')
    })
    it('resumes payment using the saved price', () => {
        expect(render([{ application_id: 'saved', application_status: 'ready_for_payment', tuition_amount_mnt_snapshot: 59000 }])).toContain('QR payment: 59000')
    })
    it('blocks new charges for pending review and expired orders', () => {
        expect(render([{ application_status: 'pending_review' }])).toContain('Дахин төлөх шаардлагагүй')
        const expired = render([{ application_status: 'ready_for_payment', payment_due_at: '2026-01-01T00:00:00Z' }])
        expect(expired).toContain('Дахин төлбөр бүү хийгээрэй')
        expect(expired).not.toContain('QR payment')
    })
})
