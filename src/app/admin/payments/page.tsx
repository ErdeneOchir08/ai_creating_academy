import Link from 'next/link'
import { CheckCircle2, Clock, Image as ImageIcon, Search, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getPayments } from '@/features/admin/actions/admin-actions'
import { PaymentReviewActions } from '@/features/admin/components/payment-review-actions'

type SearchParams = { status?: string; search?: string }

const labels = {
  pending: 'Хүлээгдэж буй',
  approved: 'Зөвшөөрсөн',
  rejected: 'Татгалзсан',
} as const

function statusBadge(status: string) {
  if (status === 'approved') {
    return <span className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="h-5 w-5" /> Зөвшөөрсөн</span>
  }
  if (status === 'rejected') {
    return <span className="flex items-center gap-2 text-red-400"><XCircle className="h-5 w-5" /> Татгалзсан</span>
  }
  return <span className="flex items-center gap-2 text-amber-400"><Clock className="h-5 w-5" /> Хүлээгдэж буй</span>
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const requestedStatus = params.status
  const currentStatus = requestedStatus === 'approved' || requestedStatus === 'rejected' ? requestedStatus : 'pending'
  const currentSearch = params.search?.trim() ?? ''
  const payments = await getPayments({ status: currentStatus, search: currentSearch })

  return (
    <div className="min-h-screen bg-[#09090b] p-5 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Төлбөрийн хүсэлтүүд</h1>
          <p className="text-zinc-400">Баримтыг шалгаад зөвшөөрөх эсвэл татгалзах шийдвэр гаргана.</p>
        </header>

        <section>
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <nav className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-1" aria-label="Төлбөрийн төлөв">
              {(Object.keys(labels) as Array<keyof typeof labels>).map((status) => (
                <Link key={status} href={`/admin/payments?status=${status}&search=${encodeURIComponent(currentSearch)}`}>
                  <span className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${currentStatus === status ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
                    {labels[status]}
                  </span>
                </Link>
              ))}
            </nav>

            <form action="/admin/payments" method="GET" className="relative flex-1 md:max-w-xs">
              <input type="hidden" name="status" value={currentStatus} />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                name="search"
                defaultValue={currentSearch}
                placeholder="Оюутан эсвэл хичээл хайх"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </form>
          </div>

          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            {labels[currentStatus]}
            <span className="rounded-full bg-indigo-600 px-2 py-1 text-xs text-white">{payments.length}</span>
          </h2>

          <div className="grid gap-4">
            {payments.length > 0 ? payments.map((payment) => (
              <Card key={payment.id} className="border-zinc-800 bg-zinc-900 text-white">
                <CardContent className="flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm text-zinc-400">Оюутан: <span className="font-medium text-white">{payment.profiles?.display_name || payment.user_id}</span></p>
                    <h3 className="truncate text-lg font-semibold">{payment.courses?.title || 'Хичээл олдсонгүй'}</h3>
                    <p className="font-mono text-sm text-emerald-400">{payment.courses?.price_display || '—'}</p>
                    {payment.bonus_course_titles?.length > 0 && (
                      <p className="mt-2 text-xs text-violet-300">
                        {payment.bonus_course_status === 'granted' ? 'Нээгдсэн дагалдах үнэгүй: ' : 'Зөвшөөрвөл нээгдэх дагалдах үнэгүй: '}
                        {payment.bonus_course_titles.join(', ')}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">Илгээсэн: {new Date(payment.created_at).toLocaleString('mn-MN')}</p>
                  </div>

                  <div className="flex w-full flex-1 items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-4 md:w-auto">
                    <ImageIcon className="h-8 w-8 shrink-0 text-zinc-600" />
                    <div>
                      <p className="text-sm font-medium">Төлбөрийн баримт</p>
                      {payment.proof_image_url ? (
                        <a href={payment.proof_image_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">Баримтыг нээх</a>
                      ) : (
                        <p className="text-xs text-amber-400">Баримтыг нээж чадсангүй</p>
                      )}
                    </div>
                  </div>

                  {payment.status === 'pending' ? (
                    <PaymentReviewActions paymentId={payment.id} />
                  ) : (
                    <div className="flex w-full min-w-36 flex-col items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-medium md:w-auto">
                      {statusBadge(payment.status)}
                      <PaymentReviewActions paymentId={payment.id} status={payment.status} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-400">
                {currentSearch ? `“${currentSearch}” хайлтад тохирох хүсэлт олдсонгүй.` : `${labels[currentStatus]} төлбөрийн хүсэлт одоогоор алга.`}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
