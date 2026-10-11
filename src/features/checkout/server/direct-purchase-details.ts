import { createHash } from 'node:crypto'
import { parseOfferingDraftDetails } from '../domain/offering-checkout'

export function directPurchaseDetails(userId: string, offeringId: string, accountLabel: string) {
    const digest = createHash('sha256').update(`direct-course:${userId}:${offeringId}`).digest('hex')
    const requestId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
    return parseOfferingDraftDetails({
        schema_version: 1, client_request_id: requestId,
        learner_full_name: accountLabel.trim().slice(0, 240) || 'Mind Academy account',
        learner_birth_date: null, learner_registration_number: null, applicant_relationship: 'self',
        signer_full_name: null, signer_email: null, signer_phone: null,
        signer_registration_number: null, answers: {},
    }, 'none')
}
