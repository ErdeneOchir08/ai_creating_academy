'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle2, Clock3, Mail, Search, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    reviewCohortApplication,
    type AdminCohortApplication,
} from '@/features/admin/actions/cohort-application-actions.admin'
import type { CohortApplicationStatus } from '@/features/programs/domain/cohort-application'

const tabs: Array<{ value: 'all' | CohortApplicationStatus; label: string }> = [
    { value: 'all', label: 'Бүгд' },
    { value: 'submitted', label: 'Шинэ' },
    { value: 'approved', label: 'Зөвшөөрсөн' },
    { value: 'rejected', label: 'Буцаасан' },
    { value: 'draft', label: 'Ноорог' },
    { value: 'withdrawn', label: 'Татсан' },
]

const statusLabels: Record<CohortApplicationStatus, string> = {
    draft: 'Ноорог', submitted: 'Хянах', approved: 'Зөвшөөрсөн', rejected: 'Буцаасан', withdrawn: 'Буцаан татсан',
}
export function CohortApplicationInbox({
    applications,
    variableLabels,
}: {
    applications: AdminCohortApplication[]
    variableLabels: Record<string, string>
}) {
    const [activeTab, setActiveTab] = useState<'all' | CohortApplicationStatus>('submitted')
    const [query, setQuery] = useState('')
    const [reasons, setReasons] = useState<Record<string, string>>({})
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const filtered = useMemo(() => applications.filter((application) => {
        if (activeTab !== 'all' && application.status !== activeTab) return false
        const haystack = [
            application.applicant?.display_name,
            application.contact_email,
            application.cohort?.name,
            application.cohort?.program?.name,
            ...Object.values(application.answers),
        ].filter(Boolean).join(' ').toLowerCase()
        return !query.trim() || haystack.includes(query.trim().toLowerCase())
    }), [activeTab, applications, query])

    function decide(application: AdminCohortApplication, decision: 'approved' | 'rejected') {
        setError(null)
        setMessage(null)
        startTransition(async () => {
            try {
                const result = await reviewCohortApplication(application.id, decision, reasons[application.id])
                setMessage(result.success)
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Үйлдлийг гүйцэтгэж чадсангүй.')
            }
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveTab(tab.value)}
                            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${activeTab === tab.value ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-zinc-800 text-zinc-500 hover:text-white'}`}
                        >
                            {tab.label} <span className="ml-1 text-xs">{tab.value === 'all' ? applications.length : applications.filter((item) => item.status === tab.value).length}</span>
                        </button>
                    ))}
                </div>
                <label className="relative block lg:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Нэр, и-мэйл, хөтөлбөрөөр хайх" className="border-zinc-800 bg-zinc-950 pl-9" />
                </label>
            </div>

            {message && <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
            {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500">Энэ төлөвт өргөдөл алга.</div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((application) => (
                        <article key={application.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
                            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-lg font-semibold text-white">{application.applicant?.display_name || application.answers.student_name || 'Суралцагч'}</h2>
                                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">{statusLabels[application.status]}</span>
                                    </div>
                                    <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500"><Mail className="h-3.5 w-3.5" />{application.contact_email}</p>
                                </div>
                                <div className="text-sm lg:text-right">
                                    <p className="font-medium text-zinc-200">{application.cohort?.program?.name} · {application.cohort?.name}</p>
                                    <p className="mt-1 text-zinc-600">{application.contract?.title} · v{application.contract?.version_number}</p>
                                </div>
                            </div>

                            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {Object.entries(application.answers).map(([key, value]) => (
                                    <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                                        <dt className="text-xs text-zinc-600">{variableLabels[key] ?? key}</dt>
                                        <dd className="mt-1 break-words text-sm text-zinc-200">{value || '—'}</dd>
                                    </div>
                                ))}
                            </dl>

                            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-zinc-800 pt-4 text-xs text-zinc-600">
                                <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Илгээсэн: {application.submitted_at ? new Date(application.submitted_at).toLocaleString('mn-MN') : '—'}</span>
                                {application.cohort?.tuition_amount_mnt != null && <span>Төлбөр: ₮ {application.cohort.tuition_amount_mnt.toLocaleString()}</span>}
                            </div>

                            {application.status === 'submitted' && (
                                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                                    <Textarea
                                        value={reasons[application.id] ?? ''}
                                        onChange={(event) => setReasons((current) => ({ ...current, [application.id]: event.target.value }))}
                                        maxLength={2_000}
                                        placeholder="Буцаах бол шалтгааныг тодорхой бичнэ үү."
                                        className="min-h-20 border-zinc-800 bg-zinc-900"
                                    />
                                    <div className="flex gap-2 lg:flex-col">
                                        <Button disabled={pending} onClick={() => decide(application, 'approved')} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="mr-2 h-4 w-4" />Зөвшөөрөх</Button>
                                        <Button disabled={pending || !(reasons[application.id]?.trim())} variant="outline" onClick={() => decide(application, 'rejected')} className="border-red-500/30 text-red-300 hover:bg-red-500/10"><XCircle className="mr-2 h-4 w-4" />Буцаах</Button>
                                    </div>
                                </div>
                            )}

                            {application.status === 'rejected' && application.rejection_reason && (
                                <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">Шалтгаан: {application.rejection_reason}</p>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    )
}
