import { describe, expect, it } from 'vitest'
import { getSignerRole, getUlaanbaatarDate } from './contract-signing'

describe('contract signer role', () => {
    it('requires a guardian before the eighteenth birthday', () => {
        expect(getSignerRole('2008-08-05', '2026-08-04')).toBe('guardian')
    })

    it('allows the student to sign on the eighteenth birthday', () => {
        expect(getSignerRole('2008-08-04', '2026-08-04')).toBe('self')
    })

    it('matches PostgreSQL month-end clamping for a February 29 birthday', () => {
        expect(getSignerRole('2008-02-29', '2026-02-27')).toBe('guardian')
        expect(getSignerRole('2008-02-29', '2026-02-28')).toBe('self')
    })

    it('rejects a future birth date', () => {
        expect(() => getSignerRole('2026-08-05', '2026-08-04')).toThrow(/ирээдүйд/)
    })

    it('uses the Ulaanbaatar calendar date', () => {
        expect(getUlaanbaatarDate(new Date('2026-08-03T16:30:00.000Z'))).toBe('2026-08-04')
    })
})
