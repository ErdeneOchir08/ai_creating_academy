import type { ContractPolicy, DeliveryMode } from '@/features/programs/domain/training-program'

export const classTypes = [
    'self_paced_online',
    'instructor_led_online',
    'offline_with_video',
] as const

export type ClassType = (typeof classTypes)[number]
export type DisplayClassType = ClassType | 'legacy'

export const classTypeLabels: Record<DisplayClassType, string> = {
    self_paced_online: 'Онлайн · бие даан суралцах',
    instructor_led_online: 'Онлайн · багштай',
    offline_with_video: 'Танхим · видео хичээлтэй',
    legacy: 'Хуучин бүртгэл',
}

export const classTypeShortLabels: Record<DisplayClassType, string> = {
    self_paced_online: 'Бие даан онлайн',
    instructor_led_online: 'Багштай онлайн',
    offline_with_video: 'Танхим + видео',
    legacy: 'Хуучин урсгал',
}

export const classTypeRules: Record<ClassType, {
    deliveryMode: Extract<DeliveryMode, 'online' | 'offline'>
    contractPolicy: ContractPolicy
    needsTeacher: boolean
}> = {
    self_paced_online: {
        deliveryMode: 'online',
        contractPolicy: 'none',
        needsTeacher: false,
    },
    instructor_led_online: {
        deliveryMode: 'online',
        contractPolicy: 'required',
        needsTeacher: true,
    },
    offline_with_video: {
        deliveryMode: 'offline',
        contractPolicy: 'required',
        needsTeacher: true,
    },
}

export function deriveClassType(input: {
    classType?: string | null
    deliveryMode: DeliveryMode
    contractPolicy: ContractPolicy
}): DisplayClassType {
    if (classTypes.includes(input.classType as ClassType)) return input.classType as ClassType
    if (input.deliveryMode === 'online' && input.contractPolicy === 'none') return 'self_paced_online'
    if (input.deliveryMode === 'online' && input.contractPolicy === 'required') return 'instructor_led_online'
    if (input.deliveryMode === 'offline' && input.contractPolicy === 'required') return 'offline_with_video'
    return 'legacy'
}

export function storedClassType(input: {
    deliveryMode: DeliveryMode
    contractPolicy: ContractPolicy
}): ClassType | null {
    const derived = deriveClassType(input)
    return derived === 'legacy' ? null : derived
}
