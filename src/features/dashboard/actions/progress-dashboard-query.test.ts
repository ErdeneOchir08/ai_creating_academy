import { describe, expect, it } from 'vitest'

import { PROGRESS_COURSE_SELECT } from './progress-dashboard-query'

describe('progress dashboard course query', () => {
    it('loads course progress independently from a specific grant table', () => {
        expect(PROGRESS_COURSE_SELECT).toContain('lessons (id, title, position)')
        expect(PROGRESS_COURSE_SELECT).not.toContain('enrollments')
    })
})
