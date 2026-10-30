'use server'

import { cookies } from 'next/headers'
import { isLocale, localeCookieName } from './locale'

export async function setLocale(locale: string) {
    if (!isLocale(locale)) throw new Error('Unsupported language')
    const cookieStore = await cookies()
    cookieStore.set(localeCookieName, locale, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
    })
}
