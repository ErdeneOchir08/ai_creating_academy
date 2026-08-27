import { z } from 'zod'

export const offeringContractPolicies = ['required', 'none'] as const
export type OfferingContractPolicy = (typeof offeringContractPolicies)[number]

export const offeringCheckoutStatuses = [
    'draft',
    'contract_required',
    'ready_for_payment',
    'pending_review',
    'correction_required',
    'approved',
    'withdrawn',
] as const
export type OfferingCheckoutStatus = (typeof offeringCheckoutStatuses)[number]

export const offeringPaymentReviewStates = [
    'not_submitted',
    'pending_review',
    'correction_required',
    'approved',
] as const
export type OfferingPaymentReviewState = (typeof offeringPaymentReviewStates)[number]

export const offeringApplicantRelationships = ['self', 'parent', 'guardian', 'other'] as const
export type OfferingApplicantRelationship = (typeof offeringApplicantRelationships)[number]

const uuidSchema = (message: string) => z.string().uuid(message)

const optionalCalendarDateSchema = z.preprocess(
    (value) => value === undefined || value === null || value === '' ? null : value,
    z.string().date('Төрсөн огноо буруу байна.').nullable(),
)

const optionalRegistrationNumberSchema = z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string()
        .trim()
        .max(50, 'Суралцагчийн регистрийн дугаар 50 тэмдэгтээс урт байж болохгүй.')
        .nullable()
        .optional()
        .transform((value) => value ?? null),
)

/**
 * The learner is a person, not an authenticated account. This distinction lets a
 * parent apply for more than one child without treating the parent as the learner.
 */
export const offeringLearnerSchema = z.object({
    fullName: z.string()
        .trim()
        .min(1, 'Суралцагчийн овог нэрийг оруулна уу.')
        .max(240, 'Суралцагчийн овог нэр 240 тэмдэгтээс урт байж болохгүй.'),
    birthDate: optionalCalendarDateSchema,
    registrationNumber: optionalRegistrationNumberSchema,
})

export type OfferingLearner = z.infer<typeof offeringLearnerSchema>

const offeringCheckoutIdentitySchema = z.object({
    offeringId: uuidSchema('Элсэлтийн мэдээлэл буруу байна.'),
    applicantUserId: uuidSchema('Өргөдөл гаргагчийн мэдээлэл буруу байна.'),
    contentAccessUserId: uuidSchema('Хичээл үзэх бүртгэлийн мэдээлэл буруу байна.'),
    learner: offeringLearnerSchema,
})

/**
 * Contract-specific answers and signature evidence deliberately remain outside
 * this schema. The contract feature owns those rules; checkout only records the
 * offering's policy and the three distinct parties involved.
 */
export const noContractOfferingCheckoutDraftSchema = offeringCheckoutIdentitySchema.extend({
    contractPolicy: z.literal('none'),
})

export const contractRequiredOfferingCheckoutDraftSchema = offeringCheckoutIdentitySchema.extend({
    contractPolicy: z.literal('required'),
})

export const offeringCheckoutDraftSchema = z.discriminatedUnion('contractPolicy', [
    noContractOfferingCheckoutDraftSchema,
    contractRequiredOfferingCheckoutDraftSchema,
])

export type NoContractOfferingCheckoutDraft = z.infer<typeof noContractOfferingCheckoutDraftSchema>
export type ContractRequiredOfferingCheckoutDraft = z.infer<typeof contractRequiredOfferingCheckoutDraftSchema>
export type OfferingCheckoutDraft = z.infer<typeof offeringCheckoutDraftSchema>

export const offeringCheckoutProgressSchema = z.object({
    contractPolicy: z.enum(offeringContractPolicies),
    hasCompletedLearnerDetails: z.boolean(),
    hasAcceptedContract: z.boolean(),
    paymentReviewState: z.enum(offeringPaymentReviewStates),
    isWithdrawn: z.boolean(),
}).superRefine((value, context) => {
    if (value.isWithdrawn || value.paymentReviewState === 'not_submitted') return

    if (!value.hasCompletedLearnerDetails) {
        context.addIssue({
            code: 'custom',
            path: ['hasCompletedLearnerDetails'],
            message: 'Төлбөрийн баримт илгээхийн өмнө суралцагчийн мэдээллийг бүрэн оруулна уу.',
        })
    }

    if (value.contractPolicy === 'required' && !value.hasAcceptedContract) {
        context.addIssue({
            code: 'custom',
            path: ['hasAcceptedContract'],
            message: 'Төлбөрийн баримт илгээхийн өмнө гэрээг зөвшөөрнө үү.',
        })
    }
})

export type OfferingCheckoutProgress = z.infer<typeof offeringCheckoutProgressSchema>

const contractFieldSchema = z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    description: z.string(),
})

const savedLearnerSchema = z.object({
    full_name: z.string().min(1),
    birth_date: z.string().date().nullable(),
    registration_number: z.string().nullable(),
})

const savedSignerSchema = z.object({
    full_name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    registration_number: z.string().nullable(),
})

const savedPaymentProofSchema = z.object({
    payment_proof_id: z.string().uuid(),
    attempt_number: z.coerce.number().int().positive(),
    status: z.enum(['pending_review', 'correction_required', 'approved']),
    amount_mnt: z.coerce.number().int().nonnegative(),
    rejection_reason: z.string().nullable(),
    created_at: z.string(),
    reviewed_at: z.string().nullable(),
})

export const savedOfferingApplicationSchema = z.object({
    application_id: z.string().uuid(),
    client_request_id: z.string().uuid(),
    payment_reference: z.string().regex(/^MA-[0-9]{8,19}$/),
    learner_id: z.string().uuid(),
    content_access_user_id: z.string().uuid(),
    learner: savedLearnerSchema,
    applicant_relationship: z.enum(offeringApplicantRelationships),
    signer: savedSignerSchema,
    answers: z.record(z.string(), z.string()),
    application_status: z.enum(offeringCheckoutStatuses),
    contract_accepted_at: z.string().nullable(),
    payment_due_at: z.string().nullable(),
    payment: savedPaymentProofSchema.nullable(),
    enrollment_id: z.string().uuid().nullable(),
    enrollment_status: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
})

export const offeringCheckoutFormSchema = z.object({
    offering_id: z.string().uuid(),
    course_id: z.string().uuid(),
    course_title: z.string().min(1),
    course_description: z.string(),
    course_thumbnail_path: z.string().nullable(),
    program_name: z.string().min(1),
    program_description: z.string(),
    offering_name: z.string().min(1),
    delivery_mode: z.enum(['online', 'offline']),
    contract_policy: z.enum(offeringContractPolicies),
    capacity: z.coerce.number().int().positive().nullable(),
    available_seats: z.coerce.number().int().nonnegative().nullable(),
    tuition_amount_mnt: z.coerce.number().int().nonnegative(),
    payment_plan: z.string(),
    schedule_summary: z.string(),
    location: z.string(),
    registration_closes_at: z.string().nullable(),
    starts_on: z.string().date().nullable(),
    ends_on: z.string().date().nullable(),
    is_accepting_applications: z.boolean(),
    qpay_enabled: z.boolean().default(true),
    manual_transfer_enabled: z.boolean().default(true),
    contract_version_id: z.string().uuid().nullable(),
    contract_title: z.string().nullable(),
    contract_version_number: z.coerce.number().int().positive().nullable(),
    contract_content: z.string().nullable(),
    contract_preview_values: z.record(z.string(), z.string()),
    fields: z.array(contractFieldSchema),
    my_applications: z.array(savedOfferingApplicationSchema),
}).superRefine((value, context) => {
    if (value.contract_policy === 'none') {
        if (
            value.contract_version_id !== null
            || value.contract_title !== null
            || value.contract_version_number !== null
            || value.contract_content !== null
            || value.fields.length > 0
        ) {
            context.addIssue({
                code: 'custom',
                path: ['contract_policy'],
                message: 'Гэрээгүй элсэлт гэрээний мэдээлэл агуулж болохгүй.',
            })
        }
        return
    }

    if (
        value.contract_version_id === null
        || value.contract_title === null
        || value.contract_version_number === null
        || value.contract_content === null
    ) {
        context.addIssue({
            code: 'custom',
            path: ['contract_version_id'],
            message: 'Гэрээ шаардлагатай элсэлтийн гэрээний хувилбар дутуу байна.',
        })
    }
})

export const myOfferingCheckoutStatusSchema = z.object({
    application_id: z.string().uuid(),
    offering_id: z.string().uuid(),
    course_id: z.string().uuid(),
    learner_id: z.string().uuid(),
    learner_full_name: z.string().min(1),
    content_access_user_id: z.string().uuid(),
    program_name: z.string().min(1),
    offering_name: z.string().min(1),
    contract_policy: z.enum(offeringContractPolicies),
    application_status: z.enum(offeringCheckoutStatuses),
    contract_accepted_at: z.string().nullable(),
    payment_due_at: z.string().nullable(),
    payment_proof_id: z.string().uuid().nullable(),
    payment_status: z.enum(['pending_review', 'correction_required', 'approved']).nullable(),
    payment_rejection_reason: z.string().nullable(),
    payment_created_at: z.string().nullable(),
    payment_reviewed_at: z.string().nullable(),
    amount_mnt: z.coerce.number().int().nonnegative(),
    enrollment_id: z.string().uuid().nullable(),
    enrollment_status: z.string().nullable(),
    updated_at: z.string(),
})

export type OfferingCheckoutForm = z.infer<typeof offeringCheckoutFormSchema>
export type SavedOfferingApplication = z.infer<typeof savedOfferingApplicationSchema>
export type MyOfferingCheckoutStatus = z.infer<typeof myOfferingCheckoutStatusSchema>

/**
 * Online offerings do not have a classroom venue. If a published contract uses
 * the generic location variable, show the academy address already supplied by
 * the checkout RPC. Offline offerings must keep their explicit venue and never
 * inherit the academy address implicitly.
 */
export function getOfferingContractPreviewValues(
    checkout: Pick<OfferingCheckoutForm, 'delivery_mode' | 'contract_preview_values'>,
) {
    const values = checkout.contract_preview_values
    if (checkout.delivery_mode !== 'online' || values.location?.trim()) return values

    const academyAddress = values.academy_address?.trim()
    return academyAddress
        ? { ...values, location: academyAddress }
        : values
}

const nullableTrimmedString = (maximum: number) => z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().trim().max(maximum).nullable(),
)

const offeringDraftDetailsBaseSchema = z.object({
    contractPolicy: z.enum(offeringContractPolicies),
    schema_version: z.literal(1),
    client_request_id: z.string().uuid('Элсэлтийн хүсэлтийн дугаар буруу байна.'),
    learner_full_name: z.string().trim().min(1, 'Суралцагчийн овог нэрийг оруулна уу.').max(240),
    learner_birth_date: optionalCalendarDateSchema,
    learner_registration_number: optionalRegistrationNumberSchema,
    applicant_relationship: z.enum(offeringApplicantRelationships),
    signer_full_name: nullableTrimmedString(240),
    signer_email: z.preprocess(
        (value) => typeof value === 'string' && value.trim() === '' ? null : value,
        z.string().trim().email('Гарын үсэг зурах хүний и-мэйл буруу байна.').max(320).nullable(),
    ),
    signer_phone: nullableTrimmedString(50),
    signer_registration_number: nullableTrimmedString(50),
    answers: z.record(z.string(), z.string()),
}).superRefine((value, context) => {
    if (value.contractPolicy === 'none') return

    const required: Array<[keyof typeof value, unknown, string]> = [
        ['learner_birth_date', value.learner_birth_date, 'Гэрээ байгуулахын тулд суралцагчийн төрсөн огноог оруулна уу.'],
        ['learner_registration_number', value.learner_registration_number, 'Гэрээ байгуулахын тулд суралцагчийн регистрийн дугаарыг оруулна уу.'],
        ['signer_full_name', value.signer_full_name, 'Гэрээ зөвшөөрөх хүний овог нэрийг оруулна уу.'],
        ['signer_email', value.signer_email, 'Гэрээ зөвшөөрөх хүний и-мэйлийг оруулна уу.'],
        ['signer_phone', value.signer_phone, 'Гэрээ зөвшөөрөх хүний утасны дугаарыг оруулна уу.'],
        ['signer_registration_number', value.signer_registration_number, 'Гэрээ зөвшөөрөх хүний регистрийн дугаарыг оруулна уу.'],
    ]

    for (const [path, fieldValue, message] of required) {
        if (fieldValue) continue
        context.addIssue({ code: 'custom', path: [path], message })
    }
})

export type OfferingDraftDetails = Omit<z.infer<typeof offeringDraftDetailsBaseSchema>, 'contractPolicy'>

export function parseOfferingCheckoutDraft(value: unknown) {
    return offeringCheckoutDraftSchema.parse(value)
}

export function parseOfferingCheckoutProgress(value: unknown) {
    return offeringCheckoutProgressSchema.parse(value)
}

export function parseOfferingCheckoutForm(value: unknown) {
    return offeringCheckoutFormSchema.parse(value)
}

export function parseMyOfferingCheckoutStatuses(value: unknown) {
    return z.array(myOfferingCheckoutStatusSchema).parse(value)
}

export function parseOfferingDraftDetails(
    value: unknown,
    contractPolicy: OfferingContractPolicy,
): OfferingDraftDetails {
    const parsed = offeringDraftDetailsBaseSchema.parse({
        ...(typeof value === 'object' && value !== null ? value : {}),
        contractPolicy,
    })
    return {
        schema_version: parsed.schema_version,
        client_request_id: parsed.client_request_id,
        learner_full_name: parsed.learner_full_name,
        learner_birth_date: parsed.learner_birth_date,
        learner_registration_number: parsed.learner_registration_number,
        applicant_relationship: parsed.applicant_relationship,
        signer_full_name: parsed.signer_full_name,
        signer_email: parsed.signer_email,
        signer_phone: parsed.signer_phone,
        signer_registration_number: parsed.signer_registration_number,
        answers: parsed.answers,
    }
}

export function deriveOfferingCheckoutStatus(value: OfferingCheckoutProgress): OfferingCheckoutStatus {
    const progress = offeringCheckoutProgressSchema.parse(value)

    if (progress.isWithdrawn) return 'withdrawn'
    if (progress.paymentReviewState === 'approved') return 'approved'
    if (progress.paymentReviewState === 'correction_required') return 'correction_required'
    if (progress.paymentReviewState === 'pending_review') return 'pending_review'
    if (!progress.hasCompletedLearnerDetails) return 'draft'
    if (progress.contractPolicy === 'required' && !progress.hasAcceptedContract) {
        return 'contract_required'
    }

    return 'ready_for_payment'
}
