import type { Locale } from './locale'

export function formatAcademyDateTime(value: string, locale: Locale) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'mn-MN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ulaanbaatar',
    }).format(date)
}
