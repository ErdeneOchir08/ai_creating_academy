import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, CircleCheck, FileText, MapPin, Monitor, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { withReturnPath } from '@/lib/auth/return-path'
import { createClient } from '@/lib/supabase/server'
import {
    getOfferingCheckoutForm,
    getOfferingPaymentConfiguration,
} from '@/features/checkout/actions/offering-checkout-actions'
import { OfferingCheckoutEditor } from '@/features/checkout/components/offering-checkout-editor'
import { getOpenCohortApplicationForm } from '@/features/programs/actions/cohort-application-actions'
import { ApprovedContractSnapshot } from '@/features/programs/components/approved-contract-snapshot'
import { CohortApplicationEditor } from '@/features/programs/components/cohort-application-form'
import { getMyApprovedContractSnapshot } from '@/features/programs/queries/approved-contract-snapshot-query'
import { getUlaanbaatarDate } from '@/features/programs/domain/contract-signing'
import { isProgramRouteId } from '@/features/programs/domain/program-route'
import { getMyCohortPaymentState } from '@/features/payments/actions/cohort-payment-actions'
import { CohortPaymentPanel } from '@/features/payments/components/cohort-payment-panel'
import { getQpayPublicState } from '@/lib/qpay/config'

const deliveryLabels = { online: 'Цахим', offline: 'Танхим', hybrid: 'Хосолсон' } as const

export default async function ProgramApplicationPage({
    params,
    searchParams,
}: {
    params: Promise<{ cohortId: string }>
    searchParams: Promise<{ application?: string }>
}) {
    const [{ cohortId }, query, supabase] = await Promise.all([
        params,
        searchParams,
        createClient(),
    ])
    if (!isProgramRouteId(cohortId)) notFound()

    const checkout = await getOfferingCheckoutForm(cohortId)
    if (checkout) {
        const { data: { user } } = await supabase.auth.getUser()
        const [profileResult, paymentConfiguration] = user
            ? await Promise.all([
                supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
                getOfferingPaymentConfiguration(),
            ])
            : [{ data: null }, { instructions: '', isTestMode: true }] as const
        const qpay = getQpayPublicState()

        return (
            <OfferingCheckoutPage
                checkout={checkout}
                user={user ? {
                    email: user.email ?? '',
                    displayName: profileResult.data?.display_name ?? null,
                } : null}
                currentDate={getUlaanbaatarDate()}
                serverNow={new Date().toISOString()}
                paymentConfiguration={{
                    ...paymentConfiguration,
                    qpayEnabled: qpay.enabled,
                    qpayNewInvoicesEnabled: checkout.qpay_enabled,
                    manualTransferEnabled: checkout.manual_transfer_enabled,
                    qpayEnvironment: qpay.environment,
                }}
                initialApplicationId={query.application}
            />
        )
    }

    const cohort = await getOpenCohortApplicationForm(cohortId)
    if (!cohort) notFound()
    const { data: { user } } = await supabase.auth.getUser()
    const [profileResult, contractSnapshot, paymentState] = user
        ? await Promise.all([
            supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
            getMyApprovedContractSnapshot(cohortId),
            cohort.my_application?.status === 'approved'
                ? getMyCohortPaymentState(cohort.my_application.id)
                : Promise.resolve(null),
        ])
        : [{ data: null }, null, null] as const

    return (
        <LegacyCohortApplicationPage
            cohort={cohort}
            user={user ? { email: user.email ?? '', displayName: profileResult.data?.display_name ?? null } : null}
            contractSnapshot={contractSnapshot}
            paymentState={paymentState}
        />
    )
}

async function OfferingCheckoutPage({
    checkout,
    user,
    currentDate,
    serverNow,
    paymentConfiguration,
    initialApplicationId,
}: {
    checkout: NonNullable<Awaited<ReturnType<typeof getOfferingCheckoutForm>>>
    user: { email: string; displayName: string | null } | null
    currentDate: string
    serverNow: string
    paymentConfiguration: {
        instructions: string
        isTestMode: boolean
        qpayEnabled: boolean
        qpayNewInvoicesEnabled: boolean
        manualTransferEnabled: boolean
        qpayEnvironment: 'sandbox' | 'production'
    }
    initialApplicationId?: string
}) {
    if (!checkout) notFound()
    const returnPath = `/programs/${encodeURIComponent(checkout.offering_id)}`
    return (
        <div className="min-h-[calc(100vh-64px)] bg-zinc-950 px-4 py-10 text-white">
            <div className="mx-auto max-w-6xl">
                <Link href={`/course/${checkout.course_id}`} className="text-sm text-zinc-400 hover:text-white">
                    ← Хичээлийн мэдээлэл рүү буцах
                </Link>
                <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <main className="min-w-0">
                        <p className="text-sm font-medium text-indigo-400">{checkout.program_name}</p>
                        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{checkout.offering_name}</h1>
                        <p className="mt-4 max-w-3xl leading-relaxed text-zinc-400">{checkout.program_description}</p>
                        <OfferingFacts
                            deliveryMode={checkout.delivery_mode}
                            startsOn={checkout.starts_on}
                            endsOn={checkout.ends_on}
                            location={checkout.location}
                            classSize={checkout.capacity}
                            classSizeIsLimit={false}
                            schedule={checkout.schedule_summary}
                        />

                        <div className="mt-8">
                            {!user ? (
                                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-6">
                                    <h2 className="text-xl font-semibold">Элсэхийн тулд нэвтэрнэ үү</h2>
                                    <p className="mt-2 text-sm text-zinc-300">Таны хүсэлт, гэрээ, төлбөр болон хичээл үзэх эрх нэг бүртгэлд найдвартай хадгалагдана.</p>
                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <Button asChild><Link href={withReturnPath('/login', returnPath)}>Нэвтрэх</Link></Button>
                                        <Button asChild variant="outline"><Link href={withReturnPath('/register', returnPath)}>Бүртгүүлэх</Link></Button>
                                    </div>
                                </div>
                            ) : !checkout.is_accepting_applications && checkout.my_applications.length === 0 ? (
                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6">
                                    <h2 className="text-xl font-semibold text-amber-100">Элсэлт хаагдсан байна</h2>
                                    <p className="mt-2 text-sm text-amber-100/70">Энэ элсэлт одоогоор шинэ хүсэлт хүлээн авахгүй байна.</p>
                                </div>
                            ) : (
                                <OfferingCheckoutEditor
                                    checkout={checkout}
                                    profileName={user.displayName}
                                    userEmail={user.email}
                                    currentDate={currentDate}
                                    serverNow={serverNow}
                                    paymentConfiguration={paymentConfiguration}
                                    initialApplicationId={initialApplicationId}
                                    newClientRequestId={crypto.randomUUID()}
                                />
                            )}
                        </div>
                    </main>

                    <OfferingSummary checkout={checkout} />
                </div>
            </div>
        </div>
    )
}

function OfferingSummary({ checkout }: { checkout: NonNullable<Awaited<ReturnType<typeof getOfferingCheckoutForm>>> }) {
    return (
        <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 lg:sticky lg:top-24">
            <p className="text-xs text-zinc-500">Сургалтын төлбөр</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">₮ {checkout.tuition_amount_mnt.toLocaleString('mn-MN')}</p>
            {checkout.payment_plan && <p className="mt-4 text-sm leading-relaxed text-zinc-400">{checkout.payment_plan}</p>}
            <div className="mt-6 border-t border-zinc-800 pt-5">
                <p className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    {checkout.contract_policy === 'required' ? 'Гэрээ шаардлагатай' : 'Гэрээ шаардлагагүй'}
                </p>
                {checkout.contract_policy === 'required' && (
                    <>
                        <p className="mt-2 text-sm text-zinc-400">{checkout.contract_title} · v{checkout.contract_version_number}</p>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-600">Гэрээний энэ хувилбар хүсэлттэй өөрчлөгдөхгүйгээр холбогдоно.</p>
                    </>
                )}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
                <p>
                    Төлбөрийг админ баталгаажуулсны дараа <strong className="font-semibold text-white">“{checkout.course_title}”</strong> хичээл үзэх эрх нээгдэнэ.
                </p>
            </div>
        </aside>
    )
}

function OfferingFacts({
    deliveryMode,
    startsOn,
    endsOn,
    location,
    classSize,
    classSizeIsLimit,
    schedule,
}: {
    deliveryMode: 'online' | 'offline' | 'hybrid'
    startsOn: string | null
    endsOn: string | null
    location: string
    classSize: number | null
    classSizeIsLimit: boolean
    schedule: string
}) {
    return (
        <div className="mt-7 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-3"><Monitor className="mt-0.5 h-4 w-4 text-indigo-400" /><span><span className="block text-xs text-zinc-500">Хэлбэр</span>{deliveryLabels[deliveryMode]}</span></p>
            <p className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-indigo-400" /><span><span className="block text-xs text-zinc-500">Хугацаа</span>{startsOn ?? 'Тодорхойгүй'} – {endsOn ?? 'Тодорхойгүй'}</span></p>
            {deliveryMode === 'offline' && location && <p className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 text-indigo-400" /><span><span className="block text-xs text-zinc-500">Байршил</span>{location}</span></p>}
            {classSize !== null && <p className="flex items-start gap-3"><Users className="mt-0.5 h-4 w-4 text-indigo-400" /><span><span className="block text-xs text-zinc-500">{classSizeIsLimit ? 'Үлдсэн суудал' : 'Ангийн хэмжээ'}</span>{classSizeIsLimit ? classSize : `${classSize} суралцагч`}</span></p>}
            {schedule && <p className="sm:col-span-2"><span className="block text-xs text-zinc-500">Хуваарь</span>{schedule}</p>}
        </div>
    )
}

function LegacyCohortApplicationPage({
    cohort,
    user,
    contractSnapshot,
    paymentState,
}: {
    cohort: NonNullable<Awaited<ReturnType<typeof getOpenCohortApplicationForm>>>
    user: { email: string; displayName: string | null } | null
    contractSnapshot: Awaited<ReturnType<typeof getMyApprovedContractSnapshot>>
    paymentState: Awaited<ReturnType<typeof getMyCohortPaymentState>>
}) {
    const returnPath = `/programs/${encodeURIComponent(cohort.cohort_id)}`
    return (
        <div className="min-h-[calc(100vh-64px)] bg-zinc-950 px-4 py-10 text-white">
            <div className="mx-auto max-w-6xl">
                <Link href="/programs" className="text-sm text-zinc-400 hover:text-white">← Бүх сургалтууд</Link>
                <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div>
                        <p className="text-sm font-medium text-indigo-400">{cohort.program_name}</p>
                        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{cohort.cohort_name}</h1>
                        <p className="mt-4 max-w-3xl leading-relaxed text-zinc-400">{cohort.program_description}</p>
                        <OfferingFacts
                            deliveryMode={cohort.delivery_mode}
                            startsOn={cohort.starts_on}
                            endsOn={cohort.ends_on}
                            location={cohort.location}
                            classSize={cohort.capacity === null ? null : Math.max(0, cohort.capacity - cohort.approved_count)}
                            classSizeIsLimit
                            schedule={cohort.schedule_summary}
                        />
                        <div className="mt-8">
                            {user ? (
                                <CohortApplicationEditor cohort={cohort} profileName={user.displayName} userEmail={user.email} currentDate={getUlaanbaatarDate()} hasContractSnapshot={contractSnapshot !== null} />
                            ) : (
                                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-6">
                                    <h2 className="text-xl font-semibold">Өргөдөл гаргахын тулд нэвтэрнэ үү</h2>
                                    <div className="mt-5 flex gap-3">
                                        <Button asChild><Link href={withReturnPath('/login', returnPath)}>Нэвтрэх</Link></Button>
                                        <Button asChild variant="outline"><Link href={withReturnPath('/register', returnPath)}>Бүртгүүлэх</Link></Button>
                                    </div>
                                </div>
                            )}
                            {contractSnapshot && <div className="mt-6"><ApprovedContractSnapshot snapshot={contractSnapshot} /></div>}
                            {paymentState && <div className="mt-6"><CohortPaymentPanel state={paymentState} /></div>}
                        </div>
                    </div>
                    <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 lg:sticky lg:top-24">
                        <p className="text-xs text-zinc-500">Сургалтын төлбөр</p>
                        <p className="mt-1 text-3xl font-bold text-emerald-400">{cohort.tuition_amount_mnt == null ? 'Тодорхойгүй' : `₮ ${cohort.tuition_amount_mnt.toLocaleString('mn-MN')}`}</p>
                        {cohort.payment_plan && <p className="mt-4 text-sm leading-relaxed text-zinc-400">{cohort.payment_plan}</p>}
                        <div className="mt-6 border-t border-zinc-800 pt-5">
                            <p className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-indigo-400" />Гэрээний хувилбар</p>
                            <p className="mt-2 text-sm text-zinc-400">{cohort.contract_title} · v{cohort.contract_version_number}</p>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}
