import { z } from 'zod'

export const cohortApplicationStatuses = ['draft', 'submitted', 'approved', 'rejected', 'withdrawn'] as const
export type CohortApplicationStatus = (typeof cohortApplicationStatuses)[number]

const applicationFieldSchema = z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    description: z.string(),
})

const savedApplicationSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(cohortApplicationStatuses),
    answers: z.record(z.string(), z.string()),
    rejection_reason: z.string().nullable(),
    submitted_at: z.string().nullable(),
    updated_at: z.string(),
})

export const openCohortSchema = z.object({
    cohort_id: z.string().uuid(),
    program_name: z.string(),
    program_description: z.string(),
    cohort_name: z.string(),
    delivery_mode: z.enum(['online', 'offline', 'hybrid']),
    capacity: z.number().int().positive().nullable(),
    approved_count: z.coerce.number().int().nonnegative(),
    tuition_amount_mnt: z.number().int().nonnegative().nullable(),
    payment_plan: z.string(),
    schedule_summary: z.string(),
    location: z.string(),
    registration_closes_at: z.string().nullable(),
    starts_on: z.string().nullable(),
    ends_on: z.string().nullable(),
})

export const cohortApplicationFormSchema = openCohortSchema.omit({ cohort_id: true }).extend({
    cohort_id: z.string().uuid(),
    contract_title: z.string(),
    contract_version_number: z.number().int().positive(),
    is_accepting_applications: z.boolean(),
    fields: z.array(applicationFieldSchema),
    my_application: savedApplicationSchema.nullable(),
})

export type OpenCohort = z.infer<typeof openCohortSchema>
export type CohortApplicationForm = z.infer<typeof cohortApplicationFormSchema>
export type CohortApplicationField = z.infer<typeof applicationFieldSchema>

export const approvedApplicationContractSnapshotSchema = z.object({
    id: z.string().uuid(),
    application_id: z.string().uuid(),
    contract_title: z.string().min(1),
    contract_version_number: z.number().int().positive(),
    contract_number: z.string().regex(/^[0-9]{2}\/[1-9][0-9]*$/),
    contract_date: z.string().date(),
    contract_content: z.string(),
    unresolved_variable_keys: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)),
    resolved_values: z.record(z.string(), z.string()),
    created_at: z.string(),
})

export type ApprovedApplicationContractSnapshot = z.infer<typeof approvedApplicationContractSnapshotSchema>

const contractSnapshotApplicationDetailsSchema = z.object({
    contact_email: z.string(),
    status: z.literal('approved'),
    submitted_at: z.string(),
    reviewed_at: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
})

const contractSnapshotProgramDetailsSchema = z.object({
    program: z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),
    }),
    cohort: z.object({
        id: z.string().uuid(),
        name: z.string(),
        delivery_mode: z.enum(['online', 'offline', 'hybrid']),
        capacity: z.number().int().positive().nullable(),
        tuition_amount_mnt: z.number().int().nonnegative().nullable(),
        payment_plan: z.string(),
        schedule_summary: z.string(),
        location: z.string(),
        registration_opens_at: z.string().nullable(),
        registration_closes_at: z.string().nullable(),
        starts_on: z.string().nullable(),
        ends_on: z.string().nullable(),
    }),
})

const contractSnapshotAcademyDetailsSchema = z.object({
    display_name: z.string().nullable(),
    short_description: z.string().nullable(),
    public_email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    business_hours: z.string().nullable(),
    website_url: z.string().nullable(),
    legal_name: z.string(),
    representative_name: z.string(),
    contract_phone: z.string(),
    contract_address: z.string(),
    bank_name: z.string(),
    bank_account_number: z.string(),
    bank_account_holder: z.string(),
})

export const adminApprovedApplicationContractSnapshotSchema = approvedApplicationContractSnapshotSchema.extend({
    applicant_user_id: z.string().uuid(),
    cohort_id: z.string().uuid(),
    contract_version_id: z.string().uuid(),
    required_variable_keys: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)),
    application_answers: z.record(z.string(), z.string()),
    application_details: contractSnapshotApplicationDetailsSchema,
    program_details: contractSnapshotProgramDetailsSchema,
    academy_details: contractSnapshotAcademyDetailsSchema,
    created_by: z.string().uuid(),
})

export type AdminApprovedApplicationContractSnapshot = z.infer<typeof adminApprovedApplicationContractSnapshotSchema>

export function parseOpenCohorts(value: unknown) {
    return z.array(openCohortSchema).parse(value)
}

export function parseCohortApplicationForm(value: unknown) {
    return cohortApplicationFormSchema.parse(value)
}

export function parseApprovedApplicationContractSnapshot(value: unknown) {
    return approvedApplicationContractSnapshotSchema.parse(value)
}

export function parseAdminApprovedApplicationContractSnapshot(value: unknown) {
    return adminApprovedApplicationContractSnapshotSchema.parse(value)
}

export function renderApprovedContractSnapshot(
    content: string,
    resolvedValues: Record<string, string>,
) {
    return content.replace(/\{\{([a-z][a-z0-9_]*)\}\}/g, (_token, key: string) => {
        const value = resolvedValues[key]?.trim()
        return value || `⟦${key}⟧`
    })
}

export function formatContractSnapshotDate(value: string) {
    return new Intl.DateTimeFormat('mn-MN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ulaanbaatar',
    }).format(new Date(value))
}

export function answersFromFormData(formData: FormData) {
    const answers: Record<string, string> = {}

    for (const [name, rawValue] of formData.entries()) {
        if (!name.startsWith('answer:') || typeof rawValue !== 'string') continue

        const key = name.slice('answer:'.length)
        if (!/^[a-z][a-z0-9_]*$/.test(key)) {
            throw new Error('Өргөдлийн талбар буруу байна.')
        }

        const value = rawValue.trim()
        if (value.length > 500) {
            throw new Error('Өргөдлийн нэг хариулт 500 тэмдэгтээс урт байж болохгүй.')
        }
        answers[key] = value
    }

    return answers
}
