import type { CohortStatus } from '@/features/programs/domain/training-program'

export type RegistrationWindowState = 'inactive' | 'scheduled' | 'open' | 'expired'

export function getRegistrationWindowState({
    status,
    registrationOpensAt,
    registrationClosesAt,
    now = Date.now(),
}: {
    status: CohortStatus
    registrationOpensAt: string | null
    registrationClosesAt: string | null
    now?: number
}): RegistrationWindowState {
    if (status !== 'open') return 'inactive'

    const opensAt = registrationOpensAt ? Date.parse(registrationOpensAt) : Number.NaN
    if (Number.isFinite(opensAt) && now < opensAt) return 'scheduled'

    const closesAt = registrationClosesAt ? Date.parse(registrationClosesAt) : Number.NaN
    if (Number.isFinite(closesAt) && now > closesAt) return 'expired'

    return 'open'
}
