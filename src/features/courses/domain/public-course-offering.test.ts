import { describe, expect, it } from 'vitest'

import {
    parseCourseUsesOfferingCheckout,
    parseOfferingDisplayMetadata,
    parseOfferingDisplayMetadataItem,
    parsePublicCourseOfferings,
} from './public-course-offering'

const courseId = '7fd98a63-0415-4d45-a26d-6ea9bd436f15'
const offering = {
    offering_id: '8ed7616e-e839-4b36-858a-2d778dcdd70d',
    course_id: courseId,
    program_name: 'TeenCoder',
    program_description: 'Өсвөрийн кодчиллын хөтөлбөр',
    offering_name: '2026 намрын элсэлт',
    delivery_mode: 'offline',
    contract_policy: 'required',
    capacity: 20,
    available_seats: 8,
    tuition_amount_mnt: 650_000,
    payment_plan: 'Бүтэн төлөлт',
    schedule_summary: 'Даваа, Лхагва, Баасан 17:00–19:00',
    location: 'Twin Tower',
    registration_closes_at: '2026-08-17T01:00:00+00:00',
    starts_on: '2026-08-17',
    ends_on: '2026-09-17',
}

describe('public course offering domain', () => {
    it('parses the fixed public RPC row contract', () => {
        expect(parsePublicCourseOfferings([offering], courseId)).toEqual([offering])
    })

    it('coerces aggregate seat counts returned as strings', () => {
        expect(parsePublicCourseOfferings([{
            ...offering,
            available_seats: '8',
        }], courseId)[0].available_seats).toBe(8)
    })

    it('rejects an offering belonging to a different course', () => {
        expect(() => parsePublicCourseOfferings([{
            ...offering,
            course_id: 'bfa1263d-c485-4f8c-ad2b-3d728b43d12a',
        }], courseId)).toThrow('Элсэлтийн сонголтын хичээлийн мэдээлэл зөрүүтэй байна.')
    })

    it('rejects a null list instead of reporting it as no open enrollment', () => {
        expect(() => parsePublicCourseOfferings(null, courseId)).toThrow()
    })

    it('rejects V2 offerings with unsupported delivery or incomplete payment terms', () => {
        expect(() => parsePublicCourseOfferings([{ ...offering, delivery_mode: 'hybrid' }], courseId)).toThrow()
        expect(() => parsePublicCourseOfferings([{ ...offering, tuition_amount_mnt: 0 }], courseId)).toThrow()
        expect(() => parsePublicCourseOfferings([{ ...offering, tuition_amount_mnt: null }], courseId)).toThrow()
    })

    it('parses the ownership RPC as a strict boolean', () => {
        expect(parseCourseUsesOfferingCheckout(true)).toBe(true)
        expect(parseCourseUsesOfferingCheckout(false)).toBe(false)
        expect(() => parseCourseUsesOfferingCheckout('true')).toThrow()
    })

    it('parses informational class-size metadata independently from seat availability', () => {
        const metadata = {
            offering_id: offering.offering_id,
            display_capacity: '20',
            configuration_revision: '3',
        }
        expect(parseOfferingDisplayMetadata([metadata])[0]).toMatchObject({
            display_capacity: 20,
            configuration_revision: 3,
        })
        expect(parseOfferingDisplayMetadataItem(metadata)?.display_capacity).toBe(20)
        expect(parseOfferingDisplayMetadataItem({})).toBeNull()
    })
})
