import 'server-only'

import nodemailer from 'nodemailer'

type ContractSigningCodeEmail = {
    to: string
    signerName: string
    programName: string
    code: string
    expiresInMinutes: number
}

export type ContractSigningCodeEmailResult =
    | { sent: true }
    | { sent: false; error: string }

function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    })[character] ?? character)
}

export async function sendContractSigningCodeEmail(
    input: ContractSigningCodeEmail,
): Promise<ContractSigningCodeEmailResult> {
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()
    const port = Number(process.env.SMTP_PORT?.trim() || '465')
    const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Mind Academy'

    if (!host || !user || !pass || !Number.isInteger(port)) {
        return { sent: false, error: 'Гэрээ баталгаажуулах и-мэйл илгээх тохиргоо дутуу байна.' }
    }

    const signerName = escapeHtml(input.signerName)
    const programName = escapeHtml(input.programName)
    const code = escapeHtml(input.code)
    const subjectProgramName = input.programName.replace(/[\r\n]+/g, ' ').trim()
    const subject = `Mind Academy — Гэрээ баталгаажуулах код: ${subjectProgramName}`
    const html = [
        `<p>Сайн байна уу, ${signerName}!</p>`,
        `<p><strong>${programName}</strong> хөтөлбөрийн гэрээг зөвшөөрөх баталгаажуулах код:</p>`,
        `<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>`,
        `<p>Код ${input.expiresInMinutes} минутын хугацаанд хүчинтэй. Та энэ үйлдлийг эхлүүлээгүй бол кодыг бусдад дамжуулахгүй, уг и-мэйлийг үл тоомсорлоно уу.</p>`,
    ].join('')
    const text = [
        `Сайн байна уу, ${input.signerName}!`,
        `${input.programName} хөтөлбөрийн гэрээг зөвшөөрөх баталгаажуулах код: ${input.code}`,
        `Код ${input.expiresInMinutes} минутын хугацаанд хүчинтэй. Кодыг бусдад дамжуулахгүй байна уу.`,
    ].join('\n\n')

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
            to: input.to,
            subject,
            text,
            html,
        })
        return { sent: true }
    } catch (error) {
        const codeValue = typeof error === 'object' && error && 'code' in error
            ? String(error.code)
            : ''

        if (codeValue === 'EAUTH') {
            return { sent: false, error: 'SMTP нэвтрэх мэдээллийг шалгана уу.' }
        }
        if (codeValue === 'ETIMEDOUT' || codeValue === 'ESOCKET' || codeValue === 'ECONNECTION') {
            return { sent: false, error: 'SMTP сервертэй холбогдож чадсангүй.' }
        }
        return { sent: false, error: 'Баталгаажуулах кодыг и-мэйлээр илгээж чадсангүй.' }
    }
}
