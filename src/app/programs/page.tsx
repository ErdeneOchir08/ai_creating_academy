import Link from 'next/link'
import { CalendarDays, MapPin, Monitor, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getOpenTrainingCohorts } from '@/features/programs/actions/cohort-application-actions'

const deliveryLabels = { online: 'Цахим', offline: 'Танхим', hybrid: 'Хосолсон' } as const

function dateLabel(value: string | null) {
    if (!value) return 'Огноо удахгүй'
    return new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}
export default async function ProgramsPage() {
    const cohorts = await getOpenTrainingCohorts()

    return (
        <div className="min-h-[calc(100vh-64px)] bg-zinc-950 px-4 py-14 text-white">
            <div className="mx-auto max-w-6xl">
                <div className="max-w-3xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">Mind Academy</p>
                    <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Нээлттэй элсэлтүүд</h1>
                    <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                        Танхим, цахим болон хосолсон хөтөлбөрүүдийн мэдээлэлтэй танилцаж, өргөдлөө цахимаар илгээнэ үү.
                    </p>
                </div>

                {cohorts.length === 0 ? (
                    <div className="mt-12 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
                        <h2 className="text-xl font-semibold">Одоогоор нээлттэй элсэлт алга.</h2>
                        <p className="mt-2 text-sm text-zinc-500">Шинэ элсэлт нээгдэхэд энэ хуудсанд автоматаар харагдана.</p>
                    </div>
                ) : (
                    <div className="mt-12 grid gap-6 md:grid-cols-2">
                        {cohorts.map((cohort) => (
                            <article key={cohort.cohort_id} className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-indigo-400">{cohort.program_name}</p>
                                        <h2 className="mt-1 text-2xl font-semibold">{cohort.cohort_name}</h2>
                                    </div>
                                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">Нээлттэй</span>
                                </div>
                                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-zinc-400">{cohort.program_description || 'Хөтөлбөрийн дэлгэрэнгүй мэдээлэлтэй танилцана уу.'}</p>
                                <div className="mt-6 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                                    <p className="flex items-center gap-2"><Monitor className="h-4 w-4 text-zinc-500" />{deliveryLabels[cohort.delivery_mode]}</p>
                                    <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-zinc-500" />{dateLabel(cohort.starts_on)}</p>
                                    {cohort.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-zinc-500" />{cohort.location}</p>}
                                    {cohort.capacity && <p className="flex items-center gap-2"><Users className="h-4 w-4 text-zinc-500" />{cohort.capacity - cohort.approved_count} суудал үлдсэн</p>}
                                </div>
                                <div className="mt-6 flex items-end justify-between gap-4 border-t border-zinc-800 pt-5">
                                    <div>
                                        <p className="text-xs text-zinc-500">Сургалтын төлбөр</p>
                                        <p className="mt-1 text-xl font-semibold text-emerald-400">{cohort.tuition_amount_mnt == null ? 'Тодорхойгүй' : `₮ ${cohort.tuition_amount_mnt.toLocaleString()}`}</p>
                                    </div>
                                    <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
                                        <Link href={`/programs/${cohort.cohort_id}`}>Дэлгэрэнгүй</Link>
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
