import { describe, expect, it } from 'vitest'

import { getSafeReturnPath, withReturnPath } from './return-path'

describe('getSafeReturnPath', () => {
    it.each([
        '/',
        '/programs/8ed7616e-e839-4b36-858a-2d778dcdd70d',
        '/courses/example?lesson=2#questions',
        '/search?resource=%2Fprograms%2Fexample',
        '/%E1%85%A0',
    ])('accepts the internal path %s', (value) => {
        expect(getSafeReturnPath(value)).toBe(value)
    })

    it.each([
        null,
        undefined,
        '',
        'programs/example',
        '//evil.example/checkout',
        'https://evil.example/checkout',
        'http://evil.example/checkout',
        'javascript:alert(1)',
        '/\\evil.example/checkout',
        '/%2f%2fevil.example/checkout',
        '/%5cevil.example/checkout',
        '/programs/example%0d%0aX-Test:yes',
        '/programs/example\u0000',
        ['/programs/example'],
    ])('rejects the unsafe return value %j', (value) => {
        expect(getSafeReturnPath(value)).toBeNull()
    })
})

describe('withReturnPath', () => {
    it('adds an encoded valid return path without removing existing parameters', () => {
        expect(withReturnPath('/login?confirmed=1', '/programs/example?source=home')).toBe(
            '/login?confirmed=1&next=%2Fprograms%2Fexample%3Fsource%3Dhome',
        )
    })

    it('does not add an unsafe return path', () => {
        expect(withReturnPath('/login', '//evil.example')).toBe('/login')
    })
})
