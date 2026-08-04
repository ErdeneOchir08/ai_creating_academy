import 'server-only'

import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const CONTRACT_OTP_COOKIE = 'mind_contract_signing'
export const CONTRACT_OTP_EXPIRY_MINUTES = 10
export const CONTRACT_OTP_RESEND_SECONDS = 60
export const CONTRACT_OTP_MAX_ATTEMPTS = 5

const challengeSchema = z.object({
    version: z.literal(1),
    applicationId: z.string().uuid(),
    applicantUserId: z.string().uuid(),
    email: z.string().email(),
    nonce: z.string().min(16),
    codeDigest: z.string().regex(/^[a-f0-9]{64}$/),
    expiresAt: z.number().int().positive(),
    attempts: z.number().int().min(0).max(CONTRACT_OTP_MAX_ATTEMPTS),
})

type Challenge = z.infer<typeof challengeSchema>

type ChallengeIdentity = Pick<Challenge, 'applicationId' | 'applicantUserId' | 'email'>

export function createContractSigningChallenge(
    identity: ChallengeIdentity,
    secret: string,
    now = Date.now(),
) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const nonce = randomBytes(18).toString('base64url')
    const expiresAt = now + CONTRACT_OTP_EXPIRY_MINUTES * 60_000
    const challenge: Challenge = {
        version: 1,
        ...identity,
        nonce,
        codeDigest: digestCode(code, identity, nonce, expiresAt, secret),
        expiresAt,
        attempts: 0,
    }

    return { code, token: encodeChallenge(challenge, secret), expiresAt }
}

export function verifyContractSigningChallenge(
    token: string,
    code: string,
    expected: ChallengeIdentity,
    secret: string,
    now = Date.now(),
):
    | { valid: true }
    | { valid: false; reason: 'invalid' | 'expired' | 'attempts_exceeded'; nextToken?: string } {
    const challenge = decodeChallenge(token, secret)
    if (!challenge) return { valid: false, reason: 'invalid' }

    if (
        challenge.applicationId !== expected.applicationId
        || challenge.applicantUserId !== expected.applicantUserId
        || challenge.email !== expected.email
    ) {
        return { valid: false, reason: 'invalid' }
    }

    if (challenge.expiresAt <= now) return { valid: false, reason: 'expired' }
    if (challenge.attempts >= CONTRACT_OTP_MAX_ATTEMPTS) {
        return { valid: false, reason: 'attempts_exceeded' }
    }

    const digest = digestCode(
        code,
        expected,
        challenge.nonce,
        challenge.expiresAt,
        secret,
    )
    if (safeEqual(digest, challenge.codeDigest)) return { valid: true }

    const attempts = challenge.attempts + 1
    if (attempts >= CONTRACT_OTP_MAX_ATTEMPTS) {
        return { valid: false, reason: 'attempts_exceeded' }
    }

    return {
        valid: false,
        reason: 'invalid',
        nextToken: encodeChallenge({ ...challenge, attempts }, secret),
    }
}

function signingKey(secret: string) {
    return createHmac('sha256', secret)
        .update('mind-academy:contract-signing:v1')
        .digest()
}

function digestCode(
    code: string,
    identity: ChallengeIdentity,
    nonce: string,
    expiresAt: number,
    secret: string,
) {
    return createHmac('sha256', signingKey(secret))
        .update([
            code,
            identity.applicationId,
            identity.applicantUserId,
            identity.email,
            nonce,
            expiresAt.toString(),
        ].join('\u0000'))
        .digest('hex')
}

function encodeChallenge(challenge: Challenge, secret: string) {
    const payload = Buffer.from(JSON.stringify(challenge)).toString('base64url')
    const signature = createHmac('sha256', signingKey(secret)).update(payload).digest('hex')
    return `${payload}.${signature}`
}

function decodeChallenge(token: string, secret: string): Challenge | null {
    const [payload, signature, ...rest] = token.split('.')
    if (!payload || !signature || rest.length > 0) return null

    const expectedSignature = createHmac('sha256', signingKey(secret)).update(payload).digest('hex')
    if (!safeEqual(signature, expectedSignature)) return null

    try {
        return challengeSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
    } catch {
        return null
    }
}

function safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
