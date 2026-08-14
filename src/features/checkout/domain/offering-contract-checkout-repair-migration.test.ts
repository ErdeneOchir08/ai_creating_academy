import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(
    process.cwd(),
    'supabase/migrations/20260814021638_fix_v2_guardian_contract_checkout.sql',
), 'utf8')

function extractFunction(name: string) {
    const escapedName = name.replaceAll('.', '\\.')
    const match = migration.match(new RegExp(
        `create or replace function ${escapedName}\\([\\s\\S]*?\\n\\$\\$;`,
        'i',
    ))
    if (!match) throw new Error(`Migration function not found: ${name}`)
    return match[0]
}

describe('V2 guardian contract checkout repair migration', () => {
    it('removes column-variable ambiguity from every persisted signer field', () => {
        const saveDraft = extractFunction('public.save_course_offering_checkout_draft')

        expect(saveDraft).toContain('normalized_signer_email text;')
        expect(saveDraft).toContain('normalized_signer_phone text;')
        expect(saveDraft).toContain('normalized_signer_registration_number text;')
        expect(saveDraft).not.toMatch(/\n\s*signer_email text;/)
        expect(saveDraft).not.toMatch(/\n\s*signer_phone text;/)
        expect(saveDraft).not.toMatch(/\n\s*signer_registration_number text;/)
        expect(saveDraft).toContain('signer_email = normalized_signer_email')
        expect(saveDraft).toContain('signer_phone = normalized_signer_phone')
        expect(saveDraft).toContain(
            'signer_registration_number = normalized_signer_registration_number',
        )
    })

    it('retains authentication, ownership, locking, and idempotency boundaries', () => {
        const saveDraft = extractFunction('public.save_course_offering_checkout_draft')

        expect(saveDraft).toContain('security definer')
        expect(saveDraft).toContain("set search_path = ''")
        expect(saveDraft).toContain('current_user_id uuid := (select auth.uid())')
        expect(saveDraft).toContain('for update of cohort')
        expect(saveDraft).toContain('application.applicant_user_id = current_user_id')
        expect(saveDraft).toContain('application.client_request_id = parsed_client_request_id')
        expect(saveDraft).toContain('when unique_violation then')
        expect(saveDraft).toContain('existing_application.offering_id = p_offering_id')
        expect(saveDraft).toContain(
            'existing_application.content_access_user_id = p_content_access_user_id',
        )
    })

    it('uses only snapshotted academy data for an online location fallback', () => {
        const values = extractFunction('private.build_course_offering_contract_values')

        expect(values).toContain(
            "snapshotted_location := nullif(trim(target_application.terms_snapshot ->> 'location'), '')",
        )
        expect(values).toContain(
            "trim(target_application.terms_snapshot #>> '{issuer,address}')",
        )
        expect(values).toContain(
            "when target_application.terms_snapshot ->> 'delivery_mode' = 'online'",
        )
        expect(values).toContain(
            'then coalesce(snapshotted_location, snapshotted_academy_address)',
        )
        expect(values).toContain('else snapshotted_location')
    })

    it('does not rewrite published contracts, offering configuration, or applications', () => {
        expect(migration).not.toMatch(/update public\.contract_template_versions/i)
        expect(migration).not.toMatch(/update public\.training_cohorts/i)
        expect(migration).not.toMatch(/delete from public\./i)
        expect(migration).not.toMatch(/alter table public\./i)
    })
})
