import { z } from 'zod'

export const deliveryModes = ['online', 'offline', 'hybrid'] as const
export const cohortStatuses = ['draft', 'open', 'closed', 'in_progress', 'completed', 'cancelled'] as const

export type DeliveryMode = (typeof deliveryModes)[number]
export type CohortStatus = (typeof cohortStatuses)[number]

const optionalUuid = z.union([
    z.literal(''),
    z.string().uuid('Сонгосон гэрээний хувилбар буруу байна.'),
]).transform((value) => value || null)

const optionalPositiveInteger = z.union([
    z.literal(''),
    z.coerce.number().int('Бүхэл тоо оруулна уу.').positive('0-ээс их тоо оруулна уу.'),
]).transform((value) => value === '' ? null : value)

const optionalNonNegativeInteger = z.union([
    z.literal(''),
    z.coerce.number().int('Бүхэл тоо оруулна уу.').nonnegative('0 эсвэл түүнээс их тоо оруулна уу.'),
]).transform((value) => value === '' ? null : value)

const optionalIsoDateTime = z.union([
    z.literal(''),
    z.string().datetime({ offset: true, message: 'Огноо, цагийн утга буруу байна.' }),
]).transform((value) => value || null)

const optionalDate = z.union([
    z.literal(''),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Огнооны утга буруу байна.'),
]).transform((value) => value || null)

const programSchema = z.object({
    name: z.string().trim().min(1, 'Хөтөлбөрийн нэр оруулна уу.').max(160, 'Хөтөлбөрийн нэр 160 тэмдэгтээс урт байж болохгүй.'),
    description: z.string().trim().max(2_000, 'Тайлбар 2,000 тэмдэгтээс урт байж болохгүй.'),
})

const cohortSchema = z.object({
    name: z.string().trim().min(1, 'Элсэлтийн нэр оруулна уу.').max(160, 'Элсэлтийн нэр 160 тэмдэгтээс урт байж болохгүй.'),
    deliveryMode: z.enum(deliveryModes, { message: 'Сургалтын хэлбэр сонгоно уу.' }),
    contractVersionId: optionalUuid,
    capacity: optionalPositiveInteger,
    tuitionAmountMnt: optionalNonNegativeInteger,
    paymentPlan: z.string().trim().max(1_000, 'Төлбөрийн нөхцөл 1,000 тэмдэгтээс урт байж болохгүй.'),
    scheduleSummary: z.string().trim().max(2_000, 'Хуваарийн тайлбар 2,000 тэмдэгтээс урт байж болохгүй.'),
    location: z.string().trim().max(1_000, 'Байршлын мэдээлэл 1,000 тэмдэгтээс урт байж болохгүй.'),
    registrationOpensAt: optionalIsoDateTime,
    registrationClosesAt: optionalIsoDateTime,
    startsOn: optionalDate,
    endsOn: optionalDate,
}).superRefine((value, context) => {
    if (value.registrationOpensAt && value.registrationClosesAt
        && Date.parse(value.registrationClosesAt) < Date.parse(value.registrationOpensAt)) {
        context.addIssue({
            code: 'custom',
            path: ['registrationClosesAt'],
            message: 'Бүртгэл хаах хугацаа нээх хугацаанаас өмнө байж болохгүй.',
        })
    }

    if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
        context.addIssue({
            code: 'custom',
            path: ['endsOn'],
            message: 'Сургалт дуусах өдөр эхлэх өдрөөс өмнө байж болохгүй.',
        })
    }
})

function parseWithUserMessage<T>(schema: z.ZodType<T>, input: unknown) {
    const result = schema.safeParse(input)
    if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Оруулсан мэдээлэл буруу байна.')
    return result.data
}

export function validateTrainingProgramInput(input: unknown) {
    return parseWithUserMessage(programSchema, input)
}

export function validateTrainingCohortInput(input: unknown) {
    return parseWithUserMessage(cohortSchema, input)
}

export const allowedCohortTransitions: Readonly<Record<CohortStatus, readonly CohortStatus[]>> = {
    draft: ['open', 'cancelled'],
    open: ['closed', 'cancelled'],
    closed: ['open', 'in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
}

export function assertCohortTransition(current: CohortStatus, next: CohortStatus) {
    if (!allowedCohortTransitions[current].includes(next)) {
        throw new Error('Элсэлтийн төлөвийг энэ дарааллаар өөрчлөх боломжгүй.')
    }
}
