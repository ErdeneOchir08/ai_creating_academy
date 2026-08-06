import type {
    MyOfferingCheckoutStatus,
    OfferingCheckoutStatus,
} from '@/features/checkout/domain/offering-checkout'

export type OfferingCheckoutStatusTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success'

export type OfferingCheckoutStatusPresentation = {
    label: string
    description: string
    actionLabel: string
    tone: OfferingCheckoutStatusTone
    showPaymentDeadline: boolean
    showRejectionReason: boolean
}

const presentations = {
    draft: {
        label: 'Мэдээлэл дутуу',
        description: 'Суралцагчийн мэдээллээ бөглөж хүсэлтээ үргэлжлүүлнэ үү.',
        actionLabel: 'Үргэлжлүүлэх',
        tone: 'neutral',
        showPaymentDeadline: false,
        showRejectionReason: false,
    },
    contract_required: {
        label: 'Гэрээ зөвшөөрөх шаардлагатай',
        description: 'Гэрээг хянаж зөвшөөрсний дараа төлбөрийн алхам нээгдэнэ.',
        actionLabel: 'Гэрээг үргэлжлүүлэх',
        tone: 'info',
        showPaymentDeadline: true,
        showRejectionReason: false,
    },
    ready_for_payment: {
        label: 'Төлбөрийн баримт хүлээгдэж байна',
        description: 'Төлбөрийн баримтаа эцсийн хугацаанаас өмнө илгээнэ үү.',
        actionLabel: 'Төлбөрийн алхам руу очих',
        tone: 'info',
        showPaymentDeadline: true,
        showRejectionReason: false,
    },
    pending_review: {
        label: 'Төлбөр хянагдаж байна',
        description: 'Таны төлбөрийн баримтыг академийн админ шалгаж байна.',
        actionLabel: 'Дэлгэрэнгүй харах',
        tone: 'warning',
        showPaymentDeadline: false,
        showRejectionReason: false,
    },
    correction_required: {
        label: 'Баримтыг засах шаардлагатай',
        description: 'Админы тайлбарыг шалгаад төлбөрийн баримтаа дахин илгээнэ үү.',
        actionLabel: 'Баримт дахин илгээх',
        tone: 'danger',
        showPaymentDeadline: true,
        showRejectionReason: true,
    },
    approved: {
        label: 'Элсэлт баталгаажсан',
        description: 'Хичээл үзэх эрх идэвхжсэн байна.',
        actionLabel: 'Хичээл үзэх',
        tone: 'success',
        showPaymentDeadline: false,
        showRejectionReason: false,
    },
    withdrawn: {
        label: 'Хүсэлт цуцлагдсан',
        description: 'Энэ элсэлтийн хүсэлт цуцлагдсан байна.',
        actionLabel: 'Дэлгэрэнгүй харах',
        tone: 'neutral',
        showPaymentDeadline: false,
        showRejectionReason: false,
    },
} satisfies Record<OfferingCheckoutStatus, OfferingCheckoutStatusPresentation>

export function getOfferingCheckoutStatusPresentation(status: OfferingCheckoutStatus) {
    return presentations[status]
}

export function selectNonApprovedOfferingCheckoutStatuses<
    T extends Pick<MyOfferingCheckoutStatus, 'application_status'>,
>(statuses: readonly T[]) {
    return statuses.filter((status) => status.application_status !== 'approved')
}
