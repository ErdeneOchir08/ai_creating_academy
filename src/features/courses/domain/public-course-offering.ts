import { z } from 'zod'

export const publicCourseOfferingSchema = z.object({
    offering_id: z.string().uuid(),
    course_id: z.string().uuid(),
    program_name: z.string(),
    program_description: z.string(),
    offering_name: z.string(),
    delivery_mode: z.enum(['online', 'offline']),
    contract_policy: z.enum(['required', 'none']),
    capacity: z.coerce.number().int().positive().nullable(),
    available_seats: z.coerce.number().int().nonnegative().nullable(),
    tuition_amount_mnt: z.coerce.number().int().positive(),
    payment_plan: z.string(),
    schedule_summary: z.string(),
    location: z.string(),
    registration_closes_at: z.string().nullable(),
    starts_on: z.string().nullable(),
    ends_on: z.string().nullable(),
})

export type PublicCourseOffering = z.infer<typeof publicCourseOfferingSchema>

export function parseCourseUsesOfferingCheckout(value: unknown) {
    return z.boolean().parse(value)
}

export function parsePublicCourseOfferings(value: unknown, expectedCourseId: string) {
    const courseId = z.string().uuid().parse(expectedCourseId)
    const offerings = z.array(publicCourseOfferingSchema).parse(value)

    if (offerings.some((offering) => offering.course_id !== courseId)) {
        throw new Error('Элсэлтийн сонголтын хичээлийн мэдээлэл зөрүүтэй байна.')
    }

    return offerings
}
