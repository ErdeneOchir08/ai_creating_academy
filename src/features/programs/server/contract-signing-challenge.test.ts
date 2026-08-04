import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
    CONTRACT_OTP_MAX_ATTEMPTS,
    createContractSigningChallenge,
    verifyContractSigningChallenge,
} from './contract-signing-challenge'

const identity = {
    applicationId: 'f91bc9c0-b64f-44d1-a940-a1ce05d0d8bf',
    applicantUserId: '9afbd520-0b72-4f3c-9395-964b8798f327',
    email: 'parent@example.com',
}

describe('contract signing email challenge', () => {
    it('accepts the correct code for the same application and signer', () => {
        const challenge = createContractSigningChallenge(identity, 'test-secret', 1_000)
        expect(verifyContractSigningChallenge(
            challenge.token,
            challenge.code,
            identity,
            'test-secret',
            2_000,
        )).toEqual({ valid: true })
    })

    it('rejects a token copied to another application', () => {
        const challenge = createContractSigningChallenge(identity, 'test-secret', 1_000)
        expect(verifyContractSigningChallenge(
            challenge.token,
            challenge.code,
            { ...identity, applicationId: 'fbaad481-0539-4edb-a814-77b39fb2cac1' },
            'test-secret',
            2_000,
        )).toMatchObject({ valid: false, reason: 'invalid' })
    })

    it('expires after the configured lifetime', () => {
        const challenge = createContractSigningChallenge(identity, 'test-secret', 1_000)
        expect(verifyContractSigningChallenge(
            challenge.token,
            challenge.code,
            identity,
            'test-secret',
            challenge.expiresAt,
        )).toEqual({ valid: false, reason: 'expired' })
    })

    it('locks the challenge after repeated incorrect codes', () => {
        let token = createContractSigningChallenge(identity, 'test-secret', 1_000).token
        let lastResult: ReturnType<typeof verifyContractSigningChallenge> | undefined

        for (let attempt = 0; attempt < CONTRACT_OTP_MAX_ATTEMPTS; attempt += 1) {
            lastResult = verifyContractSigningChallenge(
                token,
                '000000',
                identity,
                'test-secret',
                2_000,
            )
            if (!lastResult.valid && lastResult.nextToken) token = lastResult.nextToken
        }

        expect(lastResult).toMatchObject({ valid: false, reason: 'attempts_exceeded' })
    })
})
