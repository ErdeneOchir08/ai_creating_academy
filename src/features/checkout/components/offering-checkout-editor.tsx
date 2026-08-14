'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, CircleAlert, Clock3, Copy, FileCheck2, MailCheck, Plus, ShieldCheck, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    acceptOfferingContract,
    saveOfferingCheckoutDraft,
    submitOfferingPaymentProof,
} from '@/features/checkout/actions/offering-checkout-actions'
import type {
    OfferingCheckoutForm,
    OfferingApplicantRelationship,
    SavedOfferingApplication,
} from '@/features/checkout/domain/offering-checkout'
import { renderContractApplicationPreview } from '@/features/programs/domain/cohort-application'
import {
    CONTRACT_SIGNATURE_STATEMENT_MN,
    getSignerRole,
    type SignerRole,
} from '@/features/programs/domain/contract-signing'

type VerificationState = {
    maskedEmail: string
    expiresInMinutes: number
}

type PaymentConfiguration = {
    instructions: string
    isTestMode: boolean
}

const managedContractFields = new Set([
    'student_name',
    'student_birth_date',
    'student_registration_number',
    'signer_name',
    'signer_email',
    'signer_phone',
    'signer_registration_number',
    'signer_relationship',
    'guardian_name',
    'guardian_registration_number',
    'guardian_relationship',
])

const statusLabels = {
    draft: 'Мэдээлэл дутуу',
    contract_required: 'Гэрээ зөвшөөрөх',
    ready_for_payment: 'Төлбөрийн баримт илгээх',
    pending_review: 'Админ шалгаж байна',
    correction_required: 'Баримт дахин илгээх',
    approved: 'Элсэлт баталгаажсан',
    withdrawn: 'Хүсэлт цуцлагдсан',
} as const

export function OfferingCheckoutEditor({
    checkout,
    profileName,
    userEmail,
    currentDate,
    serverNow,
    paymentConfiguration,
    initialApplicationId,
    newClientRequestId,
}: {
    checkout: OfferingCheckoutForm
    profileName: string | null
    userEmail: string
    currentDate: string
    serverNow: string
    paymentConfiguration: PaymentConfiguration
    initialApplicationId?: string
    newClientRequestId: string
}) {
    const router = useRouter()
    const detailsFormRef = useRef<HTMLFormElement>(null)
    const [pending, startTransition] = useTransition()
    const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(
        initialApplicationId ?? checkout.my_applications[0]?.application_id ?? null,
    )
    const selectedApplication = useMemo(
        () => checkout.my_applications.find((item) => item.application_id === selectedApplicationId) ?? null,
        [checkout.my_applications, selectedApplicationId],
    )
    const [clientRequestId, setClientRequestId] = useState(
        selectedApplication?.client_request_id ?? newClientRequestId,
    )
    const [learnerFullName, setLearnerFullName] = useState(
        selectedApplication?.learner.full_name ?? profileName ?? '',
    )
    const [learnerBirthDate, setLearnerBirthDate] = useState(
        selectedApplication?.learner.birth_date ?? '',
    )
    const [learnerRegistrationNumber, setLearnerRegistrationNumber] = useState(
        selectedApplication?.learner.registration_number ?? '',
    )
    const [applicantRelationship, setApplicantRelationship] = useState<OfferingApplicantRelationship>(
        selectedApplication?.applicant_relationship ?? 'self',
    )
    const [signerFullName, setSignerFullName] = useState(selectedApplication?.signer.full_name ?? '')
    const [signerEmail, setSignerEmail] = useState(selectedApplication?.signer.email ?? '')
    const [signerPhone, setSignerPhone] = useState(selectedApplication?.signer.phone ?? '')
    const [signerRegistrationNumber, setSignerRegistrationNumber] = useState(
        selectedApplication?.signer.registration_number ?? '',
    )
    const [answers, setAnswers] = useState<Record<string, string>>(selectedApplication?.answers ?? {})
    const [contractAccepted, setContractAccepted] = useState(false)
    const [verification, setVerification] = useState<VerificationState | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const visibleContractFields = useMemo(
        () => checkout.fields.filter((field) => !managedContractFields.has(field.key)),
        [checkout.fields],
    )
    const signerRole = useMemo<SignerRole | null>(() => {
        if (checkout.contract_policy !== 'required' || !learnerBirthDate) return null
        try {
            return getSignerRole(learnerBirthDate, currentDate)
        } catch {
            return null
        }
    }, [checkout.contract_policy, learnerBirthDate, currentDate])

    function loadApplication(application: SavedOfferingApplication) {
        setSelectedApplicationId(application.application_id)
        setClientRequestId(application.client_request_id)
        setLearnerFullName(application.learner.full_name)
        setLearnerBirthDate(application.learner.birth_date ?? '')
        setLearnerRegistrationNumber(application.learner.registration_number ?? '')
        setApplicantRelationship(application.applicant_relationship)
        setSignerFullName(application.signer.full_name ?? '')
        setSignerEmail(application.signer.email ?? '')
        setSignerPhone(application.signer.phone ?? '')
        setSignerRegistrationNumber(application.signer.registration_number ?? '')
        setAnswers(application.answers)
        setContractAccepted(false)
        setVerification(null)
        setMessage(null)
        setError(null)
    }

    const effectiveApplicantRelationship: OfferingApplicantRelationship = signerRole === 'self'
        ? 'self'
        : signerRole === 'guardian' && applicantRelationship === 'self'
            ? 'parent'
            : applicantRelationship
    const signerRelationship = effectiveApplicantRelationship === 'self'
        ? 'Суралцагч өөрөө'
        : effectiveApplicantRelationship === 'parent'
            ? 'Эцэг, эх'
            : effectiveApplicantRelationship === 'guardian'
                ? 'Хууль ёсны асран хамгаалагч'
                : 'Бусад'
    const effectiveSignerName = signerRole === 'self' ? learnerFullName : signerFullName
    const effectiveSignerEmail = signerRole === 'self' ? userEmail : signerEmail
    const effectiveSignerRegistration = signerRole === 'self'
        ? learnerRegistrationNumber
        : signerRegistrationNumber
    const previewAnswers = {
        ...answers,
        student_name: learnerFullName,
        student_birth_date: learnerBirthDate,
        student_registration_number: learnerRegistrationNumber,
        signer_name: effectiveSignerName,
        signer_email: effectiveSignerEmail,
        signer_phone: signerPhone,
        signer_registration_number: effectiveSignerRegistration,
        signer_relationship: signerRelationship,
        guardian_name: signerRole === 'guardian' ? signerFullName : '',
        guardian_registration_number: signerRole === 'guardian' ? signerRegistrationNumber : '',
        guardian_relationship: signerRole === 'guardian' ? signerRelationship : '',
    }
    const contractPreview = checkout.contract_content
        ? renderContractApplicationPreview(
            checkout.contract_content,
            checkout.contract_preview_values,
            previewAnswers,
            checkout.fields,
        )
        : ''

    function resetFeedback() {
        setMessage(null)
        setError(null)
    }

    function detailsFormData() {
        if (!detailsFormRef.current) throw new Error('Элсэлтийн маягт олдсонгүй.')
        return new FormData(detailsFormRef.current)
    }

    function saveDetails() {
        resetFeedback()
        setVerification(null)
        startTransition(async () => {
            try {
                const formData = detailsFormData()
                const result = await saveOfferingCheckoutDraft(checkout.offering_id, formData)
                if (result.error) return setError(result.error)
                setSelectedApplicationId(result.applicationId ?? null)
                setMessage(result.success ?? 'Мэдээлэл хадгалагдлаа.')
                router.refresh()
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Мэдээллийг хадгалж чадсангүй.')
            }
        })
    }

    function acceptContract() {
        resetFeedback()
        startTransition(async () => {
            try {
                const result = await acceptOfferingContract(checkout.offering_id, detailsFormData())
                if (result.status === 'error') return setError(result.error)
                setSelectedApplicationId(result.applicationId)
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
                setError(cause instanceof Error ? cause.message : 'Гэрээг баталгаажуулж чадсангүй.')
            }
        })
    }

    function newLearner() {
        setSelectedApplicationId(null)
        setClientRequestId(crypto.randomUUID())
        setLearnerFullName('')
        setLearnerBirthDate('')
        setLearnerRegistrationNumber('')
        setApplicantRelationship('parent')
        setSignerFullName(profileName ?? '')
        setSignerEmail(userEmail)
        setSignerPhone('')
        setSignerRegistrationNumber('')
        setAnswers({})
        setContractAccepted(false)
        setVerification(null)
        resetFeedback()
    }

    const finalized = selectedApplication?.application_status === 'approved'
    const pendingReview = selectedApplication?.application_status === 'pending_review'
    const contractFinalized = Boolean(selectedApplication?.contract_accepted_at)
    const paymentReady = selectedApplication
        && ['ready_for_payment', 'correction_required'].includes(selectedApplication.application_status)
    const detailsLocked = verification !== null || contractFinalized || Boolean(
        selectedApplication && ['pending_review', 'correction_required', 'approved', 'withdrawn'].includes(
            selectedApplication.application_status,
        ),
    )

    return (
        <div className="space-y-6">
            {checkout.my_applications.length > 0 && (
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <label className="min-w-0 flex-1 space-y-2 text-sm text-zinc-300">
                            <span className="font-medium">Элсэлтийн хүсэлт</span>
                            <select
                                value={selectedApplicationId ?? ''}
                                onChange={(event) => {
                                    const application = checkout.my_applications.find((item) => item.application_id === event.target.value)
                                    if (application) loadApplication(application)
                                }}
                                className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-white"
                            >
                                {!selectedApplicationId && <option value="">Шинэ суралцагч</option>}
                                {checkout.my_applications.map((application) => (
                                    <option key={application.application_id} value={application.application_id}>
                                        {application.learner.full_name} · {statusLabels[application.application_status]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Button type="button" variant="outline" onClick={newLearner}>
                            <Plus className="mr-2 h-4 w-4" />Өөр суралцагч элсүүлэх
                        </Button>
                    </div>
                </section>
            )}

            {finalized ? (
                <CompletionPanel application={selectedApplication} courseTitle={checkout.course_title} />
            ) : pendingReview ? (
                <PendingReviewPanel application={selectedApplication} />
            ) : (
                <>
                    <form ref={detailsFormRef} className="space-y-7 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7">
                        <input type="hidden" name="client_request_id" value={clientRequestId} />
                        <header>
                            <p className="text-sm font-medium text-indigo-400">1-р алхам</p>
                            <h2 className="mt-1 text-xl font-semibold">Суралцагчийн мэдээлэл</h2>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                                Суралцагч болон нэвтэрсэн бүртгэл тусдаа хадгалагдана. Хичээл үзэх эрх эхний ээлжид {userEmail} бүртгэлд нээгдэнэ.
                            </p>
                        </header>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="Суралцагчийн овог нэр" required>
                                <Input name="learner_full_name" required maxLength={240} value={learnerFullName} onChange={(event) => setLearnerFullName(event.target.value)} disabled={detailsLocked} />
                            </Field>
                            <Field label="Суралцагчтай ямар холбоотой вэ?" required>
                                <select
                                    name="applicant_relationship"
                                    required
                                    value={effectiveApplicantRelationship}
                                    onChange={(event) => setApplicantRelationship(event.target.value as OfferingApplicantRelationship)}
                                    disabled={detailsLocked || signerRole === 'self'}
                                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 disabled:opacity-60"
                                >
                                    {signerRole !== 'guardian' && <option value="self">Өөрөө</option>}
                                    <option value="parent">Эцэг, эх</option>
                                    <option value="guardian">Хууль ёсны асран хамгаалагч</option>
                                    {checkout.contract_policy === 'none' && <option value="other">Бусад</option>}
                                </select>
                            </Field>
                            <Field
                                label="Төрсөн огноо"
                                required={checkout.contract_policy === 'required'}
                                hint={checkout.contract_policy === 'none' ? 'Заавал биш' : 'Хэн гэрээ зөвшөөрөхийг автоматаар тодорхойлно.'}
                            >
                                <Input type="date" name="learner_birth_date" required={checkout.contract_policy === 'required'} max={currentDate} value={learnerBirthDate} onChange={(event) => setLearnerBirthDate(event.target.value)} disabled={detailsLocked} className="[color-scheme:dark]" />
                            </Field>
                            <Field label="Регистрийн дугаар" required={checkout.contract_policy === 'required'} hint={checkout.contract_policy === 'none' ? 'Заавал биш' : undefined}>
                                <Input name="learner_registration_number" required={checkout.contract_policy === 'required'} maxLength={50} value={learnerRegistrationNumber} onChange={(event) => setLearnerRegistrationNumber(event.target.value)} disabled={detailsLocked} />
                            </Field>
                        </div>

                        {checkout.contract_policy === 'required' && signerRole && (
                            <section className="space-y-5 border-t border-zinc-800 pt-6">
                                <div>
                                    <h3 className="font-semibold">Гэрээ зөвшөөрөх хүн</h3>
                                    <p className="mt-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-sm text-indigo-100">
                                        {signerRole === 'self'
                                            ? 'Суралцагч 18 нас хүрсэн тул гэрээг өөрөө зөвшөөрнө.'
                                            : 'Суралцагч 18 нас хүрээгүй тул эцэг, эх эсвэл хууль ёсны асран хамгаалагч гэрээг зөвшөөрнө.'}
                                    </p>
                                </div>
                                {signerRole === 'self' ? (
                                    <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm sm:grid-cols-2">
                                        <Summary label="Овог нэр" value={learnerFullName} />
                                        <Summary label="И-мэйл" value={userEmail} />
                                        <Field label="Утасны дугаар" required>
                                            <Input name="signer_phone" required maxLength={50} value={signerPhone} onChange={(event) => setSignerPhone(event.target.value)} disabled={detailsLocked} autoComplete="tel" />
                                        </Field>
                                    </div>
                                ) : (
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <Field label="Овог нэр" required>
                                            <Input name="signer_full_name" required maxLength={240} value={signerFullName} onChange={(event) => setSignerFullName(event.target.value)} disabled={detailsLocked} autoComplete="name" />
                                        </Field>
                                        <Field label="И-мэйл" required hint="Шаардлагатай үед 6 оронтой код энэ хаягт очно.">
                                            <Input type="email" name="signer_email" required maxLength={320} value={signerEmail} onChange={(event) => setSignerEmail(event.target.value)} disabled={detailsLocked} autoComplete="email" />
                                        </Field>
                                        <Field label="Утасны дугаар" required>
                                            <Input name="signer_phone" required maxLength={50} value={signerPhone} onChange={(event) => setSignerPhone(event.target.value)} disabled={detailsLocked} autoComplete="tel" />
                                        </Field>
                                        <Field label="Регистрийн дугаар" required>
                                            <Input name="signer_registration_number" required maxLength={50} value={signerRegistrationNumber} onChange={(event) => setSignerRegistrationNumber(event.target.value)} disabled={detailsLocked} />
                                        </Field>
                                    </div>
                                )}
                            </section>
                        )}

                        {checkout.contract_policy === 'required' && visibleContractFields.length > 0 && (
                            <section className="grid gap-5 border-t border-zinc-800 pt-6 sm:grid-cols-2">
                                {visibleContractFields.map((field) => (
                                    <Field key={field.key} label={field.label} required hint={field.description}>
                                        <Input
                                            name={`answer:${field.key}`}
                                            required
                                            maxLength={500}
                                            value={answers[field.key] ?? ''}
                                            onChange={(event) => setAnswers((current) => ({ ...current, [field.key]: event.target.value }))}
                                            disabled={detailsLocked}
                                        />
                                    </Field>
                                ))}
                            </section>
                        )}

                        {checkout.contract_policy === 'required' && signerRole && !contractFinalized && (
                            <section className="space-y-4 border-t border-zinc-800 pt-6">
                                <div>
                                    <p className="text-sm font-medium text-indigo-400">2-р алхам</p>
                                    <h3 className="mt-1 font-semibold">Гэрээг хянаж зөвшөөрөх</h3>
                                </div>
                                <details className="rounded-xl border border-zinc-800 bg-zinc-900/40">
                                    <summary className="cursor-pointer px-5 py-4 text-sm font-medium">Гэрээг бүтнээр нь харах</summary>
                                    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words border-t border-zinc-800 p-5 font-sans text-sm leading-7 text-zinc-300">
                                        {contractPreview}
                                    </pre>
                                </details>
                                <label className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-indigo-100">
                                    <input type="checkbox" name="contract_accepted" required checked={contractAccepted} onChange={(event) => setContractAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-indigo-500" />
                                    <span>{CONTRACT_SIGNATURE_STATEMENT_MN}</span>
                                </label>
                            </section>
                        )}

                        {checkout.contract_policy === 'required' && contractFinalized && (
                            <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                                <div className="flex gap-3">
                                    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                                    <div>
                                        <h3 className="font-semibold text-emerald-100">Гэрээ баталгаажсан</h3>
                                        <p className="mt-1 text-sm text-emerald-100/70">
                                            Гэрээний мэдээлэл өөрчлөгдөхгүй хадгалагдсан. Одоо төлбөрийн баримтаа илгээнэ үү.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {verification && (
                            <section className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                                <input type="hidden" name="verification_pending" value="1" />
                                <div className="flex gap-3">
                                    <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                                    <div>
                                        <h3 className="font-semibold">И-мэйл кодоо оруулна уу</h3>
                                        <p className="mt-1 text-sm text-emerald-100/70">{verification.maskedEmail} хаягт илгээсэн код {verification.expiresInMinutes} минут хүчинтэй.</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <Input name="verification_code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="text-center tracking-[0.3em] sm:max-w-52" />
                                    <Button type="button" disabled={pending} onClick={() => detailsFormRef.current?.reportValidity() && acceptContract()} className="bg-emerald-600 hover:bg-emerald-700">
                                        <ShieldCheck className="mr-2 h-4 w-4" />Код баталгаажуулах
                                    </Button>
                                </div>
                            </section>
                        )}

                        <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-5">
                            {checkout.contract_policy === 'none' ? (
                                <Button type="button" disabled={pending || detailsLocked} onClick={() => detailsFormRef.current?.reportValidity() && saveDetails()}>
                                    {pending ? 'Хадгалж байна…' : 'Төлбөр рүү үргэлжлүүлэх'}
                                </Button>
                            ) : contractFinalized ? null : !verification ? (
                                <Button type="button" disabled={pending || detailsLocked || !signerRole} onClick={() => detailsFormRef.current?.reportValidity() && acceptContract()}>
                                    <FileCheck2 className="mr-2 h-4 w-4" />{pending ? 'Баталгаажуулж байна…' : 'Гэрээг зөвшөөрөх'}
                                </Button>
                            ) : (
                                <Button type="button" variant="outline" disabled={pending} onClick={acceptContract}>Код дахин илгээх</Button>
                            )}
                        </div>
                        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                        {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
                    </form>

                    {paymentReady && (
                        <PaymentPanel
                            checkout={checkout}
                            application={selectedApplication}
                            configuration={paymentConfiguration}
                            serverNow={serverNow}
                        />
                    )}
                </>
            )}
        </div>
    )
}

function PaymentPanel({
    checkout,
    application,
    configuration,
    serverNow,
}: {
    checkout: OfferingCheckoutForm
    application: SavedOfferingApplication
    configuration: PaymentConfiguration
    serverNow: string
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [copiedReference, setCopiedReference] = useState<string | null>(null)
    const configured = configuration.instructions.length > 0
    const overdue = application.payment_due_at
        ? new Date(application.payment_due_at).getTime() < new Date(serverNow).getTime()
        : false

    async function copyPaymentReference() {
        setError(null)
        try {
            await navigator.clipboard.writeText(application.payment_reference)
            setCopiedReference(application.payment_reference)
        } catch (cause) {
            console.error('Unable to copy offering payment reference:', cause)
            setError('Гүйлгээний утгыг хуулж чадсангүй. Кодыг гараар сонгон хуулна уу.')
        }
    }

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setMessage(null)
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
            try {
                const result = await submitOfferingPaymentProof(
                    checkout.offering_id,
                    application.application_id,
                    formData,
                )
                if (result.error) return setError(result.error)
                setMessage(result.notificationError
                    ? `Баримт хадгалагдлаа. ${result.notificationError}`
                    : 'Төлбөрийн баримт илгээгдлээ. Админ шалгасны дараа и-мэйлээр мэдэгдэнэ.')
                router.refresh()
            } catch (cause) {
                console.error('Offering payment submission transport failed:', cause)
                setError('Төлбөрийн баримтыг илгээх үед холболтын алдаа гарлаа. Файлын хэмжээ 10 MB-аас хэтрээгүй эсэхийг шалгаад дахин оролдоно уу.')
            }
        })
    }

    return (
        <section className={`rounded-2xl border p-5 sm:p-7 ${overdue ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
            <p className="text-sm font-medium text-emerald-400">{checkout.contract_policy === 'none' ? '2-р алхам' : '3-р алхам'}</p>
            <h2 className="mt-1 text-xl font-semibold">Төлбөрийн баримт илгээх</h2>
            <p className="mt-2 text-3xl font-bold text-emerald-400">₮ {checkout.tuition_amount_mnt.toLocaleString('mn-MN')}</p>
            {checkout.payment_plan && <p className="mt-2 text-sm text-zinc-400">{checkout.payment_plan}</p>}
            {application.payment_due_at && (
                <p className={`mt-3 text-sm ${overdue ? 'text-red-300' : 'text-zinc-400'}`}>
                    Эцсийн хугацаа: {new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ulaanbaatar' }).format(new Date(application.payment_due_at))}
                </p>
            )}
            {overdue && (
                <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                    <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                    <div>
                        <p className="font-semibold">Төлбөрийн хугацаа дууссан</p>
                        <p className="mt-1 leading-relaxed text-red-100/80">
                            Төлбөрийн баримт илгээх боломжгүй байна. Хугацааг дахин нээлгэх бол Mind Academy-тай холбогдоно уу.
                        </p>
                    </div>
                </div>
            )}
            {application.payment?.status === 'correction_required' && application.payment.rejection_reason && (
                <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                    <strong>Баримтыг дахин илгээх шалтгаан:</strong> {application.payment.rejection_reason}
                </p>
            )}
            {!overdue && configuration.isTestMode && (
                <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-medium text-amber-200">Туршилтын горим идэвхтэй байна. Бодит мөнгө шилжүүлэхгүй.</p>
            )}
            {!overdue && (
                <>
                    <div className="mt-5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-300">Гүйлгээний утга</p>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <code className="select-all break-all text-xl font-bold tracking-wider text-white">
                                {application.payment_reference}
                            </code>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={copyPaymentReference}
                                className="shrink-0 border-indigo-400/40 bg-transparent text-white hover:bg-indigo-500/20 hover:text-white"
                            >
                                {copiedReference === application.payment_reference
                                    ? <><Check className="mr-2 h-4 w-4" />Хуулсан</>
                                    : <><Copy className="mr-2 h-4 w-4" />Хуулах</>}
                            </Button>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-indigo-100/80">
                            Банкны шилжүүлгийн утга хэсэгт дээрх кодыг өөрчлөлгүй оруулна уу. Ингэснээр админ таны төлбөрийг зөв хүсэлттэй тулгана.
                        </p>
                    </div>
                    {configured ? (
                        <div className="mt-4 whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-6 text-zinc-200">{configuration.instructions}</div>
                    ) : (
                        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Төлбөрийн мэдээлэл тохируулагдаагүй байна. Академийн админтай холбогдоно уу.</p>
                    )}
                    <form onSubmit={submit} className="mt-5 space-y-4">
                        <Field label="Төлбөрийн баримтын зураг" required hint="JPG, PNG эсвэл WebP; хамгийн ихдээ 10 MB.">
                            <Input name="receipt" type="file" required accept="image/jpeg,image/png,image/webp" />
                        </Field>
                        <Button type="submit" disabled={pending || !configured} className="bg-emerald-600 hover:bg-emerald-700">
                            <Upload className="mr-2 h-4 w-4" />{pending ? 'Илгээж байна…' : 'Баримт илгээх'}
                        </Button>
                        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                        {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
                    </form>
                </>
            )}
        </section>
    )
}

function PendingReviewPanel({ application }: { application: SavedOfferingApplication }) {
    return (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-7 text-center">
            <Clock3 className="mx-auto h-10 w-10 text-amber-400" />
            <h2 className="mt-4 text-xl font-semibold">Төлбөрийн баримтыг шалгаж байна</h2>
            <p className="mt-2 text-sm text-zinc-400">{application.learner.full_name}-ийн баримтыг админ шалгасны дараа и-мэйлээр мэдэгдэнэ. Дахин баримт илгээх шаардлагагүй.</p>
        </section>
    )
}

function CompletionPanel({ application, courseTitle }: { application: SavedOfferingApplication; courseTitle: string }) {
    return (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-7 text-center">
            <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-400" />
            <h2 className="mt-4 text-2xl font-semibold">Элсэлт баталгаажлаа</h2>
            <p className="mt-2 text-zinc-300">{application.learner.full_name}-ийн “{courseTitle}” хичээл үзэх эрх нээгдсэн.</p>
            <Button asChild className="mt-5"><a href="/dashboard/courses">Миний хичээлүүд рүү очих</a></Button>
        </section>
    )
}

function Field({
    label,
    required,
    hint,
    children,
}: {
    label: string
    required?: boolean
    hint?: string
    children: React.ReactNode
}) {
    return (
        <label className="space-y-2 text-sm text-zinc-300">
            <span className="font-medium">{label}{required && <span className="text-red-400"> *</span>}</span>
            {children}
            {hint && <span className="block text-xs leading-relaxed text-zinc-500">{hint}</span>}
        </label>
    )
}

function Summary({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 break-words text-zinc-200">{value || '—'}</p>
        </div>
    )
}
