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
    updateTrainingCohortConfiguration,
    updateTrainingCohortDraft,
    updateTrainingProgram,
    type OfferingCourseOption,
    type PublishedContractOption,
    type TrainingCohort,
    type TrainingProgramDetail,
} from '@/features/admin/actions/training-program-actions.admin'
import {
    allowedCohortTransitions,
    getCohortOpeningReadiness,
    type CohortOpeningIssue,
    type CohortStatus,
    type ContractPolicy,
} from '@/features/programs/domain/training-program'

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
const contractPolicyLabels: Record<ContractPolicy, string> = {
    required: 'Гэрээ шаардлагатай',
    none: 'Гэрээ шаардлагагүй',
}

function statusClass(status: CohortStatus) {
    if (status === 'open') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    if (status === 'draft') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    if (status === 'cancelled') return 'border-red-500/30 bg-red-500/10 text-red-300'
    return 'border-zinc-700 bg-zinc-900 text-zinc-300'
}

const openingIssueContent: Record<CohortOpeningIssue, { title: string; description: string }> = {
    program_archived: {
        title: 'Дараагийн алхам: сургалтыг архиваас гаргах',
        description: 'Архивласан сургалтын анги / элсэлтийг суралцагчдад нээх боломжгүй.',
    },
    unsupported_delivery_mode: {
        title: 'Дараагийн алхам: сургалтын хэлбэр сонгох',
        description: 'Шинэ нэгдсэн урсгалд онлайн эсвэл танхимын сургалтын хэлбэр сонгоно уу.',
    },
    course_not_ready: {
        title: 'Дараагийн алхам: бэлэн видео хичээл сонгох',
        description: 'Холбосон хичээл нийтлэгдсэн бөгөөд дор хаяж нэг бэлэн видео агуулгатай байх ёстой.',
    },
    contract_not_assignable: {
        title: 'Дараагийн алхам: гэрээний хувилбар сонгох',
        description: 'Гэрээ шаардлагатай тул идэвхтэй нийтлэгдсэн гэрээний хувилбар сонгоно уу.',
    },
    contract_not_allowed: {
        title: 'Дараагийн алхам: гэрээний тохиргоог цэвэрлэх',
        description: 'Гэрээ шаардлагагүй сонголтод гэрээний хувилбар холбоотой байж болохгүй. Нооргийг дахин хадгална уу.',
    },
    tuition_not_configured: {
        title: 'Дараагийн алхам: сургалтын төлбөр тохируулах',
        description: 'Сургалтын бодит төлбөрийн дүнг 0-ээс их бүхэл тоогоор оруулна уу.',
    },
    payment_deadline_not_configured: {
        title: 'Дараагийн алхам: төлөх хугацаа тохируулах',
        description: 'Төлбөртэй элсэлтэд өргөдөл зөвшөөрснөөс хойш төлөх хоногийг заавал тохируулна.',
    },
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

function FormSectionHeading({ step, title, description }: { step: number; title: string; description: string }) {
    return (
        <div className="mt-2 border-t border-zinc-800 pt-5 md:col-span-2 first:mt-0 first:border-t-0 first:pt-0">
            <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-300">{step}</span>
                <div>
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
                </div>
            </div>
        </div>
    )
}

function CohortFields({
    cohort,
    contracts,
    courses,
}: {
    cohort?: TrainingCohort
    contracts: PublishedContractOption[]
    courses: OfferingCourseOption[]
}) {
    const isLegacyCheckout = cohort?.checkout_version === 1
    const [contractPolicy, setContractPolicy] = useState<ContractPolicy | ''>(
        isLegacyCheckout ? 'required' : cohort?.contract_policy ?? '',
    )
    const [contractVersionId, setContractVersionId] = useState(cohort?.contract_version_id ?? '')
    const needsDeliveryChoice = !cohort || (!isLegacyCheckout && cohort.delivery_mode === 'hybrid')
    const deliveryDefaultValue = needsDeliveryChoice ? '' : cohort?.delivery_mode ?? ''
    const [deliveryMode, setDeliveryMode] = useState(deliveryDefaultValue)
    const selectableContracts = contracts.filter((contract) => contract.is_assignable || contract.id === cohort?.contract_version_id)
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <FormSectionHeading step={1} title="Анги / элсэлтийн үндсэн мэдээлэл" description="Суралцагчид харах нэр, үзэх контент болон сургалтын хэлбэрийг сонгоно." />
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Анги / элсэлтийн нэр</span>
                <Input name="name" required maxLength={160} defaultValue={cohort?.name} placeholder="Жишээ: TeenCoder 2026 намрын элсэлт" className="border-zinc-700 bg-zinc-900" />
            </label>
            {isLegacyCheckout ? (
                <input type="hidden" name="course_id" value="" />
            ) : (
                <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                    <span>Хичээлийн контент</span>
                    <select name="course_id" defaultValue={cohort?.course_id ?? ''} className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                        <option value="">Одоогоор сонгохгүй</option>
                        {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.title}{course.is_ready_for_offering ? ' · бэлэн' : course.published ? ' · бэлэн видео дутуу' : ' · ноорог'}
                            </option>
                        ))}
                    </select>
                    <span className="block text-xs leading-relaxed text-zinc-500">Төлбөр батлагдсаны дараа суралцагчид нээгдэх контентыг сонгоно. Нэг контентыг олон анги / элсэлтэд ашиглаж болно.</span>
                    <span className="block rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200">
                        Ноорог дээр хичээл сонгох нь буцааж өөрчлөх боломжтой. Хэрэв сонгосон хичээл шинэ элсэлтийн урсгалд хараахан шилжээгүй бол анхны нээлтээр хуучин шууд төлбөрийн урсгал бүрмөсөн хаагдаж, цаашид зөвхөн элсэлтийн сонголтоор бүртгэнэ.
                    </span>
                </label>
            )}
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалтын хэлбэр</span>
                <select name="delivery_mode" required value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value)} className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                    {needsDeliveryChoice && <option value="" disabled>{cohort ? 'Онлайн эсвэл танхим сонгох' : 'Сургалтын хэлбэр сонгох'}</option>}
                    <option value="offline">Танхим</option>
                    <option value="online">Онлайн</option>
                    {isLegacyCheckout && <option value="hybrid">Хосолсон · хуучин урсгал</option>}
                </select>
            </label>
            <FormSectionHeading step={2} title="Гэрээ" description="Гэрээ шаардах эсэхийг сонгоно. Шаардлагатай бол зөвхөн нийтлэгдсэн хувилбар ашиглана." />
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Гэрээ шаардах эсэх</span>
                {isLegacyCheckout ? (
                    <>
                        <input type="hidden" name="contract_policy" value="required" />
                        <span className="flex h-10 items-center rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                            Одоогийн гэрээтэй урсгал
                        </span>
                    </>
                ) : (
                    <select
                        name="contract_policy"
                        required
                        value={contractPolicy}
                        onChange={(event) => {
                            const nextPolicy = event.target.value as ContractPolicy
                            setContractPolicy(nextPolicy)
                            if (nextPolicy === 'none') setContractVersionId('')
                        }}
                        className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                    >
                        {!cohort && <option value="" disabled>Гэрээний бодлого сонгох</option>}
                        <option value="required">Гэрээ шаардлагатай</option>
                        <option value="none">Гэрээ шаардлагагүй</option>
                    </select>
                )}
                <span className="block text-xs leading-relaxed text-zinc-500">
                    {isLegacyCheckout
                        ? 'Энэ элсэлт одоо ажиллаж буй гэрээ, төлбөрийн урсгалаа өөрчлөхгүй хадгална.'
                        : contractPolicy === ''
                            ? 'Суралцагч төлбөр төлөхөөс өмнө гэрээ зөвшөөрөх шаардлагатай эсэхийг сонгоно уу.'
                            : contractPolicy === 'required'
                            ? 'Суралцагч төлбөрийн баримт илгээхээс өмнө сонгосон гэрээг зөвшөөрнө.'
                            : 'Суралцагч гэрээгүйгээр төлбөрийн баримтаа шууд илгээнэ.'}
                </span>
            </label>
            {contractPolicy === 'required' && (
                <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                    <span>Гэрээний нийтлэгдсэн хувилбар</span>
                    <select name="contract_version_id" value={contractVersionId} onChange={(event) => setContractVersionId(event.target.value)} className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                        <option value="">Одоогоор сонгохгүй</option>
                        {selectableContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.template_name} · v{contract.version_number} · {contract.title}{contract.is_assignable ? '' : ' · ашиглалтаас гарсан'}</option>)}
                    </select>
                </label>
            )}
            {contractPolicy === 'none' && <input type="hidden" name="contract_version_id" value="" />}
            <FormSectionHeading step={3} title="Үнэ ба бүртгэл" description="Үнэ, суралцагчийн тоо, төлбөрийн хугацаа болон бүртгэл нээлттэй байх хугацааг тохируулна." />
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Ангийн суралцагчийн тоо (мэдээллийн)</span>
                <Input name="capacity" type="number" min={1} step={1} defaultValue={(cohort?.checkout_version === 2 ? cohort.display_capacity : cohort?.capacity) ?? ''} placeholder="Жишээ: 20" className="border-zinc-700 bg-zinc-900" />
                <span className="block text-xs leading-relaxed text-zinc-500">Суралцагчдад ангийн хэмжээг мэдээлнэ. Шинэ нэгдсэн урсгалд энэ тоо бүртгэлийг автоматаар хаахгүй.</span>
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалтын төлбөр (₮)</span>
                <Input name="tuition_amount_mnt" type="number" min={isLegacyCheckout ? 0 : 1} step={1} defaultValue={cohort?.tuition_amount_mnt ?? ''} placeholder="Жишээ: 450000" className="border-zinc-700 bg-zinc-900" />
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
            <FormSectionHeading step={4} title="Хуваарь ба байршил" description="Сургалтын эхлэх, дуусах өдөр болон суралцагчид харах хуваарийг оруулна." />
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
            {isLegacyCheckout || deliveryMode === 'offline' ? (
                <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                    <span>Танхимын байршил</span>
                    <Textarea name="location" required={!isLegacyCheckout} maxLength={1_000} defaultValue={cohort?.location} placeholder="Жишээ: Twin Tower 1, 5 давхар, 505 тоот" className="min-h-20 border-zinc-700 bg-zinc-900" />
                </label>
            ) : (
                <input type="hidden" name="location" value="" />
            )}
            <FormSectionHeading step={5} title="Нэмэлт нөхцөл" description="Зөвхөн нийтэд харуулах шаардлагатай нэмэлт төлбөрийн тайлбар байвал оруулна." />
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Төлбөрийн нөхцөл</span>
                <Textarea name="payment_plan" maxLength={1_000} defaultValue={cohort?.payment_plan} placeholder="Жишээ: Төлбөрийг бүтнээр шилжүүлнэ" className="min-h-20 border-zinc-700 bg-zinc-900" />
            </label>
        </div>
    )
}

function ConfigurableOfferingFields({ cohort }: { cohort: TrainingCohort }) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="configuration_revision" value={cohort.configuration_revision} />
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Анги / элсэлтийн нэр</span>
                <Input name="name" required maxLength={160} defaultValue={cohort.name} className="border-zinc-700 bg-zinc-950" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Ангийн суралцагчийн тоо (мэдээллийн)</span>
                <Input name="capacity" type="number" min={1} step={1} defaultValue={cohort.display_capacity ?? ''} placeholder="Жишээ: 20" className="border-zinc-700 bg-zinc-950" />
                <span className="block text-xs leading-relaxed text-zinc-500">Энэ нь зөвхөн нийтэд харагдах мэдээлэл бөгөөд бүртгэлийг автоматаар хаахгүй.</span>
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалтын төлбөр (₮)</span>
                <Input name="tuition_amount_mnt" type="number" min={1} step={1} required defaultValue={cohort.tuition_amount_mnt ?? ''} className="border-zinc-700 bg-zinc-950" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Өргөдөл зөвшөөрснөөс хойш төлөх хугацаа (хоног)</span>
                <Input name="payment_due_days" type="number" min={1} step={1} required defaultValue={cohort.payment_due_days ?? ''} className="border-zinc-700 bg-zinc-950" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Бүртгэл нээх хугацаа</span>
                <Input name="registration_opens_at" type="datetime-local" defaultValue={localDateTime(cohort.registration_opens_at)} className="border-zinc-700 bg-zinc-950" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Бүртгэл хаах хугацаа</span>
                <Input name="registration_closes_at" type="datetime-local" defaultValue={localDateTime(cohort.registration_closes_at)} className="border-zinc-700 bg-zinc-950" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалт эхлэх өдөр</span>
                <Input name="starts_on" type="date" defaultValue={cohort.starts_on ?? ''} className="border-zinc-700 bg-zinc-950" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
                <span>Сургалт дуусах өдөр</span>
                <Input name="ends_on" type="date" defaultValue={cohort.ends_on ?? ''} className="border-zinc-700 bg-zinc-950" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Хуваарийн тайлбар</span>
                <Textarea name="schedule_summary" maxLength={2_000} defaultValue={cohort.schedule_summary} className="min-h-20 border-zinc-700 bg-zinc-950" />
            </label>
            {cohort.delivery_mode === 'offline' ? (
                <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                    <span>Танхимын байршил</span>
                    <Textarea name="location" required maxLength={1_000} defaultValue={cohort.location} className="min-h-20 border-zinc-700 bg-zinc-950" />
                </label>
            ) : <input type="hidden" name="location" value="" />}
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Төлбөрийн нөхцөл</span>
                <Textarea name="payment_plan" maxLength={1_000} defaultValue={cohort.payment_plan} className="min-h-20 border-zinc-700 bg-zinc-950" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Өөрчлөлтийн шалтгаан</span>
                <Textarea name="change_reason" required minLength={5} maxLength={500} placeholder="Жишээ: 2026 намрын хуваарь болон үнийг шинэчлэв" className="min-h-20 border-zinc-700 bg-zinc-950" />
                <span className="block text-xs leading-relaxed text-zinc-500">Аудитын түүхэнд хадгалагдана. Өмнө хүсэлт илгээсэн суралцагчдын нөхцөл өөрчлөгдөхгүй.</span>
            </label>
        </div>
    )
}

export function TrainingProgramEditor({
    program,
    contracts,
    courses,
}: {
    program: TrainingProgramDetail
    contracts: PublishedContractOption[]
    courses: OfferingCourseOption[]
}) {
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
        if (!confirm(`“${program.name}” сургалтыг устгах уу?`)) return
        await run('delete-program', async () => {
            await deleteTrainingProgram(program.id)
            router.push('/admin/programs')
        })
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8">
            <header className="space-y-4">
                <Link href="/admin/programs" className="inline-flex items-center text-sm text-zinc-400 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />Сургалтууд</Link>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold text-white sm:text-3xl">{program.name}</h1>
                            {program.is_archived && <Badge variant="outline" className="border-zinc-700 text-zinc-400"><Archive className="mr-1 h-3 w-3" />Архив</Badge>}
                        </div>
                        <p className="mt-2 text-zinc-400">Сургалтын ерөнхий мэдээлэл болон анги / элсэлт бүрийн нөхцөлийг удирдана.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline"><Link href="/admin/courses">Хичээлийн контент</Link></Button>
                        <Button asChild variant="outline"><Link href="/admin/contracts"><FileSignature className="mr-2 h-4 w-4" />Гэрээний сан</Link></Button>
                        <Button variant="outline" disabled={!!pending} onClick={() => void run('archive', () => setTrainingProgramArchived(program.id, !program.is_archived))}>
                            <Archive className="mr-2 h-4 w-4" />{program.is_archived ? 'Архиваас гаргах' : 'Архивлах'}
                        </Button>
                    </div>
                </div>
            </header>

            {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader><CardTitle>Сургалтын ерөнхий мэдээлэл</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={saveProgram} className="grid gap-4">
                        <label className="space-y-2 text-sm text-zinc-300"><span>Нэр</span><Input name="name" required maxLength={160} defaultValue={program.name} className="border-zinc-700 bg-zinc-900" /></label>
                        <label className="space-y-2 text-sm text-zinc-300"><span>Тайлбар</span><Textarea name="description" maxLength={2_000} defaultValue={program.description} className="min-h-24 border-zinc-700 bg-zinc-900" /></label>
                        <div className="flex flex-wrap justify-between gap-3">
                            {program.cohorts.length === 0 ? <Button type="button" variant="ghost" disabled={!!pending} onClick={() => void removeProgram()} className="text-zinc-400 hover:text-red-400"><Trash2 className="mr-2 h-4 w-4" />Устгах</Button> : <span />}
                            <Button disabled={!!pending} className="bg-indigo-600 text-white hover:bg-indigo-700"><PencilLine className="mr-2 h-4 w-4" />Хадгалах</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-indigo-500/20 bg-indigo-500/5 text-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-indigo-400" />Шинэ анги / элсэлт нээх дараалал</CardTitle>
                    <CardDescription className="text-zinc-400">Доорх дөрвөн алхмыг дуусгасны дараа л суралцагчдад нээнэ.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ol className="grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
                        <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"><strong className="block text-white">1. Контент бэлтгэх</strong><span className="mt-1 block text-zinc-500">Видео хичээл, preview болон ангиллыг “Хичээлийн контент” хэсэгт бэлтгэнэ.</span></li>
                        <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"><strong className="block text-white">2. Анги / элсэлт үүсгэх</strong><span className="mt-1 block text-zinc-500">Онлайн эсвэл танхим, үнэ, хугацаа, хуваарь болон контентыг сонгоно.</span></li>
                        <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"><strong className="block text-white">3. Гэрээ ба төлбөрийг шалгах</strong><span className="mt-1 block text-zinc-500">Гэрээ шаардлагатай бол нийтлэгдсэн хувилбар холбоод урсгалыг preview-ээр шалгана.</span></li>
                        <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"><strong className="block text-white">4. Суралцагчдад нээх</strong><span className="mt-1 block text-zinc-500">Бэлэн байдлын шалгалт амжилттай үед анги / элсэлтийг нээнэ.</span></li>
                    </ol>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold text-white">Анги / элсэлтүүд</h2>
                    <p className="mt-1 text-sm text-zinc-500">Нийт {program.cohorts.length} анги / элсэлт байна.</p>
                </div>
                {program.cohorts.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">Одоогоор анги / элсэлт үүсгээгүй байна.</div> : program.cohorts.map((cohort) => {
                    const contract = contracts.find((item) => item.id === cohort.contract_version_id)
                    const linkedCourse = courses.find((item) => item.id === cohort.course_id)
                    const courseIsReady = linkedCourse?.is_ready_for_offering === true
                    const isLegacyCheckout = cohort.checkout_version === 1
                    const openingReadiness = getCohortOpeningReadiness({
                        checkoutVersion: cohort.checkout_version,
                        deliveryMode: cohort.delivery_mode,
                        contractPolicy: cohort.contract_policy,
                        hasContractVersion: cohort.contract_version_id !== null,
                        contractVersionIsAssignable: contract?.is_assignable === true,
                        courseIsReady: isLegacyCheckout || courseIsReady,
                        tuitionAmountMnt: cohort.tuition_amount_mnt,
                        paymentDueDays: cohort.payment_due_days,
                        programIsArchived: program.is_archived,
                    })
                    const canOpen = openingReadiness.isReady
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
                                    <p><span className="block text-xs text-zinc-600">Ангийн хэмжээ</span>{(isLegacyCheckout ? cohort.capacity : cohort.display_capacity) ?? 'Тодорхойгүй'}{!isLegacyCheckout ? ' · мэдээллийн' : ''}</p>
                                    <p><span className="block text-xs text-zinc-600">Төлбөр</span>{cohort.tuition_amount_mnt == null ? 'Тодорхойгүй' : `₮ ${cohort.tuition_amount_mnt.toLocaleString()}`}</p>
                                    <p><span className="block text-xs text-zinc-600">Төлөх хугацаа</span>{cohort.payment_due_days == null ? 'Тохируулаагүй' : `${cohort.payment_due_days} хоног`}</p>
                                    <p className="sm:col-span-2"><span className="block text-xs text-zinc-600">Ашиглах урсгал</span>{isLegacyCheckout ? 'Одоогийн баталгаажсан урсгал' : 'Шинэ нэгдсэн урсгал'}</p>
                                    {!isLegacyCheckout && <p className="sm:col-span-2"><span className="block text-xs text-zinc-600">Хичээлийн контент</span>{linkedCourse?.title ?? 'Сонгоогүй'}</p>}
                                    <p className="sm:col-span-2"><span className="block text-xs text-zinc-600">Гэрээ</span>{contractPolicyLabels[cohort.contract_policy]}{cohort.contract_policy === 'required' ? ` · ${contract?.is_assignable ? `${contract.template_name} · v${contract.version_number}` : contract ? `${contract.template_name} · v${contract.version_number} · ашиглалтаас гарсан` : cohort.contract_version_id ? 'ашиглалтаас гарсан хувилбар' : 'хувилбар сонгоогүй'}` : ''}</p>
                                </div>

                                {!isLegacyCheckout && cohort.status !== 'draft' && ['open', 'closed'].includes(cohort.status) && (
                                    <details className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                                        <summary className="cursor-pointer text-sm font-medium text-indigo-200">Ирээдүйн элсэгчдэд харагдах нөхцөлийг засах</summary>
                                        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100">
                                            Энд хадгалсан үнэ, хугацаа, хуваарь болон байршил зөвхөн дараа нь хүсэлт илгээх суралцагчдад үйлчилнэ. Одоо байгаа хүсэлт, гэрээ, төлбөрийн нөхцөл өөрчлөгдөхгүй. Хичээлийн контент, сургалтын хэлбэр, гэрээний бодлогыг нээсний дараа солихгүй.
                                        </div>
                                        <form
                                            onSubmit={(event) => {
                                                event.preventDefault()
                                                void run(`${cohort.id}-configuration`, () => updateTrainingCohortConfiguration(cohort.id, program.id, normalizedFormData(event.currentTarget)))
                                            }}
                                            className="mt-5 space-y-5"
                                        >
                                            <ConfigurableOfferingFields key={`${cohort.id}:${cohort.configuration_revision}`} cohort={cohort} />
                                            <div className="flex justify-end">
                                                <Button type="submit" variant="outline" disabled={!!pending}>Шинэ нөхцөлийг хадгалах</Button>
                                            </div>
                                        </form>
                                    </details>
                                )}

                                {cohort.status === 'draft' && (
                                    <div className={`rounded-xl border p-4 ${canOpen ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
                                        <div className="flex items-start gap-3">
                                            {canOpen ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <FileSignature className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-white">
                                                    {openingReadiness.isReady
                                                        ? isLegacyCheckout
                                                            ? 'Дараагийн алхам: маягтыг эцэслэн шалгах'
                                                            : 'Элсэлт нээхэд бэлэн'
                                                        : openingIssueContent[openingReadiness.issues[0]!].title}
                                                </p>
                                                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                                                    {openingReadiness.isReady
                                                        ? isLegacyCheckout
                                                            ? 'Нийтлэгдсэн гэрээ, төлбөрийн нөхцөл бэлэн байна. Элсэлт нээхийн өмнө суралцагч болон асран хамгаалагчийн харагдацыг шалгана уу.'
                                                            : `Видео хичээл, ${cohort.contract_policy === 'required' ? 'гэрээ, ' : ''}төлбөрийн нөхцөл бүрэн бэлэн байна.`
                                                        : openingIssueContent[openingReadiness.issues[0]!].description}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <Button asChild variant="outline">
                                                        <Link href={`/admin/programs/${program.id}/cohorts/${cohort.id}/preview`}>
                                                            <Eye className="mr-2 h-4 w-4" />Маягт, гэрээг урьдчилан харах
                                                        </Link>
                                                    </Button>
                                                    {cohort.contract_policy === 'required' && !contract?.is_assignable && <Button asChild variant="ghost"><Link href="/admin/contracts"><FileSignature className="mr-2 h-4 w-4" />Гэрээний сан</Link></Button>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {cohort.status === 'draft' && (
                                    <details className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                                        <summary className="cursor-pointer text-sm font-medium text-zinc-200">Ноорог засах</summary>
                                        <form onSubmit={(event) => { event.preventDefault(); void saveCohort(cohort, event.currentTarget) }} className="mt-5 space-y-5">
                                            <CohortFields key={`${cohort.id}:${cohort.updated_at}`} cohort={cohort} contracts={contracts} courses={courses} />
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
                                            <Button key={next} variant={next === 'cancelled' ? 'ghost' : 'outline'} disabled={!!pending || (next === 'open' && !canOpen)} onClick={() => {
                                                const confirmed = next === 'cancelled'
                                                    ? confirm(`“${cohort.name}” элсэлтийг цуцлах уу? Энэ үйлдлийг буцаах боломжгүй.`)
                                                    : next === 'open' && cohort.checkout_version === 2
                                                        ? confirm(`“${cohort.name}” элсэлтийг нээх үү?\n\nХэрэв “${linkedCourse?.title ?? 'сонгосон хичээл'}” хичээл шинэ урсгалд хараахан шилжээгүй бол энэ нээлтээр бүрмөсөн шилжинэ. Шилжсэн хичээлийн хуучин шууд төлбөрийн урсгалыг дараа нь дахин нээхгүй.`)
                                                        : true
                                                if (!confirmed) return
                                                void run(`${cohort.id}-${next}`, () => changeTrainingCohortStatus(cohort.id, program.id, next))
                                            }} className={next === 'cancelled' ? 'text-zinc-400 hover:text-red-400' : ''}>
                                                {next === 'open' ? <CalendarDays className="mr-2 h-4 w-4" /> : null}{transitionLabels[next]}
                                            </Button>
                                        ))}
                                        {cohort.status === 'draft' && !canOpen && <span className="text-xs text-amber-300">Дээрх бэлтгэлийн алхмыг дуусгасны дараа элсэлт нээнэ.</span>}
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
                        <span className="flex items-center gap-2 text-lg font-semibold"><Plus className="h-5 w-5 text-indigo-400" />Шинэ анги / элсэлт үүсгэх</span>
                        <span className="mt-2 block text-sm text-zinc-500">Энэ сургалтын шинэ хугацаа, үнэ эсвэл хэлбэртэй анги нээх үед ашиглана.</span>
                    </summary>
                    <div className="border-t border-zinc-800 p-6">
                        {!contracts.some((contract) => contract.is_assignable) && <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Нийтлэгдсэн идэвхтэй гэрээ алга. Гэрээ шаардлагатай анги / элсэлт нээх бол эхлээд <Link href="/admin/contracts" className="underline">гэрээний сангаас</Link> хувилбар нийтэлнэ үү.</p>}
                        <form onSubmit={addCohort} className="space-y-5">
                            <CohortFields key={program.cohorts.length} contracts={contracts} courses={courses} />
                            <div className="flex justify-end"><Button disabled={!!pending} className="bg-indigo-600 text-white hover:bg-indigo-700"><Plus className="mr-2 h-4 w-4" />{pending === 'new-cohort' ? 'Үүсгэж байна…' : 'Ноорог үүсгэх'}</Button></div>
                        </form>
                    </div>
                </details>
            )}

            <p className="flex items-center gap-2 text-xs text-zinc-600"><FileSignature className="h-4 w-4" />Нийтлэгдсэн гэрээний хувилбар өөрчлөгдөхгүй бөгөөд элсэлт бүр яг сонгосон хувилбараа хадгална.</p>
        </div>
    )
}
