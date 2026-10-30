import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { localeCookieName, resolveLocale } from './locale'
import { createTranslator } from './translator'

export const getLocale = cache(async () => {
    const cookieStore = await cookies()
    return resolveLocale(cookieStore.get(localeCookieName)?.value)
})

export async function getTranslations() {
    return createTranslator(await getLocale())
}
