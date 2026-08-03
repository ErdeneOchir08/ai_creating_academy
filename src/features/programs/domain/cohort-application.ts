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

export function parseOpenCohorts(value: unknown) {
    return z.array(openCohortSchema).parse(value)
}

export function parseCohortApplicationForm(value: unknown) {
    return cohortApplicationFormSchema.parse(value)
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
