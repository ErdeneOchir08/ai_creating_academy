import Link from 'next/link'
import { CheckCircle2, Clock, Image as ImageIcon, Search, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getPayments } from '@/features/admin/actions/admin-actions'
import { getCohortPayments } from '@/features/admin/actions/cohort-payment-actions.admin'
import { getCourseOfferingPayments } from '@/features/admin/actions/offering-payment-actions.admin'
import { getQpayPayments } from '@/features/admin/actions/qpay-payment-actions.admin'
import { PaymentReviewActions } from '@/features/admin/components/payment-review-actions'
import { CohortPaymentReviewActions } from '@/features/admin/components/cohort-payment-review-actions'
import { OfferingPaymentList } from '@/features/admin/components/offering-payment-list'
import { QpayPaymentList } from '@/features/admin/components/qpay-payment-list'

type SearchParams = { type?: string; status?: string; search?: string }
type PaymentStatus = 'pending' | 'approved' | 'rejected'
type PaymentType = 'course' | 'cohort' | 'offering' | 'qpay'

const statusLabels: Record<PaymentStatus, string> = {
    pending: 'Хүлээгдэж буй',
    approved: 'Зөвшөөрсөн',
    rejected: 'Татгалзсан',
}

function paymentHref(type: PaymentType, status: PaymentStatus, search: string) {
    return `/admin/payments?type=${type}&status=${status}&search=${encodeURIComponent(search)}`
}

function statusBadge(status: PaymentStatus) {
    if (status === 'approved') return <span className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="h-5 w-5" />Зөвшөөрсөн</span>
    if (status === 'rejected') return <span className="flex items-center gap-2 text-red-400"><XCircle className="h-5 w-5" />Татгалзсан</span>
    return <span className="flex items-center gap-2 text-amber-400"><Clock className="h-5 w-5" />Хүлээгдэж буй</span>
}

function formatMnt(value: number) {
    return `₮ ${new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 0 }).format(value)}`
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const params = await searchParams
    const paymentType: PaymentType = params.type === 'course' || params.type === 'cohort' || params.type === 'qpay'
        ? params.type
        : 'offering'
    const currentStatus: PaymentStatus = params.status === 'approved' || params.status === 'rejected' ? params.status : 'pending'
    const currentSearch = params.search?.trim() ?? ''
    const offeringPayments = paymentType === 'offering'
        ? await getCourseOfferingPayments({ status: currentStatus, search: currentSearch })
        : null
    const qpayPayments = paymentType === 'qpay'
        ? await getQpayPayments({ status: currentStatus, search: currentSearch })
        : null
    const payments = paymentType === 'offering' || paymentType === 'qpay'
        ? []
        : paymentType === 'cohort'
            ? await getCohortPayments({ status: currentStatus, search: currentSearch })
            : await getPayments({ status: currentStatus, search: currentSearch })
    const paymentCount = qpayPayments?.length ?? offeringPayments?.length ?? payments.length

    return (
        <div className="min-h-screen bg-[#09090b] p-5 text-white md:p-8">
            <div className="mx-auto max-w-6xl">
                <header className="mb-8">
                    <h1 className="mb-2 text-3xl font-bold">Төлбөрийн хүсэлтүүд</h1>
                    <p className="text-zinc-400">Шинэ нэгдсэн анги / элсэлтийн төлбөрийг үндсэн хэсгээс шалгана. Хуучин урсгалууд түүхэн хүсэлтүүдэд зориулан тусдаа хадгалагдана.</p>
                </header>

                <nav className="mb-6 grid max-w-4xl grid-cols-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1 sm:grid-cols-4" aria-label="Төлбөрийн төрөл">
                    {([
                        ['offering', 'Анги / элсэлт'],
                        ['qpay', 'QPay автомат'],
                        ['course', 'Шууд төлбөр · хуучин'],
                        ['cohort', 'Гэрээт урсгал · хуучин'],
                    ] as const).map(([type, label]) => (
                        <Link key={type} href={paymentHref(type, currentStatus, currentSearch)} className={`rounded-lg px-4 py-3 text-center text-sm font-medium transition-colors ${paymentType === type ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
                            {label}
                        </Link>
                    ))}
                </nav>

                <section>
                    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <nav className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-1" aria-label="Төлбөрийн төлөв">
                            {(Object.keys(statusLabels) as PaymentStatus[]).map((status) => (
                                <Link key={status} href={paymentHref(paymentType, status, currentSearch)} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${currentStatus === status ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
                                    {statusLabels[status]}
                                </Link>
                            ))}
                        </nav>

                        <form action="/admin/payments" method="GET" className="relative flex-1 md:max-w-sm">
                            <input type="hidden" name="type" value={paymentType} />
                            <input type="hidden" name="status" value={currentStatus} />
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input type="search" name="search" defaultValue={currentSearch} placeholder={paymentType === 'course' ? 'Оюутан эсвэл хичээлээр хайх' : 'Суралцагч, и-мэйл, сургалтаар хайх'} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </form>
                    </div>

                    <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                        {statusLabels[currentStatus]}
                        <span className="rounded-full bg-indigo-600 px-2 py-1 text-xs text-white">{paymentCount}</span>
                    </h2>

                    <div className="grid gap-4">
                        {paymentType === 'qpay'
                            ? <QpayPaymentList payments={qpayPayments ?? []} />
                            : paymentType === 'offering'
                            ? <OfferingPaymentList payments={offeringPayments ?? []} />
                            : paymentType === 'course'
                            ? payments.map((payment) => {
                                if (!('course_id' in payment)) return null
                                return (
                                    <Card key={payment.id} className="border-zinc-800 bg-zinc-900 text-white">
                                        <CardContent className="flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center">
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="text-sm text-zinc-400">Оюутан: <span className="font-medium text-white">{payment.profiles?.display_name || payment.user_id}</span></p>
                                                <h3 className="truncate text-lg font-semibold">{payment.courses?.title || 'Хичээл олдсонгүй'}</h3>
                                                <p className="font-mono text-sm text-emerald-400">{payment.courses?.price_display || '—'}</p>
                                                {payment.bonus_course_titles?.length > 0 && <p className="mt-2 text-xs text-violet-300">{payment.bonus_course_status === 'granted' ? 'Нээгдсэн дагалдах үнэгүй: ' : 'Зөвшөөрвөл нээгдэх дагалдах үнэгүй: '}{payment.bonus_course_titles.join(', ')}</p>}
                                                <p className="mt-2 text-xs text-zinc-500">Илгээсэн: {new Date(payment.created_at).toLocaleString('mn-MN')}</p>
                                            </div>
                                            <ReceiptLink url={payment.proof_image_url} />
                                            {payment.status === 'pending'
                                                ? <PaymentReviewActions paymentId={payment.id} />
                                                : <div className="flex w-full min-w-40 flex-col items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 md:w-auto">{statusBadge(payment.status)}<PaymentReviewActions paymentId={payment.id} status={payment.status} /></div>}
                                        </CardContent>
                                    </Card>
                                )
                            })
                            : payments.map((payment) => {
                                if (!('cohort_id' in payment)) return null
                                const studentName = payment.applicant?.display_name || payment.application?.answers?.student_name || payment.application?.contact_email || payment.applicant_user_id
                                return (
                                    <Card key={payment.id} className="border-zinc-800 bg-zinc-900 text-white">
                                        <CardContent className="flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center">
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="text-sm text-zinc-400">Суралцагч: <span className="font-medium text-white">{studentName}</span></p>
                                                <h3 className="text-lg font-semibold">{payment.cohort?.program?.name || 'Хөтөлбөр олдсонгүй'}</h3>
                                                <p className="text-sm text-zinc-400">Ээлж: {payment.cohort?.name || '—'}</p>
                                                <p className="font-mono text-sm text-emerald-400">{formatMnt(payment.amount_mnt)}</p>
                                                {payment.status === 'rejected' && payment.rejection_reason && <p className="mt-2 text-xs text-red-300">Буцаасан шалтгаан: {payment.rejection_reason}</p>}
                                                <p className="mt-2 text-xs text-zinc-500">Илгээсэн: {new Date(payment.created_at).toLocaleString('mn-MN')}</p>
                                            </div>
                                            <ReceiptLink url={payment.receiptUrl} />
                                            {payment.status === 'pending'
                                                ? <CohortPaymentReviewActions paymentId={payment.id} cohortId={payment.cohort_id} />
                                                : <div className="flex w-full min-w-40 flex-col items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 md:w-auto">{statusBadge(payment.status)}<CohortPaymentReviewActions paymentId={payment.id} cohortId={payment.cohort_id} status={payment.status} /></div>}
                                        </CardContent>
                                    </Card>
                                )
                            })}

                        {paymentCount === 0 && (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-400">
                                {currentSearch ? `“${currentSearch}” хайлтад тохирох хүсэлт олдсонгүй.` : `${statusLabels[currentStatus]} төлбөрийн хүсэлт одоогоор алга.`}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}

function ReceiptLink({ url }: { url: string | null }) {
    return (
        <div className="flex w-full flex-1 items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-4 md:w-auto">
            <ImageIcon className="h-8 w-8 shrink-0 text-zinc-600" />
            <div>
                <p className="text-sm font-medium">Төлбөрийн баримт</p>
                {url
                    ? <a href={url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">Баримтыг нээх</a>
                    : <p className="text-xs text-amber-400">Баримтыг нээж чадсангүй</p>}
            </div>
        </div>
    )
}
