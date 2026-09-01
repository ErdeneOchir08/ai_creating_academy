import { CheckCircle2, Clock3, RefreshCcw, TriangleAlert } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import type { AdminQpayPayment } from '@/features/admin/actions/qpay-payment-actions.admin'
import { QpayPaymentConfirmationAction } from '@/features/admin/components/qpay-payment-confirmation-action'

const statusLabels: Record<AdminQpayPayment['status'], string> = {
    created: 'Нэхэмжлэл үүсгэж байна',
    pending: 'Төлбөр хүлээж байна',
    paid: 'Амжилттай төлөгдсөн',
    rejected: 'Татгалзсан',
    failed: 'Алдаатай',
    expired: 'Хугацаа дууссан',
    cancelled: 'Цуцлагдсан',
    refunded: 'Буцаан олгосон',
}

function formatMnt(value: number) {
    return `₮ ${new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 0 }).format(value)}`
}

function formatDate(value: string | null) {
    return value ? new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
}

function Status({ status }: { status: AdminQpayPayment['status'] }) {
    if (status === 'paid') return <span className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{statusLabels[status]}</span>
    if (status === 'refunded') return <span className="flex items-center gap-2 text-sky-400"><RefreshCcw className="h-4 w-4" />{statusLabels[status]}</span>
    if (status === 'created' || status === 'pending') return <span className="flex items-center gap-2 text-amber-400"><Clock3 className="h-4 w-4" />{statusLabels[status]}</span>
    return <span className="flex items-center gap-2 text-red-400"><TriangleAlert className="h-4 w-4" />{statusLabels[status]}</span>
}

export function QpayPaymentList({ payments }: { payments: AdminQpayPayment[] }) {
    return (
        <div className="grid gap-4">
            {payments.map((payment) => (
                <Card key={payment.id} className="border-zinc-800 bg-zinc-900 text-white">
                    <CardContent className="space-y-5 p-6">
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                            <div>
                                <div className="mb-2 flex flex-wrap gap-2 text-xs">
                                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-blue-300">QPay автомат</span>
                                    <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-400">{payment.sourceSite}</span>
                                </div>
                                <h3 className="text-lg font-semibold">{payment.programName} · {payment.offeringName}</h3>
                                <p className="mt-1 text-sm text-zinc-400">{payment.learnerName} · {payment.applicantEmail}</p>
                            </div>
                            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"><Status status={payment.status} /></div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <Info label="Академийн дугаар" value={payment.paymentReference} mono />
                            <Info label="QPay sender invoice" value={payment.senderInvoiceNo} mono />
                            <Info label="QPay invoice ID" value={payment.qpayInvoiceId ?? '—'} mono />
                            <Info label="Төлбөрийн дүн" value={formatMnt(payment.amountMnt)} accent />
                        </div>

                        <div className="flex flex-col justify-between gap-2 border-t border-zinc-800 pt-4 text-xs text-zinc-500 md:flex-row">
                            <div>
                                <p>Үүсгэсэн: {formatDate(payment.createdAt)}</p>
                                <p>Төлөгдсөн: {formatDate(payment.paidAt)}</p>
                            </div>
                            <div className="md:text-right">
                                <p className="select-all">QPay payment ID: {payment.qpayPaymentId ?? '—'}</p>
                                {payment.failureReason ? <p className="mt-1 text-red-300">{payment.failureReason}</p> : null}
                            </div>
                        </div>
                        {payment.status === 'paid' && (
                            <QpayPaymentConfirmationAction
                                paymentId={payment.id}
                                notification={payment.notification}
                            />
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

function Info({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <p className="mb-1 text-xs text-zinc-500">{label}</p>
            <p className={`select-all break-all text-sm font-semibold ${mono ? 'font-mono' : ''} ${accent ? 'text-emerald-400' : 'text-zinc-100'}`}>{value}</p>
        </div>
    )
}
