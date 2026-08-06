import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, FileText, MapPin, Monitor, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getOpenCohortApplicationForm } from '@/features/programs/actions/cohort-application-actions'
import { ApprovedContractSnapshot } from '@/features/programs/components/approved-contract-snapshot'
import { CohortApplicationEditor } from '@/features/programs/components/cohort-application-form'
import { getMyApprovedContractSnapshot } from '@/features/programs/queries/approved-contract-snapshot-query'
import { getUlaanbaatarDate } from '@/features/programs/domain/contract-signing'
import { getMyCohortPaymentState } from '@/features/payments/actions/cohort-payment-actions'
import { CohortPaymentPanel } from '@/features/payments/components/cohort-payment-panel'

const deliveryLabels = { online: 'Цахим', offline: 'Танхим', hybrid: 'Хосолсон' } as const

export default async function ProgramApplicationPage({ params }: { params: Promise<{ cohortId: string }> }) {
    const { cohortId } = await params
    const [cohort, supabase] = await Promise.all([
        getOpenCohortApplicationForm(cohortId),
        createClient(),
    ])
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
    const profile = profileResult.data

    return (
        <div className="min-h-[calc(100vh-64px)] bg-zinc-950 px-4 py-10 text-white">
            <div className="mx-auto max-w-6xl">
                <Link href="/programs" className="text-sm text-zinc-400 hover:text-white">← Нээлттэй элсэлтүүд</Link>
                <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div>
                        <p className="text-sm font-medium text-indigo-400">{cohort.program_name}</p>
                        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{cohort.cohort_name}</h1>
                        <p className="mt-4 max-w-3xl leading-relaxed text-zinc-400">{cohort.program_description}</p>

                        <div className="mt-7 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm sm:grid-cols-2">
                            <p className="flex items-start gap-3"><Monitor className="mt-0.5 h-4 w-4 text-indigo-400" /><span><span className="block text-xs text-zinc-500">Хэлбэр</span>{deliveryLabels[cohort.delivery_mode]}</span></p>
                            <p className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-indigo-400" /><span><span className="block text-xs text-zinc-500">Хугацаа</span>{cohort.starts_on ?? 'Тодорхойгүй'} — {cohort.ends_on ?? 'Тодорхойгүй'}</span></p>
                            {cohort.location && <p className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 text-indigo-400" /><span><span className="block text-xs text-zinc-500">Байршил</span>{cohort.location}</span></p>}
                            {cohort.capacity && <p className="flex items-start gap-3"><Users className="mt-0.5 h-4 w-4 text-indigo-400" /><span><span className="block text-xs text-zinc-500">Суудал</span>{cohort.capacity - cohort.approved_count} үлдсэн</span></p>}
                        </div>

                        <div className="mt-8">
                            {user ? (
                                <CohortApplicationEditor
                                    cohort={cohort}
                                    profileName={profile?.display_name ?? null}
                                    userEmail={user.email ?? ''}
                                    currentDate={getUlaanbaatarDate()}
                                    hasContractSnapshot={contractSnapshot !== null}
                                />
                            ) : (
                                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-6">
                                    <h2 className="text-xl font-semibold">Өргөдөл гаргахын тулд нэвтэрнэ үү.</h2>
                                    <p className="mt-2 text-sm text-zinc-300">Таны өргөдөл, гэрээ болон төлбөрийн явцыг нэг бүртгэлд аюулгүй хадгална.</p>
                                    <div className="mt-5 flex gap-3">
                                        <Button asChild className="bg-indigo-600 hover:bg-indigo-700"><Link href="/login">Нэвтрэх</Link></Button>
                                        <Button asChild variant="outline"><Link href="/register">Бүртгүүлэх</Link></Button>
                                    </div>
                                </div>
                            )}
                            {contractSnapshot && (
                                <div className="mt-6">
                                    <ApprovedContractSnapshot snapshot={contractSnapshot} />
                                </div>
                            )}
                            {paymentState && (
                                <div className="mt-6">
                                    <CohortPaymentPanel state={paymentState} />
                                </div>
                            )}
                        </div>
                    </div>

                    <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 lg:sticky lg:top-24">
                        <p className="text-xs text-zinc-500">Сургалтын төлбөр</p>
                        <p className="mt-1 text-3xl font-bold text-emerald-400">{cohort.tuition_amount_mnt == null ? 'Тодорхойгүй' : `₮ ${cohort.tuition_amount_mnt.toLocaleString()}`}</p>
                        {cohort.payment_plan && <p className="mt-4 text-sm leading-relaxed text-zinc-400">{cohort.payment_plan}</p>}
                        <div className="mt-6 border-t border-zinc-800 pt-5">
                            <p className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-indigo-400" />Гэрээний хувилбар</p>
                            <p className="mt-2 text-sm text-zinc-400">{cohort.contract_title} · v{cohort.contract_version_number}</p>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-600">Өргөдөл энэ хувилбартай тогтмол холбогдоно. Дараа нь админ гэрээг шинэчилсэн ч таны өргөдлийн хувилбар өөрчлөгдөхгүй.</p>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}
