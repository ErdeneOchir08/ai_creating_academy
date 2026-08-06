'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendContractSigningCodeEmail } from '@/lib/email/contract-signing-code'
import {
    answersFromFormData,
    parseCohortApplicationForm,
    parseOpenCohorts,
} from '@/features/programs/domain/cohort-application'
import {
    CONTRACT_SIGNATURE_STATEMENT_MN,
    CONTRACT_SIGNATURE_STATEMENT_VERSION,
    getSignerRole,
    getUlaanbaatarDate,
    signerDraftSchema,
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

type ContractSubmissionResult =
    | { status: 'submitted'; success: string }
    | {
        status: 'verification_required'
        success: string
        maskedEmail: string
        expiresInMinutes: number
    }
    | { status: 'error'; error: string }

const otpReservationSchema = z.object({
    reserved: z.boolean(),
    reserved_at: z.string().datetime({ offset: true }),
    retry_after_seconds: z.number().int().nonnegative(),
})

class ContractSubmissionError extends Error {}

function failContractSubmission(message: string): never {
    throw new ContractSubmissionError(message)
}

function assertUuid(value: string, fieldName: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error(`${fieldName} буруу байна.`)
    }
}
function refreshApplication(cohortId: string) {
    revalidatePath('/programs')
    revalidatePath(`/programs/${cohortId}`)
}

export async function getOpenTrainingCohorts() {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('list_open_training_cohorts')

    if (error) {
        console.error('Unable to load open training cohorts:', error.message)
        throw new Error('Нээлттэй элсэлтүүдийг уншиж чадсангүй.')
    }
    return parseOpenCohorts(data ?? [])
}

export async function getOpenCohortApplicationForm(cohortId: string) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_open_cohort_application_form', { p_cohort_id: cohortId })

    if (error) {
        console.error('Unable to load cohort application form:', error.message)
        throw new Error('Элсэлтийн мэдээллийг уншиж чадсангүй.')
    }
    return data ? parseCohortApplicationForm(data) : null
}

async function saveDraft(cohortId: string, formData: FormData) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Өргөдөл гаргахын тулд нэвтэрнэ үү.')

    const answers = answersFromFormData(formData)
    const studentBirthDate = optionalFormString(formData, 'student_birth_date', 10)
    const signerName = optionalFormString(formData, 'signer_name', 240)
    const signerEmail = optionalFormString(formData, 'signer_email', 320)
    const signerPhone = optionalFormString(formData, 'signer_phone', 50)
    const signerRegistrationNumber = optionalFormString(formData, 'signer_registration_number', 50)
    const signerRelationship = optionalFormString(formData, 'signer_relationship', 120)
    const { data, error } = await supabase.rpc('save_cohort_application_draft', {
        p_cohort_id: cohortId,
        p_answers: answers,
        p_student_birth_date: studentBirthDate || null,
        p_signer_name: signerName || null,
        p_signer_email: signerEmail || null,
        p_signer_phone: signerPhone || null,
        p_signer_registration_number: signerRegistrationNumber || null,
        p_signer_relationship: signerRelationship || null,
    })

    if (error || !data) {
        console.error('Unable to save cohort application draft:', error?.message)
        throw new Error(error?.message.includes('not accepting')
            ? 'Энэ элсэлт одоогоор өргөдөл хүлээн авахгүй байна.'
            : 'Өргөдлийн нооргийг хадгалж чадсангүй.')
    }
    return data as string
}

function optionalFormString(formData: FormData, key: string, maxLength: number) {
    const value = formData.get(key)
    if (typeof value !== 'string') return ''

    const normalized = value.trim()
    if (normalized.length > maxLength) throw new Error('Оруулсан мэдээлэл хэт урт байна.')
    return normalized
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

function getRelatedProgramName(value: unknown) {
    const cohort = Array.isArray(value) ? value[0] : value
    if (!cohort || typeof cohort !== 'object' || !('program' in cohort)) return null

    const programValue = cohort.program
    const program = Array.isArray(programValue) ? programValue[0] : programValue
    if (!program || typeof program !== 'object' || !('name' in program)) return null
    return typeof program.name === 'string' && program.name.trim() ? program.name.trim() : null
}

function clearOtpCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, cohortId: string) {
    cookieStore.set(CONTRACT_OTP_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: `/programs/${cohortId}`,
        maxAge: 0,
    })
}

export async function saveCohortApplicationDraft(cohortId: string, formData: FormData) {
    await saveDraft(cohortId, formData)
    refreshApplication(cohortId)
    return { success: 'Өргөдлийн ноорог хадгалагдлаа.' }
}

async function submitCohortApplicationInternal(
    cohortId: string,
    formData: FormData,
): Promise<ContractSubmissionResult> {
    if (formData.get('contract_accepted') !== 'on') {
        failContractSubmission('Гэрээний нөхцөлийг зөвшөөрснөө баталгаажуулна уу.')
    }

    const signingInput = signerDraftSchema.safeParse({
        studentBirthDate: optionalFormString(formData, 'student_birth_date', 10),
        signerName: optionalFormString(formData, 'signer_name', 240),
        signerEmail: optionalFormString(formData, 'signer_email', 320),
        signerPhone: optionalFormString(formData, 'signer_phone', 50),
        signerRegistrationNumber: optionalFormString(formData, 'signer_registration_number', 50),
        signerRelationship: optionalFormString(formData, 'signer_relationship', 120),
    })
    if (!signingInput.success) {
        failContractSubmission('Суралцагч болон гэрээ зөвшөөрөх хүний мэдээллийг бүрэн, зөв оруулна уу.')
    }
    getSignerRole(signingInput.data.studentBirthDate, getUlaanbaatarDate())

    const applicationId = await saveDraft(cohortId, formData)
    const supabase = await createClient()
    const [{ data: { user } }, claimsResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getClaims(),
    ])
    if (!user) failContractSubmission('Гэрээ зөвшөөрөхийн тулд дахин нэвтэрнэ үү.')

    const sessionId = typeof claimsResult.data?.claims?.session_id === 'string'
        ? claimsResult.data.claims.session_id
        : null
    const serviceSecret = getContractServiceSecret()
    const admin = createAdminClient()
    const { data: rawPolicy, error: policyError } = await admin.rpc(
        'get_contract_signature_verification_policy',
        {
            p_applicant_user_id: user.id,
            p_session_id: sessionId,
            p_application_id: applicationId,
        },
    )
    if (policyError) {
        console.error('Unable to determine contract verification policy:', policyError.message)
        failContractSubmission('Гарын үсгийн баталгаажуулалтыг шалгаж чадсангүй.')
    }
    const policy = verificationPolicySchema.parse(rawPolicy)
    const cookieStore = await cookies()

    if (policy.verification_required) {
        const verificationCode = optionalFormString(formData, 'verification_code', 6)
        const identity = {
            applicationId,
            applicantUserId: user.id,
            email: policy.signer_email,
        }

        if (verificationCode) {
            if (!/^\d{6}$/.test(verificationCode)) {
                failContractSubmission('Баталгаажуулах код 6 оронтой байна.')
            }

            const challengeToken = cookieStore.get(CONTRACT_OTP_COOKIE)?.value
            if (!challengeToken) {
                failContractSubmission('Баталгаажуулах кодын хугацаа дууссан. Шинэ код авна уу.')
            }

            const verification = verifyContractSigningChallenge(
                challengeToken,
                verificationCode,
                identity,
                serviceSecret,
            )
            if (!verification.valid) {
                if (verification.nextToken) {
                    cookieStore.set(CONTRACT_OTP_COOKIE, verification.nextToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        path: `/programs/${cohortId}`,
                        maxAge: CONTRACT_OTP_EXPIRY_MINUTES * 60,
                    })
                } else {
                    clearOtpCookie(cookieStore, cohortId)
                }

                if (verification.reason === 'expired') {
                    failContractSubmission('Баталгаажуулах кодын хугацаа дууссан. Шинэ код авна уу.')
                }
                if (verification.reason === 'attempts_exceeded') {
                    failContractSubmission('Кодыг олон удаа буруу оруулсан. Шинэ код авна уу.')
                }
                failContractSubmission('Баталгаажуулах код буруу байна.')
            }

            await finalizeContractSignature(admin, applicationId, user.id, 'email_otp')
            clearOtpCookie(cookieStore, cohortId)
        } else {
            const { data: application, error: applicationError } = await admin
                .from('cohort_applications')
                .select(`
                    signer_name,
                    signer_email,
                    cohort:training_cohorts!cohort_applications_cohort_id_fkey (
                        program:training_programs!training_cohorts_program_id_fkey ( name )
                    )
                `)
                .eq('id', applicationId)
                .eq('applicant_user_id', user.id)
                .eq('status', 'draft')
                .maybeSingle()

            if (applicationError || !application) {
                failContractSubmission('Баталгаажуулах мэдээллийг бэлтгэж чадсангүй.')
            }

            const challenge = createContractSigningChallenge(identity, serviceSecret)
            const { data: rawReservation, error: reservationError } = await supabase.rpc(
                'reserve_cohort_signature_verification',
                { p_application_id: applicationId },
            )
            if (reservationError) {
                console.error('Unable to reserve contract verification send:', reservationError.message)
                failContractSubmission('Баталгаажуулах кодын хүсэлтийг хадгалж чадсангүй.')
            }

            const reservation = otpReservationSchema.parse(
                Array.isArray(rawReservation) ? rawReservation[0] : rawReservation,
            )
            if (!reservation.reserved) {
                failContractSubmission(
                    `Шинэ код авахын өмнө ${reservation.retry_after_seconds} секунд хүлээнэ үү.`,
                )
            }

            const emailResult = await sendContractSigningCodeEmail({
                to: policy.signer_email,
                signerName: application.signer_name || 'гэрээ байгуулагч',
                programName: getRelatedProgramName(application.cohort) || 'Mind Academy сургалт',
                code: challenge.code,
                expiresInMinutes: CONTRACT_OTP_EXPIRY_MINUTES,
            })
            if (!emailResult.sent) {
                const { error: releaseError } = await supabase.rpc(
                    'release_cohort_signature_verification',
                    {
                        p_application_id: applicationId,
                        p_reserved_at: reservation.reserved_at,
                    },
                )
                if (releaseError) {
                    console.error('Unable to release contract verification reservation:', releaseError.message)
                }
                failContractSubmission(emailResult.error)
            }

            cookieStore.set(CONTRACT_OTP_COOKIE, challenge.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: `/programs/${cohortId}`,
                maxAge: CONTRACT_OTP_EXPIRY_MINUTES * 60,
            })

            return {
                status: 'verification_required',
                success: 'Баталгаажуулах кодыг и-мэйлээр илгээлээ.',
                maskedEmail: maskEmail(policy.signer_email),
                expiresInMinutes: CONTRACT_OTP_EXPIRY_MINUTES,
            }
        }
    } else {
        await finalizeContractSignature(admin, applicationId, user.id, 'authenticated_account')
        clearOtpCookie(cookieStore, cohortId)
    }

    refreshApplication(cohortId)
    revalidatePath('/admin/applications')
    return { status: 'submitted', success: 'Гэрээг зөвшөөрч, өргөдлийг амжилттай илгээлээ.' }
}

export async function submitCohortApplication(
    cohortId: string,
    formData: FormData,
): Promise<ContractSubmissionResult> {
    try {
        return await submitCohortApplicationInternal(cohortId, formData)
    } catch (cause) {
        const message = cause instanceof ContractSubmissionError
            ? cause.message
            : 'Гэрээг зөвшөөрч чадсангүй. Дахин оролдоно уу.'
        console.error('Unable to submit cohort application:', cause)
        return { status: 'error', error: message }
    }
}

async function finalizeContractSignature(
    admin: ReturnType<typeof createAdminClient>,
    applicationId: string,
    applicantUserId: string,
    method: 'authenticated_account' | 'email_otp',
) {
    const { error } = await admin.rpc('finalize_cohort_contract_signature', {
        p_application_id: applicationId,
        p_applicant_user_id: applicantUserId,
        p_signature_method: method,
        p_signature_statement: CONTRACT_SIGNATURE_STATEMENT_MN,
        p_signature_statement_version: CONTRACT_SIGNATURE_STATEMENT_VERSION,
    })

    if (!error) return
    console.error('Unable to finalize cohort contract signature:', error.message)

    if (error.message.includes('student age')) {
        failContractSubmission('Суралцагчийн нас болон гарын үсэг зурах талын мэдээлэл тохирохгүй байна.')
    }
    if (error.message.includes('adult signer name')) {
        failContractSubmission('18 нас хүрсэн суралцагчийн гарын үсгийн нэр суралцагчийн нэртэй таарах ёстой.')
    }
    if (error.message.includes('incomplete') || error.message.includes('missing')) {
        failContractSubmission('Гэрээ байгуулахад шаардлагатай мэдээллийг бүрэн оруулна уу.')
    }
    failContractSubmission('Гэрээг зөвшөөрч, өргөдлийг илгээж чадсангүй.')
}

export async function withdrawCohortApplication(applicationId: string, cohortId: string) {
    assertUuid(applicationId, 'Өргөдлийн дугаар')
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    const supabase = await createClient()
    const { error } = await supabase.rpc('withdraw_cohort_application', { p_application_id: applicationId })
    if (error) throw new Error('Өргөдлийг буцаан татаж чадсангүй.')

    refreshApplication(cohortId)
    revalidatePath('/admin/applications')
    return { success: 'Өргөдлийг буцаан татлаа.' }
}
