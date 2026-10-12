import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signUp, resend } = vi.hoisted(() => ({ signUp: vi.fn(), resend: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signUp, resend } }) }))
vi.mock('@/lib/auth/return-path', () => ({ getSafeReturnPath: () => null, withReturnPath: (path: string) => path }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'https://mindacademy.mn' }) }))
import { signup, resendConfirmation } from './auth-actions'

function form() {
    const data = new FormData()
    data.set('email', 'example@example.com')
    data.set('password', 'test-only-password')
    data.set('full_name', 'Test')
    return data
}

describe('registration guidance without account enumeration', () => {
    beforeEach(() => signUp.mockReset())
    it('gives new and obfuscated existing accounts identical next steps', async () => {
        signUp.mockResolvedValueOnce({ data: { session: null, user: { identities: [{}] } }, error: null })
        const fresh = await signup(form())
        signUp.mockResolvedValueOnce({ data: { session: null, user: { identities: [] } }, error: null })
        expect(await signup(form())).toEqual(fresh)
        expect(fresh?.success).toContain('шаардлагатай бол')
        expect(fresh?.success).toContain('нууц үгээ сэргээх')
    })
    it('handles explicit duplicate errors without revealing membership', async () => {
        signUp.mockResolvedValue({ data: {}, error: { code: 'user_already_exists', message: 'User already registered' } })
        const result = await signup(form())
        expect(result?.success).toContain('шаардлагатай бол')
        expect(result?.error).toBeUndefined()
    })
    it('does not disguise actual provider failures as success', async () => {
        signUp.mockResolvedValue({ data: {}, error: { code: 'unexpected_failure', message: 'SMTP error' } })
        const result = await signup(form())
        expect(result?.error).toBeTruthy()
        expect(result?.success).toBeUndefined()
    })
})

describe('resend confirmation', () => {
    beforeEach(() => resend.mockReset())
    it('normalizes the address and only requests signup confirmation', async () => {
        resend.mockResolvedValue({ error: null })
        const data = form()
        data.set('email', '  Example@Example.com  ')
        expect((await resendConfirmation(data)).success).toContain('бүртгэлтэй бол')
        expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'example@example.com', options: { emailRedirectTo: 'https://mindacademy.mn/auth/confirm' } })
    })
    it('rejects invalid email without contacting the provider', async () => {
        const data = form()
        data.set('email', 'invalid')
        expect((await resendConfirmation(data)).error).toBeTruthy()
        expect(resend).not.toHaveBeenCalled()
    })
    it('does not disclose whether an account exists', async () => {
        resend.mockResolvedValueOnce({ error: null })
        const expected = await resendConfirmation(form())
        resend.mockResolvedValueOnce({ error: { code: 'user_not_found' } })
        expect(await resendConfirmation(form())).toEqual(expected)
    })
    it('reports throttling and provider failures without exposing raw details', async () => {
        resend.mockResolvedValueOnce({ error: { status: 429 } })
        expect((await resendConfirmation(form())).error).toContain('хязгаарт')
        resend.mockResolvedValueOnce({ error: { message: 'secret provider details', code: 'unexpected_failure' } })
        const result = await resendConfirmation(form())
        expect(result.error).toBeTruthy()
        expect(result.success).toBeUndefined()
        expect(result.error).not.toContain('secret')
    })
})
