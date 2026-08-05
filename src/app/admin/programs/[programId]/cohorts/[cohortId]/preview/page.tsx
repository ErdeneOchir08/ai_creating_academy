import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye, FileWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CohortApplicationEditor } from '@/features/programs/components/cohort-application-form'
import { getUlaanbaatarDate } from '@/features/programs/domain/contract-signing'
import { getAdminEnrollmentPreview } from '@/features/admin/queries/enrollment-preview-query'

const contractStatusLabels = {
    draft: 'Ноорог',
    published: 'Нийтлэгдсэн',
    retired: 'Ашиглалтаас гарсан',
} as const

export default async function AdminEnrollmentPreviewPage({
    params,
    searchParams,
}: {
    params: Promise<{ programId: string; cohortId: string }>
    searchParams: Promise<{ contractVersionId?: string | string[] }>
}) {
    const [{ programId, cohortId }, query] = await Promise.all([params, searchParams])
    const requestedContractVersionId = typeof query.contractVersionId === 'string'
        ? query.contractVersionId
        : undefined
    const preview = await getAdminEnrollmentPreview(programId, cohortId, requestedContractVersionId)
    if (!preview) notFound()

    return (
        <div className="mx-auto max-w-7xl space-y-7 p-5 text-white sm:p-8">
            <header>
                <Link
                    href={`/admin/programs/${programId}`}
                    className="inline-flex items-center text-sm text-zinc-400 hover:text-white"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />{preview.programName}
                </Link>
                <div className="mt-4 flex items-start gap-3">
                    <Eye className="mt-1 h-6 w-6 shrink-0 text-sky-400" />
                    <div>
                        <h1 className="text-2xl font-bold sm:text-3xl">Элсэлтийн маягтын урьдчилсан харагдац</h1>
                        <p className="mt-2 text-zinc-400">{preview.cohortName}</p>
                    </div>
                </div>
            </header>

            <section className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5">
                <h2 className="font-semibold text-sky-100">Зөвхөн админд харагдана</h2>
                <p className="mt-2 text-sm leading-relaxed text-sky-100/75">
                    Энэ хуудас бодит элсэлт нээхгүй. Доорх сонголт болон маягтын утгыг хадгалахгүй, өргөдөл үүсгэхгүй, гэрээ нийтлэхгүй, и-мэйл илгээхгүй.
                </p>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
                <h2 className="font-semibold">Шалгах гэрээний хувилбар</h2>
                <p className="mt-1 text-sm text-zinc-500">Бодит гэрээний сангаас хувилбараа өөрөө сонгоно. Сонголт элсэлтийн ноорогт хадгалагдахгүй.</p>
                <form method="get" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1 space-y-2 text-sm text-zinc-300">
                        <span>Гэрээний хувилбар</span>
                        <select
                            name="contractVersionId"
                            defaultValue={preview.selectedContractVersionId ?? ''}
                            required
                            className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                        >
                            <option value="">Сонгоно уу</option>
                            {preview.contractOptions.map((contract) => (
                                <option key={contract.id} value={contract.id}>
                                    {contract.templateName} · v{contract.versionNumber} · {contractStatusLabels[contract.status]}
                                    {contract.templateArchived ? ' · архивласан сан' : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Button type="submit" variant="outline"><Eye className="mr-2 h-4 w-4" />Харах</Button>
                </form>
                {requestedContractVersionId && !preview.selectedContract && (
                    <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                        Сонгосон гэрээний хувилбар олдсонгүй. Гэрээний сангаас хүчинтэй сонголт хийнэ үү.
                    </p>
                )}
            </section>

            {preview.form && preview.selectedContract ? (
                <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <CohortApplicationEditor
                        cohort={preview.form}
                        profileName={null}
                        userEmail={preview.adminEmail}
                        currentDate={getUlaanbaatarDate()}
                        hasContractSnapshot={false}
                        mode="admin-preview"
                    />
                    <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-950 p-5 xl:sticky xl:top-24">
                        <h2 className="font-semibold">Одоогийн өгөгдөл</h2>
                        <dl className="mt-4 space-y-4 text-sm">
                            <PreviewValue label="Хөтөлбөр" value={preview.programName} />
                            <PreviewValue label="Элсэлт" value={preview.cohortName} />
                            <PreviewValue label="Элсэлтийн төлөв" value={preview.cohortStatus} />
                            <PreviewValue
                                label="Шалгаж буй гэрээ"
                                value={`${preview.selectedContract.templateName} · v${preview.selectedContract.versionNumber} · ${contractStatusLabels[preview.selectedContract.status]}`}
                            />
                            <PreviewValue
                                label="Элсэлтэд хадгалсан гэрээ"
                                value={preview.assignedContractVersionId
                                    ? preview.assignedContractVersionId === preview.selectedContractVersionId
                                        ? 'Энэ хувилбар'
                                        : 'Өөр хувилбар'
                                    : 'Одоогоор сонгоогүй'}
                            />
                        </dl>
                        <p className="mt-5 flex items-start gap-2 border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
                            <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
                            Насанд хүрсэн суралцагчийн жишээнд таны админ бүртгэлийн и-мэйл зөвхөн дэлгэц дээр харагдана. Энэ хуудсаас хадгалагдахгүй.
                        </p>
                    </aside>
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
                    Маягтыг шалгахын тулд дээрээс гэрээний хувилбар сонгоно уу.
                </div>
            )}
        </div>
    )
}

function PreviewValue({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs text-zinc-600">{label}</dt>
            <dd className="mt-1 break-words text-zinc-300">{value}</dd>
        </div>
    )
}
