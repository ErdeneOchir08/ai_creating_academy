'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CohortApplicationStatus } from '@/features/programs/domain/cohort-application'

type Relation<T> = T | T[] | null

type RawApplication = {
    id: string
    status: CohortApplicationStatus
    contact_email: string
    answers: Record<string, string>
    submitted_at: string | null
    reviewed_at: string | null
    rejection_reason: string | null
    created_at: string
    updated_at: string
    applicant: Relation<{ display_name: string | null }>
    cohort: Relation<{
        id: string
        name: string
        tuition_amount_mnt: number | null
        program: Relation<{ name: string }>
    }>
    contract: Relation<{ title: string; version_number: number }>
    contract_snapshot: Relation<{
        id: string
        created_at: string
        unresolved_variable_keys: string[]
    }>
}
export type AdminCohortApplication = Omit<RawApplication, 'applicant' | 'cohort' | 'contract' | 'contract_snapshot'> & {
    applicant: { display_name: string | null } | null
    cohort: {
        id: string
        name: string
        tuition_amount_mnt: number | null
        program: { name: string } | null
    } | null
    contract: { title: string; version_number: number } | null
    contract_snapshot: {
        id: string
        created_at: string
        unresolved_variable_keys: string[]
    } | null
}

function first<T>(value: Relation<T>) {
    return Array.isArray(value) ? value[0] ?? null : value
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Нэвтрэх шаардлагатай.')

    const { data: role, error } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')
    return supabase
}

function assertUuid(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error('Өргөдлийн дугаар буруу байна.')
    }
}

export async function getAdminCohortApplications() {
    const supabase = await requireAdmin()
    const [applicationsResult, variablesResult] = await Promise.all([
        supabase
            .from('cohort_applications')
            .select(`
                id, status, contact_email, answers, submitted_at, reviewed_at,
                rejection_reason, created_at, updated_at,
                applicant:profiles!cohort_applications_applicant_user_id_fkey ( display_name ),
                cohort:training_cohorts!cohort_applications_cohort_id_fkey (
                    id, name, tuition_amount_mnt,
                    program:training_programs!training_cohorts_program_id_fkey ( name )
                ),
                contract:contract_template_versions!cohort_applications_contract_version_id_fkey ( title, version_number ),
                contract_snapshot:cohort_application_contract_snapshots!cohort_application_contract_snapshots_application_id_fkey (
                    id, created_at, unresolved_variable_keys
                )
            `)
            .order('updated_at', { ascending: false }),
        supabase
            .from('contract_variables')
            .select('key, label_mn'),
    ])

    if (applicationsResult.error || variablesResult.error) {
        console.error('Unable to load cohort applications:', applicationsResult.error?.message ?? variablesResult.error?.message)
        throw new Error('Элсэлтийн өргөдлүүдийг уншиж чадсангүй.')
    }

    const applications = ((applicationsResult.data ?? []) as unknown as RawApplication[]).map((application) => {
        const cohort = first(application.cohort)
        return {
            ...application,
            applicant: first(application.applicant),
            cohort: cohort ? { ...cohort, program: first(cohort.program) } : null,
            contract: first(application.contract),
            contract_snapshot: first(application.contract_snapshot),
        }
    }) as AdminCohortApplication[]

    return {
        applications,
        variableLabels: Object.fromEntries((variablesResult.data ?? []).map((variable) => [variable.key, variable.label_mn])),
    }
}

export async function reviewCohortApplication(applicationId: string, decision: 'approved' | 'rejected', rejectionReason?: string) {
    assertUuid(applicationId)
    const supabase = await requireAdmin()
    const { error } = await supabase.rpc('review_cohort_application', {
        p_application_id: applicationId,
        p_decision: decision,
        p_rejection_reason: rejectionReason?.trim() || null,
    })

    if (error) {
        console.error('Unable to review cohort application:', error.message)
        if (error.message.includes('capacity')) throw new Error('Энэ ээлжийн зөвшөөрөгдсөн суралцагчийн тоо суудлын хязгаарт хүрсэн байна.')
        if (error.message.includes('reason')) throw new Error('Буцаах шалтгааныг оруулна уу.')
        throw new Error('Өргөдлийн шийдвэрийг хадгалж чадсангүй.')
    }

    revalidatePath('/admin/applications')
    revalidatePath('/programs')
    return { success: decision === 'approved' ? 'Өргөдлийг зөвшөөрлөө.' : 'Өргөдлийг шалтгаантайгаар буцаалаа.' }
}
