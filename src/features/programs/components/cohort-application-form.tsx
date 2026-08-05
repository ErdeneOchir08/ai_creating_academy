'use client'

import { useDeferredValue, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileText, MailCheck, Save, ShieldCheck, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    saveCohortApplicationDraft,
    submitCohortApplication,
    withdrawCohortApplication,
} from '@/features/programs/actions/cohort-application-actions'
import {
    renderContractApplicationPreview,
    type CohortApplicationForm,
} from '@/features/programs/domain/cohort-application'
import {
    CONTRACT_SIGNATURE_STATEMENT_MN,
    getSignerRole,
    type SignerRole,
} from '@/features/programs/domain/contract-signing'

const statusLabels = {
    draft: 'Ноорог',
    submitted: 'Хянагдаж байна',
    approved: 'Зөвшөөрсөн',
    rejected: 'Буцаасан',
    withdrawn: 'Буцаан татсан',
} as const

const managedSignerFieldKeys = new Set([
    'student_birth_date',
    'signer_name',
    'signer_email',
    'signer_phone',
    'signer_registration_number',
    'signer_relationship',
    'guardian_name',
    'guardian_registration_number',
    'guardian_relationship',
])

type VerificationState = {
    maskedEmail: string
    expiresInMinutes: number
}

export function CohortApplicationEditor({
    cohort,
    profileName,
    userEmail,
    currentDate,
    hasContractSnapshot,
    mode = 'live',
}: {
    cohort: CohortApplicationForm
    profileName: string | null
    userEmail: string
    currentDate: string
    hasContractSnapshot: boolean
    mode?: 'live' | 'admin-preview'
}) {
    const previewOnly = mode === 'admin-preview'
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [verification, setVerification] = useState<VerificationState | null>(null)
    const application = cohort.my_application
    const visibleFields = useMemo(
        () => cohort.fields.filter((field) => !managedSignerFieldKeys.has(field.key)),
        [cohort.fields],
    )
    const hasRequiredStudentIdentity = cohort.fields.some((field) => field.key === 'student_name')
        && cohort.fields.some((field) => field.key === 'student_registration_number')
    const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(
        visibleFields.map((field) => [
            field.key,
            application?.answers[field.key] ?? (field.key === 'student_name' ? profileName ?? '' : ''),
        ]),
    ))
    const [studentBirthDate, setStudentBirthDate] = useState(application?.student_birth_date ?? '')
    const [signerName, setSignerName] = useState(application?.signer_name ?? '')
    const [signerEmail, setSignerEmail] = useState(application?.signer_email ?? '')
    const [signerPhone, setSignerPhone] = useState(application?.signer_phone ?? '')
    const [signerRegistrationNumber, setSignerRegistrationNumber] = useState(
        application?.signer_registration_number ?? '',
    )
    const [signerRelationship, setSignerRelationship] = useState(application?.signer_relationship ?? '')
    const [contractAccepted, setContractAccepted] = useState(false)
    const deferredAnswers = useDeferredValue(answers)
    const signerRole = useMemo<SignerRole | null>(() => {
        if (!studentBirthDate) return null
        try {
            return getSignerRole(studentBirthDate, currentDate)
        } catch {
            return null
        }
    }, [studentBirthDate, currentDate])
    const effectiveSignerEmail = signerRole === 'self' ? userEmail : signerEmail
    const effectiveSignerRegistration = signerRole === 'self'
        ? answers.student_registration_number ?? ''
        : signerRegistrationNumber
    const effectiveSignerRelationship = signerRole === 'self' ? 'Өөрөө' : signerRelationship
    const previewAnswers = useMemo(() => ({
        ...deferredAnswers,
        student_birth_date: studentBirthDate,
        signer_name: signerName,
        signer_email: effectiveSignerEmail,
        signer_phone: signerPhone,
        signer_registration_number: effectiveSignerRegistration,
        signer_relationship: effectiveSignerRelationship,
        guardian_name: signerName,
        guardian_registration_number: effectiveSignerRegistration,
        guardian_relationship: effectiveSignerRelationship,
    }), [
        deferredAnswers,
        effectiveSignerEmail,
        effectiveSignerRegistration,
        effectiveSignerRelationship,
        signerName,
        signerPhone,
        studentBirthDate,
    ])
    const contractPreview = useMemo(() => renderContractApplicationPreview(
        cohort.contract_content,
        cohort.contract_preview_values,
        previewAnswers,
        cohort.fields,
    ), [cohort.contract_content, cohort.contract_preview_values, cohort.fields, previewAnswers])
    const editable = previewOnly || cohort.is_accepting_applications
        && (!application || ['draft', 'rejected', 'withdrawn'].includes(application.status))

    function resetFeedback() {
        setError(null)
        setMessage(null)
    }

    function formData() {
        if (!formRef.current) throw new Error('Өргөдлийн маягт олдсонгүй.')
        return new FormData(formRef.current)
    }

    function saveDraft() {
        if (previewOnly) return
        resetFeedback()
        setVerification(null)
        startTransition(async () => {
            try {
                const result = await saveCohortApplicationDraft(cohort.cohort_id, formData())
                setMessage(result.success)
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Нооргийг хадгалж чадсангүй.')
            }
        })
    }

    function submitContract() {
        if (previewOnly) return
        resetFeedback()
        startTransition(async () => {
            try {
                const result = await submitCohortApplication(cohort.cohort_id, formData())
                setMessage(result.success)
                if (result.status === 'verification_required') {
                    setVerification({
                        maskedEmail: result.maskedEmail,
                        expiresInMinutes: result.expiresInMinutes,
                    })
                    return
                }

                setVerification(null)
                router.refresh()
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Гэрээг зөвшөөрч чадсангүй.')
            }
        })
    }

    function withdraw() {
        if (previewOnly || !application) return
        resetFeedback()
        startTransition(async () => {
            try {
                const result = await withdrawCohortApplication(application.id, cohort.cohort_id)
                setMessage(result.success)
                router.refresh()
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Өргөдлийг буцаан татаж чадсангүй.')
            }
        })
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
                    {visibleFields.map((field) => (
                        <ApplicationValue
                            key={field.key}
                            label={field.label}
                            value={application.answers[field.key]}
                        />
                    ))}
                    <ApplicationValue label="Суралцагчийн төрсөн огноо" value={application.student_birth_date} />
                    <ApplicationValue
                        label="Гэрээ байгуулсан тал"
                        value={application.signer_role === 'self' ? 'Суралцагч өөрөө' : 'Эцэг, эх / хууль ёсны асран хамгаалагч'}
                    />
                    <ApplicationValue label="Гарын үсэг зурсан хүний нэр" value={application.signer_name} />
                    <ApplicationValue label="Гарын үсэг зурсан хүний и-мэйл" value={application.signer_email} />
                </dl>
                {application.signed_at && (
                    <p className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-indigo-200">
                        {cohort.contract_title} гэрээний v{cohort.contract_version_number} хувилбарыг{' '}
                        {new Date(application.signed_at).toLocaleString('mn-MN')} үед зөвшөөрсөн.
                    </p>
                )}
                {application.status === 'submitted' && cohort.is_accepting_applications && (
                    <Button type="button" variant="outline" disabled={pending} onClick={withdraw}>
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
        <form
            ref={formRef}
            onSubmit={(event) => event.preventDefault()}
            className="space-y-7 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6"
        >
            {previewOnly && (
                <div role="status" className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
                    <p className="font-semibold">Админы урьдчилсан харагдац</p>
                    <p className="mt-1 leading-relaxed text-sky-100/75">
                        Энэ маягтад оруулсан мэдээлэл хадгалагдахгүй, өргөдөл үүсэхгүй, и-мэйл эсвэл баталгаажуулах код илгээгдэхгүй.
                    </p>
                </div>
            )}
            <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
                <div>
                    <h2 className="text-xl font-semibold text-white">Элсэлтийн мэдээлэл</h2>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                        Суралцагчийн мэдээллийг оруулсны дараа хэн гэрээ зөвшөөрөхийг систем автоматаар тодорхойлно.
                    </p>
                </div>
            </div>

            {application?.status === 'rejected' && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                    <p className="font-medium">Өргөдлийг засварлуулахаар буцаасан.</p>
                    <p className="mt-1 text-amber-100/80">{application.rejection_reason}</p>
                </div>
            )}

            {!hasRequiredStudentIdentity && (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                    Энэ гэрээний хувилбарт суралцагчийн нэр эсвэл регистрийн талбар дутуу байна. Элсэлт нээсэн админ гэрээний хувилбарыг засах шаардлагатай.
                </p>
            )}

            <section className="space-y-5">
                <h3 className="text-base font-semibold text-white">1. Суралцагчийн мэдээлэл</h3>
                <div className="grid gap-5 sm:grid-cols-2">
                    {visibleFields.map((field) => (
                        <label key={field.key} className="space-y-2 text-sm text-zinc-300">
                            <span className="font-medium">{field.label}</span>
                            <Input
                                name={`answer:${field.key}`}
                                required
                                maxLength={500}
                                value={answers[field.key] ?? ''}
                                onChange={(event) => {
                                    setAnswers((current) => ({ ...current, [field.key]: event.target.value }))
                                    setVerification(null)
                                }}
                                autoComplete="off"
                                className="border-zinc-700 bg-zinc-900"
                            />
                            {field.description && (
                                <span className="block text-xs leading-relaxed text-zinc-500">{field.description}</span>
                            )}
                        </label>
                    ))}
                    <label className="space-y-2 text-sm text-zinc-300">
                        <span className="font-medium">Суралцагчийн төрсөн огноо</span>
                        <Input
                            type="date"
                            name="student_birth_date"
                            required
                            max={currentDate}
                            value={studentBirthDate}
                            onChange={(event) => {
                                setStudentBirthDate(event.target.value)
                                setVerification(null)
                            }}
                            className="border-zinc-700 bg-zinc-900 [color-scheme:dark]"
                        />
                        <span className="block text-xs leading-relaxed text-zinc-500">
                            Энэ огноогоор суралцагч өөрөө эсвэл асран хамгаалагч гэрээ зөвшөөрөхийг тодорхойлно.
                        </span>
                    </label>
                </div>
            </section>

            {signerRole && (
                <section className="space-y-5 border-t border-zinc-800 pt-6">
                    <div>
                        <h3 className="text-base font-semibold text-white">2. Гэрээ зөвшөөрөх хүний мэдээлэл</h3>
                        <p className="mt-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-sm text-indigo-100">
                            {signerRole === 'self'
                                ? 'Суралцагч 18 нас хүрсэн тул гэрээг өөрөө зөвшөөрнө.'
                                : 'Суралцагч 18 нас хүрээгүй тул эцэг, эх эсвэл хууль ёсны асран хамгаалагч гэрээг зөвшөөрнө.'}
                        </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span className="font-medium">Овог нэр</span>
                            <Input
                                name="signer_name"
                                required
                                maxLength={240}
                                value={signerName}
                                onChange={(event) => {
                                    setSignerName(event.target.value)
                                    setVerification(null)
                                }}
                                autoComplete="name"
                                className="border-zinc-700 bg-zinc-900"
                            />
                            {signerRole === 'self' && (
                                <span className="block text-xs text-zinc-500">Суралцагчийн овог нэртэй ижил байна.</span>
                            )}
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span className="font-medium">Утасны дугаар</span>
                            <Input
                                name="signer_phone"
                                required
                                maxLength={50}
                                value={signerPhone}
                                onChange={(event) => {
                                    setSignerPhone(event.target.value)
                                    setVerification(null)
                                }}
                                autoComplete="tel"
                                className="border-zinc-700 bg-zinc-900"
                            />
                        </label>
                        {signerRole === 'guardian' ? (
                            <>
                                <label className="space-y-2 text-sm text-zinc-300">
                                    <span className="font-medium">И-мэйл хаяг</span>
                                    <Input
                                        type="email"
                                        name="signer_email"
                                        required
                                        maxLength={320}
                                        value={signerEmail}
                                        onChange={(event) => {
                                            setSignerEmail(event.target.value)
                                            setVerification(null)
                                        }}
                                        autoComplete="email"
                                        className="border-zinc-700 bg-zinc-900"
                                    />
                                    <span className="block text-xs text-zinc-500">Шаардлагатай үед 6 оронтой код энэ хаягт очно.</span>
                                </label>
                                <label className="space-y-2 text-sm text-zinc-300">
                                    <span className="font-medium">Регистрийн дугаар</span>
                                    <Input
                                        name="signer_registration_number"
                                        required
                                        maxLength={50}
                                        value={signerRegistrationNumber}
                                        onChange={(event) => {
                                            setSignerRegistrationNumber(event.target.value)
                                            setVerification(null)
                                        }}
                                        autoComplete="off"
                                        className="border-zinc-700 bg-zinc-900"
                                    />
                                </label>
                                <label className="space-y-2 text-sm text-zinc-300 sm:col-span-2">
                                    <span className="font-medium">Суралцагчтай ямар холбоотой вэ?</span>
                                    <select
                                        name="signer_relationship"
                                        required
                                        value={signerRelationship}
                                        onChange={(event) => {
                                            setSignerRelationship(event.target.value)
                                            setVerification(null)
                                        }}
                                        className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                                    >
                                        <option value="">Сонгоно уу</option>
                                        <option value="Эцэг">Эцэг</option>
                                        <option value="Эх">Эх</option>
                                        <option value="Хууль ёсны асран хамгаалагч">Хууль ёсны асран хамгаалагч</option>
                                    </select>
                                </label>
                            </>
                        ) : (
                            <>
                                <input type="hidden" name="signer_email" value={userEmail} />
                                <input type="hidden" name="signer_registration_number" value={effectiveSignerRegistration} />
                                <input type="hidden" name="signer_relationship" value="Өөрөө" />
                                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm sm:col-span-2">
                                    <p className="text-xs text-zinc-500">Баталгаажсан бүртгэлийн и-мэйл</p>
                                    <p className="mt-1 break-all text-zinc-200">{userEmail}</p>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            )}

            <section className="space-y-4 border-t border-zinc-800 pt-6">
                <div>
                    <h3 className="text-base font-semibold text-white">3. Гэрээг хянаж зөвшөөрөх</h3>
                    <p className="mt-1 text-sm text-zinc-500">Үндсэн мэдээллийг шалгаад шаардлагатай бол гэрээг бүтнээр нь нээнэ үү.</p>
                </div>
                <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm sm:grid-cols-2">
                    <SummaryValue label="Сургалт" value={`${cohort.program_name} · ${cohort.cohort_name}`} />
                    <SummaryValue label="Гэрээ" value={`${cohort.contract_title} · v${cohort.contract_version_number}`} />
                    <SummaryValue label="Суралцагч" value={answers.student_name} />
                    <SummaryValue
                        label="Гэрээ зөвшөөрөх тал"
                        value={signerRole === 'self' ? 'Суралцагч өөрөө' : signerRole === 'guardian' ? 'Эцэг, эх / асран хамгаалагч' : 'Төрсөн огноог оруулна уу'}
                    />
                </div>
                <details className="rounded-xl border border-zinc-800 bg-zinc-900/40">
                    <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-zinc-200">
                        Гэрээг бүтнээр нь харах
                    </summary>
                    <div className="border-t border-zinc-800 px-4 py-5 sm:px-5">
                        <p className="mb-4 text-xs leading-relaxed text-zinc-500">
                            Гэрээний дугаар болон огноо өргөдлийг админ зөвшөөрөх үед автоматаар үүснэ.
                        </p>
                        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-zinc-950 p-4 font-sans text-sm leading-7 text-zinc-300">
                            {contractPreview}
                        </pre>
                    </div>
                </details>
                <label className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-indigo-100">
                    <input
                        type="checkbox"
                        name="contract_accepted"
                        required
                        checked={contractAccepted}
                        onChange={(event) => setContractAccepted(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 accent-indigo-500"
                    />
                    <span>{CONTRACT_SIGNATURE_STATEMENT_MN}</span>
                </label>
            </section>

            {!previewOnly && verification && (
                <section className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                    <div className="flex items-start gap-3">
                        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                        <div>
                            <h3 className="font-semibold text-white">И-мэйл кодоор баталгаажуулах</h3>
                            <p className="mt-1 text-sm leading-relaxed text-emerald-100/70">
                                {verification.maskedEmail} хаягт илгээсэн 6 оронтой кодыг {verification.expiresInMinutes} минутын дотор оруулна уу.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Input
                            name="verification_code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                            aria-label="6 оронтой баталгаажуулах код"
                            className="border-emerald-500/30 bg-zinc-950 text-center text-lg tracking-[0.35em] sm:max-w-56"
                        />
                        <Button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                                if (formRef.current?.reportValidity()) submitContract()
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            <ShieldCheck className="mr-2 h-4 w-4" />Кодоор баталгаажуулах
                        </Button>
                    </div>
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                            const input = formRef.current?.elements.namedItem('verification_code')
                            if (input instanceof HTMLInputElement) input.value = ''
                            submitContract()
                        }}
                        className="text-sm text-emerald-200 underline-offset-4 hover:underline disabled:opacity-50"
                    >
                        Код дахин илгээх
                    </button>
                </section>
            )}

            {previewOnly ? (
                <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-400">
                    Бодит хэрэглэгчийн орчинд энд “Ноорог хадгалах” болон “Гэрээг зөвшөөрөх” үйлдлүүд харагдана. Урьдчилсан харагдацад эдгээр үйлдлийг зориуд идэвхгүй болгосон.
                </div>
            ) : (
                <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-5">
                    <Button type="button" variant="outline" disabled={pending} onClick={saveDraft}>
                        <Save className="mr-2 h-4 w-4" />Ноорог хадгалах
                    </Button>
                    {!verification && (
                        <Button
                            type="button"
                            disabled={pending || !signerRole || !hasRequiredStudentIdentity}
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => {
                                if (formRef.current?.reportValidity()) submitContract()
                            }}
                        >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {pending ? 'Баталгаажуулж байна…' : 'Гэрээг зөвшөөрөх'}
                        </Button>
                    )}
                </div>
            )}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
        </form>
    )
}

function ApplicationValue({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="mt-1 break-words text-sm text-zinc-200">{value || '—'}</dd>
        </div>
    )
}

function SummaryValue({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 break-words text-zinc-200">{value || '—'}</p>
        </div>
    )
}
