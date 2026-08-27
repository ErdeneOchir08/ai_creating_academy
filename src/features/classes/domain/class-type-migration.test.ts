import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260827071018_add_class_type_control_layer.sql'),
    'utf8',
).toLowerCase()

describe('class type control-layer migration', () => {
    it('adds only the three approved business types while allowing unmapped history', () => {
        expect(migration).toContain('add column class_type text')
        expect(migration).toContain("'self_paced_online'")
        expect(migration).toContain("'instructor_led_online'")
        expect(migration).toContain("'offline_with_video'")
        expect(migration).toContain('class_type is null')
    })

    it('backfills only deterministic delivery and contract combinations', () => {
        expect(migration).toContain("delivery_mode = 'online' and contract_policy = 'none'")
        expect(migration).toContain("delivery_mode = 'online' and contract_policy = 'required'")
        expect(migration).toContain("delivery_mode = 'offline' and contract_policy = 'required'")
        expect(migration).toContain('else null')
    })

    it('does not rewrite or delete financial and legal records', () => {
        expect(migration).not.toContain('course_offering_payments')
        expect(migration).not.toContain('course_offering_contract_acceptances')
        expect(migration).not.toContain('course_offering_enrollments')
        expect(migration).not.toContain('delete from')
        expect(migration).not.toContain('drop table')
    })
})
