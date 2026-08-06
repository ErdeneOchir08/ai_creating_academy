import { describe, expect, it } from 'vitest'
import { isProgramRouteId } from './program-route'

describe('program route ID validation', () => {
    it('accepts a supported UUID path segment', () => {
        expect(isProgramRouteId('6c63ff95-1052-4cf7-b45f-c5c89e3af810')).toBe(true)
        expect(isProgramRouteId('6C63FF95-1052-4CF7-B45F-C5C89E3AF810')).toBe(true)
    })

    it.each([
        '',
        'not-a-uuid',
        '../programs',
        '6c63ff95-1052-7cf7-b45f-c5c89e3af810',
        '6c63ff95-1052-4cf7-745f-c5c89e3af810',
    ])('rejects malformed path segment %s', (value) => {
        expect(isProgramRouteId(value)).toBe(false)
    })
})
