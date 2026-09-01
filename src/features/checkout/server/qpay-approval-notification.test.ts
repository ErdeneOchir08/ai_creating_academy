import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createAdminClient: vi.fn(),
    sendEmail: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/email/offering-status', () => ({
    sendOfferingPaymentDecisionEmail: mocks.sendEmail,
}))

import { deliverQpayApprovalNotification } from './qpay-approval-notification'

const paymentId = 'f91bc9c0-b64f-44d1-a940-a1ce05d0d8bf'
const applicationId = '8ed7616b-e839-4b36-858a-2d778dcdd70d'
const offeringId = 'e917a3ce-77a2-474f-8932-8eab05193d4f'
const learnerId = '9afbd520-0b72-4f3c-9395-964b8798f327'
const applicantId = '2f465847-bfcc-4391-b654-18af7718b828'

function builder(result: { data?: unknown; error?: unknown }, updates?: unknown[]) {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.update = vi.fn((value: unknown) => {
        updates?.push(value)
        return chain
    })
    chain.maybeSingle = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }))
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
        Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve, reject)
    )
    return chain
}

function successfulAdmin(notificationStatus: 'pending' | 'failed' | 'sent' = 'pending') {
    const claimUpdates: unknown[] = []
    const finishUpdates: unknown[] = []
    const builders = [
        builder({ data: { id: applicationId, status: notificationStatus, attempts: 0, locked_at: null } }),
        builder({ data: { application_id: applicationId, provider: 'qpay', status: 'paid' } }),
        builder({ data: {
            offering_id: offeringId,
            learner_id: learnerId,
            applicant_user_id: applicantId,
            contact_email: 'parent@example.com',
            terms_snapshot: { program_name: 'AI Game Creator', offering_name: 'Level 1' },
        } }),
        builder({ data: { full_name: 'Student' } }),
        builder({ data: { display_name: 'Parent' } }),
        builder({ data: { id: applicationId } }, claimUpdates),
        builder({ data: null }, finishUpdates),
    ]
    const from = vi.fn(() => {
        const next = builders.shift()
        if (!next) throw new Error('Unexpected database call')
        return next
    })
    return { admin: { from }, claimUpdates, finishUpdates }
}

describe('QPay approval notification delivery', () => {
    beforeEach(() => {
        mocks.createAdminClient.mockReset()
        mocks.sendEmail.mockReset().mockResolvedValue({ sent: true })
    })

    it('claims, sends, and marks a paid QPay confirmation as sent', async () => {
        const { admin, claimUpdates, finishUpdates } = successfulAdmin()
        mocks.createAdminClient.mockReturnValue(admin)

        await expect(deliverQpayApprovalNotification(paymentId)).resolves.toEqual({ sent: true })

        expect(mocks.sendEmail).toHaveBeenCalledWith({
            to: 'parent@example.com',
            recipientName: 'Parent',
            learnerName: 'Student',
            programName: 'AI Game Creator',
            offeringName: 'Level 1',
            offeringId,
            decision: 'approved',
        })
        expect(claimUpdates).toEqual([expect.objectContaining({ status: 'processing', attempts: 1 })])
        expect(finishUpdates).toEqual([expect.objectContaining({ status: 'sent', last_error: null })])
    })

    it('does not send the same successful notification twice', async () => {
        const from = vi.fn(() => builder({
            data: { id: applicationId, status: 'sent', attempts: 1, locked_at: null },
        }))
        mocks.createAdminClient.mockReturnValue({ from })

        await expect(deliverQpayApprovalNotification(paymentId)).resolves.toEqual({
            sent: true,
            alreadySent: true,
        })
        expect(from).toHaveBeenCalledTimes(1)
        expect(mocks.sendEmail).not.toHaveBeenCalled()
    })

    it('records an SMTP failure for an administrator to retry', async () => {
        const { admin, finishUpdates } = successfulAdmin()
        mocks.createAdminClient.mockReturnValue(admin)
        mocks.sendEmail.mockResolvedValue({ sent: false, error: 'SMTP unavailable.' })

        await expect(deliverQpayApprovalNotification(paymentId)).resolves.toEqual({
            sent: false,
            error: 'SMTP unavailable.',
        })
        expect(finishUpdates).toEqual([expect.objectContaining({
            status: 'failed',
            last_error: 'SMTP unavailable.',
        })])
    })
})
