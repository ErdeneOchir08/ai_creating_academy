import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mailMocks = vi.hoisted(() => ({
    createTransport: vi.fn(),
    sendMail: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('nodemailer', () => ({
    default: { createTransport: mailMocks.createTransport },
}))

import { sendOfferingPaymentDecisionEmail } from './offering-status'

const baseInput = {
    to: 'parent@example.com',
    recipientName: 'Бат',
    learnerName: 'Тэмүүлэн',
    programName: 'TeenCoder',
    offeringName: '2026 намрын элсэлт',
    offeringId: '8ed7616b-e839-4b36-858a-2d778dcdd70d',
} as const

describe('offering payment decision email', () => {
    beforeEach(() => {
        vi.stubEnv('SMTP_HOST', 'smtp.example.com')
        vi.stubEnv('SMTP_PORT', '465')
        vi.stubEnv('SMTP_USER', 'academy@example.com')
        vi.stubEnv('SMTP_PASS', 'app-password')
        vi.stubEnv('SMTP_FROM_NAME', 'Mind Academy')
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://mindacademy.mn/')
        mailMocks.sendMail.mockReset().mockResolvedValue({ messageId: 'message-1' })
        mailMocks.createTransport.mockReset().mockReturnValue({ sendMail: mailMocks.sendMail })
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('sends approved content with dashboard and offering links', async () => {
        await expect(sendOfferingPaymentDecisionEmail({
            ...baseInput,
            decision: 'approved',
        })).resolves.toEqual({ sent: true })

        expect(mailMocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
            host: 'smtp.example.com',
            port: 465,
            secure: true,
            connectionTimeout: 8_000,
            greetingTimeout: 8_000,
            socketTimeout: 10_000,
        }))
        expect(mailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'parent@example.com',
            subject: 'Mind Academy — Төлбөр баталгаажлаа: TeenCoder · 2026 намрын элсэлт',
            text: expect.stringContaining('https://mindacademy.mn/dashboard/courses'),
            html: expect.stringContaining('https://mindacademy.mn/programs/8ed7616b-e839-4b36-858a-2d778dcdd70d'),
        }))
    })

    it('escapes all dynamic HTML and includes a correction reason', async () => {
        await sendOfferingPaymentDecisionEmail({
            ...baseInput,
            recipientName: '<Admin & Parent>',
            learnerName: 'Learner <script>alert(1)</script>',
            programName: 'Teen & Code',
            offeringName: 'Autumn "Class"',
            decision: 'correction_required',
            rejectionReason: '<img src=x onerror=alert(1)>',
        })

        const message = mailMocks.sendMail.mock.calls[0]?.[0]
        expect(message.html).toContain('&lt;Admin &amp; Parent&gt;')
        expect(message.html).toContain('Learner &lt;script&gt;alert(1)&lt;/script&gt;')
        expect(message.html).toContain('Teen &amp; Code · Autumn &quot;Class&quot;')
        expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
        expect(message.html).not.toContain('<script>')
        expect(message.html).not.toContain('<img src=x')
        expect(message.text).toContain('Шалгалтын тайлбар: <img src=x onerror=alert(1)>')
        expect(message.html).toContain('https://mindacademy.mn/programs/8ed7616b-e839-4b36-858a-2d778dcdd70d')
        expect(message.html).not.toContain('/dashboard/courses')
    })

    it('returns a clear Mongolian error without attempting delivery when SMTP is incomplete', async () => {
        vi.stubEnv('SMTP_PASS', '')

        await expect(sendOfferingPaymentDecisionEmail({
            ...baseInput,
            decision: 'approved',
        })).resolves.toEqual({
            sent: false,
            error: 'Төлбөрийн төлөвийн и-мэйл илгээх SMTP тохиргоо дутуу байна.',
        })
        expect(mailMocks.createTransport).not.toHaveBeenCalled()
        expect(mailMocks.sendMail).not.toHaveBeenCalled()
    })

    it('maps SMTP authentication failures to an actionable Mongolian error', async () => {
        mailMocks.sendMail.mockRejectedValueOnce({ code: 'EAUTH' })

        await expect(sendOfferingPaymentDecisionEmail({
            ...baseInput,
            decision: 'correction_required',
        })).resolves.toEqual({
            sent: false,
            error: 'SMTP нэвтрэх мэдээллийг шалгана уу.',
        })
    })
})
