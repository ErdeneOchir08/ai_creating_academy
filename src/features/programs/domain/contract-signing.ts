import { z } from 'zod'

export const CONTRACT_SIGNATURE_STATEMENT_VERSION = 'mn-v1'
export const CONTRACT_SIGNATURE_STATEMENT_MN =
    'Би гэрээний нөхцөлтэй танилцаж, мэдээллээ үнэн зөв оруулсан бөгөөд энэхүү гэрээг зөвшөөрч байна.'

export const signerRoles = ['self', 'guardian'] as const
export type SignerRole = (typeof signerRoles)[number]

export const signerDraftSchema = z.object({
    studentBirthDate: z.string().date(),
    signerName: z.string().trim().min(1).max(240),
    signerEmail: z.string().trim().email().max(320),
    signerPhone: z.string().trim().min(1).max(50),
    signerRegistrationNumber: z.string().trim().min(1).max(50),
    signerRelationship: z.string().trim().min(1).max(120),
})

export type SignerDraft = z.infer<typeof signerDraftSchema>

export function getSignerRole(studentBirthDate: string, currentDate: string): SignerRole {
    const birth = parseCalendarDate(studentBirthDate)
    const current = parseCalendarDate(currentDate)

    if (compareCalendarDates(birth, current) > 0) {
        throw new Error('Суралцагчийн төрсөн огноо ирээдүйд байж болохгүй.')
    }

    const eighteenthBirthday = { ...birth, year: birth.year + 18 }
    return compareCalendarDates(eighteenthBirthday, current) <= 0 ? 'self' : 'guardian'
}

export function getUlaanbaatarDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ulaanbaatar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
}

function parseCalendarDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) throw new Error('Огнооны формат буруу байна.')

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const candidate = new Date(Date.UTC(year, month - 1, day))

    if (
        candidate.getUTCFullYear() !== year
        || candidate.getUTCMonth() !== month - 1
        || candidate.getUTCDate() !== day
    ) {
        throw new Error('Огноо буруу байна.')
    }

    return { year, month, day }
}

function compareCalendarDates(
    left: { year: number; month: number; day: number },
    right: { year: number; month: number; day: number },
) {
    return left.year - right.year || left.month - right.month || left.day - right.day
}
