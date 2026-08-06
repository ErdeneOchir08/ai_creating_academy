import { z } from 'zod'

export const deliveryModes = ['online', 'offline', 'hybrid'] as const
export const contractPolicies = ['required', 'none'] as const
export const cohortStatuses = ['draft', 'open', 'closed', 'in_progress', 'completed', 'cancelled'] as const

export type DeliveryMode = (typeof deliveryModes)[number]
export type ContractPolicy = (typeof contractPolicies)[number]
export type CohortStatus = (typeof cohortStatuses)[number]

export const cohortOpeningIssues = [
    'program_archived',
    'unsupported_delivery_mode',
    'course_not_ready',
    'contract_not_assignable',
    'contract_not_allowed',
    'tuition_not_configured',
    'payment_deadline_not_configured',
] as const

export type CohortOpeningIssue = (typeof cohortOpeningIssues)[number]

export type CohortOpeningReadinessInput = {
    checkoutVersion: 1 | 2
    deliveryMode: DeliveryMode
    contractPolicy: ContractPolicy
    hasContractVersion: boolean
    contractVersionIsAssignable: boolean
    courseIsReady: boolean
    tuitionAmountMnt: number | null
    paymentDueDays: number | null
    programIsArchived: boolean
}

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
    courseId: optionalUuid,
    contractPolicy: z.enum(contractPolicies, { message: 'Гэрээ шаардах эсэхийг сонгоно уу.' }),
    contractVersionId: optionalUuid,
    capacity: optionalPositiveInteger,
    tuitionAmountMnt: optionalNonNegativeInteger,
    paymentDueDays: optionalPositiveInteger,
    paymentPlan: z.string().trim().max(1_000, 'Төлбөрийн нөхцөл 1,000 тэмдэгтээс урт байж болохгүй.'),
    scheduleSummary: z.string().trim().max(2_000, 'Хуваарийн тайлбар 2,000 тэмдэгтээс урт байж болохгүй.'),
    location: z.string().trim().max(1_000, 'Байршлын мэдээлэл 1,000 тэмдэгтээс урт байж болохгүй.'),
    registrationOpensAt: optionalIsoDateTime,
    registrationClosesAt: optionalIsoDateTime,
    startsOn: optionalDate,
    endsOn: optionalDate,
}).superRefine((value, context) => {
    if (value.contractPolicy === 'none' && value.contractVersionId !== null) {
        context.addIssue({
            code: 'custom',
            path: ['contractVersionId'],
            message: 'Гэрээгүй элсэлтэд гэрээний хувилбар сонгохгүй.',
        })
    }

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

export function validateTrainingCohortInput(input: unknown, checkoutVersion: 1 | 2) {
    const value = parseWithUserMessage(cohortSchema, input)

    if (checkoutVersion === 2 && value.deliveryMode === 'hybrid') {
        throw new Error('Шинэ элсэлтийн сургалтын хэлбэр онлайн эсвэл танхим байх ёстой.')
    }

    if (checkoutVersion === 1 && (value.courseId !== null || value.contractPolicy !== 'required')) {
        throw new Error('Одоогийн элсэлтийн баталгаажсан урсгалын тохиргоог өөрчлөх боломжгүй.')
    }

    return value
}

export function validateCohortPaymentDueDays(input: unknown) {
    return parseWithUserMessage(optionalPositiveInteger, input)
}

export function getCohortOpeningReadiness(input: CohortOpeningReadinessInput) {
    const issues: CohortOpeningIssue[] = []

    if (input.programIsArchived) issues.push('program_archived')

    if (input.checkoutVersion === 2) {
        if (input.deliveryMode !== 'online' && input.deliveryMode !== 'offline') {
            issues.push('unsupported_delivery_mode')
        }
        if (!input.courseIsReady) issues.push('course_not_ready')
    }

    if (input.contractPolicy === 'required') {
        if (!input.hasContractVersion || !input.contractVersionIsAssignable) {
            issues.push('contract_not_assignable')
        }
    } else if (input.hasContractVersion) {
        issues.push('contract_not_allowed')
    }

    if (input.checkoutVersion === 2) {
        if (input.tuitionAmountMnt === null || input.tuitionAmountMnt <= 0) {
            issues.push('tuition_not_configured')
        } else if (input.paymentDueDays === null) {
            issues.push('payment_deadline_not_configured')
        }
    } else if (input.tuitionAmountMnt === null) {
        issues.push('tuition_not_configured')
    } else if (input.tuitionAmountMnt > 0 && input.paymentDueDays === null) {
        issues.push('payment_deadline_not_configured')
    }

    if (issues.length === 0) return { isReady: true, issues: [] as const }
    return {
        isReady: false,
        issues: issues as [CohortOpeningIssue, ...CohortOpeningIssue[]],
    } as const
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
