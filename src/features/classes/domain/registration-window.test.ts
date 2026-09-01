import { describe, expect, it } from 'vitest'

import { getRegistrationWindowState } from './registration-window'

const now = Date.parse('2026-09-01T00:00:00.000Z')

describe('getRegistrationWindowState', () => {
    it('does not reinterpret non-open class statuses', () => {
        expect(getRegistrationWindowState({
            status: 'closed',
            registrationOpensAt: null,
            registrationClosesAt: null,
            now,
        })).toBe('inactive')
    })

    it('reports a future registration window as scheduled', () => {
        expect(getRegistrationWindowState({
            status: 'open',
            registrationOpensAt: '2026-09-02T00:00:00.000Z',
            registrationClosesAt: '2026-09-10T00:00:00.000Z',
            now,
        })).toBe('scheduled')
    })

    it('reports the active registration window as open', () => {
        expect(getRegistrationWindowState({
            status: 'open',
            registrationOpensAt: '2026-08-20T00:00:00.000Z',
            registrationClosesAt: '2026-09-01T00:00:00.000Z',
            now,
        })).toBe('open')
    })

    it('reports a passed registration deadline as expired', () => {
        expect(getRegistrationWindowState({
            status: 'open',
            registrationOpensAt: '2026-08-20T00:00:00.000Z',
            registrationClosesAt: '2026-08-31T23:59:59.000Z',
            now,
        })).toBe('expired')
    })
})
