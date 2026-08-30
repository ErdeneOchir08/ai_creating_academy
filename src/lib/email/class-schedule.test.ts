import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mailMocks = vi.hoisted(() => ({
    createTransport: vi.fn(),
    sendMail: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('nodemailer', () => ({
    default: { createTransport: mailMocks.createTransport },
}))

import { sendClassScheduleChangedEmail } from './class-schedule'

const input = {
    to: 'student@example.com',
    learnerName: 'Тэмүүлэн',
    className: 'AI Game Creator',
    reason: 'Багшийн хүсэлтээр нэг цагаар хойшлуулав.',
    sessions: [{
        title: 'Танилцах хичээл',
        startsAt: '2026-09-05T10:00:00.000Z',
        endsAt: '2026-09-05T12:00:00.000Z',
        meetingUrl: 'https://meet.example.com/class',
        location: '',
    }],
} as const

describe('class schedule changed email', () => {
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

    afterEach(() => vi.unstubAllEnvs())

    it('uses Ulaanbaatar time and links to the student dashboard', async () => {
        await expect(sendClassScheduleChangedEmail(input)).resolves.toEqual({ sent: true })

        expect(mailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'student@example.com',
            subject: 'Mind Academy — Хуваарь шинэчлэгдлээ: AI Game Creator',
            text: expect.stringContaining('https://mindacademy.mn/dashboard/courses'),
            html: expect.stringContaining('18:00'),
        }))
    })

    it('escapes dynamic HTML', async () => {
        await sendClassScheduleChangedEmail({
            ...input,
            learnerName: '<script>student</script>',
            className: 'Class <b>one</b>',
            reason: '<img src=x>',
        })

        const message = mailMocks.sendMail.mock.calls[0]?.[0]
        expect(message.html).toContain('&lt;script&gt;student&lt;/script&gt;')
        expect(message.html).toContain('Class &lt;b&gt;one&lt;/b&gt;')
        expect(message.html).toContain('&lt;img src=x&gt;')
        expect(message.html).not.toContain('<script>')
    })

    it('does not attempt delivery without SMTP', async () => {
        vi.stubEnv('SMTP_PASS', '')
        await expect(sendClassScheduleChangedEmail(input)).resolves.toEqual({
            sent: false,
            error: 'Хуваарийн и-мэйл илгээх SMTP тохиргоо дутуу байна.',
        })
        expect(mailMocks.createTransport).not.toHaveBeenCalled()
    })
})
