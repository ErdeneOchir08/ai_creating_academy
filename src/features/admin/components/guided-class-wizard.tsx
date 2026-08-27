'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CalendarDays,
    Check,
    CheckCircle2,
    Circle,
    CreditCard,
    Eye,
    GraduationCap,
    Loader2,
    MapPin,
    MonitorPlay,
    Presentation,
    Save,
    ShieldCheck,
    Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    createGuidedClassDraft,
    publishGuidedClass,
    saveGuidedClassLearning,
    saveGuidedClassPayment,
    saveGuidedClassSchedule,
    type GuidedClassDraft,
} from '@/features/admin/actions/guided-class-actions.admin'
import type {
    OfferingCourseOption,
    PublishedContractOption,
} from '@/features/admin/actions/training-program-actions.admin'
import {
    classTypeLabels,
    classTypeRules,
    type ClassType,
} from '@/features/classes/domain/class-type'
import { guidedClassReadiness } from '@/features/classes/domain/guided-class'

const classTypeCards: Array<{
    value: ClassType
    title: string
    description: string
    detail: string
    icon: typeof MonitorPlay
}> = [
    {
        value: 'self_paced_online',
        title: 'Онлайн · бие даан',
        description: 'Багшгүй, гэрээгүй, видео хичээлээ өөрийн хурдаар үзнэ.',
        detail: 'QPay төлөгдвөл хичээл автоматаар нээгдэнэ.',
        icon: MonitorPlay,
    },
    {
        value: 'instructor_led_online',
        title: 'Онлайн · багштай',
        description: 'Багшийн хуваарьтай онлайн анги. Гэрээ шаардлагатай.',
        detail: 'Видео хичээл болон онлайн уулзалтыг хамтад нь ашиглана.',
        icon: Users,
    },
    {
        value: 'offline_with_video',
        title: 'Танхим + видео',
        description: 'Танхимд багштай сураад видео хичээл давхар үзнэ.',
        detail: 'Гэрээ, хуваарь болон танхимын байршил шаардлагатай.',
        icon: Presentation,
    },
]

const steps = [
    { number: 1, label: 'Төрөл ба нэр' },
    { number: 2, label: 'Видео хичээл' },
    { number: 3, label: 'Хуваарь' },
    { number: 4, label: 'Гэрээ ба төлбөр' },
    { number: 5, label: 'Шалгаж нийтлэх' },
]

function localDateTime(value: string | null) {
    if (!value) return ''
    const date = new Date(value)
    const pad = (number: number) => String(number).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function WizardHeader({ currentStep, classId }: { currentStep: number; classId?: string }) {
    return (
        <>
            <header className="space-y-4">
                <Link href="/admin/classes" className="inline-flex items-center text-sm text-zinc-400 hover:text-white">
                    <ArrowLeft className="mr-2 h-4 w-4" />Ангиуд
                </Link>
                <div>
                    <div className="flex items-center gap-3">
                        <GraduationCap className="h-8 w-8 text-indigo-400" />
                        <h1 className="text-2xl font-bold text-white sm:text-3xl">Шинэ анги үүсгэх</h1>
                    </div>
                    <p className="mt-2 text-zinc-400">Таван богино алхам. Алхам бүрийн дараа ноорог автоматаар хадгалагдана.</p>
                </div>
            </header>

            <nav className="grid gap-2 sm:grid-cols-5" aria-label="Анги үүсгэх алхам">
                {steps.map((step) => {
                    const active = currentStep === step.number
                    const complete = currentStep > step.number
                    const content = (
                        <span className={`flex h-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs transition-colors ${active ? 'border-indigo-500 bg-indigo-500/10 text-white' : complete ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${active ? 'bg-indigo-600 text-white' : complete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-900'}`}>
                                {complete ? <Check className="h-3.5 w-3.5" /> : step.number}
                            </span>
                            <span>{step.label}</span>
                        </span>
                    )
                    if (classId && step.number >= 2) {
                        return <Link key={step.number} href={`/admin/classes/${classId}/setup?step=${step.number}`}>{content}</Link>
                    }
                    return <span key={step.number}>{content}</span>
                })}
            </nav>
        </>
    )
}

export function GuidedClassStarter() {
    const router = useRouter()
    const [classType, setClassType] = useState<ClassType>('self_paced_online')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')

    async function createDraft(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setPending(true)
        try {
            const data = new FormData(event.currentTarget)
            data.set('class_type', classType)
            const result = await createGuidedClassDraft(data)
            router.push(`/admin/classes/${result.classId}/setup?step=2`)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Ангийн ноорог үүсгэж чадсангүй.')
            setPending(false)
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-7 p-5 sm:p-8">
            <WizardHeader currentStep={1} />
            {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
            <form onSubmit={createDraft} className="space-y-6">
                <Card className="border-zinc-800 bg-zinc-950 text-white">
                    <CardHeader>
                        <CardTitle>1. Ангийн төрлөө сонгоно уу</CardTitle>
                        <CardDescription className="text-zinc-400">Энэ сонголтоор гэрээ, хуваарь болон байршлын шаардлага автоматаар тохирно.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-3">
                        {classTypeCards.map((option) => {
                            const Icon = option.icon
                            const selected = classType === option.value
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setClassType(option.value)}
                                    aria-pressed={selected}
                                    className={`rounded-2xl border p-5 text-left transition-colors ${selected ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                                >
                                    <span className="flex items-start justify-between gap-3">
                                        <Icon className={selected ? 'h-6 w-6 text-indigo-300' : 'h-6 w-6 text-zinc-500'} />
                                        {selected ? <CheckCircle2 className="h-5 w-5 text-indigo-300" /> : <Circle className="h-5 w-5 text-zinc-700" />}
                                    </span>
                                    <strong className="mt-4 block text-white">{option.title}</strong>
                                    <span className="mt-2 block text-sm leading-6 text-zinc-400">{option.description}</span>
                                    <span className="mt-3 block text-xs leading-5 text-zinc-500">{option.detail}</span>
                                </button>
                            )
                        })}
                    </CardContent>
                </Card>

                <Card className="border-zinc-800 bg-zinc-950 text-white">
                    <CardHeader>
                        <CardTitle>2. Нэр ба тайлбар</CardTitle>
                        <CardDescription className="text-zinc-400">Суралцагчид харах энгийн, ойлгомжтой мэдээлэл.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span>Ангийн нэр *</span>
                            <Input name="name" required maxLength={160} placeholder="Жишээ: AI Game Creator Level 1" className="border-zinc-700 bg-zinc-900" />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span>Товч тайлбар</span>
                            <Textarea name="description" maxLength={2_000} placeholder="Энэ ангид юу сурахыг 1–3 өгүүлбэрээр бичнэ үү." className="min-h-28 border-zinc-700 bg-zinc-900" />
                        </label>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button disabled={pending} className="bg-indigo-600 text-white hover:bg-indigo-700">
                        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Ноорог хадгалаад үргэлжлүүлэх
                    </Button>
                </div>
            </form>
        </div>
    )
}

export function GuidedClassWizard({
    draft,
    currentStep,
    courses,
    contracts,
    qpay,
}: {
    draft: GuidedClassDraft
    currentStep: number
    courses: OfferingCourseOption[]
    contracts: PublishedContractOption[]
    qpay: { enabled: boolean; environment: 'sandbox' | 'production' }
}) {
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const selectedCourse = courses.find((course) => course.id === draft.courseId)
    const selectedContract = contracts.find((contract) => contract.id === draft.contractVersionId)
    const readiness = guidedClassReadiness(draft, {
        courseReady: selectedCourse?.is_ready_for_offering === true,
        contractReady: selectedContract?.is_assignable === true,
        qpayAvailable: qpay.enabled,
    })
    const isReady = readiness.every((item) => item.complete)
    const rules = classTypeRules[draft.classType]

    async function saveStep(event: React.FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<void>, nextStep: number) {
        event.preventDefault()
        setError('')
        setPending(true)
        try {
            await action(new FormData(event.currentTarget))
            router.push(`/admin/classes/${draft.id}/setup?step=${nextStep}`)
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Алхамыг хадгалж чадсангүй.')
            setPending(false)
        }
    }

    async function publish() {
        if (!confirm(`“${draft.name}” ангийг суралцагчдад нээх үү?`)) return
        setError('')
        setPending(true)
        try {
            await publishGuidedClass(draft.id)
            router.push(`/admin/classes/${draft.id}`)
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Ангийг нийтэлж чадсангүй.')
            setPending(false)
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-7 p-5 sm:p-8">
            <WizardHeader currentStep={currentStep} classId={draft.id} />

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <strong className="text-white">{draft.name}</strong>
                <Badge className="bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/10">{classTypeLabels[draft.classType]}</Badge>
                <span className="ml-auto text-xs text-emerald-300"><Check className="mr-1 inline h-3.5 w-3.5" />Ноорог хадгалагдсан</span>
            </div>

            {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

            {currentStep === 2 && (
                <form onSubmit={(event) => void saveStep(event, (data) => saveGuidedClassLearning(draft.id, data), 3)}>
                    <Card className="border-zinc-800 bg-zinc-950 text-white">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-indigo-300" />Видео хичээл сонгох</CardTitle>
                            <CardDescription className="text-zinc-400">Төлбөр батлагдсаны дараа суралцагчид нээгдэх хичээлийн багц.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <label className="space-y-2 text-sm text-zinc-300">
                                <span>Видео хичээл *</span>
                                <select name="course_id" required defaultValue={draft.courseId ?? ''} className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                                    <option value="" disabled>Видео хичээл сонгох</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.title}{course.is_ready_for_offering ? ' · бэлэн' : course.published ? ' · бэлэн видео дутуу' : ' · ноорог'}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {courses.length === 0 && <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200">Видео хичээл алга байна. Эхлээд Видео сан хэсэгт хичээл үүсгэнэ үү.</p>}
                            <WizardButtons classId={draft.id} previous={null} pending={pending} />
                        </CardContent>
                    </Card>
                </form>
            )}

            {currentStep === 3 && (
                <form onSubmit={(event) => void saveStep(event, (data) => saveGuidedClassSchedule(draft.id, data), 4)}>
                    <Card className="border-zinc-800 bg-zinc-950 text-white">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-indigo-300" />Хугацаа ба хуваарь</CardTitle>
                            <CardDescription className="text-zinc-400">
                                {draft.classType === 'self_paced_online' ? 'Бие даан суралцах ангид тогтсон хуваарь шаардлагагүй. Хүсвэл үзэх хугацааг зааж болно.' : 'Суралцагчид яг хэзээ хичээллэхийг ойлгомжтой оруулна.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 md:grid-cols-2">
                            <label className="space-y-2 text-sm text-zinc-300">
                                <span>{draft.classType === 'self_paced_online' ? 'Хичээл нээгдэх өдөр' : 'Эхлэх өдөр *'}</span>
                                <Input name="starts_on" type="date" required={draft.classType !== 'self_paced_online'} defaultValue={draft.startsOn ?? ''} className="border-zinc-700 bg-zinc-900" />
                            </label>
                            <label className="space-y-2 text-sm text-zinc-300">
                                <span>{draft.classType === 'self_paced_online' ? 'Хичээл хаагдах өдөр' : 'Дуусах өдөр *'}</span>
                                <Input name="ends_on" type="date" required={draft.classType !== 'self_paced_online'} defaultValue={draft.endsOn ?? ''} className="border-zinc-700 bg-zinc-900" />
                            </label>
                            {draft.classType !== 'self_paced_online' && (
                                <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                                    <span>Хичээлийн хуваарь *</span>
                                    <Textarea name="schedule_summary" required maxLength={2_000} defaultValue={draft.scheduleSummary} placeholder="Жишээ: Мягмар, Пүрэв гарагт 18:00–20:00" className="min-h-24 border-zinc-700 bg-zinc-900" />
                                </label>
                            )}
                            {draft.classType === 'offline_with_video' && (
                                <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                                    <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-300" />Танхимын бүтэн байршил *</span>
                                    <Textarea name="location" required maxLength={1_000} defaultValue={draft.location} placeholder="Жишээ: Twin Tower 1, 5 давхар, 502 тоот" className="min-h-24 border-zinc-700 bg-zinc-900" />
                                </label>
                            )}
                            <div className="md:col-span-2"><WizardButtons classId={draft.id} previous={2} pending={pending} /></div>
                        </CardContent>
                    </Card>
                </form>
            )}

            {currentStep === 4 && (
                <form onSubmit={(event) => void saveStep(event, (data) => saveGuidedClassPayment(draft.id, data), 5)}>
                    <Card className="border-zinc-800 bg-zinc-950 text-white">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-indigo-300" />Гэрээ ба төлбөр</CardTitle>
                            <CardDescription className="text-zinc-400">QPay үндсэн төлбөр. Өмнөх төлбөр, нэхэмжлэлд энэ тохиргоо нөлөөлөхгүй.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 md:grid-cols-2">
                            {rules.contractPolicy === 'required' ? (
                                <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                                    <span>Нийтлэгдсэн гэрээ *</span>
                                    <select name="contract_version_id" required defaultValue={draft.contractVersionId ?? ''} className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                                        <option value="" disabled>Гэрээ сонгох</option>
                                        {contracts.filter((contract) => contract.is_assignable || contract.id === draft.contractVersionId).map((contract) => (
                                            <option key={contract.id} value={contract.id}>{contract.template_name} · v{contract.version_number} · {contract.title}</option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-100 md:col-span-2">
                                    <ShieldCheck className="mr-2 inline h-4 w-4" />Энэ төрлийн ангид гэрээ шаардлагагүй.
                                </div>
                            )}
                            <label className="space-y-2 text-sm text-zinc-300">
                                <span>Үнэ (MNT) *</span>
                                <Input name="tuition_amount_mnt" type="number" min={1} step={1} required defaultValue={draft.tuitionAmountMnt ?? ''} placeholder="Жишээ: 450000" className="border-zinc-700 bg-zinc-900" />
                            </label>
                            <label className="space-y-2 text-sm text-zinc-300">
                                <span>Төлөх хугацаа (хоног) *</span>
                                <Input name="payment_due_days" type="number" min={1} step={1} required defaultValue={draft.paymentDueDays ?? 3} className="border-zinc-700 bg-zinc-900" />
                            </label>
                            <label className="space-y-2 text-sm text-zinc-300">
                                <span>Суралцагчийн тоо</span>
                                <Input name="capacity" type="number" min={1} step={1} defaultValue={draft.capacity ?? ''} placeholder="Жишээ: 20" className="border-zinc-700 bg-zinc-900" />
                            </label>
                            <label className="space-y-2 text-sm text-zinc-300">
                                <span>Бүртгэл нээх хугацаа</span>
                                <Input name="registration_opens_at" type="datetime-local" defaultValue={localDateTime(draft.registrationOpensAt)} className="border-zinc-700 bg-zinc-900" />
                            </label>
                            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                                <span>Бүртгэл хаах хугацаа</span>
                                <Input name="registration_closes_at" type="datetime-local" defaultValue={localDateTime(draft.registrationClosesAt)} className="border-zinc-700 bg-zinc-900" />
                            </label>
                            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                                <span>Төлбөрийн нэмэлт тайлбар</span>
                                <Textarea name="payment_plan" maxLength={1_000} defaultValue={draft.paymentPlan} placeholder="Хоосон орхиж болно." className="min-h-20 border-zinc-700 bg-zinc-900" />
                            </label>
                            <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 md:col-span-2">
                                <p className="font-semibold text-white">Төлбөрийн арга</p>
                                <label className="flex items-start gap-3 text-sm text-zinc-300">
                                    <input name="qpay_enabled" type="checkbox" defaultChecked={draft.qpayEnabled} className="mt-1" />
                                    <span><strong className="block text-white">QPay · үндсэн</strong>QR болон банкны апп-аар автомат баталгаажуулна. {qpay.enabled ? 'Систем бэлэн.' : 'Системийн тохиргоо одоогоор идэвхгүй.'}</span>
                                </label>
                                <label className="flex items-start gap-3 text-sm text-zinc-300">
                                    <input name="manual_transfer_enabled" type="checkbox" defaultChecked={draft.manualTransferEnabled} className="mt-1" />
                                    <span><strong className="block text-white">Банкны шилжүүлэг · нөөц арга</strong>Баримтыг админ гараар шалгана.</span>
                                </label>
                            </div>
                            <div className="md:col-span-2"><WizardButtons classId={draft.id} previous={3} pending={pending} /></div>
                        </CardContent>
                    </Card>
                </form>
            )}

            {currentStep === 5 && (
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <Card className="border-zinc-800 bg-zinc-950 text-white">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-300" />Нийтлэхийн өмнөх шалгалт</CardTitle>
                            <CardDescription className="text-zinc-400">Ногоон болсон бүх зүйл бэлэн. Дутуу зүйл дээр дарж тухайн алхам руу буцна.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {readiness.map((item) => (
                                <Link key={item.key} href={`/admin/classes/${draft.id}/setup?step=${item.step}`} className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${item.complete ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5 hover:border-amber-400/40'}`}>
                                    {item.complete ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}
                                    <span><strong className="block text-white">{item.label}</strong><span className="mt-1 block text-xs leading-5 text-zinc-400">{item.help}</span></span>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card className="border-zinc-800 bg-zinc-950 text-white">
                            <CardHeader><CardTitle className="text-lg">Ангийн товч мэдээлэл</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <Summary label="Төрөл" value={classTypeLabels[draft.classType]} />
                                <Summary label="Видео" value={selectedCourse?.title ?? 'Сонгоогүй'} />
                                <Summary label="Үнэ" value={draft.tuitionAmountMnt ? `₮ ${draft.tuitionAmountMnt.toLocaleString('mn-MN')}` : 'Тохируулаагүй'} />
                                <Summary label="Гэрээ" value={rules.contractPolicy === 'none' ? 'Шаардлагагүй' : selectedContract ? `${selectedContract.template_name} · v${selectedContract.version_number}` : 'Сонгоогүй'} />
                                <Summary label="QPay" value={draft.qpayEnabled && qpay.enabled ? 'Идэвхтэй' : 'Идэвхгүй'} />
                            </CardContent>
                        </Card>
                        <Button asChild variant="outline" className="w-full border-zinc-700">
                            <Link href={`/admin/programs/${draft.programId}/cohorts/${draft.id}/preview`}><Eye className="mr-2 h-4 w-4" />Суралцагчийн харагдац</Link>
                        </Button>
                        <Button type="button" onClick={() => void publish()} disabled={pending || !isReady} className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Ангийг нийтлэх
                        </Button>
                        {!isReady && <p className="text-center text-xs leading-5 text-amber-300">Дутуу зүйлсийг бөглөсний дараа нийтлэх товч идэвхжинэ.</p>}
                    </div>
                </div>
            )}
        </div>
    )
}

function WizardButtons({ classId, previous, pending }: { classId: string; previous: number | null; pending: boolean }) {
    return (
        <div className="flex flex-wrap justify-between gap-3 border-t border-zinc-800 pt-5">
            {previous ? (
                <Button asChild type="button" variant="ghost"><Link href={`/admin/classes/${classId}/setup?step=${previous}`}><ArrowLeft className="mr-2 h-4 w-4" />Буцах</Link></Button>
            ) : <span />}
            <Button disabled={pending} className="bg-indigo-600 text-white hover:bg-indigo-700">
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Хадгалаад үргэлжлүүлэх
            </Button>
        </div>
    )
}

function Summary({ label, value }: { label: string; value: string }) {
    return <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3 last:border-b-0 last:pb-0"><span className="text-zinc-500">{label}</span><strong className="text-right text-zinc-200">{value}</strong></div>
}
