import { describe, expect, it } from 'vitest'
import { classTypeRules, deriveClassType, storedClassType } from './class-type'

describe('Mind Academy business class types', () => {
    it('maps the three supported business flows', () => {
        expect(deriveClassType({ deliveryMode: 'online', contractPolicy: 'none' }))
            .toBe('self_paced_online')
        expect(deriveClassType({ deliveryMode: 'online', contractPolicy: 'required' }))
            .toBe('instructor_led_online')
        expect(deriveClassType({ deliveryMode: 'offline', contractPolicy: 'required' }))
            .toBe('offline_with_video')
    })

    it('does not guess the type of an unsupported historical flow', () => {
        expect(deriveClassType({ deliveryMode: 'hybrid', contractPolicy: 'required' }))
            .toBe('legacy')
        expect(storedClassType({ deliveryMode: 'hybrid', contractPolicy: 'required' }))
            .toBeNull()
    })

    it('keeps each supported type tied to one delivery and contract rule', () => {
        expect(classTypeRules.self_paced_online).toMatchObject({
            deliveryMode: 'online',
            contractPolicy: 'none',
            needsTeacher: false,
        })
        expect(classTypeRules.instructor_led_online).toMatchObject({
            deliveryMode: 'online',
            contractPolicy: 'required',
            needsTeacher: true,
        })
        expect(classTypeRules.offline_with_video).toMatchObject({
            deliveryMode: 'offline',
            contractPolicy: 'required',
            needsTeacher: true,
        })
    })

    it('prefers an explicit stored type for migrated records', () => {
        expect(deriveClassType({
            classType: 'self_paced_online',
            deliveryMode: 'online',
            contractPolicy: 'none',
        })).toBe('self_paced_online')
    })
})
