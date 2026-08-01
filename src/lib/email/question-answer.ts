import nodemailer from 'nodemailer'

type QuestionAnswerEmail = {
    to: string
    studentName: string
    courseTitle: string
    lessonTitle: string
    answerContent: string
}

export type QuestionAnswerEmailResult =
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

function getQuestionsUrl() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    return siteUrl ? `${siteUrl.replace(/\/$/, '')}/dashboard/questions` : null
}

export async function sendQuestionAnswerEmail(input: QuestionAnswerEmail): Promise<QuestionAnswerEmailResult> {
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()
    const port = Number(process.env.SMTP_PORT?.trim() || '465')
    const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Mind Academy'

    if (!host || !user || !pass || !Number.isInteger(port)) {
        return { sent: false, error: 'SMTP is not configured.' }
    }

    const questionsUrl = getQuestionsUrl()
    const name = escapeHtml(input.studentName)
    const course = escapeHtml(input.courseTitle)
    const lesson = escapeHtml(input.lessonTitle)
    const answer = escapeHtml(input.answerContent).replace(/\n/g, '<br />')
    const subject = `Mind Academy — Таны асуултад хариуллаа: ${input.courseTitle}`
    const html = `<p>Сайн байна уу, ${name}!</p><p><strong>${course}</strong> хичээлийн <strong>${lesson}</strong> хэсэгт үлдээсэн асуултад тань хариуллаа.</p><p><strong>Хариулт:</strong><br />${answer}</p>${questionsUrl ? `<p><a href="${questionsUrl}">Миний асуултууд руу орох</a></p>` : ''}`
    const text = `Сайн байна уу, ${input.studentName}! ${input.courseTitle} хичээлийн ${input.lessonTitle} хэсэгт үлдээсэн асуултад тань хариуллаа.\n\nХариулт:\n${input.answerContent}${questionsUrl ? `\n\n${questionsUrl}` : ''}`

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
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
        if (code === 'EAUTH') return { sent: false, error: 'SMTP authentication failed.' }
        if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
            return { sent: false, error: 'Could not connect to the SMTP server.' }
        }
        return { sent: false, error: 'Could not send the email.' }
    }
}
