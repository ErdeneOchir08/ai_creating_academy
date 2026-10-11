import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signUp } }) }))
vi.mock('@/lib/auth/return-path', () => ({ getSafeReturnPath: () => null, withReturnPath: (path: string) => path }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'https://mindacademy.mn' }) }))
import { signup } from './auth-actions'

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
