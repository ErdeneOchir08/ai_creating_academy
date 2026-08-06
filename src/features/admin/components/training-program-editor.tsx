'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Archive, ArrowLeft, CalendarDays, CheckCircle2, Eye, FileSignature, ListChecks, PencilLine, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    changeTrainingCohortStatus,
    createTrainingCohort,
    deleteTrainingCohortDraft,
    deleteTrainingProgram,
    setTrainingProgramArchived,
    updateTrainingCohortDraft,
    updateTrainingCohortPaymentDeadline,
    updateTrainingProgram,
    type PublishedContractOption,
    type TrainingCohort,
    type TrainingProgramDetail,
} from '@/features/admin/actions/training-program-actions.admin'
import { allowedCohortTransitions, type CohortStatus } from '@/features/programs/domain/training-program'

const statusLabels: Record<CohortStatus, string> = {
    draft: 'Ноорог',
    open: 'Элсэлт нээлттэй',
    closed: 'Элсэлт хаалттай',
    in_progress: 'Явагдаж байгаа',
    completed: 'Дууссан',
    cancelled: 'Цуцлагдсан',
}

const transitionLabels: Partial<Record<CohortStatus, string>> = {
    open: 'Элсэлт нээх',
    closed: 'Элсэлт хаах',
    in_progress: 'Сургалт эхлүүлэх',
    completed: 'Дуусгах',
    cancelled: 'Цуцлах',
}

const deliveryLabels = { online: 'Онлайн', offline: 'Танхим', hybrid: 'Хосолсон' } as const

function statusClass(status: CohortStatus) {
    if (status === 'open') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    if (status === 'draft') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    if (status === 'cancelled') return 'border-red-500/30 bg-red-500/10 text-red-300'
    return 'border-zinc-700 bg-zinc-900 text-zinc-300'
}

function localDateTime(value: string | null) {
    if (!value) return ''
    const date = new Date(value)
    const pad = (number: number) => String(number).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizedFormData(form: HTMLFormElement) {
    const data = new FormData(form)
    for (const key of ['registration_opens_at', 'registration_closes_at']) {
        const value = String(data.get(key) ?? '')
        data.set(key, value ? new Date(value).toISOString() : '')
    }
    return data
}

function CohortFields({ cohort, contracts }: { cohort?: TrainingCohort; contracts: PublishedContractOption[] }) {
    const selectableContracts = contracts.filter((contract) => contract.is_assignable || contract.id === cohort?.contract_version_id)
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Элсэлтийн нэр</span>
                <Input name="name" required maxLength={160} defaultValue={cohort?.name} placeholder="Жишээ: TeenCoder 2026 намрын элсэлт" className="border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалтын хэлбэр</span>
                <select name="delivery_mode" defaultValue={cohort?.delivery_mode ?? 'offline'} className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                    <option value="offline">Танхим</option>
                    <option value="online">Онлайн</option>
                    <option value="hybrid">Хосолсон</option>
                </select>
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Гэрээний нийтлэгдсэн хувилбар</span>
                <select name="contract_version_id" defaultValue={cohort?.contract_version_id ?? ''} className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                    <option value="">Одоогоор сонгохгүй</option>
                    {selectableContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.template_name} · v{contract.version_number} · {contract.title}{contract.is_assignable ? '' : ' · ашиглалтаас гарсан'}</option>)}
                </select>
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Суудлын тоо</span>
                <Input name="capacity" type="number" min={1} step={1} defaultValue={cohort?.capacity ?? ''} placeholder="Жишээ: 20" className="border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалтын төлбөр (₮)</span>
                <Input name="tuition_amount_mnt" type="number" min={0} step={1} defaultValue={cohort?.tuition_amount_mnt ?? ''} placeholder="Жишээ: 450000" className="border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Өргөдөл зөвшөөрснөөс хойш төлөх хугацаа (хоног)</span>
                <Input name="payment_due_days" type="number" min={1} step={1} defaultValue={cohort?.payment_due_days ?? ''} placeholder="Жишээ: 3" className="border-zinc-700 bg-zinc-900" />
                <span className="block text-xs leading-relaxed text-zinc-500">Төлбөртэй элсэлтэд заавал тохируулна. Систем өргөдөл бүрийн яг төлөх эцсийн хугацааг зөвшөөрсөн мөчөөс тооцож хадгална.</span>
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Бүртгэл нээх хугацаа</span>
                <Input name="registration_opens_at" type="datetime-local" defaultValue={localDateTime(cohort?.registration_opens_at ?? null)} className="border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Бүртгэл хаах хугацаа</span>
                <Input name="registration_closes_at" type="datetime-local" defaultValue={localDateTime(cohort?.registration_closes_at ?? null)} className="border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалт эхлэх өдөр</span>
                <Input name="starts_on" type="date" defaultValue={cohort?.starts_on ?? ''} className="border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалт дуусах өдөр</span>
                <Input name="ends_on" type="date" defaultValue={cohort?.ends_on ?? ''} className="border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Хуваарийн тайлбар</span>
                <Textarea name="schedule_summary" maxLength={2_000} defaultValue={cohort?.schedule_summary} placeholder="Жишээ: Бямба, Ням гарагт 10:00–12:00" className="min-h-20 border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Байршил / онлайн мэдээлэл</span>
                <Textarea name="location" maxLength={1_000} defaultValue={cohort?.location} placeholder="Танхимын хаяг эсвэл онлайн сургалтын тайлбар" className="min-h-20 border-zinc-700 bg-zinc-900" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Төлбөрийн нөхцөл</span>
                <Textarea name="payment_plan" maxLength={1_000} defaultValue={cohort?.payment_plan} placeholder="Нэг удаа эсвэл хуваан төлөх нөхцөл" className="min-h-20 border-zinc-700 bg-zinc-900" />
            </label>
        </div>
    )
}

export function TrainingProgramEditor({ program, contracts }: { program: TrainingProgramDetail; contracts: PublishedContractOption[] }) {
    const router = useRouter()
    const [pending, setPending] = useState('')
    const [error, setError] = useState('')

    async function run(key: string, work: () => Promise<unknown>) {
        setError('')
        setPending(key)
        try {
            await work()
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Үйлдлийг гүйцэтгэж чадсангүй.')
        } finally {
            setPending('')
        }
    }

    async function saveProgram(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        await run('program', () => updateTrainingProgram(program.id, data))
    }

    async function addCohort(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = event.currentTarget
        await run('new-cohort', async () => {
            await createTrainingCohort(program.id, normalizedFormData(form))
            form.reset()
        })
    }

    async function saveCohort(cohort: TrainingCohort, form: HTMLFormElement) {
        await run(cohort.id, () => updateTrainingCohortDraft(cohort.id, program.id, normalizedFormData(form)))
    }

    async function removeProgram() {
        if (!confirm(`“${program.name}” хөтөлбөрийг устгах уу?`)) return
        await run('delete-program', async () => {
            await deleteTrainingProgram(program.id)
            router.push('/admin/programs')
        })
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8">
            <header className="space-y-4">
                <Link href="/admin/programs" className="inline-flex items-center text-sm text-zinc-400 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />Хөтөлбөрүүд</Link>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold text-white sm:text-3xl">{program.name}</h1>
                            {program.is_archived && <Badge variant="outline" className="border-zinc-700 text-zinc-400"><Archive className="mr-1 h-3 w-3" />Архив</Badge>}
                        </div>
                        <p className="mt-2 text-zinc-400">Хөтөлбөрийн мэдээлэл, элсэлтийн мөчлөг болон гэрээний хувилбарыг удирдана.</p>
                    </div>
                    <Button variant="outline" disabled={!!pending} onClick={() => void run('archive', () => setTrainingProgramArchived(program.id, !program.is_archived))}>
                        <Archive className="mr-2 h-4 w-4" />{program.is_archived ? 'Архиваас гаргах' : 'Архивлах'}
                    </Button>
                </div>
            </header>

            {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader><CardTitle>Хөтөлбөрийн үндсэн мэдээлэл</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={saveProgram} className="grid gap-4">
                        <label className="space-y-2 text-sm text-zinc-300"><span>Нэр</span><Input name="name" required maxLength={160} defaultValue={program.name} className="border-zinc-700 bg-zinc-900" /></label>
                        <label className="space-y-2 text-sm text-zinc-300"><span>Тайлбар</span><Textarea name="description" maxLength={2_000} defaultValue={program.description} className="min-h-24 border-zinc-700 bg-zinc-900" /></label>
                        <div className="flex flex-wrap justify-between gap-3">
                            {program.cohorts.length === 0 ? <Button type="button" variant="ghost" disabled={!!pending} onClick={() => void removeProgram()} className="text-zinc-400 hover:text-red-400"><Trash2 className="mr-2 h-4 w-4" />Устгах</Button> : <span />}
                            <Button disabled={!!pending} className="bg-indigo-600 hover:bg-indigo-700"><PencilLine className="mr-2 h-4 w-4" />Хадгалах</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-indigo-500/20 bg-indigo-500/5 text-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-indigo-400" />Элсэлт бэлтгэх дараалал</CardTitle>
                    <CardDescription className="text-zinc-400">Нэг элсэлтийг дараах дарааллаар бэлтгэнэ. Аль нэг алхам дутуу бол суралцагчдад харагдахгүй.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ol className="grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
                        <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"><strong className="block text-white">1. Элсэлтийн мэдээлэл</strong><span className="mt-1 block text-zinc-500">Үнэ, хугацаа, хуваарь, байршлыг ноорогт хадгална.</span></li>
                        <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"><strong className="block text-white">2. Маягт ба гэрээг шалгах</strong><span className="mt-1 block text-zinc-500">Админы урьдчилсан харагдацаар насанд хүрсэн болон хүүхдийн хувилбарыг шалгана.</span></li>
                        <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"><strong className="block text-white">3. Гэрээг батлах</strong><span className="mt-1 block text-zinc-500">Шалгасан гэрээг нийтэлж түгжээд тухайн элсэлтэд сонгоно.</span></li>
                        <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"><strong className="block text-white">4. Элсэлт нээх</strong><span className="mt-1 block text-zinc-500">Зөвхөн бүх мэдээллээ шалгасны дараа суралцагчдад нээнэ.</span></li>
                    </ol>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold text-white">Элсэлтүүд</h2>
                    <p className="mt-1 text-sm text-zinc-500">Нийт {program.cohorts.length} элсэлтийн мөчлөг байна.</p>
                </div>
                {program.cohorts.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">Одоогоор элсэлт үүсгээгүй байна.</div> : program.cohorts.map((cohort) => {
                    const contract = contracts.find((item) => item.id === cohort.contract_version_id)
                    const transitions = allowedCohortTransitions[cohort.status]
                    return (
                        <Card key={cohort.id} className="border-zinc-800 bg-zinc-950 text-white">
                            <CardHeader>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{cohort.name}</CardTitle>
                                        <CardDescription className="mt-2 text-zinc-500">{deliveryLabels[cohort.delivery_mode]}{cohort.starts_on ? ` · ${cohort.starts_on}-с` : ''}</CardDescription>
                                    </div>
                                    <Badge variant="outline" className={statusClass(cohort.status)}>{statusLabels[cohort.status]}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
                                    <p><span className="block text-xs text-zinc-600">Суудал</span>{cohort.capacity ?? 'Тодорхойгүй'}</p>
                                    <p><span className="block text-xs text-zinc-600">Төлбөр</span>{cohort.tuition_amount_mnt == null ? 'Тодорхойгүй' : `₮ ${cohort.tuition_amount_mnt.toLocaleString()}`}</p>
                                    <p><span className="block text-xs text-zinc-600">Төлөх хугацаа</span>{cohort.payment_due_days == null ? 'Тохируулаагүй' : `${cohort.payment_due_days} хоног`}</p>
                                    <p className="sm:col-span-2"><span className="block text-xs text-zinc-600">Гэрээ</span>{contract ? `${contract.template_name} · v${contract.version_number}` : cohort.contract_version_id ? 'Ашиглалтаас гарсан хувилбар' : 'Сонгоогүй'}</p>
                                </div>

                                {cohort.status !== 'draft' && ['open', 'closed'].includes(cohort.status) && (
                                    <form
                                        onSubmit={(event) => {
                                            event.preventDefault()
                                            void run(`${cohort.id}-payment-deadline`, () => updateTrainingCohortPaymentDeadline(cohort.id, program.id, new FormData(event.currentTarget)))
                                        }}
                                        className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-end"
                                    >
                                        <label className="flex-1 space-y-2 text-sm text-zinc-300">
                                            <span>Өргөдөл зөвшөөрснөөс хойш төлөх хугацаа (хоног)</span>
                                            <Input name="payment_due_days" type="number" min={1} step={1} defaultValue={cohort.payment_due_days ?? ''} required={Boolean(cohort.tuition_amount_mnt)} className="border-zinc-700 bg-zinc-950" />
                                        </label>
                                        <Button type="submit" variant="outline" disabled={!!pending}>Хугацаа хадгалах</Button>
                                    </form>
                                )}

                                {cohort.status === 'draft' && (
                                    <div className={`rounded-xl border p-4 ${contract ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
                                        <div className="flex items-start gap-3">
                                            {contract ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <FileSignature className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-white">{contract ? 'Дараагийн алхам: маягтыг эцэслэн шалгах' : 'Дараагийн алхам: гэрээний нооргийг шалгах'}</p>
                                                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                                                    {contract
                                                        ? 'Нийтлэгдсэн гэрээ сонгогдсон. Элсэлт нээхийн өмнө суралцагч болон асран хамгаалагчийн харагдацыг шалгана уу.'
                                                        : 'Одоогоор гэрээ сонгоогүй тул элсэлт нээгдэхгүй. Урьдчилсан харагдацаар бодит нооргийг шалгаад, зөв болсон үед гэрээний сангаас нийтэлнэ.'}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <Button asChild variant="outline">
                                                        <Link href={`/admin/programs/${program.id}/cohorts/${cohort.id}/preview`}>
                                                            <Eye className="mr-2 h-4 w-4" />Маягт, гэрээг урьдчилан харах
                                                        </Link>
                                                    </Button>
                                                    {!contract && <Button asChild variant="ghost"><Link href="/admin/contracts"><FileSignature className="mr-2 h-4 w-4" />Гэрээний сан</Link></Button>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {cohort.status === 'draft' && (
                                    <details className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                                        <summary className="cursor-pointer text-sm font-medium text-zinc-200">Ноорог засах</summary>
                                        <form onSubmit={(event) => { event.preventDefault(); void saveCohort(cohort, event.currentTarget) }} className="mt-5 space-y-5">
                                            <CohortFields cohort={cohort} contracts={contracts} />
                                            <div className="flex flex-wrap justify-between gap-3">
                                                <Button type="button" variant="ghost" disabled={!!pending} onClick={() => {
                                                    if (confirm(`“${cohort.name}” нооргийг устгах уу?`)) void run(cohort.id, () => deleteTrainingCohortDraft(cohort.id, program.id))
                                                }} className="text-zinc-400 hover:text-red-400"><Trash2 className="mr-2 h-4 w-4" />Ноорог устгах</Button>
                                                <Button disabled={!!pending} variant="outline"><PencilLine className="mr-2 h-4 w-4" />Ноорог хадгалах</Button>
                                            </div>
                                        </form>
                                    </details>
                                )}

                                {transitions.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
                                        {transitions.map((next) => (
                                            <Button key={next} variant={next === 'cancelled' ? 'ghost' : 'outline'} disabled={!!pending || (next === 'open' && !cohort.contract_version_id)} onClick={() => {
                                                if (next !== 'cancelled' || confirm(`“${cohort.name}” элсэлтийг цуцлах уу? Энэ үйлдлийг буцаах боломжгүй.`)) {
                                                    void run(`${cohort.id}-${next}`, () => changeTrainingCohortStatus(cohort.id, program.id, next))
                                                }
                                            }} className={next === 'cancelled' ? 'text-zinc-400 hover:text-red-400' : ''}>
                                                {next === 'open' ? <CalendarDays className="mr-2 h-4 w-4" /> : null}{transitionLabels[next]}
                                            </Button>
                                        ))}
                                        {cohort.status === 'draft' && !cohort.contract_version_id && <span className="text-xs text-amber-300">Элсэлт нээхийн өмнө гэрээ сонгоно.</span>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </section>

            {!program.is_archived && (
                <details className="rounded-xl border border-zinc-800 bg-zinc-950 text-white">
                    <summary className="cursor-pointer list-none p-6">
                        <span className="flex items-center gap-2 text-lg font-semibold"><Plus className="h-5 w-5 text-indigo-400" />Шинэ элсэлт үүсгэх</span>
                        <span className="mt-2 block text-sm text-zinc-500">Одоо байгаа элсэлтээс тусдаа шинэ элсэлтийн мөчлөг хэрэгтэй үед нээнэ.</span>
                    </summary>
                    <div className="border-t border-zinc-800 p-6">
                        {!contracts.some((contract) => contract.is_assignable) && <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Нийтлэгдсэн идэвхтэй гэрээ алга. Ноорог үүсгэж болох боловч элсэлт нээхээс өмнө <Link href="/admin/contracts" className="underline">гэрээний сангаас</Link> хувилбар нийтэлнэ үү.</p>}
                        <form onSubmit={addCohort} className="space-y-5">
                            <CohortFields contracts={contracts} />
                            <div className="flex justify-end"><Button disabled={!!pending} className="bg-indigo-600 hover:bg-indigo-700"><Plus className="mr-2 h-4 w-4" />{pending === 'new-cohort' ? 'Үүсгэж байна…' : 'Ноорог үүсгэх'}</Button></div>
                        </form>
                    </div>
                </details>
            )}

            <p className="flex items-center gap-2 text-xs text-zinc-600"><FileSignature className="h-4 w-4" />Нийтлэгдсэн гэрээний хувилбар өөрчлөгдөхгүй бөгөөд элсэлт бүр яг сонгосон хувилбараа хадгална.</p>
        </div>
    )
}
