import type { SavedOfferingApplication } from './offering-checkout'

export function isDirectCourseCheckout(value: {
    course_managed?: boolean
    class_type?: string
    contract_policy: string
    delivery_mode: string
}) {
    return value.course_managed === true && value.class_type === 'self_paced_online'
        && value.contract_policy === 'none' && value.delivery_mode === 'online'
}

// Never start a second charge while an earlier receipt/payment needs attention.
export function directCourseApplication(applications: SavedOfferingApplication[]) {
    return applications.find((item) => item.application_status === 'pending_review')
        ?? applications.find((item) => item.application_status === 'approved')
        ?? applications.find((item) => item.application_status !== 'withdrawn')
        ?? applications[0]
        ?? null
}
