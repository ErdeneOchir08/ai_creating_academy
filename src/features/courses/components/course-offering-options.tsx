import Link from 'next/link'
import { CalendarDays, FileText, MapPin, Monitor, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PublicCourseOffering } from '../domain/public-course-offering'

const deliveryLabels = {
    online: 'Цахим',
    offline: 'Танхим',
} as const

function formatMnt(amount: number) {
    return new Intl.NumberFormat('mn-MN', {
        style: 'currency',
        currency: 'MNT',
        maximumFractionDigits: 0,
    }).format(amount)
}

export function CourseOfferingOptions({
    offerings,
    lookupFailed = false,
    compact = false,
}: {
    offerings: PublicCourseOffering[]
    lookupFailed?: boolean
    compact?: boolean
}) {
    if (lookupFailed) {
        return (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-center text-sm leading-relaxed text-amber-100">
                Элсэлтийн мэдээллийг одоогоор ачаалж чадсангүй. Түр хүлээгээд дахин оролдоно уу.
            </div>
        )
    }

    if (offerings.length === 0) {
        return (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-center text-sm leading-relaxed text-amber-100">
                Одоогоор энэ хичээлийн нээлттэй элсэлт алга. Дараагийн элсэлтийн мэдээллийг удахгүй нийтэлнэ.
            </div>
        )
    }

    return (
        <div className={compact ? 'space-y-3' : 'space-y-4'}>
            {!compact && (
                <div>
                    <h3 className="text-lg font-bold text-white">Элсэлтийн сонголт</h3>
                    <p className="mt-1 text-sm text-zinc-400">Танд тохирох хэлбэр, хуваарьтай элсэлтийг сонгоно уу.</p>
                </div>
            )}
            {offerings.map((offering) => (
                    <article key={offering.offering_id} className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-4 text-left">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <p className="text-xs font-medium text-indigo-300">{offering.program_name}</p>
                                <h4 className="mt-1 font-semibold text-white">{offering.offering_name}</h4>
                            </div>
                            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-200">
                                {deliveryLabels[offering.delivery_mode]}
                            </span>
                        </div>

                        <dl className={compact ? 'mt-3 space-y-2 text-xs text-zinc-400' : 'mt-4 grid gap-2 text-sm text-zinc-400'}>
                            {offering.schedule_summary && <OfferingDetail icon={CalendarDays} value={offering.schedule_summary} />}
                            {offering.delivery_mode === 'offline' && offering.location && <OfferingDetail icon={MapPin} value={offering.location} />}
                            <OfferingDetail
                                icon={FileText}
                                value={offering.contract_policy === 'required' ? 'Гэрээ байгуулна' : 'Гэрээ шаардахгүй'}
                            />
                            {offering.capacity !== null && (
                                <OfferingDetail
                                    icon={Users}
                                    value={`${offering.capacity} суралцагчийн анги`}
                                />
                            )}
                            {!offering.schedule_summary && <OfferingDetail icon={Monitor} value={deliveryLabels[offering.delivery_mode]} />}
                        </dl>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-bold text-emerald-400">{formatMnt(offering.tuition_amount_mnt)}</p>
                                {offering.payment_plan && <p className="mt-0.5 text-xs text-zinc-500">{offering.payment_plan}</p>}
                            </div>
                            <Button asChild className="shrink-0 bg-indigo-600 font-bold text-white hover:bg-indigo-700">
                                <Link href={`/programs/${offering.offering_id}`}>Элсэлт рүү очих</Link>
                            </Button>
                        </div>
                    </article>
            ))}
        </div>
    )
}

function OfferingDetail({
    icon: Icon,
    value,
}: {
    icon: typeof CalendarDays
    value: string
}) {
    return (
        <div className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <span className="break-words">{value}</span>
        </div>
    )
}
