import { describe, expect, it } from 'vitest'
import { applicationPaymentAmount } from './application-payment-amount'

describe('saved application payment amount', () => {
    it('shows the saved price independently of later catalogue edits', () => {
        expect(applicationPaymentAmount({ tuition_amount_mnt_snapshot: 69000 })).toBe(69000)
    })
    it('fails closed instead of guessing a current price', () => {
        for (const amount of [undefined, 0, -1, 1.5, NaN]) {
            expect(() => applicationPaymentAmount({ tuition_amount_mnt_snapshot: amount })).toThrow()
        }
    })
})
