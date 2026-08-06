import { describe, expect, it } from 'vitest'

import {
    parseEffectiveCourseAccessResult,
    parseEffectiveCourseAccessRows,
} from './effective-course-access'

const courseId = '7fd98a63-0415-4d45-a26d-6ea9bd436f15'

describe('effective course access domain', () => {
    it('accepts the minimal RPC row contract', () => {
        expect(parseEffectiveCourseAccessRows([{ course_id: courseId }])).toEqual([{
            course_id: courseId,
            access_id: null,
            enrollment_id: null,
            granted_at: null,
            grant_source: null,
        }])
    })

    it('preserves optional V1-compatible metadata and ignores future columns', () => {
        expect(parseEffectiveCourseAccessRows([{
            course_id: courseId,
            enrollment_id: '82fe9e54-c9b2-42a6-a930-5389719c15a1',
            granted_at: '2026-08-06T03:00:00+00:00',
            grant_source: 'payment',
            future_source_kind: 'legacy',
        }])[0]).toMatchObject({
            course_id: courseId,
            enrollment_id: '82fe9e54-c9b2-42a6-a930-5389719c15a1',
            granted_at: '2026-08-06T03:00:00+00:00',
            grant_source: 'payment',
        })
    })

    it('deduplicates multiple legitimate grants without discarding available metadata', () => {
        expect(parseEffectiveCourseAccessRows([
            { course_id: courseId, access_id: 'offering-access' },
            {
                course_id: courseId,
                enrollment_id: 'legacy-enrollment',
                granted_at: '2026-08-06T03:00:00+00:00',
                grant_source: 'payment',
            },
        ])).toEqual([{
            course_id: courseId,
            access_id: 'offering-access',
            enrollment_id: 'legacy-enrollment',
            granted_at: '2026-08-06T03:00:00+00:00',
            grant_source: 'payment',
        }])
    })

    it('parses the scalar access-check result strictly', () => {
        expect(parseEffectiveCourseAccessResult(true)).toBe(true)
        expect(parseEffectiveCourseAccessResult(false)).toBe(false)
        expect(() => parseEffectiveCourseAccessResult('true')).toThrow()
    })
})
