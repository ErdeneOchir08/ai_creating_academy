import type { CohortApplicationField } from '@/features/programs/domain/cohort-application'
import type { DeliveryMode } from '@/features/programs/domain/training-program'

const contractVariablePattern = /\{\{([a-z][a-z0-9_]*)\}\}/g

export type PreviewContractVariable = {
    key: string
    label_mn: string
    description_mn: string
    category: 'contract' | 'participant' | 'program' | 'payment' | 'academy'
}

export type EnrollmentPreviewValuesInput = {
    programName: string
    cohortName: string
    deliveryMode: DeliveryMode
    scheduleSummary: string
    startsOn: string | null
    endsOn: string | null
    location: string
    tuitionAmountMnt: number | null
    paymentPlan: string
    issuer: {
        legalName: string
        representativeName: string
        phone: string
        address: string
        bankName: string
        bankAccountNumber: string
        bankAccountHolder: string
    }
}

const deliveryLabels: Record<DeliveryMode, string> = {
    online: 'Цахим',
    offline: 'Танхим',
    hybrid: 'Хосолсон',
}

function normalizedRecord(values: Record<string, string | number | null | undefined>) {
    return Object.fromEntries(Object.entries(values).flatMap(([key, rawValue]) => {
        if (rawValue === null || rawValue === undefined) return []
        const value = String(rawValue).trim()
        return value ? [[key, value]] : []
    }))
}

export function participantFieldsForContract(
    content: string,
    variables: PreviewContractVariable[],
): CohortApplicationField[] {
    const participantVariables = new Map(
        variables
            .filter((variable) => variable.category === 'participant')
            .map((variable) => [variable.key, variable]),
    )
    const usedKeys = new Set(Array.from(content.matchAll(contractVariablePattern), (match) => match[1]))

    return [...usedKeys]
        .sort((left, right) => left.localeCompare(right))
        .flatMap((key) => {
            const variable = participantVariables.get(key)
            return variable ? [{
                key: variable.key,
                label: variable.label_mn,
                description: variable.description_mn,
            }] : []
        })
}

export function buildEnrollmentContractPreviewValues(input: EnrollmentPreviewValuesInput) {
    return normalizedRecord({
        contract_number: 'Зөвшөөрөх үед үүснэ',
        contract_date: 'Зөвшөөрсөн өдөр',
        program_name: input.programName,
        cohort_name: input.cohortName,
        learning_format: deliveryLabels[input.deliveryMode],
        schedule: input.scheduleSummary,
        start_date: input.startsOn,
        end_date: input.endsOn,
        location: input.location,
        tuition_amount: input.tuitionAmountMnt,
        payment_plan: input.paymentPlan,
        academy_name: input.issuer.legalName,
        academy_representative: input.issuer.representativeName,
        academy_phone: input.issuer.phone,
        academy_address: input.issuer.address,
        bank_name: input.issuer.bankName,
        bank_account_number: input.issuer.bankAccountNumber,
        bank_account_holder: input.issuer.bankAccountHolder,
    })
}
