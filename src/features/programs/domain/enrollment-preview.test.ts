import { describe, expect, it } from 'vitest'
import {
    buildEnrollmentContractPreviewValues,
    participantFieldsForContract,
    type PreviewContractVariable,
} from './enrollment-preview'

const participantVariables: PreviewContractVariable[] = [
    {
        key: 'student_name',
        label_mn: 'Суралцагчийн нэр',
        description_mn: 'Бүтэн нэр',
        category: 'participant',
    },
    {
        key: 'signer_name',
        label_mn: 'Гэрээ зөвшөөрөх хүний нэр',
        description_mn: 'Бүтэн нэр',
        category: 'participant',
    },
    {
        key: 'program_name',
        label_mn: 'Хөтөлбөрийн нэр',
        description_mn: 'Хөтөлбөр',
        category: 'program',
    },
]

describe('participantFieldsForContract', () => {
    it('returns each participant variable used by the selected contract exactly once', () => {
        const fields = participantFieldsForContract(
            '{{student_name}} {{program_name}} {{signer_name}} {{student_name}}',
            participantVariables,
        )

        expect(fields).toEqual([
            { key: 'signer_name', label: 'Гэрээ зөвшөөрөх хүний нэр', description: 'Бүтэн нэр' },
            { key: 'student_name', label: 'Суралцагчийн нэр', description: 'Бүтэн нэр' },
        ])
    })

    it('does not invent fields for unknown contract variables', () => {
        expect(participantFieldsForContract('{{unknown_field}}', participantVariables)).toEqual([])
    })
})

describe('buildEnrollmentContractPreviewValues', () => {
    it('uses actual cohort and issuer values while omitting blank optional values', () => {
        const values = buildEnrollmentContractPreviewValues({
            programName: 'TeenCoder',
            cohortName: '2026 намрын элсэлт',
            deliveryMode: 'offline',
            scheduleSummary: 'Даваа, Лхагва, Баасан 17:00–19:00',
            startsOn: '2026-08-17',
            endsOn: null,
            location: 'Twin Tower 1, 505',
            tuitionAmountMnt: 450000,
            paymentPlan: '',
            issuer: {
                legalName: 'Mind Academy',
                representativeName: 'Захирал',
                phone: '00000000',
                address: 'Улаанбаатар',
                bankName: '',
                bankAccountNumber: '',
                bankAccountHolder: '',
            },
        })

        expect(values).toMatchObject({
            program_name: 'TeenCoder',
            cohort_name: '2026 намрын элсэлт',
            learning_format: 'Танхим',
            tuition_amount: '450000',
            academy_name: 'Mind Academy',
        })
        expect(values).not.toHaveProperty('end_date')
        expect(values).not.toHaveProperty('payment_plan')
        expect(values).not.toHaveProperty('bank_name')
    })
})
