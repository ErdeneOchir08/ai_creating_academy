import { describe, expect, it } from 'vitest'
import {
    answersFromFormData,
    parseAdminApprovedApplicationContractSnapshot,
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
            contract_number: '26/65',
            contract_date: '2026-08-04',
            contract_content: 'Суралцагч: {{student_name}}\nТөлөөлөгч: {{academy_representative}}',
            unresolved_variable_keys: ['academy_representative'],
            resolved_values: { student_name: 'Бат Болд' },
            created_at: '2026-08-03T07:00:00.000Z',
        })

        expect(renderApprovedContractSnapshot(snapshot.contract_content, snapshot.resolved_values))
            .toBe('Суралцагч: Бат Болд\nТөлөөлөгч: ⟦academy_representative⟧')
    })

    it('validates the complete admin audit snapshot', () => {
        const snapshot = parseAdminApprovedApplicationContractSnapshot({
            id: '83791d9e-07cd-41ca-972c-896964ccf47f',
            application_id: 'af4c1761-d3cd-44d4-bff0-00ca9a6d8be6',
            applicant_user_id: '7cb4d882-4a5c-4b24-9b2d-20b79f59ab31',
            cohort_id: '7fd98a63-0415-4d45-a26d-6ea9bd436f15',
            contract_version_id: '44021b7b-7547-462f-b755-fc6a529201f7',
            contract_title: 'TeenCoder сургалтын гэрээ',
            contract_version_number: 2,
            contract_number: '26/65',
            contract_date: '2026-08-04',
            contract_content: 'Суралцагч: {{student_name}}',
            required_variable_keys: ['student_name'],
            unresolved_variable_keys: [],
            resolved_values: { student_name: 'Бат Болд' },
            application_answers: { student_name: 'Бат Болд' },
            application_details: {
                contact_email: 'student@example.com',
                status: 'approved',
                submitted_at: '2026-08-03T06:00:00.000Z',
                reviewed_at: '2026-08-03T07:00:00.000Z',
                created_at: '2026-08-03T05:00:00.000Z',
                updated_at: '2026-08-03T07:00:00.000Z',
            },
            program_details: {
                program: { id: '7f1679b0-9b21-4cf2-a342-c701a81a1124', name: 'TeenCoder', description: '' },
                cohort: {
                    id: '7fd98a63-0415-4d45-a26d-6ea9bd436f15',
                    name: '2026 намар',
                    delivery_mode: 'offline',
                    capacity: 20,
                    tuition_amount_mnt: 450000,
                    payment_plan: '',
                    schedule_summary: 'Бямба, Ням',
                    location: 'Mind Academy',
                    registration_opens_at: null,
                    registration_closes_at: null,
                    starts_on: '2026-09-01',
                    ends_on: null,
                },
            },
            academy_details: {
                display_name: 'Mind Academy',
                short_description: null,
                public_email: null,
                phone: null,
                address: null,
                business_hours: null,
                website_url: 'https://mindacademy.mn',
                legal_name: 'Майнд Аженси Эл И ХХК',
                representative_name: 'Ж.Эрдэнэчимэг',
                contract_phone: '+976 8045 6060',
                contract_address: 'Улаанбаатар хот',
                bank_name: 'Хаан банк',
                bank_account_number: 'MN560005005475336658',
                bank_account_holder: 'Майнд Аженси Эл И',
            },
            created_by: 'bfa1263d-c485-4f8c-ad2b-3d728b43d12a',
            created_at: '2026-08-03T07:00:00.000Z',
        })

        expect(snapshot.application_details.contact_email).toBe('student@example.com')
        expect(snapshot.program_details.cohort.tuition_amount_mnt).toBe(450000)
    })
})
