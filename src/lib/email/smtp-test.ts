import 'server-only'

import nodemailer from 'nodemailer'

export type SmtpTestEmailResult =
    | { sent: true }
    | { sent: false; error: string }

export function isSmtpConfigured() {
    const port = Number(process.env.SMTP_PORT?.trim() || '465')
    return Boolean(
        process.env.SMTP_HOST?.trim()
        && process.env.SMTP_USER?.trim()
        && process.env.SMTP_PASS?.trim()
        && Number.isInteger(port),
    )
}

export async function sendSmtpTestEmail(to: string): Promise<SmtpTestEmailResult> {
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()
    const port = Number(process.env.SMTP_PORT?.trim() || '465')
    const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Mind Academy'

    if (!host || !user || !pass || !Number.isInteger(port)) {
        return { sent: false, error: 'SMTP тохиргоо бүрэн биш байна.' }
    }

    try {
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
            connectionTimeout: 8_000,
            greetingTimeout: 8_000,
            socketTimeout: 10_000,
        })

        await transporter.sendMail({
            from: `${fromName} <${user}>`,
            to,
            subject: 'Mind Academy — И-мэйл тохиргооны туршилт',
            text: 'Mind Academy-ийн и-мэйл тохиргоо амжилттай ажиллаж байна. Энэ бол админы илгээсэн туршилтын мессеж юм.',
            html: '<p><strong>Mind Academy</strong>-ийн и-мэйл тохиргоо амжилттай ажиллаж байна.</p><p>Энэ бол админы илгээсэн туршилтын мессеж юм.</p>',
        })

        return { sent: true }
    } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
        if (code === 'EAUTH') return { sent: false, error: 'SMTP нэвтрэх мэдээлэл буруу байна. Google App Password-оо шалгана уу.' }
        if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
            return { sent: false, error: 'SMTP сервертэй холбогдож чадсангүй.' }
        }
        return { sent: false, error: 'Туршилтын и-мэйл илгээж чадсангүй.' }
    }
}
