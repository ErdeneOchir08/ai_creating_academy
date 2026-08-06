import { z } from 'zod'

const nullableMetadata = z.string().min(1).nullable().optional()

export const effectiveCourseAccessRowSchema = z.object({
    course_id: z.string().uuid(),
    access_id: nullableMetadata,
    enrollment_id: nullableMetadata,
    granted_at: nullableMetadata,
    grant_source: nullableMetadata,
}).passthrough().transform((row) => ({
    course_id: row.course_id,
    access_id: row.access_id ?? null,
    enrollment_id: row.enrollment_id ?? null,
    granted_at: row.granted_at ?? null,
    grant_source: row.grant_source ?? null,
}))

export type EffectiveCourseAccess = z.infer<typeof effectiveCourseAccessRowSchema>

export function parseEffectiveCourseAccessRows(value: unknown) {
    return deduplicateEffectiveCourseAccess(
        z.array(effectiveCourseAccessRowSchema).parse(value ?? []),
    )
}

export function parseEffectiveCourseAccessResult(value: unknown) {
    return z.boolean().parse(value)
}

/**
 * A learner can receive the same course from more than one legitimate source.
 * The UI needs one course card, while source-specific grants remain in the DB.
 */
export function deduplicateEffectiveCourseAccess(rows: EffectiveCourseAccess[]) {
    const byCourse = new Map<string, EffectiveCourseAccess>()

    for (const row of rows) {
        const current = byCourse.get(row.course_id)
        if (!current) {
            byCourse.set(row.course_id, row)
            continue
        }

        byCourse.set(row.course_id, {
            course_id: row.course_id,
            access_id: current.access_id ?? row.access_id,
            enrollment_id: current.enrollment_id ?? row.enrollment_id,
            granted_at: current.granted_at ?? row.granted_at,
            grant_source: current.grant_source ?? row.grant_source,
        })
    }

    return [...byCourse.values()]
}
