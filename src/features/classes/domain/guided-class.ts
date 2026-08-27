import { classTypeRules, type ClassType } from './class-type'

export type GuidedReadinessItem = {
    key: string
    label: string
    complete: boolean
    help: string
    step: number
}

export type GuidedReadinessClass = {
    classType: ClassType
    courseId: string | null
    contractVersionId: string | null
    tuitionAmountMnt: number | null
    paymentDueDays: number | null
    scheduleSummary: string
    location: string
    startsOn: string | null
    endsOn: string | null
    qpayEnabled: boolean
    manualTransferEnabled: boolean
}

export function guidedClassReadiness(
    draft: GuidedReadinessClass,
    options: {
        courseReady: boolean
        contractReady: boolean
        qpayAvailable: boolean
    },
): GuidedReadinessItem[] {
    const rules = classTypeRules[draft.classType]
    const scheduled = draft.classType !== 'self_paced_online'
    return [
        {
            key: 'course',
            label: 'Видео хичээл бэлэн',
            complete: Boolean(draft.courseId) && options.courseReady,
            help: 'Нийтлэгдсэн, бэлэн видеотой хичээл сонгоно.',
            step: 2,
        },
        {
            key: 'schedule',
            label: scheduled ? 'Хуваарь бүрэн' : 'Суралцах хугацаа тохиромжтой',
            complete: !scheduled || Boolean(draft.startsOn && draft.endsOn && draft.scheduleSummary),
            help: scheduled ? 'Эхлэх, дуусах өдөр болон хуваарийг оруулна.' : 'Бие даан суралцах ангид тогтсон хуваарь шаардлагагүй.',
            step: 3,
        },
        {
            key: 'location',
            label: 'Танхимын байршил бэлэн',
            complete: draft.classType !== 'offline_with_video' || Boolean(draft.location),
            help: 'Танхимын ангид суралцагч очих бүтэн байршлыг оруулна.',
            step: 3,
        },
        {
            key: 'contract',
            label: rules.contractPolicy === 'required' ? 'Гэрээ бэлэн' : 'Гэрээ шаардлагагүй',
            complete: rules.contractPolicy === 'none' || Boolean(draft.contractVersionId && options.contractReady),
            help: 'Багштай болон танхимын ангид идэвхтэй нийтлэгдсэн гэрээ сонгоно.',
            step: 4,
        },
        {
            key: 'price',
            label: 'Үнэ, төлөх хугацаа бэлэн',
            complete: Boolean(draft.tuitionAmountMnt && draft.tuitionAmountMnt > 0 && draft.paymentDueDays && draft.paymentDueDays > 0),
            help: 'Үнэ болон төлөх хоногийг 0-ээс их тоогоор оруулна.',
            step: 4,
        },
        {
            key: 'payment',
            label: 'Төлбөрийн арга бэлэн',
            complete: (draft.qpayEnabled && options.qpayAvailable) || draft.manualTransferEnabled,
            help: 'QPay эсвэл банкны шилжүүлгээс дор хаяж нэгийг идэвхжүүлнэ.',
            step: 4,
        },
    ]
}
