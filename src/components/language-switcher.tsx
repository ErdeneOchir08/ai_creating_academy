'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Languages } from 'lucide-react'
import { useLocale } from './language-provider'
import { setLocale } from '@/lib/i18n/actions'

export function LanguageSwitcher() {
    const id = useId()
    const locale = useLocale()
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [failed, setFailed] = useState(false)

    return (
        <div className="relative shrink-0">
            <label htmlFor={id} className="sr-only">{locale === 'en' ? 'Website language' : 'Вебсайтын хэл'}</label>
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 focus-within:ring-2 focus-within:ring-indigo-500">
                <Languages className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                <select
                    id={id}
                    value={locale}
                    disabled={pending}
                    aria-busy={pending}
                    aria-describedby={failed ? `${id}-error` : undefined}
                    className="min-h-7 min-w-0 cursor-pointer bg-zinc-950 outline-none disabled:cursor-wait disabled:opacity-50"
                    onChange={(event) => {
                        const nextLocale = event.target.value
                        setFailed(false)
                        startTransition(async () => {
                            try {
                                await setLocale(nextLocale)
                                router.refresh()
                            } catch {
                                setFailed(true)
                            }
                        })
                    }}
                >
                    <option value="mn" lang="mn">Монгол</option>
                    <option value="en" lang="en">English</option>
                </select>
            </div>
            {failed && <p id={`${id}-error`} role="alert" className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-red-500/30 bg-zinc-950 p-3 text-xs text-red-300">
                {locale === 'en' ? 'Could not change language. Please try again.' : 'Хэлийг сольж чадсангүй. Дахин оролдоно уу.'}
            </p>}
        </div>
    )
}
