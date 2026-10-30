import { describe, expect, it } from 'vitest'
import { resolveLocale } from './locale'
import { createTranslator } from './translator'
import { formatAcademyDateTime } from './format'

describe('website languages', () => {
    it('defaults to Mongolian and rejects unsupported cookie values', () => {
        for (const value of [undefined, '', 'fr', 'EN', '<script>', null]) {
            expect(resolveLocale(value)).toBe('mn')
        }
        expect(resolveLocale('en')).toBe('en')
    })

    it('translates the primary visitor and student actions into English', () => {
        const t = createTranslator('en')
        expect(t('Нэвтрэх')).toBe('Sign in')
        expect(t('Миний хичээлүүд')).toBe('My courses')
        expect(t('Бидний тухай')).toBe('About us')
        expect(t('И-мэйл хаяг эсвэл нууц үг буруу байна.')).toBe('Incorrect email address or password.')
    })

    it('preserves Mongolian and authored content without a translation', () => {
        expect(createTranslator('mn')('Миний хичээлүүд')).toBe('Миний хичээлүүд')
        expect(createTranslator('en')('Админы бичсэн сургалтын тайлбар')).toBe('Админы бичсэн сургалтын тайлбар')
        expect(createTranslator('en')('constructor')).toBe('constructor')
    })

    it('uses English sentence order for values and tolerates multiline source text', () => {
        expect(createTranslator('en')('{value0}-р түвшинд хүрэхэд {value1} XP дутуу', { value0: 4, value1: 125 }))
            .toBe('125 XP to reach level 4')
        expect(createTranslator('mn')('Дахин илгээх хүртэл {value0} секунд', { value0: 20 }))
            .toBe('Дахин илгээх хүртэл 20 секунд')
        expect(createTranslator('en')('  Бидний\n тухай  ')).toBe('About us')
    })

    it('shows English dates while keeping the academy timezone', () => {
        const date = formatAcademyDateTime('2026-10-30T01:30:00Z', 'en')
        expect(date).toContain('Oct 30, 2026')
        expect(date).toContain('9:30 AM')
        expect(formatAcademyDateTime('invalid', 'en')).toBe('invalid')
    })
})
