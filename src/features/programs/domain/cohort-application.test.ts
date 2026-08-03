import { describe, expect, it } from 'vitest'
import {
    answersFromFormData,
    parseApprovedApplicationContractSnapshot,
    parseCohortApplicationForm,
    parseOpenCohorts,
    renderApprovedContractSnapshot,
} from './cohort-application'

const cohort = {
    cohort_id: '7fd98a63-0415-4d45-a26d-6ea9bd436f15',
    program_name: 'TeenCoder',
    program_description: 'Өсвөрийн кодчиллын хөтөлбөр',
    cohort_name: '2026 намрын элсэлт',
    delivery_mode: 'offline',
    capacity: 20,
    approved_count: 4,
    tuition_amount_mnt: 450_000,
    payment_plan: 'Бүтэн төлөлт',
    schedule_summary: 'Бямба, Ням',
    location: 'Улаанбаатар',
    registration_closes_at: null,
    starts_on: '2026-09-01',
    ends_on: '2027-04-30',
}

describe('cohort application domain', () => {
    it('parses an open cohort result and coerces the aggregate count', () => {
        expect(parseOpenCohorts([{ ...cohort, approved_count: '4' }])[0].approved_count).toBe(4)
    })

    it('parses a contract-driven application form', () => {
        const parsed = parseCohortApplicationForm({
            ...cohort,
            contract_title: 'TeenCoder сургалтын гэрээ',
            contract_version_number: 1,
            is_accepting_applications: true,
            fields: [{ key: 'student_name', label: 'Суралцагчийн нэр', description: '' }],
            my_application: null,
        })
        expect(parsed.fields[0].key).toBe('student_name')
    })

    it('extracts only answer-prefixed form fields', () => {
        const formData = new FormData()
        formData.set('answer:student_name', '  Бат Болд  ')
        formData.set('cohort_id', 'ignored')
        expect(answersFromFormData(formData)).toEqual({ student_name: 'Бат Болд' })
    })

    it('rejects malformed dynamic answer keys', () => {
        const formData = new FormData()
        formData.set('answer:../../role', 'admin')
        expect(() => answersFromFormData(formData)).toThrow('Өргөдлийн талбар буруу байна.')
    })

    it('parses and renders an immutable approved contract snapshot', () => {
        const snapshot = parseApprovedApplicationContractSnapshot({
            id: '83791d9e-07cd-41ca-972c-896964ccf47f',
            application_id: 'af4c1761-d3cd-44d4-bff0-00ca9a6d8be6',
            contract_title: 'TeenCoder сургалтын гэрээ',
            contract_version_number: 2,
            contract_content: 'Суралцагч: {{student_name}}\nТөлөөлөгч: {{academy_representative}}',
            unresolved_variable_keys: ['academy_representative'],
            resolved_values: { student_name: 'Бат Болд' },
            created_at: '2026-08-03T07:00:00.000Z',
        })

        expect(renderApprovedContractSnapshot(snapshot.contract_content, snapshot.resolved_values))
            .toBe('Суралцагч: Бат Болд\nТөлөөлөгч: ⟦academy_representative⟧')
    })
})
