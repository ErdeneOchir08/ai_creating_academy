import { CheckCircle2, Clock, FileCheck2, Hash, Image as ImageIcon, UserRound, XCircle } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { OfferingPaymentReviewActions } from '@/features/admin/components/offering-payment-review-actions'
import type { AdminOfferingPayment } from '@/features/admin/domain/offering-payment-review'

const relationshipLabels: Record<AdminOfferingPayment['applicantRelationship'], string> = {
    self: 'Суралцагч өөрөө',
    parent: 'Эцэг, эх',
    guardian: 'Асран хамгаалагч',
    other: 'Бусад',
}

const applicationStatusLabels: Record<AdminOfferingPayment['applicationStatus'], string> = {
    draft: 'Ноорог',
    submitted: 'Хянагдаж буй',
    approved: 'Элсэлт баталгаажсан',
    withdrawn: 'Цуцалсан',
}

function formatMnt(value: number) {
    return `₮ ${new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 0 }).format(value)}`
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat('mn-MN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

function statusBadge(status: AdminOfferingPayment['status']) {
    if (status === 'approved') {
        return <span className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="h-5 w-5" />Зөвшөөрсөн</span>
    }
    if (status === 'rejected') {
        return <span className="flex items-center gap-2 text-red-400"><XCircle className="h-5 w-5" />Засвар шаардсан</span>
    }
    return <span className="flex items-center gap-2 text-amber-400"><Clock className="h-5 w-5" />Хүлээгдэж буй</span>
}

export function OfferingPaymentList({ payments }: { payments: AdminOfferingPayment[] }) {
    return (
        <div className="grid gap-4">
            {payments.map((payment) => (
                <Card key={payment.id} className="border-zinc-800 bg-zinc-900 text-white">
                    <CardContent className="space-y-6 p-6">
                        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                            <div className="min-w-0 space-y-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-indigo-300">V2 элсэлт</span>
                                    <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-300">{payment.deliveryMode === 'online' ? 'Онлайн' : 'Танхим'}</span>
                                    <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-300">{payment.contractPolicy === 'required' ? 'Гэрээтэй' : 'Гэрээгүй'}</span>
                                    <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-400">Баримт #{payment.attemptNumber}</span>
                                </div>
                                <h3 className="text-xl font-semibold">{payment.programName} · {payment.offeringName}</h3>
                                <p className="text-sm text-zinc-400">Олгох хичээл: <span className="text-zinc-200">{payment.courseTitle}</span></p>
                            </div>
                            <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                                {statusBadge(payment.status)}
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
                                <p className="mb-1 flex items-center gap-1.5 text-xs text-indigo-300"><Hash className="h-3.5 w-3.5" />Гүйлгээний утга</p>
                                <p className="select-all break-all font-mono font-semibold tracking-wide text-white">{payment.paymentReference}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <p className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500"><UserRound className="h-3.5 w-3.5" />Суралцагч</p>
                                <p className="font-medium">{payment.learnerName}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <p className="mb-1 text-xs text-zinc-500">Өргөдөл гаргагч</p>
                                <p className="font-medium">{payment.applicantName || payment.applicantEmail}</p>
                                <p className="mt-1 break-all text-xs text-zinc-400">{payment.applicantEmail}</p>
                                <p className="mt-1 text-xs text-zinc-500">{relationshipLabels[payment.applicantRelationship]}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <p className="mb-1 text-xs text-zinc-500">Төлбөрийн дүн</p>
                                <p className="font-mono font-semibold text-emerald-400">{formatMnt(payment.amountMnt)}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                                <p className="mb-1 text-xs text-zinc-500">Төлөх эцсийн хугацаа</p>
                                <p className="text-sm text-zinc-200">{formatDateTime(payment.paymentDueAt)}</p>
                            </div>
                        </div>

                        {payment.status === 'rejected' && payment.rejectionReason && (
                            <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
                                <span className="font-medium">Засварын шалтгаан:</span> {payment.rejectionReason}
                            </div>
                        )}

                        <div className="flex flex-col items-stretch justify-between gap-4 border-t border-zinc-800 pt-5 md:flex-row md:items-center">
                            <div className="space-y-1 text-xs text-zinc-500">
                                <p>Илгээсэн: {formatDateTime(payment.submittedAt)}</p>
                                {payment.reviewedAt && <p>Шийдвэрлэсэн: {formatDateTime(payment.reviewedAt)}</p>}
                                <p>Элсэлтийн төлөв: {applicationStatusLabels[payment.applicationStatus]}</p>
                            </div>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <ReceiptLink url={payment.receiptUrl} />
                                <OfferingPaymentReviewActions
                                    paymentId={payment.id}
                                    status={payment.status}
                                    notification={payment.notification}
                                    notificationTrackingError={payment.notificationTrackingError}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

function ReceiptLink({ url }: { url: string | null }) {
    return (
        <div className="flex min-w-48 items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-3">
            {url ? <FileCheck2 className="h-7 w-7 shrink-0 text-indigo-400" /> : <ImageIcon className="h-7 w-7 shrink-0 text-zinc-600" />}
            <div>
                <p className="text-sm font-medium">Төлбөрийн баримт</p>
                {url
                    ? <a href={url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">Баримтыг нээх</a>
                    : <p className="text-xs text-amber-400">Баримтын холбоос үүссэнгүй</p>}
            </div>
        </div>
    )
}
