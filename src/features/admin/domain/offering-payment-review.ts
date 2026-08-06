import { z } from 'zod'

export const adminOfferingPaymentStatuses = ['pending', 'approved', 'rejected'] as const
export type AdminOfferingPaymentStatus = (typeof adminOfferingPaymentStatuses)[number]

export const offeringNotificationStatuses = ['pending', 'processing', 'sent', 'failed'] as const
export type OfferingNotificationStatus = (typeof offeringNotificationStatuses)[number]

export const offeringPaymentRejectionReasonSchema = z.string()
    .trim()
    .min(1, 'Төлбөрийн баримтыг буцаах шалтгааныг оруулна уу.')
    .max(500, 'Татгалзсан шалтгаан 500 тэмдэгтээс урт байж болохгүй.')

const paymentProofSchema = z.object({
    id: z.string().uuid(),
    application_id: z.string().uuid(),
    offering_id: z.string().uuid(),
    applicant_user_id: z.string().uuid(),
    attempt_number: z.coerce.number().int().positive(),
    amount_mnt: z.coerce.number().int().positive(),
    status: z.enum(adminOfferingPaymentStatuses),
    rejection_reason: z.string().nullable(),
    created_at: z.string().min(1),
    reviewed_at: z.string().nullable(),
})

const termsSnapshotSchema = z.object({
    course_id: z.string().uuid(),
    program_name: z.string().trim().min(1),
    offering_name: z.string().trim().min(1),
    delivery_mode: z.enum(['online', 'offline']),
    course: z.object({
        title: z.string().trim().min(1),
    }).passthrough(),
}).passthrough()

const applicationSchema = z.object({
    id: z.string().uuid(),
    offering_id: z.string().uuid(),
    learner_id: z.string().uuid(),
    applicant_user_id: z.string().uuid(),
    content_access_user_id: z.string().uuid(),
    contact_email: z.string().trim().min(3).max(320),
    applicant_relationship: z.enum(['self', 'parent', 'guardian', 'other']),
    contract_policy_snapshot: z.enum(['required', 'none']),
    payment_due_at: z.string().min(1),
    status: z.enum(['draft', 'submitted', 'approved', 'withdrawn']),
    terms_snapshot: termsSnapshotSchema,
})

const notificationSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(offeringNotificationStatuses),
    attempts: z.coerce.number().int().nonnegative(),
    available_at: z.string().min(1),
    locked_at: z.string().nullable(),
    sent_at: z.string().nullable(),
    last_error: z.string().nullable(),
})

const reviewContextSchema = z.object({
    proof: paymentProofSchema,
    application: applicationSchema,
    learner: z.object({ full_name: z.string().trim().min(1) }),
    applicant: z.object({ display_name: z.string().trim().min(1).nullable() }).nullable(),
    receiptUrl: z.string().url().nullable(),
    notification: notificationSchema.nullable(),
    notificationTrackingError: z.string().nullable(),
})

export type AdminOfferingPaymentNotification = z.infer<typeof notificationSchema>

export type AdminOfferingPayment = {
    id: string
    applicationId: string
    offeringId: string
    applicantUserId: string
    contentAccessUserId: string
    attemptNumber: number
    amountMnt: number
    status: AdminOfferingPaymentStatus
    rejectionReason: string | null
    submittedAt: string
    reviewedAt: string | null
    paymentDueAt: string
    applicantName: string | null
    applicantEmail: string
    applicantRelationship: 'self' | 'parent' | 'guardian' | 'other'
    learnerName: string
    programName: string
    offeringName: string
    courseId: string
    courseTitle: string
    deliveryMode: 'online' | 'offline'
    contractPolicy: 'required' | 'none'
    applicationStatus: 'draft' | 'submitted' | 'approved' | 'withdrawn'
    receiptUrl: string | null
    notification: AdminOfferingPaymentNotification | null
    notificationTrackingError: string | null
}

const decisionRecipientContextSchema = z.object({
    proof: paymentProofSchema.pick({
        id: true,
        status: true,
        rejection_reason: true,
    }),
    application: applicationSchema.pick({
        offering_id: true,
        learner_id: true,
        applicant_user_id: true,
        contact_email: true,
        terms_snapshot: true,
    }),
    learner: z.object({ full_name: z.string().trim().min(1) }),
    applicant: z.object({ display_name: z.string().trim().min(1).nullable() }).nullable(),
})

export type OfferingPaymentDecisionRecipient = {
    paymentProofId: string
    status: AdminOfferingPaymentStatus
    rejectionReason: string | null
    email: string
    recipientName: string
    learnerName: string
    programName: string
    offeringName: string
    offeringId: string
}

export function parseOfferingPaymentDecisionRecipient(
    value: unknown,
): OfferingPaymentDecisionRecipient {
    const parsed = decisionRecipientContextSchema.parse(value)

    return {
        paymentProofId: parsed.proof.id,
        status: parsed.proof.status,
        rejectionReason: parsed.proof.rejection_reason,
        email: parsed.application.contact_email,
        recipientName: parsed.applicant?.display_name ?? parsed.learner.full_name,
        learnerName: parsed.learner.full_name,
        programName: parsed.application.terms_snapshot.program_name,
        offeringName: parsed.application.terms_snapshot.offering_name,
        offeringId: parsed.application.offering_id,
    }
}

export function offeringPaymentDecisionErrorMessage(
    message: string,
    decision: 'approve' | 'reject',
) {
    const normalized = message.toLocaleLowerCase('en-US')

    if (normalized.includes('no longer pending')) {
        return 'Энэ баримтыг өөр админ аль хэдийн шийдвэрлэсэн байна. Хуудсыг шинэчилнэ үү.'
    }
    if (normalized.includes('no available seats')) {
        return 'Энэ элсэлтийн суудал дүүрсэн тул төлбөрийг зөвшөөрөөгүй.'
    }
    if (normalized.includes('not operational')) {
        return 'Цуцлагдсан эсвэл дууссан элсэлтэд шинэ зөвшөөрөл үүсгэх боломжгүй.'
    }
    if (normalized.includes('payment amount does not match')) {
        return 'Баримтын дүн элсэлтийн баталгаажсан төлбөртэй тохирохгүй байна.'
    }
    if (normalized.includes('contract acceptance evidence is missing')) {
        return 'Гэрээний зөвшөөрлийн нотолгоо дутуу тул төлбөрийг зөвшөөрөх боломжгүй.'
    }
    if (normalized.includes('course snapshot is incomplete')) {
        return 'Элсэлтийн хичээлийн хувилбар дутуу байна. Хөтөлбөрийн тохиргоог шалгана уу.'
    }
    if (normalized.includes('promised course is not ready')) {
        return 'Олгох хичээлийн зарим агуулга бэлэн биш байна. Хичээлийн бэлэн байдлыг шалгана уу.'
    }
    if (normalized.includes('does not exist')) {
        return 'Төлбөрийн хүсэлт олдсонгүй. Хуудсыг шинэчилнэ үү.'
    }
    if (normalized.includes('administrator access is required')) {
        return 'Админы эрх шаардлагатай.'
    }

    return decision === 'approve'
        ? 'Төлбөрийг зөвшөөрч чадсангүй. Мэдээллийг шинэчлээд дахин оролдоно уу.'
        : 'Төлбөрийн баримтыг буцааж чадсангүй. Мэдээллийг шинэчлээд дахин оролдоно уу.'
}

export function getOfferingDecisionNotificationIdentity(
    paymentProofId: string,
    status: AdminOfferingPaymentStatus,
) {
    if (status === 'approved') {
        return {
            eventType: 'course_offering.checkout_approved',
            idempotencyKey: `course-offering-checkout-approved:${paymentProofId}`,
            decision: 'approved' as const,
        }
    }
    if (status === 'rejected') {
        return {
            eventType: 'course_offering.payment_rejected',
            idempotencyKey: `course-offering-payment-rejected:${paymentProofId}`,
            decision: 'correction_required' as const,
        }
    }
    return null
}

export function parseAdminOfferingPayment(value: unknown): AdminOfferingPayment {
    const parsed = reviewContextSchema.parse(value)
    const { proof, application } = parsed

    return {
        id: proof.id,
        applicationId: proof.application_id,
        offeringId: proof.offering_id,
        applicantUserId: proof.applicant_user_id,
        contentAccessUserId: application.content_access_user_id,
        attemptNumber: proof.attempt_number,
        amountMnt: proof.amount_mnt,
        status: proof.status,
        rejectionReason: proof.rejection_reason,
        submittedAt: proof.created_at,
        reviewedAt: proof.reviewed_at,
        paymentDueAt: application.payment_due_at,
        applicantName: parsed.applicant?.display_name ?? null,
        applicantEmail: application.contact_email,
        applicantRelationship: application.applicant_relationship,
        learnerName: parsed.learner.full_name,
        programName: application.terms_snapshot.program_name,
        offeringName: application.terms_snapshot.offering_name,
        courseId: application.terms_snapshot.course_id,
        courseTitle: application.terms_snapshot.course.title,
        deliveryMode: application.terms_snapshot.delivery_mode,
        contractPolicy: application.contract_policy_snapshot,
        applicationStatus: application.status,
        receiptUrl: parsed.receiptUrl,
        notification: parsed.notification,
        notificationTrackingError: parsed.notificationTrackingError,
    }
}

export function offeringPaymentMatchesSearch(payment: AdminOfferingPayment, search: string) {
    const normalized = search.trim().toLocaleLowerCase('mn-MN')
    if (!normalized) return true

    return [
        payment.applicantName,
        payment.applicantEmail,
        payment.learnerName,
        payment.programName,
        payment.offeringName,
        payment.courseTitle,
    ].some((value) => value?.toLocaleLowerCase('mn-MN').includes(normalized))
}
