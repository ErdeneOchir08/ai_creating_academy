import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { parseApprovedApplicationContractSnapshot } from '@/features/programs/domain/cohort-application'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function getMyApprovedContractSnapshot(cohortId: string) {
    if (!uuidPattern.test(cohortId)) throw new Error('Элсэлтийн дугаар буруу байна.')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('cohort_application_contract_snapshots')
        .select(`
            id,
            application_id,
            contract_title,
            contract_version_number,
            contract_number,
            contract_date,
            contract_content,
            unresolved_variable_keys,
            resolved_values,
            created_at
        `)
        .eq('cohort_id', cohortId)
        .eq('applicant_user_id', user.id)
        .maybeSingle()

    if (error) {
        console.error('Unable to load approved contract snapshot:', error.message)
        throw new Error('Баталгаажсан гэрээний хувийг уншиж чадсангүй.')
    }

    return data ? parseApprovedApplicationContractSnapshot(data) : null
}
