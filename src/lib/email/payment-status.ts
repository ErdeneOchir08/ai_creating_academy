import nodemailer from 'nodemailer'

type PaymentDecision = 'approved' | 'rejected'

type PaymentStatusEmail = {
    to: string
    studentName: string
    courseTitle: string
    bonusCourseTitles?: string[]
    decision: PaymentDecision
    rejectionReason?: string | null
}

type PaymentStatusEmailResult =
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

function getSmtpConfiguration() {
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()
    const port = Number(process.env.SMTP_PORT?.trim() || '465')
    const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Mind Academy'

    return { host, user, pass, port, fromName, configured: Boolean(host && user && pass && Number.isInteger(port)) }
}

function getDashboardUrl() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    return siteUrl ? `${siteUrl.replace(/\/$/, '')}/dashboard/courses` : null
}

export async function sendPaymentStatusEmail(input: PaymentStatusEmail): Promise<PaymentStatusEmailResult> {
    const config = getSmtpConfiguration()
    if (!config.configured || !config.host || !config.user || !config.pass) {
        return { sent: false, error: 'SMTP is not configured.' }
    }

    const approved = input.decision === 'approved'
    const subject = approved
        ? `Mind Academy — Төлбөр баталгаажлаа: ${input.courseTitle}`
        : `Mind Academy — Төлбөрийн хүсэлт шалгагдлаа: ${input.courseTitle}`
    const dashboardUrl = getDashboardUrl()
    const name = escapeHtml(input.studentName)
    const course = escapeHtml(input.courseTitle)
    const bonusCourseTitles = (input.bonusCourseTitles ?? [])
        .filter((title): title is string => typeof title === 'string' && title.trim().length > 0)
        .map((title) => title.trim())
    const bonusCoursesHtml = approved && bonusCourseTitles.length > 0
        ? `<p><strong>Дагалдах үнэгүй хичээлүүд мөн нээгдлээ:</strong></p><ul>${bonusCourseTitles.map((title) => `<li>${escapeHtml(title)}</li>`).join('')}</ul>`
        : ''
    const bonusCoursesText = approved && bonusCourseTitles.length > 0
        ? ` Дагалдах үнэгүй хичээлүүд мөн нээгдлээ: ${bonusCourseTitles.join(', ')}.`
        : ''
    const rejectionReason = input.rejectionReason?.trim()
    const reasonHtml = rejectionReason
        ? `<p><strong>Татгалзсан шалтгаан:</strong> ${escapeHtml(rejectionReason)}</p>`
        : ''
    const reasonText = rejectionReason ? ` Татгалзсан шалтгаан: ${rejectionReason}` : ''
    const body = approved
        ? `<p>Сайн байна уу, ${name}!</p><p><strong>${course}</strong> хичээлийн төлбөр баталгаажлаа. Та одоо хичээлээ үзэж эхлэх боломжтой.</p>${bonusCoursesHtml}${dashboardUrl ? `<p><a href="${dashboardUrl}">Миний хичээлүүд рүү очих</a></p>` : ''}`
        : `<p>Сайн байна уу, ${name}!</p><p><strong>${course}</strong> хичээлийн төлбөрийн хүсэлтийг баталгаажуулж чадсангүй. Баримтаа шалгаад дахин илгээнэ үү, эсвэл академийн админтай холбогдоно уу.</p>${reasonHtml}`
    const text = approved
        ? `Сайн байна уу, ${input.studentName}! ${input.courseTitle} хичээлийн төлбөр баталгаажлаа. Та одоо хичээлээ үзэж эхлэх боломжтой.${bonusCoursesText}${dashboardUrl ? ` ${dashboardUrl}` : ''}`
        : `Сайн байна уу, ${input.studentName}! ${input.courseTitle} хичээлийн төлбөрийн хүсэлтийг баталгаажуулж чадсангүй. Баримтаа шалгаад дахин илгээнэ үү, эсвэл академийн админтай холбогдоно уу.${reasonText}`

    try {
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: { user: config.user, pass: config.pass },
            connectionTimeout: 8_000,
            greetingTimeout: 8_000,
            socketTimeout: 10_000,
        })
        await transporter.sendMail({
            from: `${config.fromName} <${config.user}>`,
            to: input.to,
            subject,
            text,
            html: body,
        })
        return { sent: true }
    } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error
            ? String(error.code)
            : ''

        if (code === 'EAUTH') {
            return { sent: false, error: 'SMTP нэвтрэх мэдээллийг шалгана уу.' }
        }
        if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
            return { sent: false, error: 'SMTP сервертэй холбогдож чадсангүй.' }
        }

        return { sent: false, error: 'Имэйл илгээхэд алдаа гарлаа.' }
    }
}
