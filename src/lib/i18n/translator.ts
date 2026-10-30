import english from './en.json'
import type { Locale } from './locale'

const messages: Readonly<Record<string, string>> = english

// Keep authored course content and unfamiliar messages intact. Translation is
// explicit during React rendering; it never changes React's DOM behind its back.
export function createTranslator(locale: Locale) {
    return (source: string, values?: Record<string, string | number>): string => {
        const key = source.replace(/\s+/g, ' ').trim()
        const translated = locale === 'en' && Object.hasOwn(messages, key)
            ? messages[key]
            : source
        return values
            ? translated.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
                Object.hasOwn(values, name) ? String(values[name]) : placeholder)
            : translated
    }
}
