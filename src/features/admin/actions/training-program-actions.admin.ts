'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    assertCohortTransition,
    cohortStatuses,
    validateCohortPaymentDueDays,
    validateTrainingCohortInput,
    validateTrainingProgramInput,
    type CohortStatus,
    type DeliveryMode,
} from '@/features/programs/domain/training-program'

export type TrainingCohort = {
    id: string
    program_id: string
    name: string
    delivery_mode: DeliveryMode
    status: CohortStatus
    contract_version_id: string | null
    capacity: number | null
    tuition_amount_mnt: number | null
    payment_due_days: number | null
    payment_plan: string
    schedule_summary: string
    location: string
    registration_opens_at: string | null
    registration_closes_at: string | null
    starts_on: string | null
    ends_on: string | null
    created_at: string
    updated_at: string
}

export type TrainingProgramSummary = {
    id: string
    name: string
    description: string
    is_archived: boolean
    created_at: string
    updated_at: string
    cohortCount: number
    openCohortCount: number
}

export type TrainingProgramDetail = Omit<TrainingProgramSummary, 'cohortCount' | 'openCohortCount'> & {
    cohorts: TrainingCohort[]
}

export type PublishedContractOption = {
    id: string
    title: string
    version_number: number
    template_id: string
    template_name: string
    is_assignable: boolean
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Админаар нэвтэрнэ үү.')

    const { data: role, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')
    return { supabase, user }
}

function assertUuid(value: string, label: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error(`${label} буруу байна.`)
    }
}

function refreshPrograms(programId?: string) {
    revalidatePath('/admin/programs')
    if (programId) revalidatePath(`/admin/programs/${programId}`)
}

function programInput(formData: FormData) {
    return validateTrainingProgramInput({
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
    })
}

function cohortInput(formData: FormData) {
    return validateTrainingCohortInput({
        name: String(formData.get('name') ?? ''),
        deliveryMode: String(formData.get('delivery_mode') ?? ''),
        contractVersionId: String(formData.get('contract_version_id') ?? ''),
        capacity: String(formData.get('capacity') ?? ''),
        tuitionAmountMnt: String(formData.get('tuition_amount_mnt') ?? ''),
        paymentDueDays: String(formData.get('payment_due_days') ?? ''),
        paymentPlan: String(formData.get('payment_plan') ?? ''),
        scheduleSummary: String(formData.get('schedule_summary') ?? ''),
        location: String(formData.get('location') ?? ''),
        registrationOpensAt: String(formData.get('registration_opens_at') ?? ''),
        registrationClosesAt: String(formData.get('registration_closes_at') ?? ''),
        startsOn: String(formData.get('starts_on') ?? ''),
        endsOn: String(formData.get('ends_on') ?? ''),
    })
}

function cohortRecord(input: ReturnType<typeof cohortInput>) {
    return {
        name: input.name,
        delivery_mode: input.deliveryMode,
        contract_version_id: input.contractVersionId,
        capacity: input.capacity,
        tuition_amount_mnt: input.tuitionAmountMnt,
        payment_due_days: input.paymentDueDays,
        payment_plan: input.paymentPlan,
        schedule_summary: input.scheduleSummary,
        location: input.location,
        registration_opens_at: input.registrationOpensAt,
        registration_closes_at: input.registrationClosesAt,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
    }
}

export async function getTrainingProgramSummaries(): Promise<TrainingProgramSummary[]> {
    const { supabase } = await requireAdmin()
    const [programsResult, cohortsResult] = await Promise.all([
        supabase
            .from('training_programs')
            .select('id, name, description, is_archived, created_at, updated_at')
            .order('updated_at', { ascending: false }),
        supabase.from('training_cohorts').select('program_id, status'),
    ])

    if (programsResult.error || cohortsResult.error) {
        console.error('Unable to load training programs:', programsResult.error?.message ?? cohortsResult.error?.message)
        throw new Error('Хөтөлбөрүүдийг уншиж чадсангүй.')
    }

    const counts = new Map<string, { all: number; open: number }>()
    for (const cohort of cohortsResult.data ?? []) {
        const current = counts.get(cohort.program_id) ?? { all: 0, open: 0 }
        current.all += 1
        if (cohort.status === 'open') current.open += 1
        counts.set(cohort.program_id, current)
    }

    return (programsResult.data ?? []).map((program) => ({
        ...program,
        cohortCount: counts.get(program.id)?.all ?? 0,
        openCohortCount: counts.get(program.id)?.open ?? 0,
    })) as TrainingProgramSummary[]
}

export async function getTrainingProgram(programId: string): Promise<TrainingProgramDetail | null> {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const [programResult, cohortsResult] = await Promise.all([
        supabase
            .from('training_programs')
            .select('id, name, description, is_archived, created_at, updated_at')
            .eq('id', programId)
            .maybeSingle(),
        supabase
            .from('training_cohorts')
            .select('id, program_id, name, delivery_mode, status, contract_version_id, capacity, tuition_amount_mnt, payment_due_days, payment_plan, schedule_summary, location, registration_opens_at, registration_closes_at, starts_on, ends_on, created_at, updated_at')
            .eq('program_id', programId)
            .order('created_at', { ascending: false }),
    ])

    if (programResult.error || cohortsResult.error) {
        console.error('Unable to load training program:', programResult.error?.message ?? cohortsResult.error?.message)
        throw new Error('Хөтөлбөрийн мэдээллийг уншиж чадсангүй.')
    }
    if (!programResult.data) return null
    return { ...programResult.data, cohorts: (cohortsResult.data ?? []) as TrainingCohort[] } as TrainingProgramDetail
}

export async function getPublishedContractOptions(): Promise<PublishedContractOption[]> {
    const { supabase } = await requireAdmin()
    const [versionsResult, templatesResult] = await Promise.all([
        supabase
            .from('contract_template_versions')
            .select('id, title, version_number, template_id, status')
            .in('status', ['published', 'retired'])
            .order('published_at', { ascending: false }),
        supabase
            .from('contract_templates')
            .select('id, name, is_archived'),
    ])

    if (versionsResult.error || templatesResult.error) throw new Error('Нийтлэгдсэн гэрээнүүдийг уншиж чадсангүй.')
    const templates = new Map((templatesResult.data ?? []).map((template) => [template.id, template]))
    return (versionsResult.data ?? [])
        .filter((version) => templates.has(version.template_id))
        .map((version) => {
            const template = templates.get(version.template_id)!
            return {
                id: version.id,
                title: version.title,
                version_number: version.version_number,
                template_id: version.template_id,
                template_name: template.name,
                is_assignable: version.status === 'published' && !template.is_archived,
            }
        })
}

export async function createTrainingProgram(formData: FormData) {
    const { supabase, user } = await requireAdmin()
    const input = programInput(formData)
    const { data, error } = await supabase
        .from('training_programs')
        .insert({ ...input, created_by: user.id })
        .select('id')
        .single()

    if (error) {
        if (error.code === '23505') throw new Error('Ижил нэртэй хөтөлбөр аль хэдийн байна.')
        console.error('Unable to create training program:', error.message)
        throw new Error('Хөтөлбөр үүсгэж чадсангүй.')
    }
    refreshPrograms(data.id)
    return { programId: data.id }
}

export async function updateTrainingProgram(programId: string, formData: FormData) {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const input = programInput(formData)
    const { error } = await supabase.from('training_programs').update(input).eq('id', programId)
    if (error) {
        if (error.code === '23505') throw new Error('Ижил нэртэй хөтөлбөр аль хэдийн байна.')
        throw new Error('Хөтөлбөрийн мэдээллийг хадгалж чадсангүй.')
    }
    refreshPrograms(programId)
}

export async function setTrainingProgramArchived(programId: string, archived: boolean) {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase.from('training_programs').update({ is_archived: archived }).eq('id', programId)
    if (error) throw new Error('Хөтөлбөрийн төлөвийг өөрчилж чадсангүй.')
    refreshPrograms(programId)
}

export async function deleteTrainingProgram(programId: string) {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase.from('training_programs').delete().eq('id', programId)
    if (error) throw new Error(error.code === '23503'
        ? 'Элсэлтийн түүхтэй хөтөлбөрийг устгах боломжгүй. Архивлана уу.'
        : 'Хөтөлбөрийг устгаж чадсангүй.')
    refreshPrograms()
}

export async function createTrainingCohort(programId: string, formData: FormData) {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase, user } = await requireAdmin()
    const input = cohortInput(formData)
    const { data, error } = await supabase
        .from('training_cohorts')
        .insert({
            ...cohortRecord(input),
            program_id: programId,
            status: 'draft',
            created_by: user.id,
            status_changed_by: user.id,
        })
        .select('id')
        .single()

    if (error) {
        if (error.code === '23505') throw new Error('Энэ хөтөлбөрт ижил нэртэй элсэлт аль хэдийн байна.')
        if (error.message.includes('archived program')) throw new Error('Архивласан хөтөлбөрт шинэ элсэлт үүсгэх боломжгүй.')
        console.error('Unable to create training cohort:', error.message)
        throw new Error('Элсэлтийн ноорог үүсгэж чадсангүй.')
    }
    refreshPrograms(programId)
    return { cohortId: data.id }
}

export async function updateTrainingCohortDraft(cohortId: string, programId: string, formData: FormData) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const input = cohortInput(formData)
    const { data, error } = await supabase
        .from('training_cohorts')
        .update(cohortRecord(input))
        .eq('id', cohortId)
        .eq('program_id', programId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle()

    if (error || !data) {
        console.error('Unable to update training cohort:', error?.message)
        throw new Error('Зөвхөн ноорог элсэлтийн мэдээллийг засах боломжтой.')
    }
    refreshPrograms(programId)
}

export async function updateTrainingCohortPaymentDeadline(cohortId: string, programId: string, formData: FormData) {
    assertUuid(cohortId, 'Ээлжийн дугаар')
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const paymentDueDays = validateCohortPaymentDueDays(String(formData.get('payment_due_days') ?? ''))
    const { data: cohort, error: cohortError } = await supabase
        .from('training_cohorts')
        .select('tuition_amount_mnt')
        .eq('id', cohortId)
        .eq('program_id', programId)
        .maybeSingle()
    if (cohortError || !cohort) throw new Error('Ээлж олдсонгүй.')
    if ((cohort.tuition_amount_mnt ?? 0) > 0 && paymentDueDays === null) {
        throw new Error('Төлбөртэй элсэлтийн төлөх хугацааг хоосон орхиж болохгүй.')
    }
    const { data, error } = await supabase
        .from('training_cohorts')
        .update({ payment_due_days: paymentDueDays })
        .eq('id', cohortId)
        .eq('program_id', programId)
        .in('status', ['draft', 'open', 'closed'])
        .select('id')
        .maybeSingle()

    if (error || !data) {
        console.error('Unable to update cohort payment deadline:', error?.message)
        throw new Error('Төлбөр төлөх хугацааг хадгалж чадсангүй.')
    }
    refreshPrograms(programId)
}

export async function changeTrainingCohortStatus(cohortId: string, programId: string, nextStatus: CohortStatus) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    if (!cohortStatuses.includes(nextStatus)) throw new Error('Элсэлтийн төлөв буруу байна.')
    const { supabase } = await requireAdmin()
    const { data: current, error: readError } = await supabase
        .from('training_cohorts')
        .select('status')
        .eq('id', cohortId)
        .eq('program_id', programId)
        .maybeSingle()

    if (readError || !current) throw new Error('Элсэлт олдсонгүй.')
    assertCohortTransition(current.status as CohortStatus, nextStatus)

    const { error } = await supabase.from('training_cohorts').update({ status: nextStatus }).eq('id', cohortId)
    if (error) {
        if (error.message.includes('contract')) throw new Error('Элсэлт нээхийн өмнө идэвхтэй, нийтлэгдсэн гэрээ сонгоно уу.')
        if (error.message.includes('archived program')) throw new Error('Архивласан хөтөлбөрийн элсэлтийг нээх боломжгүй.')
        console.error('Unable to change cohort status:', error.message)
        throw new Error('Элсэлтийн төлөвийг өөрчилж чадсангүй.')
    }
    refreshPrograms(programId)
}

export async function deleteTrainingCohortDraft(cohortId: string, programId: string) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase
        .from('training_cohorts')
        .delete()
        .eq('id', cohortId)
        .eq('program_id', programId)
        .eq('status', 'draft')
    if (error) throw new Error('Зөвхөн ноорог элсэлтийг устгах боломжтой.')
    refreshPrograms(programId)
}
