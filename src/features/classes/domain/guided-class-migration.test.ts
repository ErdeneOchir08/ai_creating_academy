import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260827073902_add_guided_class_drafts.sql'),
    'utf8',
).toLowerCase()

describe('guided class draft migration', () => {
    it('enforces the approved delivery and contract rules in Postgres', () => {
        expect(migration).toContain('training_cohorts_class_type_rules_check')
        expect(migration).toContain("class_type = 'self_paced_online'")
        expect(migration).toContain("delivery_mode = 'online'")
        expect(migration).toContain("contract_policy = 'none'")
        expect(migration).toContain("class_type = 'offline_with_video'")
        expect(migration).toContain("delivery_mode = 'offline'")
    })

    it('creates the hidden program and class in one transaction', () => {
        expect(migration).toContain('function public.create_guided_class_draft')
        expect(migration).toContain('insert into public.training_programs')
        expect(migration).toContain('insert into public.training_cohorts')
        expect(migration).toContain('security invoker')
        expect(migration).toContain('private.is_admin()')
    })

    it('does not expose the function to anonymous users', () => {
        expect(migration).toContain('from public, anon')
        expect(migration).toContain('to authenticated, service_role')
        expect(migration).not.toContain('security definer')
    })
})
