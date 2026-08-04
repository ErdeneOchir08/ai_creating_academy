import Link from 'next/link'
import { ArrowLeft, FileCheck2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    formatContractSnapshotDate,
    renderApprovedContractSnapshot,
    type AdminApprovedApplicationContractSnapshot,
} from '@/features/programs/domain/cohort-application'

const deliveryLabels = {
    online: 'Цахим',
    offline: 'Танхим',
    hybrid: 'Хосолсон',
} as const

function formatDate(value: string | null) {
    if (!value) return '—'
    return new Intl.DateTimeFormat('mn-MN', {
        dateStyle: 'medium',
        timeZone: 'Asia/Ulaanbaatar',
    }).format(new Date(value))
}

function AuditValue({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-600">{label}</dt>
            <dd className="mt-1 break-words text-sm text-zinc-200">{value || '—'}</dd>
        </div>
    )
}

export function ContractSnapshotAudit({
    snapshot,
    variableLabels,
}: {
    snapshot: AdminApprovedApplicationContractSnapshot
    variableLabels: Record<string, string>
}) {
    const renderedContract = renderApprovedContractSnapshot(
        snapshot.contract_content,
        snapshot.resolved_values,
    )
    const { program, cohort } = snapshot.program_details
    const academy = snapshot.academy_details
    const application = snapshot.application_details
    const hasUnresolvedVariables = snapshot.unresolved_variable_keys.length > 0

    return (
        <div className="mx-auto w-full max-w-6xl space-y-8 p-5 sm:p-8 lg:p-10">
            <div>
                <Button asChild variant="ghost" className="-ml-3 text-zinc-400 hover:text-white">
                    <Link href="/admin/applications"><ArrowLeft className="mr-2 h-4 w-4" />Өргөдлүүд рүү буцах</Link>
                </Button>
                <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-400">
                            <ShieldCheck className="h-5 w-5" />
                            <span className="text-sm font-medium">Өөрчлөгдөхгүй аудитын эх</span>
                        </div>
                        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{snapshot.contract_title}</h1>
                        <p className="mt-2 text-zinc-400">
                            № {snapshot.contract_number} · {snapshot.contract_date} · Хувилбар {snapshot.contract_version_number}
                        </p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
                        Өргөдлийн төлөв: <span className="font-medium text-emerald-300">Зөвшөөрсөн</span>
                    </div>
                </div>
            </div>

            {hasUnresolvedVariables && (
                <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                    <div className="flex items-start gap-3 text-amber-200">
                        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <h2 className="font-semibold">Баталгаажаагүй гэрээний мэдээлэл байна</h2>
                            <p className="mt-1 text-sm text-amber-100/70">
                                Гарын үсгийн алхам нээхээс өмнө дараах утгуудыг албан ёсоор тохируулна.
                            </p>
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {snapshot.unresolved_variable_keys.map((key) => (
                                    <li key={key} className="rounded-full border border-amber-500/30 bg-zinc-950/50 px-3 py-1 text-xs">
                                        {variableLabels[key] ?? key}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>
            )}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 sm:p-6">
                <div className="flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-indigo-400" />
                    <h2 className="text-xl font-semibold text-white">Түгжигдсэн гэрээний агуулга</h2>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                    Энэ агуулга нь зөвшөөрөх мөчид хадгалагдсан бөгөөд одоогийн загвар өөрчлөгдсөн ч дагаж өөрчлөгдөхгүй.
                </p>
                <div className="mt-5 max-h-[46rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm leading-7 text-zinc-300 sm:p-7">
                    {renderedContract}
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Өргөдлийн үеийн мэдээлэл</h2>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AuditValue label="Холбоо барих и-мэйл" value={application.contact_email} />
                    <AuditValue label="Суралцагчийн төрсөн огноо" value={application.student_birth_date} />
                    <AuditValue
                        label="Гэрээ байгуулсан тал"
                        value={application.signer_role === 'self' ? 'Суралцагч өөрөө' : 'Эцэг, эх / хууль ёсны асран хамгаалагч'}
                    />
                    <AuditValue label="Гарын үсэг зурсан хүний нэр" value={application.signer_name} />
                    <AuditValue label="Гарын үсэг зурсан хүний и-мэйл" value={application.signer_email} />
                    <AuditValue label="Гарын үсэг зурсан хүний утас" value={application.signer_phone} />
                    <AuditValue label="Гарын үсэг зурсан хүний регистр" value={application.signer_registration_number} />
                    <AuditValue label="Суралцагчтай хамаарах холбоо" value={application.signer_relationship} />
                    <AuditValue label="Илгээсэн" value={formatContractSnapshotDate(application.submitted_at)} />
                    <AuditValue label="Гэрээг зөвшөөрсөн" value={formatContractSnapshotDate(application.signed_at)} />
                    <AuditValue
                        label="Баталгаажуулалтын арга"
                        value={application.signature_method === 'email_otp' ? 'И-мэйл код' : 'Баталгаажсан бүртгэл'}
                    />
                    <AuditValue label="И-мэйл баталгаажсан" value={formatContractSnapshotDate(application.signer_email_verified_at)} />
                    <AuditValue label="Зөвшөөрлийн өгүүлбэрийн хувилбар" value={application.signature_statement_version} />
                    <AuditValue label="Зөвшөөрсөн" value={formatContractSnapshotDate(application.reviewed_at)} />
                    {Object.entries(snapshot.application_answers).map(([key, value]) => (
                        <AuditValue key={key} label={variableLabels[key] ?? key} value={value} />
                    ))}
                </dl>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Хөтөлбөр, элсэлтийн үеийн мэдээлэл</h2>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AuditValue label="Хөтөлбөр" value={program.name} />
                    <AuditValue label="Ээлж" value={cohort.name} />
                    <AuditValue label="Сургалтын хэлбэр" value={deliveryLabels[cohort.delivery_mode]} />
                    <AuditValue label="Хуваарь" value={cohort.schedule_summary} />
                    <AuditValue label="Байршил" value={cohort.location} />
                    <AuditValue label="Суудлын тоо" value={cohort.capacity?.toLocaleString('mn-MN')} />
                    <AuditValue label="Сургалтын төлбөр" value={cohort.tuition_amount_mnt == null ? '—' : `₮ ${cohort.tuition_amount_mnt.toLocaleString('mn-MN')}`} />
                    <AuditValue label="Төлбөрийн нөхцөл" value={cohort.payment_plan} />
                    <AuditValue label="Эхлэх өдөр" value={formatDate(cohort.starts_on)} />
                    <AuditValue label="Дуусах өдөр" value={formatDate(cohort.ends_on)} />
                </dl>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Байгууллагын тухайн үеийн мэдээлэл</h2>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AuditValue label="Нэр" value={academy.display_name} />
                    <AuditValue label="И-мэйл" value={academy.public_email} />
                    <AuditValue label="Утас" value={academy.phone} />
                    <AuditValue label="Хаяг" value={academy.address} />
                    <AuditValue label="Цагийн хуваарь" value={academy.business_hours} />
                    <AuditValue label="Вэб хуудас" value={academy.website_url} />
                    <AuditValue label="Гэрээ байгуулагч" value={academy.legal_name} />
                    <AuditValue label="Эрх бүхий төлөөлөгч" value={academy.representative_name} />
                    <AuditValue label="Гэрээний утас" value={academy.contract_phone} />
                    <AuditValue label="Гэрээний хаяг" value={academy.contract_address} />
                    <AuditValue label="Банк" value={academy.bank_name} />
                    <AuditValue label="Дансны дугаар" value={academy.bank_account_number} />
                    <AuditValue label="Данс эзэмшигч" value={academy.bank_account_holder} />
                </dl>
                <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">Зөвшөөрсөн өгүүлбэр</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-200">{application.signature_statement}</p>
                </div>
            </section>

            <details className="rounded-2xl border border-zinc-800 bg-zinc-950">
                <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-zinc-400 hover:text-white">
                    Аудитын техникийн дугаарууд
                </summary>
                <dl className="grid gap-3 border-t border-zinc-800 p-5 text-xs sm:grid-cols-2">
                    <AuditValue label="Snapshot ID" value={snapshot.id} />
                    <AuditValue label="Application ID" value={snapshot.application_id} />
                    <AuditValue label="Contract version ID" value={snapshot.contract_version_id} />
                    <AuditValue label="Cohort ID" value={snapshot.cohort_id} />
                    <AuditValue label="Applicant user ID" value={snapshot.applicant_user_id} />
                    <AuditValue label="Created by user ID" value={snapshot.created_by} />
                </dl>
            </details>
        </div>
    )
}
