import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
    cohortApplicationFormSchema,
    type CohortApplicationForm,
} from '@/features/programs/domain/cohort-application'
import {
    buildEnrollmentContractPreviewValues,
    participantFieldsForContract,
    type PreviewContractVariable,
} from '@/features/programs/domain/enrollment-preview'
import type { CohortStatus, DeliveryMode } from '@/features/programs/domain/training-program'

type ContractStatus = 'draft' | 'published' | 'retired'

export type EnrollmentPreviewContractOption = {
    id: string
    title: string
    versionNumber: number
    status: ContractStatus
    templateName: string
    templateArchived: boolean
}

export type AdminEnrollmentPreview = {
    adminEmail: string
    programId: string
    programName: string
    cohortId: string
    cohortName: string
    cohortStatus: CohortStatus
    assignedContractVersionId: string | null
    selectedContractVersionId: string | null
    selectedContract: EnrollmentPreviewContractOption | null
    contractOptions: EnrollmentPreviewContractOption[]
    form: CohortApplicationForm | null
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertUuid(value: string, label: string) {
    if (!uuidPattern.test(value)) throw new Error(`${label} буруу байна.`)
}

export async function getAdminEnrollmentPreview(
    programId: string,
    cohortId: string,
    requestedContractVersionId?: string,
): Promise<AdminEnrollmentPreview | null> {
    assertUuid(programId, 'Хөтөлбөрийн дугаар')
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    const requestedContractVersionIsValid = requestedContractVersionId
        ? uuidPattern.test(requestedContractVersionId)
        : true

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Админаар нэвтэрнэ үү.')

    const roleResult = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
    if (roleResult.error || roleResult.data?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')

    const [programResult, cohortResult, versionsResult, templatesResult, variablesResult, issuerResult, approvedCountResult] = await Promise.all([
        supabase
            .from('training_programs')
            .select('id, name, description')
            .eq('id', programId)
            .maybeSingle(),
        supabase
            .from('training_cohorts')
            .select('id, program_id, name, delivery_mode, status, contract_version_id, capacity, tuition_amount_mnt, payment_plan, schedule_summary, location, registration_closes_at, starts_on, ends_on')
            .eq('id', cohortId)
            .eq('program_id', programId)
            .maybeSingle(),
        supabase
            .from('contract_template_versions')
            .select('id, template_id, version_number, status, title, content')
            .order('version_number', { ascending: false }),
        supabase
            .from('contract_templates')
            .select('id, name, is_archived'),
        supabase
            .from('contract_variables')
            .select('key, label_mn, description_mn, category')
            .eq('is_active', true),
        supabase
            .from('contract_issuer_profile')
            .select('legal_name, representative_name, phone, address, bank_name, bank_account_number, bank_account_holder')
            .eq('id', true)
            .maybeSingle(),
        supabase
            .from('cohort_applications')
            .select('id', { count: 'exact', head: true })
            .eq('cohort_id', cohortId)
            .eq('status', 'approved'),
    ])

    const queryError = programResult.error
        ?? cohortResult.error
        ?? versionsResult.error
        ?? templatesResult.error
        ?? variablesResult.error
        ?? issuerResult.error
        ?? approvedCountResult.error
    if (queryError) {
        console.error('Unable to load admin enrollment preview:', queryError.message)
        throw new Error('Элсэлтийн урьдчилсан харагдацыг ачаалж чадсангүй.')
    }
    if (!programResult.data || !cohortResult.data) return null
    if (!issuerResult.data) throw new Error('Гэрээ байгуулагчийн мэдээлэл тохируулагдаагүй байна.')

    const templates = new Map((templatesResult.data ?? []).map((template) => [template.id, template]))
    const contractOptions = (versionsResult.data ?? []).flatMap((version) => {
        const template = templates.get(version.template_id)
        return template ? [{
            id: version.id,
            title: version.title,
            versionNumber: version.version_number,
            status: version.status as ContractStatus,
            templateName: template.name,
            templateArchived: template.is_archived,
        }] : []
    })

    const selectedContractVersionId = requestedContractVersionId
        ? requestedContractVersionIsValid ? requestedContractVersionId : null
        : cohortResult.data.contract_version_id ?? null
    const selectedVersion = selectedContractVersionId
        ? (versionsResult.data ?? []).find((version) => version.id === selectedContractVersionId) ?? null
        : null
    const selectedContract = selectedVersion
        ? contractOptions.find((option) => option.id === selectedVersion.id) ?? null
        : null

    const cohort = cohortResult.data
    const form = selectedVersion && selectedContract
        ? cohortApplicationFormSchema.parse({
            cohort_id: cohort.id,
            program_name: programResult.data.name,
            program_description: programResult.data.description,
            cohort_name: cohort.name,
            delivery_mode: cohort.delivery_mode as DeliveryMode,
            capacity: cohort.capacity,
            approved_count: approvedCountResult.count ?? 0,
            tuition_amount_mnt: cohort.tuition_amount_mnt,
            payment_plan: cohort.payment_plan,
            schedule_summary: cohort.schedule_summary,
            location: cohort.location,
            registration_closes_at: cohort.registration_closes_at,
            starts_on: cohort.starts_on,
            ends_on: cohort.ends_on,
            contract_title: selectedVersion.title,
            contract_version_number: selectedVersion.version_number,
            contract_content: selectedVersion.content,
            contract_preview_values: buildEnrollmentContractPreviewValues({
                programName: programResult.data.name,
                cohortName: cohort.name,
                deliveryMode: cohort.delivery_mode as DeliveryMode,
                scheduleSummary: cohort.schedule_summary,
                startsOn: cohort.starts_on,
                endsOn: cohort.ends_on,
                location: cohort.location,
                tuitionAmountMnt: cohort.tuition_amount_mnt,
                paymentPlan: cohort.payment_plan,
                issuer: {
                    legalName: issuerResult.data.legal_name,
                    representativeName: issuerResult.data.representative_name,
                    phone: issuerResult.data.phone,
                    address: issuerResult.data.address,
                    bankName: issuerResult.data.bank_name,
                    bankAccountNumber: issuerResult.data.bank_account_number,
                    bankAccountHolder: issuerResult.data.bank_account_holder,
                },
            }),
            is_accepting_applications: false,
            fields: participantFieldsForContract(
                selectedVersion.content,
                (variablesResult.data ?? []) as PreviewContractVariable[],
            ),
            my_application: null,
        })
        : null

    return {
        adminEmail: user.email ?? '',
        programId,
        programName: programResult.data.name,
        cohortId,
        cohortName: cohort.name,
        cohortStatus: cohort.status as CohortStatus,
        assignedContractVersionId: cohort.contract_version_id,
        selectedContractVersionId,
        selectedContract,
        contractOptions,
        form,
    }
}
