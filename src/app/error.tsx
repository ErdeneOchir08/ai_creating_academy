'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AppError({ reset }: { reset: () => void }) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-white">
            <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/70 p-8 text-center shadow-2xl">
                <p className="text-sm font-medium text-indigo-400">Mind Academy</p>
                <h1 className="mt-3 text-2xl font-bold">Түр алдаа гарлаа</h1>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Хуудсыг ачаалж чадсангүй. Дахин оролдоод үзнэ үү.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button type="button" onClick={reset} className="bg-white text-black hover:bg-zinc-200">
                        Дахин оролдох
                    </Button>
                    <Button asChild type="button" variant="outline" className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-900 hover:text-white">
                        <Link href="/">Нүүр хуудас</Link>
                    </Button>
                </div>
            </section>
        </main>
    )
}
