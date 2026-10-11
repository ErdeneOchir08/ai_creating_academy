import { describe, expect, it, vi } from 'vitest'
import { recoveryTokenFromHash, verifyRecoveryToken } from './recovery'

const token = 'a'.repeat(64)
describe('cross-device password recovery', () => {
    it('reads the email fragment without needing original browser storage', () => {
        expect(recoveryTokenFromHash(`#token_hash=${token}`)).toBe(token)
        expect(recoveryTokenFromHash(`#token_hash=pkce_${token}`)).toBe(`pkce_${token}`)
    })
    it.each(['', '#recovery=1', '#token_hash=bad', '#access_token=abc'])('rejects non-recovery input %s', (hash) => {
        expect(recoveryTokenFromHash(hash)).toBeNull()
    })
    it('requires a verified recovery session, not just a supplied token', async () => {
        const verify = vi.fn().mockResolvedValue({ error: null, data: { session: { user: {} } } })
        expect(await verifyRecoveryToken(token, verify)).toBe(true)
        expect(verify).toHaveBeenCalledWith({ token_hash: token, type: 'recovery' })
    })
    it('rejects expired or reused links', async () => {
        expect(await verifyRecoveryToken(token, vi.fn().mockResolvedValue({ error: { code: 'otp_expired' }, data: { session: null } }))).toBe(false)
    })
    it('rejects successful responses without a session', async () => {
        expect(await verifyRecoveryToken(token, vi.fn().mockResolvedValue({ error: null, data: { session: null } }))).toBe(false)
    })
    it('does not send malformed tokens to auth', async () => {
        const verify = vi.fn()
        expect(await verifyRecoveryToken('bad', verify)).toBe(false)
        expect(verify).not.toHaveBeenCalled()
    })
})
