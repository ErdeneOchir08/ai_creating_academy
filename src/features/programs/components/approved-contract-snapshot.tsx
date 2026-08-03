import { FileCheck2, TriangleAlert } from 'lucide-react'
import {
    formatContractSnapshotDate,
    renderApprovedContractSnapshot,
    type ApprovedApplicationContractSnapshot,
} from '@/features/programs/domain/cohort-application'

export function ApprovedContractSnapshot({
    snapshot,
}: {
    snapshot: ApprovedApplicationContractSnapshot
}) {
    const hasUnresolvedVariables = snapshot.unresolved_variable_keys.length > 0
    const preview = renderApprovedContractSnapshot(snapshot.contract_content, snapshot.resolved_values)

    return (
        <section className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="flex items-start gap-3">
                <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                    <h3 className="font-semibold text-emerald-100">Гэрээний эх хувь түгжигдсэн</h3>
                    <p className="mt-1 text-sm text-emerald-100/70">
                        {snapshot.contract_title} · v{snapshot.contract_version_number} · {formatContractSnapshotDate(snapshot.created_at)}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                        Энэ нь өргөдөл зөвшөөрөгдөх үеийн өөрчлөгдөхгүй эх хувь. Одоогоор гарын үсэг зурсан эсвэл төлбөр баталгаажсан гэсэн утга агуулахгүй.
                    </p>
                </div>
            </div>

            {hasUnresolvedVariables && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Гэрээ баталгаажуулах алхмыг нээхийн өмнө админ байгууллагын болон гэрээний үлдсэн мэдээллийг бүрэн тохируулна.</p>
                </div>
            )}

            <details className="group rounded-xl border border-zinc-800 bg-zinc-950">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:text-white">
                    Гэрээний эхийг урьдчилан харах
                </summary>
                <div className="border-t border-zinc-800 px-4 py-5">
                    <div className="max-h-[34rem] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-zinc-300">
                        {preview}
                    </div>
                    {hasUnresolvedVariables && (
                        <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-amber-300/80">
                            ⟦...⟧ тэмдэглэгээтэй хэсгүүдийн мэдээлэл хараахан баталгаажаагүй байна.
                        </p>
                    )}
                </div>
            </details>
        </section>
    )
}
