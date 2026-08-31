import { describe, expect, it } from 'vitest'

import { buildAdminAttentionItems, countAdminAttention } from './admin-attention'

describe('admin attention queue', () => {
    it('counts only work that needs an admin decision', () => {
        expect(countAdminAttention({
            manualPayments: 2,
            qpayProblems: 1,
            unansweredQuestions: 3,
            draftClasses: 1,
        })).toBe(7)
    })

    it('keeps urgent payment work first and omits empty groups', () => {
        const items = buildAdminAttentionItems({
            manualPayments: 2,
            qpayProblems: 0,
            unansweredQuestions: 1,
            draftClasses: 0,
        })

        expect(items.map((item) => item.id)).toEqual(['manual-payments', 'questions'])
        expect(items[0]).toMatchObject({ priority: 'urgent', count: 2 })
    })

    it('returns an empty queue when normal automatic QPay monitoring is the only activity', () => {
        expect(buildAdminAttentionItems({
            manualPayments: 0,
            qpayProblems: 0,
            unansweredQuestions: 0,
            draftClasses: 0,
        })).toEqual([])
    })
})
