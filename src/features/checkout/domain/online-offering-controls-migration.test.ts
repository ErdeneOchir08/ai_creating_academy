import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260827053519_add_online_offering_controls.sql'),
    'utf8',
).toLowerCase()

describe('online offering launch controls migration', () => {
    it('adds explicit QPay and manual-transfer switches with safe existing defaults', () => {
        expect(migration).toContain('add column qpay_enabled boolean not null default true')
        expect(migration).toContain('add column manual_transfer_enabled boolean not null default true')
    })

    it('audits method changes with optimistic locking', () => {
        expect(migration).toContain('update_v2_course_offering_payment_methods')
        expect(migration).toContain('p_expected_revision is distinct from current_offering.configuration_revision')
        expect(migration).toContain('configuration_revision = current_offering.configuration_revision + 1')
        expect(migration).toContain('insert into public.course_offering_configuration_changes')
    })

    it('blocks only new attempts when an offering payment method is disabled', () => {
        expect(migration).toContain('before insert on public.course_offering_payments')
        expect(migration).toContain("new.provider = 'qpay' and not qpay_allowed")
        expect(migration).toContain("new.provider = 'manual_transfer' and not manual_allowed")
        expect(migration).not.toContain('before update on public.course_offering_payments')
    })

    it('keeps payment controls visible to an existing applicant after registration closes', () => {
        expect(migration).toContain('application.applicant_user_id = (select auth.uid())')
        expect(migration).toContain("cohort.status = 'open'")
    })

    it('keeps the privileged mutation callable only by authenticated admins and service role', () => {
        expect(migration).toContain('current_user_id is null or coalesce((select private.is_admin()), false) is false')
        expect(migration).toContain('revoke all on function public.update_v2_course_offering_payment_methods')
        expect(migration).toContain('to authenticated, service_role')
        expect(migration).not.toContain('auth.role()')
    })
})
