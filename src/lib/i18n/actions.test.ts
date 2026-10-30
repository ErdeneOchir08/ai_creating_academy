import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieSet = vi.hoisted(() => vi.fn())
const getCookies = vi.hoisted(() => vi.fn(async () => ({ set: cookieSet })))
vi.mock('next/headers', () => ({ cookies: getCookies }))
import { setLocale } from './actions'

describe('language preference', () => {
    beforeEach(() => vi.clearAllMocks())

    it('saves English and allows switching back to Mongolian across all routes', async () => {
        await setLocale('en')
        expect(cookieSet).toHaveBeenLastCalledWith('mind-academy-language', 'en', expect.objectContaining({
            path: '/', httpOnly: true, sameSite: 'lax', maxAge: 31_536_000,
        }))
        await setLocale('mn')
        expect(cookieSet).toHaveBeenLastCalledWith('mind-academy-language', 'mn', expect.any(Object))
    })

    it('rejects an unsupported language before changing cookies', async () => {
        await expect(setLocale('fr')).rejects.toThrow('Unsupported language')
        expect(getCookies).not.toHaveBeenCalled()
        expect(cookieSet).not.toHaveBeenCalled()
    })
})
