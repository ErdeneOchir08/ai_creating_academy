import Link from 'next/link'
import { ArrowRight, CalendarClock, CircleAlert, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { MyOfferingCheckoutStatus } from '@/features/checkout/domain/offering-checkout'
import {
    getEffectiveOfferingCheckoutStatusPresentation,
    type OfferingCheckoutStatusTone,
} from '../domain/offering-checkout-status-presentation'

const toneClasses = {
    neutral: 'border-zinc-700 bg-zinc-800/70 text-zinc-200',
    info: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    danger: 'border-red-500/30 bg-red-500/10 text-red-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
} satisfies Record<OfferingCheckoutStatusTone, string>

const ulaanbaatarDateTime = new Intl.DateTimeFormat('mn-MN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ulaanbaatar',
})

const mntFormatter = new Intl.NumberFormat('mn-MN', {
    style: 'currency',
    currency: 'MNT',
    maximumFractionDigits: 0,
})

function formatDeadline(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : ulaanbaatarDateTime.format(date)
}

export function OfferingCheckoutStatusList({
    statuses,
    serverNow,
}: {
    statuses: MyOfferingCheckoutStatus[]
    serverNow: string
}) {
    return (
        <section className="mb-12" aria-labelledby="offering-checkout-status-heading">
            <h2 id="offering-checkout-status-heading" className="mb-6 flex items-center gap-2 text-xl font-bold text-white">
                Элсэлтийн явц
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-300">
                    {statuses.length}
                </span>
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {statuses.map((status) => {
                    const presentation = getEffectiveOfferingCheckoutStatusPresentation(
                        status.application_status,
                        { paymentDueAt: status.payment_due_at, serverNow },
                    )
                    const continueHref = `/programs/${status.offering_id}?application=${encodeURIComponent(status.application_id)}`

                    return (
                        <Card key={status.application_id} className="border-zinc-800 bg-zinc-950 text-white">
                            <CardContent className="flex h-full flex-col p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-indigo-300">{status.program_name}</p>
                                        <h3 className="mt-1 text-lg font-semibold">{status.offering_name}</h3>
                                    </div>
                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[presentation.tone]}`}>
                                        {presentation.label}
                                    </span>
                                </div>

                                <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                                    <div className="flex items-start gap-3">
                                        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                                        <div>
                                            <p className="text-xs text-zinc-500">Суралцагч</p>
                                            <p className="mt-0.5 font-medium text-zinc-100">{status.learner_full_name}</p>
                                        </div>
                                    </div>
                                </div>

                                <p className="mt-4 text-sm leading-relaxed text-zinc-400">{presentation.description}</p>

                                <div className="mt-4 space-y-3 text-sm">
                                    <p className="font-semibold text-emerald-400">{mntFormatter.format(status.amount_mnt)}</p>

                                    {presentation.showPaymentDeadline && status.payment_due_at && (
                                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100">
                                            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                                            <p>Төлбөрийн эцсийн хугацаа: {formatDeadline(status.payment_due_at)}</p>
                                        </div>
                                    )}

                                    {presentation.showRejectionReason && status.payment_rejection_reason && (
                                        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-100">
                                            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div>
                                                <p className="font-semibold">Засах шаардлагатай шалтгаан</p>
                                                <p className="mt-1 break-words text-red-100/80">{status.payment_rejection_reason}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto pt-5">
                                    <Button asChild className="h-11 w-full bg-indigo-600 font-bold text-white hover:bg-indigo-700">
                                        <Link href={continueHref}>
                                            {presentation.actionLabel}
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </section>
    )
}
