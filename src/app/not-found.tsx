import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-white">
            <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/70 p-8 text-center shadow-2xl">
                <p className="text-sm font-medium text-indigo-400">404</p>
                <h1 className="mt-3 text-2xl font-bold">Хуудас олдсонгүй</h1>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Таны нээх гэсэн хуудас байхгүй эсвэл хаяг нь өөрчлөгдсөн байна.
                </p>
                <Button asChild className="mt-6 bg-white text-black hover:bg-zinc-200">
                    <Link href="/">Нүүр хуудас руу буцах</Link>
                </Button>
            </section>
        </main>
    )
}
