'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendContractSigningCodeEmail } from '@/lib/email/contract-signing-code'
import { sendOfferingPaymentSubmittedAlert } from '@/lib/telegram/notifications'
import { validateImageFile } from '@/lib/uploads/image-validation'
import { removeFailedPaymentReceipt } from '@/lib/uploads/payment-receipt-cleanup'
import {
    parseMyOfferingCheckoutStatuses,
    parseOfferingCheckoutForm,
    parseOfferingDraftDetails,
    type OfferingCheckoutForm,
    type OfferingDraftDetails,
} from '@/features/checkout/domain/offering-checkout'
import {
    CONTRACT_SIGNATURE_STATEMENT_MN,
    CONTRACT_SIGNATURE_STATEMENT_VERSION,
    getSignerRole,
    getUlaanbaatarDate,
} from '@/features/programs/domain/contract-signing'
import {
    CONTRACT_OTP_COOKIE,
    CONTRACT_OTP_EXPIRY_MINUTES,
    createContractSigningChallenge,
    verifyContractSigningChallenge,
} from '@/features/programs/server/contract-signing-challenge'

const verificationPolicySchema = z.object({
    verification_required: z.boolean(),
    reason: z.enum([
        'account_email_unverified',
        'different_signer_email',
        'session_not_recent',
        'recent_verified_account',
    ]),
    signer_email: z.string().email(),
})

const otpReservationSchema = z.object({
    reserved: z.boolean(),
    reserved_at: z.string().datetime({ offset: true }),
    retry_after_seconds: z.coerce.number().int().nonnegative(),
})

export type OfferingContractActionResult =
    | { status: 'accepted'; success: string; applicationId: string }
    | {
        status: 'verification_required'
        success: string
        applicationId: string
        maskedEmail: string
        expiresInMinutes: number
    }
    | { status: 'error'; error: string }

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

const relationshipLabels = {
    self: 'Суралцагч өөрөө',
    parent: 'Эцэг, эх',
    guardian: 'Хууль ёсны асран хамгаалагч',
    other: 'Бусад',
} as const

function assertUuid(value: string, label = 'Дугаар') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error(`${label} буруу байна.`)
    }
}

function optionalFormString(formData: FormData, key: string, maximum: number) {
    const raw = formData.get(key)
    if (typeof raw !== 'string') return ''
    const value = raw.trim()
    if (value.length > maximum) throw new Error('Оруулсан мэдээлэл зөвшөөрөгдөх хэмжээнээс урт байна.')
    return value
}

function requiredFormString(formData: FormData, key: string, maximum: number, message: string) {
    const value = optionalFormString(formData, key, maximum)
    if (!value) throw new Error(message)
    return value
}

function getContractServiceSecret() {
    const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) throw new Error('Гэрээ баталгаажуулах серверийн тохиргоо дутуу байна.')
    return secret
}

function maskEmail(email: string) {
    const [localPart, domain] = email.split('@')
    if (!localPart || !domain) return email
    const visible = localPart.slice(0, Math.min(2, localPart.length))
    return `${visible}${'*'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`
}

function clearOtpCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, offeringId: string) {
    cookieStore.set(CONTRACT_OTP_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: `/programs/${offeringId}`,
        maxAge: 0,
    })
}

function refreshOffering(offeringId: string) {
    revalidatePath('/programs')
    revalidatePath(`/programs/${offeringId}`)
    revalidatePath('/dashboard/courses')
    revalidatePath('/dashboard')
    revalidatePath('/admin')
    revalidatePath('/admin/payments')
}

export async function getOfferingCheckoutForm(offeringId: string) {
    assertUuid(offeringId, 'Элсэлтийн дугаар')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_course_offering_checkout_form', {
        p_offering_id: offeringId,
    })

    if (error) {
        console.error('Unable to load course offering checkout:', error.message)
        throw new Error('Элсэлтийн мэдээллийг ачаалж чадсангүй.')
    }
    return data ? parseOfferingCheckoutForm(data) : null
}

export async function getOfferingPaymentConfiguration() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('payment_configuration')
        .select('instructions, is_test_mode')
        .eq('id', true)
        .maybeSingle()

    if (error) {
        console.error('Unable to load offering payment configuration:', error.message)
        throw new Error('Төлбөрийн мэдээллийг ачаалж чадсангүй.')
    }

    return {
        instructions: data?.instructions?.trim() ?? '',
        isTestMode: data?.is_test_mode ?? true,
    }
}

export async function getMyOfferingCheckoutStatuses() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase.rpc('get_my_course_offering_checkout_statuses')
    if (error) {
        console.error('Unable to load offering checkout statuses:', error.message)
        throw new Error('Таны элсэлтийн төлөвийг ачаалж чадсангүй.')
    }
    return parseMyOfferingCheckoutStatuses(data ?? [])
}

function collectAnswers(
    formData: FormData,
    form: OfferingCheckoutForm,
    managedValues: Record<string, string>,
) {
    const answers: Record<string, string> = {}

    for (const field of form.fields) {
        if (managedContractFields.has(field.key)) {
            answers[field.key] = managedValues[field.key]?.trim() ?? ''
            continue
        }

        const value = requiredFormString(
            formData,
            `answer:${field.key}`,
            500,
            `${field.label} талбарыг оруулна уу.`,
        )
        answers[field.key] = value
    }

    return answers
}

function buildDraftDetails(
    formData: FormData,
    form: OfferingCheckoutForm,
    user: { id: string; email?: string },
): OfferingDraftDetails {
    const clientRequestId = requiredFormString(
        formData,
        'client_request_id',
        36,
        'Элсэлтийн хүсэлтийн дугаар дутуу байна.',
    )
    const learnerFullName = requiredFormString(
        formData,
        'learner_full_name',
        240,
        'Суралцагчийн овог нэрийг оруулна уу.',
    )
    const learnerBirthDate = optionalFormString(formData, 'learner_birth_date', 10) || null
    const learnerRegistrationNumber = optionalFormString(formData, 'learner_registration_number', 50) || null
    let applicantRelationship = optionalFormString(formData, 'applicant_relationship', 20) || 'self'
    let signerFullName = optionalFormString(formData, 'signer_full_name', 240) || null
    let signerEmail = optionalFormString(formData, 'signer_email', 320) || null
    const signerPhone = optionalFormString(formData, 'signer_phone', 50) || null
    let signerRegistrationNumber = optionalFormString(formData, 'signer_registration_number', 50) || null

    if (form.contract_policy === 'required') {
        if (!learnerBirthDate) throw new Error('Гэрээ байгуулахын тулд суралцагчийн төрсөн огноог оруулна уу.')
        const signerRole = getSignerRole(learnerBirthDate, getUlaanbaatarDate())
        if (signerRole === 'self') {
            applicantRelationship = 'self'
            signerFullName = learnerFullName
            signerEmail = user.email ?? null
            signerRegistrationNumber = learnerRegistrationNumber
        } else if (applicantRelationship !== 'parent' && applicantRelationship !== 'guardian') {
            throw new Error('18 нас хүрээгүй суралцагчийн эцэг, эх эсвэл хууль ёсны асран хамгаалагч гэрээг зөвшөөрнө.')
        }
    }

    const relationship = relationshipLabels[applicantRelationship as keyof typeof relationshipLabels] ?? ''
    const managedValues = {
        student_name: learnerFullName,
        student_birth_date: learnerBirthDate ?? '',
        student_registration_number: learnerRegistrationNumber ?? '',
        signer_name: signerFullName ?? '',
        signer_email: signerEmail ?? '',
        signer_phone: signerPhone ?? '',
        signer_registration_number: signerRegistrationNumber ?? '',
        signer_relationship: relationship,
        guardian_name: applicantRelationship === 'self' ? '' : signerFullName ?? '',
        guardian_registration_number: applicantRelationship === 'self' ? '' : signerRegistrationNumber ?? '',
        guardian_relationship: applicantRelationship === 'self' ? '' : relationship,
    }

    return parseOfferingDraftDetails({
        schema_version: 1,
        client_request_id: clientRequestId,
        learner_full_name: learnerFullName,
        learner_birth_date: learnerBirthDate,
        learner_registration_number: learnerRegistrationNumber,
        applicant_relationship: applicantRelationship,
        signer_full_name: signerFullName,
        signer_email: signerEmail,
        signer_phone: signerPhone,
        signer_registration_number: signerRegistrationNumber,
        answers: collectAnswers(formData, form, managedValues),
    }, form.contract_policy)
}

async function saveDraftInternal(offeringId: string, formData: FormData) {
    const supabase = await createClient()
    const [{ data: { user } }, form] = await Promise.all([
        supabase.auth.getUser(),
        getOfferingCheckoutForm(offeringId),
    ])
    if (!user) throw new Error('Элсэхийн тулд нэвтэрнэ үү.')
    if (!form) throw new Error('Энэ элсэлт олдсонгүй.')

    const details = buildDraftDetails(formData, form, { id: user.id, email: user.email })
    const { data, error } = await supabase.rpc('save_course_offering_checkout_draft', {
        p_offering_id: offeringId,
        p_content_access_user_id: user.id,
        p_details: details,
    })
    if (error || !data) {
        console.error('Unable to save offering checkout draft:', error?.message)
        throw new Error(mapCheckoutError(error?.message, 'Элсэлтийн мэдээллийг хадгалж чадсангүй.'))
    }

    return {
        applicationId: String(data),
        form,
        signerName: details.signer_full_name,
        user,
        supabase,
    }
}

async function loadSavedDraftForVerification(offeringId: string, formData: FormData) {
    const supabase = await createClient()
    const [{ data: { user } }, form] = await Promise.all([
        supabase.auth.getUser(),
        getOfferingCheckoutForm(offeringId),
    ])
    if (!user) throw new Error('Элсэхийн тулд нэвтэрнэ үү.')
    if (!form) throw new Error('Энэ элсэлт олдсонгүй.')

    const clientRequestId = requiredFormString(
        formData,
        'client_request_id',
        36,
        'Элсэлтийн хүсэлтийн дугаар дутуу байна.',
    )
    assertUuid(clientRequestId, 'Элсэлтийн хүсэлтийн дугаар')

    const application = form.my_applications.find(
        (candidate) => candidate.client_request_id === clientRequestId,
    )
    if (!application) {
        throw new Error('Баталгаажуулах гэрээний ноорог олдсонгүй. Мэдээллээ дахин шалгана уу.')
    }
    if (application.application_status !== 'contract_required') {
        throw new Error('Энэ гэрээ одоогоор и-мэйл кодоор баталгаажуулах төлөвт биш байна.')
    }

    return {
        applicationId: application.application_id,
        form,
        signerName: application.signer.full_name,
        user,
        supabase,
    }
}

export async function saveOfferingCheckoutDraft(offeringId: string, formData: FormData) {
    assertUuid(offeringId, 'Элсэлтийн дугаар')
    try {
        const { applicationId, form } = await saveDraftInternal(offeringId, formData)
        refreshOffering(offeringId)
        return {
            success: form.contract_policy === 'none'
                ? 'Суралцагчийн мэдээлэл хадгалагдлаа. Одоо төлбөрийн баримтаа илгээнэ үү.'
                : 'Элсэлтийн мэдээлэл хадгалагдлаа.',
            applicationId,
        }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Элсэлтийн мэдээллийг хадгалж чадсангүй.' }
    }
}

export async function acceptOfferingContract(
    offeringId: string,
    formData: FormData,
): Promise<OfferingContractActionResult> {
    assertUuid(offeringId, 'Элсэлтийн дугаар')
    try {
        if (formData.get('contract_accepted') !== 'on') {
            throw new Error('Гэрээний нөхцөлийг зөвшөөрснөө баталгаажуулна уу.')
        }

        const verificationCode = optionalFormString(formData, 'verification_code', 6)
        const verificationPending = formData.get('verification_pending') === '1'
        const { applicationId, form, signerName, user, supabase } = verificationPending
            ? await loadSavedDraftForVerification(offeringId, formData)
            : await saveDraftInternal(offeringId, formData)
        if (form.contract_policy !== 'required') throw new Error('Энэ элсэлт гэрээ шаардахгүй.')
        const claims = await supabase.auth.getClaims()
        const sessionId = typeof claims.data?.claims?.session_id === 'string'
            ? claims.data.claims.session_id
            : null
        const admin = createAdminClient()
        const { data: policyValue, error: policyError } = await admin.rpc(
            'get_course_offering_contract_verification_policy',
            {
                p_applicant_user_id: user.id,
                p_session_id: sessionId,
                p_application_id: applicationId,
            },
        )
        if (policyError) {
            console.error('Unable to determine offering contract verification policy:', policyError.message)
            throw new Error('Гарын үсгийн баталгаажуулалтыг шалгаж чадсангүй.')
        }

        const policy = verificationPolicySchema.parse(policyValue)
        const cookieStore = await cookies()
        if (policy.verification_required) {
            const identity = { applicationId, applicantUserId: user.id, email: policy.signer_email }

            if (!verificationCode) {
                const { data: reservationValue, error: reservationError } = await admin.rpc(
                    'reserve_course_offering_signature_verification',
                    { p_application_id: applicationId },
                )
                if (reservationError) throw new Error('Баталгаажуулах кодын хүсэлтийг хадгалж чадсангүй.')
                const reservation = otpReservationSchema.parse(
                    Array.isArray(reservationValue) ? reservationValue[0] : reservationValue,
                )
                if (!reservation.reserved) {
                    throw new Error(`Шинэ код авахын өмнө ${reservation.retry_after_seconds} секунд хүлээнэ үү.`)
                }

                const challenge = createContractSigningChallenge(identity, getContractServiceSecret())
                const email = await sendContractSigningCodeEmail({
                    to: policy.signer_email,
                    signerName: signerName || 'Гэрээ байгуулагч',
                    programName: `${form.program_name} · ${form.offering_name}`,
                    code: challenge.code,
                    expiresInMinutes: CONTRACT_OTP_EXPIRY_MINUTES,
                })
                if (!email.sent) {
                    await admin.rpc('release_course_offering_signature_verification', {
                        p_application_id: applicationId,
                        p_reserved_at: reservation.reserved_at,
                    })
                    throw new Error(`Баталгаажуулах код илгээж чадсангүй. ${email.error}`)
                }

                cookieStore.set(CONTRACT_OTP_COOKIE, challenge.token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: `/programs/${offeringId}`,
                    maxAge: CONTRACT_OTP_EXPIRY_MINUTES * 60,
                })
                return {
                    status: 'verification_required',
                    success: 'Гэрээ зөвшөөрөх и-мэйл хаяг руу 6 оронтой код илгээлээ.',
                    applicationId,
                    maskedEmail: maskEmail(policy.signer_email),
                    expiresInMinutes: CONTRACT_OTP_EXPIRY_MINUTES,
                }
            }

            if (!/^\d{6}$/.test(verificationCode)) throw new Error('Баталгаажуулах код 6 оронтой байна.')
            const challengeToken = cookieStore.get(CONTRACT_OTP_COOKIE)?.value
            if (!challengeToken) throw new Error('Баталгаажуулах кодын хугацаа дууссан. Шинэ код авна уу.')
            const verification = verifyContractSigningChallenge(
                challengeToken,
                verificationCode,
                identity,
                getContractServiceSecret(),
            )
            if (!verification.valid) {
                if (verification.nextToken) {
                    cookieStore.set(CONTRACT_OTP_COOKIE, verification.nextToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        path: `/programs/${offeringId}`,
                        maxAge: CONTRACT_OTP_EXPIRY_MINUTES * 60,
                    })
                } else {
                    clearOtpCookie(cookieStore, offeringId)
                }
                if (verification.reason === 'expired') throw new Error('Баталгаажуулах кодын хугацаа дууссан. Шинэ код авна уу.')
                if (verification.reason === 'attempts_exceeded') throw new Error('Кодыг олон удаа буруу оруулсан. Шинэ код авна уу.')
                throw new Error('Баталгаажуулах код буруу байна.')
            }

            await finalizeContract(admin, applicationId, user.id, 'email_otp')
            clearOtpCookie(cookieStore, offeringId)
        } else {
            await finalizeContract(admin, applicationId, user.id, 'authenticated_account')
            clearOtpCookie(cookieStore, offeringId)
        }

        refreshOffering(offeringId)
        return {
            status: 'accepted',
            success: 'Гэрээ амжилттай баталгаажлаа. Одоо төлбөрийн баримтаа илгээнэ үү.',
            applicationId,
        }
    } catch (error) {
        return { status: 'error', error: error instanceof Error ? error.message : 'Гэрээг баталгаажуулж чадсангүй.' }
    }
}

async function finalizeContract(
    admin: ReturnType<typeof createAdminClient>,
    applicationId: string,
    applicantUserId: string,
    method: 'authenticated_account' | 'email_otp',
) {
    const { error } = await admin.rpc('finalize_course_offering_contract_acceptance', {
        p_application_id: applicationId,
        p_applicant_user_id: applicantUserId,
        p_signature_method: method,
        p_signature_statement: CONTRACT_SIGNATURE_STATEMENT_MN,
        p_signature_statement_version: CONTRACT_SIGNATURE_STATEMENT_VERSION,
    })
    if (!error) return
    console.error('Unable to finalize offering contract:', error.message)
    throw new Error(mapCheckoutError(error.message, 'Гэрээг баталгаажуулж чадсангүй.'))
}

export async function submitOfferingPaymentProof(
    offeringId: string,
    applicationId: string,
    formData: FormData,
) {
    assertUuid(offeringId, 'Элсэлтийн дугаар')
    assertUuid(applicationId, 'Хүсэлтийн дугаар')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Төлбөрийн баримт илгээхийн тулд нэвтэрнэ үү.' }

    const receipt = formData.get('receipt')
    if (!(receipt instanceof File) || receipt.size === 0) {
        return { error: 'Төлбөрийн баримтын зургаа сонгоно уу.' }
    }

    let extension: string
    try {
        extension = await validateImageFile(receipt, 10 * 1024 * 1024)
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Зургийн файлыг шалгаж чадсангүй.' }
    }

    let form: OfferingCheckoutForm | null
    try {
        form = await getOfferingCheckoutForm(offeringId)
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Элсэлтийн мэдээллийг ачаалж чадсангүй.' }
    }
    const application = form?.my_applications.find((item) => item.application_id === applicationId)
    if (!form || !application) return { error: 'Таны элсэлтийн хүсэлт олдсонгүй.' }
    if (!['ready_for_payment', 'correction_required'].includes(application.application_status)) {
        return { error: 'Энэ хүсэлт одоогоор төлбөрийн баримт хүлээн авах төлөвт биш байна.' }
    }
    if (application.payment_due_at && new Date(application.payment_due_at).getTime() < Date.now()) {
        return { error: 'Төлбөрийн баримт илгээх хугацаа дууссан байна. Академийн админтай холбогдоно уу.' }
    }

    const receiptPath = `${user.id}/offering/${applicationId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(receiptPath, receipt, { contentType: receipt.type, upsert: false })
    if (uploadError) {
        console.error('Offering receipt upload failed:', uploadError.message)
        return { error: 'Төлбөрийн баримтыг байршуулж чадсангүй. Дахин оролдоно уу.' }
    }

    const { error: submitError } = await supabase.rpc('submit_course_offering_checkout', {
        p_application_id: applicationId,
        p_receipt_path: receiptPath,
    })
    if (submitError) {
        console.error('Offering checkout submission failed:', submitError.message)
        await removeFailedPaymentReceipt(receiptPath)
        return { error: mapCheckoutError(submitError.message, 'Төлбөрийн баримтыг илгээж чадсангүй.') }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
    const notification = await sendOfferingPaymentSubmittedAlert({
        applicantName: user.user_metadata?.display_name || user.email || 'Элсэгч',
        learnerName: application.learner.full_name,
        programName: form.program_name,
        offeringName: form.offering_name,
        adminUrl: siteUrl ? `${siteUrl}/admin/payments?type=offering&status=pending` : undefined,
    })
    if (!notification.sent) {
        console.error('Offering payment saved but Telegram notification failed:', notification.error)
    }

    refreshOffering(offeringId)
    return {
        success: true,
        notificationError: notification.sent ? undefined : 'Админы Telegram мэдэгдэл илгээгдсэнгүй.',
    }
}

function mapCheckoutError(message: string | undefined, fallback: string) {
    const normalized = message?.toLowerCase() ?? ''
    if (normalized.includes('not accepting') || normalized.includes('not open')) {
        return 'Энэ элсэлт одоогоор хүсэлт хүлээн авахгүй байна.'
    }
    if (normalized.includes('capacity') || normalized.includes('seat')) {
        return 'Энэ элсэлтийн суудал дүүрсэн байна.'
    }
    if (normalized.includes('not operational')) {
        return 'Энэ элсэлт цуцлагдсан эсвэл дууссан тул төлбөрийн баримт хүлээн авахгүй байна.'
    }
    if (normalized.includes('deadline') || normalized.includes('expired')) {
        return 'Төлбөрийн баримт илгээх хугацаа дууссан байна.'
    }
    if (normalized.includes('contract')) {
        return 'Төлбөрийн өмнө гэрээг бүрэн зөвшөөрнө үү.'
    }
    if (normalized.includes('already pending') || normalized.includes('pending review')) {
        return 'Таны төлбөрийн баримтыг админ шалгаж байна.'
    }
    return fallback
}
