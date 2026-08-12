import { describe, expect, it } from 'vitest'
import { latestCourses } from './latest-courses'

describe('latestCourses', () => {
    it('keeps the newest source order and limits the homepage to four courses', () => {
        expect(latestCourses(['newest', 'second', 'third', 'fourth', 'oldest'])).toEqual([
            'newest',
            'second',
            'third',
            'fourth',
        ])
    })

    it('returns all courses when fewer than four are available', () => {
        expect(latestCourses(['first', 'second'])).toEqual(['first', 'second'])
    })
})
