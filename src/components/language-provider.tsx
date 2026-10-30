'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/locale'
import { createTranslator } from '@/lib/i18n/translator'

const LanguageContext = createContext<Locale>('mn')

export function LanguageProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
    return <LanguageContext.Provider value={locale}>{children}</LanguageContext.Provider>
}

export function useLocale() {
    return useContext(LanguageContext)
}

export function useTranslations() {
    const locale = useLocale()
    return useMemo(() => createTranslator(locale), [locale])
}
