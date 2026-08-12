import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lessonDisplayLabel, normalizeLessonDisplayCode } from './lesson-display-code'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260812203000_add_optional_lesson_display_codes.sql'),
    'utf8',
)

describe('lesson display codes', () => {
    it('normalizes optional codes without changing lesson position', () => {
        expect(normalizeLessonDisplayCode(' 0-1 ')).toBe('0-1')
        expect(normalizeLessonDisplayCode('   ')).toBeNull()
        expect(lessonDisplayLabel('1-2', 4, true)).toBe('1-2')
        expect(lessonDisplayLabel(null, 4, true)).toBe('04')
    })

    it('rejects unsafe or oversized labels', () => {
        expect(() => normalizeLessonDisplayCode('a'.repeat(33))).toThrow()
        expect(() => normalizeLessonDisplayCode('1\n2')).toThrow()
    })

    it('enforces unique non-null codes per course in the database', () => {
        expect(migration).toContain('add column display_code text')
        expect(migration).toMatch(/unique index lessons_course_display_code_unique[\s\S]*course_id, lower\(display_code\)/)
        expect(migration).toContain('where display_code is not null')
        expect(migration).not.toMatch(/update public\.lessons[\s\S]*set position/)
    })
})
