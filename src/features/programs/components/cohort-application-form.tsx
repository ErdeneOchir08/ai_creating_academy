'use client'

import { useRef, useState, useTransition } from 'react'
import { CheckCircle2, FileText, Save, Send, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    saveCohortApplicationDraft,
    submitCohortApplication,
    withdrawCohortApplication,
} from '@/features/programs/actions/cohort-application-actions'
import type { CohortApplicationForm } from '@/features/programs/domain/cohort-application'

const statusLabels = {
    draft: 'Ноорог',
    submitted: 'Хянагдаж байна',
    approved: 'Зөвшөөрсөн',
    rejected: 'Буцаасан',
    withdrawn: 'Буцаан татсан',
} as const

export function CohortApplicationEditor({
    cohort,
    profileName,
    hasContractSnapshot,
}: {
    cohort: CohortApplicationForm
    profileName: string | null
    hasContractSnapshot: boolean
}) {
    const formRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const application = cohort.my_application
    const editable = cohort.is_accepting_applications
        && (!application || ['draft', 'rejected', 'withdrawn'].includes(application.status))

    function run(action: () => Promise<{ success: string }>) {
        setError(null)
        setMessage(null)
        startTransition(async () => {
            try {
                const result = await action()
                setMessage(result.success)
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Үйлдлийг гүйцэтгэж чадсангүй.')
            }
        })
    }

    function formData() {
        if (!formRef.current) throw new Error('Өргөдлийн маягт олдсонгүй.')
        return new FormData(formRef.current)
    }

    if (!editable && application) {
        return (
            <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm text-zinc-500">Өргөдлийн төлөв</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">{statusLabels[application.status]}</h2>
                    </div>
                    {application.status === 'approved' && <CheckCircle2 className="h-8 w-8 text-emerald-400" />}
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                    {cohort.fields.map((field) => (
                        <div key={field.key} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                            <dt className="text-xs text-zinc-500">{field.label}</dt>
                            <dd className="mt-1 break-words text-sm text-zinc-200">{application.answers[field.key] || '—'}</dd>
                        </div>
                    ))}
                </dl>
                {application.status === 'submitted' && cohort.is_accepting_applications && (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run(() => withdrawCohortApplication(application.id, cohort.cohort_id))}
                    >
                        <Undo2 className="mr-2 h-4 w-4" />Өргөдлийг буцаан татах
                    </Button>
                )}
                {application.status === 'approved' && !hasContractSnapshot && (
                    <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                        Өргөдөл зөвшөөрөгдсөн боловч гэрээний түгжигдсэн эх олдсонгүй. Админтай холбогдоно уу.
                    </p>
                )}
                {!cohort.is_accepting_applications && application.status !== 'approved' && (
                    <p className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-300">
                        Элсэлт хаагдсан тул энэ өргөдлийг одоо засварлах эсвэл дахин илгээх боломжгүй.
                    </p>
                )}
                {error && <p className="text-sm text-red-400">{error}</p>}
                {message && <p className="text-sm text-emerald-400">{message}</p>}
            </div>
        )
    }

    return (
        <form ref={formRef} className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-indigo-400" />
                <div>
                    <h2 className="text-xl font-semibold text-white">Элсэлтийн өргөдөл</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                        {cohort.contract_title} · v{cohort.contract_version_number}-д шаардлагатай мэдээлэл
                    </p>
                </div>
            </div>

            {application?.status === 'rejected' && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                    <p className="font-medium">Өргөдлийг засварлуулахаар буцаасан.</p>
                    <p className="mt-1 text-amber-100/80">{application.rejection_reason}</p>
                </div>
            )}

            {cohort.fields.length === 0 ? (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                    Сонгосон гэрээнд суралцагчаас авах хувьсагч талбар алга. Админ гэрээний агуулгыг шалгах шаардлагатай.
                </p>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                    {cohort.fields.map((field) => {
                        const saved = application?.answers[field.key]
                        const defaultValue = saved ?? (field.key === 'student_name' ? profileName ?? '' : '')
                        return (
                            <label key={field.key} className="space-y-2 text-sm text-zinc-300">
                                <span className="font-medium">{field.label}</span>
                                <Input
                                    name={`answer:${field.key}`}
                                    required
                                    maxLength={500}
                                    defaultValue={defaultValue}
                                    autoComplete={field.key === 'signer_phone' ? 'tel' : 'off'}
                                    className="border-zinc-700 bg-zinc-900"
                                />
                                {field.description && <span className="block text-xs leading-relaxed text-zinc-500">{field.description}</span>}
                            </label>
                        )
                    })}
                </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-5">
                <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => saveCohortApplicationDraft(cohort.cohort_id, formData()))}
                >
                    <Save className="mr-2 h-4 w-4" />Ноорог хадгалах
                </Button>
                <Button
                    type="button"
                    disabled={pending || cohort.fields.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => {
                        if (formRef.current?.reportValidity()) {
                            run(() => submitCohortApplication(cohort.cohort_id, formData()))
                        }
                    }}
                >
                    <Send className="mr-2 h-4 w-4" />{pending ? 'Хадгалж байна…' : 'Өргөдөл илгээх'}
                </Button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-emerald-400">{message}</p>}
        </form>
    )
}
