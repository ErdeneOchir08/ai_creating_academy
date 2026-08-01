import { BookOpen, CheckCircle2, Lightbulb, Target } from 'lucide-react'

export function AboutSection({ courseCount }: { courseCount: number }) {
    return (
        <section className="relative overflow-hidden bg-zinc-950 py-24">
            <div className="pointer-events-none absolute right-1/4 top-0 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 left-1/4 h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[150px]" />

            <div className="container relative z-10 mx-auto px-4">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <h2 className="mb-6 text-4xl font-black tracking-tight text-white md:text-5xl">Бидний тухай</h2>
                    <p className="text-xl leading-relaxed text-zinc-400">Mind Academy нь AI-г ойлгож, бодит төсөл дээр хэрэглэхийг хүссэн суралцагчдад зориулсан онлайн сургалтын платформ юм.</p>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    <article className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-8 backdrop-blur-md">
                        <div className="mb-6 w-fit rounded-2xl bg-indigo-500/20 p-3 text-indigo-400"><Target className="h-8 w-8" /></div>
                        <h3 className="mb-3 text-2xl font-bold text-white">Бидний зорилго</h3>
                        <p className="leading-relaxed text-zinc-300">AI-ийн суурь ойлголтыг алхам алхмаар тайлбарлаж, суралцагчдыг өөрийн бүтээлээ хийхэд чиглүүлэх.</p>
                    </article>

                    <article className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-8 backdrop-blur-md">
                        <div className="mb-6 w-fit rounded-2xl bg-purple-500/20 p-3 text-purple-400"><Lightbulb className="h-8 w-8" /></div>
                        <h3 className="mb-3 text-2xl font-bold text-white">Суралцах арга</h3>
                        <p className="leading-relaxed text-zinc-300">Суралцагч өөрийн хурдаар хичээлээ үзэж, ахицаа хянаж, шаардлагатай сэдэв рүүгээ дахин орох боломжтой.</p>
                    </article>

                    <article className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-transparent p-8">
                        <div className="mb-6 w-fit rounded-2xl bg-pink-500/20 p-3 text-pink-400"><BookOpen className="h-8 w-8" /></div>
                        <h3 className="mb-3 text-2xl font-bold text-white">Нээлттэй хичээлүүд</h3>
                        <p className="text-5xl font-black text-white">{courseCount}</p>
                        <p className="mt-2 leading-relaxed text-zinc-400">Одоогоор платформ дээр нийтлэгдсэн хичээлийн бодит тоо.</p>
                    </article>
                </div>

                <div className="mt-12 flex flex-wrap justify-center gap-x-10 gap-y-4 border-t border-white/5 pt-10 text-zinc-300">
                    {['Онлайн хичээл', 'Ахицын хяналт', 'Аюулгүй суралцах орчин'].map((item) => (
                        <div key={item} className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-5 w-5 text-emerald-400" />{item}</div>
                    ))}
                </div>
            </div>
        </section>
    )
}
