import { describe, expect, it } from 'vitest'

import { PROGRESS_ENROLLMENT_SELECT } from './progress-dashboard-query'

describe('progress dashboard enrollment query', () => {
    it('uses the purchased-course relationship explicitly', () => {
        expect(PROGRESS_ENROLLMENT_SELECT).toContain(
            'courses!enrollments_course_id_fkey',
        )
        expect(PROGRESS_ENROLLMENT_SELECT).not.toContain(
            'courses!enrollments_granted_by_course_id_fkey',
        )
    })
})
