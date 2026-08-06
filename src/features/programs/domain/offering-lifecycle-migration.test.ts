import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const activationMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260806160000_enable_v2_offering_checkout.sql'),
    'utf8',
)

describe('V2 offering lifecycle migration', () => {
    it('keeps the selected contract version immutable after draft', () => {
        expect(activationMigration).toMatch(
            /new\.contract_version_id is distinct from old\.contract_version_id[\s\S]*?old\.status <> 'draft'/,
        )
    })

    it('rejects every write that leaves an offering open under an archived program', () => {
        expect(activationMigration).toMatch(
            /if new\.checkout_version = 2 and new\.status = 'open' then[\s\S]*?select not program\.is_archived[\s\S]*?Registration cannot remain open for an archived program/,
        )
    })
})
