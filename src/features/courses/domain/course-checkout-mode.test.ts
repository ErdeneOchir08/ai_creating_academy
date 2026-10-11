import { describe, expect, it } from 'vitest'
import { parseCourseCheckoutMode } from './course-checkout-mode'

describe('course checkout mode', () => {
    it('defaults new courses to automatic direct checkout', () => {
        expect(parseCourseCheckoutMode(null)).toBe('direct')
    })
    it('preserves explicit class-only and direct choices', () => {
        expect(parseCourseCheckoutMode('class_only')).toBe('class_only')
        expect(parseCourseCheckoutMode('direct')).toBe('direct')
    })
    it('rejects unknown modes rather than silently selling without a contract', () => {
        expect(() => parseCourseCheckoutMode('manual')).toThrow()
        expect(() => parseCourseCheckoutMode('')).toThrow()
    })
})
