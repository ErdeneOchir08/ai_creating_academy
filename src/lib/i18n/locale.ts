export const supportedLocales = ['mn', 'en'] as const
export type Locale = (typeof supportedLocales)[number]
export const localeCookieName = 'mind-academy-language'

export function isLocale(value: unknown): value is Locale {
    return value === 'mn' || value === 'en'
}

export function resolveLocale(value: unknown): Locale {
    return isLocale(value) ? value : 'mn'
}
