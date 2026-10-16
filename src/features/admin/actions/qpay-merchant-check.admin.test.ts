import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), role: vi.fn(), check: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.role }) }) }),
}) }))
vi.mock('@/lib/qpay/client', () => ({ checkQpayMerchantConnection: mocks.check }))
vi.mock('@/lib/qpay/config', () => ({ getActiveQpayMerchant: () => 'legacy' }))
import { checkQpayMerchantConnections } from './qpay-merchant-check.admin'

describe('admin merchant diagnostics', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin' } } })
        mocks.role.mockResolvedValue({ data: { role: 'admin' } })
    })
    it('rejects signed-out requests before contacting QPay', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: null } })
        await expect(checkQpayMerchantConnections()).rejects.toThrow()
        expect(mocks.check).not.toHaveBeenCalled()
    })
    it('rejects students before contacting QPay', async () => {
        mocks.role.mockResolvedValue({ data: { role: 'student' } })
        await expect(checkQpayMerchantConnections()).rejects.toThrow()
        expect(mocks.check).not.toHaveBeenCalled()
    })
    it('returns only connection booleans and never provider errors or tokens', async () => {
        mocks.check.mockResolvedValueOnce('not-for-client').mockRejectedValueOnce(new Error('private-provider-detail'))
        expect(await checkQpayMerchantConnections()).toEqual({ active: 'legacy', connections: [
            { merchant: 'legacy', connected: true }, { merchant: 'zurkhai', connected: false },
        ] })
    })
})
