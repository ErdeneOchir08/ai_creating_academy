export type AdminAttentionCounts = {
    manualPayments: number
    qpayProblems: number
    unansweredQuestions: number
    draftClasses: number
}

export type AdminAttentionItem = {
    id: 'manual-payments' | 'qpay-problems' | 'questions' | 'draft-classes'
    title: string
    description: string
    href: string
    count: number
    priority: 'urgent' | 'normal'
}

export function countAdminAttention(counts: AdminAttentionCounts) {
    return counts.manualPayments
        + counts.qpayProblems
        + counts.unansweredQuestions
        + counts.draftClasses
}

export function buildAdminAttentionItems(counts: AdminAttentionCounts): AdminAttentionItem[] {
    const items: AdminAttentionItem[] = [
        {
            id: 'manual-payments',
            title: 'Банкны шилжүүлгийг шалгах',
            description: 'Суралцагч баримт илгээсэн. Зөв төлбөр мөн эсэхийг шалгаад шийдвэрлэнэ.',
            href: '/admin/payments?type=offering&status=pending',
            count: counts.manualPayments,
            priority: 'urgent',
        },
        {
            id: 'qpay-problems',
            title: 'QPay асуудлыг шалгах',
            description: 'Автомат төлбөр амжилтгүй болсон эсвэл санхүүгийн хяналт шаардаж байна.',
            href: '/admin/payments?type=qpay&status=rejected',
            count: counts.qpayProblems,
            priority: 'urgent',
        },
        {
            id: 'questions',
            title: 'Суралцагчийн асуултад хариулах',
            description: 'Видео хичээл дээр хариу хүлээж буй асуултууд байна.',
            href: '/admin/qa',
            count: counts.unansweredQuestions,
            priority: 'normal',
        },
        {
            id: 'draft-classes',
            title: 'Ноорог ангиа дуусгах',
            description: 'Нийтлээгүй ангийн тохиргоог үргэлжлүүлж, бэлэн болгоно.',
            href: '/admin/classes?view=draft',
            count: counts.draftClasses,
            priority: 'normal',
        },
    ]

    return items.filter((item) => item.count > 0)
}
