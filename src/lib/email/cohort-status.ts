import nodemailer from 'nodemailer'

type EmailResult = { sent: true } | { sent: false; error: string }

type CohortEmailBase = {
    to: string
    recipientName: string
    programName: string
    cohortName: string
    cohortId: string
}

type ApplicationDecisionEmail = CohortEmailBase & {
    decision: 'approved' | 'rejected'
    amountMnt?: number | null
    paymentDueAt?: string | null
    rejectionReason?: string | null
}

type PaymentDecisionEmail = CohortEmailBase & {
    decision: 'approved' | 'rejected'
    rejectionReason?: string | null
}

function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
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

function getProgramUrl(cohortId: string) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
    return siteUrl ? `${siteUrl}/programs/${cohortId}` : null
}

function formatMnt(value: number) {
    return new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 0 }).format(value)
}

function formatDeadline(value: string) {
    return new Intl.DateTimeFormat('mn-MN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ulaanbaatar',
    }).format(new Date(value))
}

async function sendEmail(input: { to: string; subject: string; text: string; html: string }): Promise<EmailResult> {
    const config = getSmtpConfiguration()
    if (!config.configured || !config.host || !config.user || !config.pass) {
        return { sent: false, error: 'SMTP тохиргоо дутуу байна.' }
    }

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
            subject: input.subject,
            text: input.text,
            html: input.html,
        })
        return { sent: true }
    } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
        if (code === 'EAUTH') return { sent: false, error: 'SMTP нэвтрэх мэдээллийг шалгана уу.' }
        if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
            return { sent: false, error: 'SMTP сервертэй холбогдож чадсангүй.' }
        }
        return { sent: false, error: 'Имэйл илгээхэд алдаа гарлаа.' }
    }
}

export async function sendCohortApplicationDecisionEmail(input: ApplicationDecisionEmail): Promise<EmailResult> {
    const approved = input.decision === 'approved'
    const url = getProgramUrl(input.cohortId)
    const title = `${input.programName} · ${input.cohortName}`
    const reason = input.rejectionReason?.trim()
    const paymentRequired = approved && typeof input.amountMnt === 'number' && input.amountMnt > 0 && input.paymentDueAt
    const paymentText = paymentRequired
        ? ` Төлбөр: ₮ ${formatMnt(input.amountMnt!)}. Баримт илгээх эцсийн хугацаа: ${formatDeadline(input.paymentDueAt!)}.`
        : ''
    const paymentHtml = paymentRequired
        ? `<p><strong>Төлбөр:</strong> ₮ ${formatMnt(input.amountMnt!)}</p><p><strong>Баримт илгээх хугацаа:</strong> ${escapeHtml(formatDeadline(input.paymentDueAt!))}</p>`
        : ''
    const reasonText = reason ? ` Шалтгаан: ${reason}` : ''
    const reasonHtml = reason ? `<p><strong>Шалтгаан:</strong> ${escapeHtml(reason)}</p>` : ''

    return sendEmail({
        to: input.to,
        subject: approved ? `Mind Academy — Элсэлтийн өргөдөл зөвшөөрөгдлөө` : `Mind Academy — Элсэлтийн өргөдөл буцаагдлаа`,
        text: approved
            ? `Сайн байна уу, ${input.recipientName}! ${title} элсэлтийн өргөдөл зөвшөөрөгдлөө.${paymentText}${url ? ` Дараагийн алхам: ${url}` : ''}`
            : `Сайн байна уу, ${input.recipientName}! ${title} элсэлтийн өргөдлийг засварлуулахаар буцаалаа.${reasonText}${url ? ` Өргөдлөө шалгах: ${url}` : ''}`,
        html: approved
            ? `<p>Сайн байна уу, ${escapeHtml(input.recipientName)}!</p><p><strong>${escapeHtml(title)}</strong> элсэлтийн өргөдөл зөвшөөрөгдлөө.</p>${paymentHtml}${url ? `<p><a href="${url}">Дараагийн алхам руу очих</a></p>` : ''}`
            : `<p>Сайн байна уу, ${escapeHtml(input.recipientName)}!</p><p><strong>${escapeHtml(title)}</strong> элсэлтийн өргөдлийг засварлуулахаар буцаалаа.</p>${reasonHtml}${url ? `<p><a href="${url}">Өргөдлөө шалгах</a></p>` : ''}`,
    })
}

export async function sendCohortPaymentDecisionEmail(input: PaymentDecisionEmail): Promise<EmailResult> {
    const approved = input.decision === 'approved'
    const url = getProgramUrl(input.cohortId)
    const title = `${input.programName} · ${input.cohortName}`
    const reason = input.rejectionReason?.trim()
    const reasonText = reason ? ` Шалтгаан: ${reason}` : ''
    const reasonHtml = reason ? `<p><strong>Шалтгаан:</strong> ${escapeHtml(reason)}</p>` : ''

    return sendEmail({
        to: input.to,
        subject: approved ? 'Mind Academy — Элсэлт баталгаажлаа' : 'Mind Academy — Төлбөрийн баримтыг дахин илгээнэ үү',
        text: approved
            ? `Сайн байна уу, ${input.recipientName}! ${title} хөтөлбөрийн төлбөр баталгаажиж, таны суудал баталгаажлаа.${url ? ` Дэлгэрэнгүй: ${url}` : ''}`
            : `Сайн байна уу, ${input.recipientName}! ${title} хөтөлбөрийн төлбөрийн баримтыг баталгаажуулж чадсангүй.${reasonText} Баримтаа шалгаад дахин илгээнэ үү.${url ? ` ${url}` : ''}`,
        html: approved
            ? `<p>Сайн байна уу, ${escapeHtml(input.recipientName)}!</p><p><strong>${escapeHtml(title)}</strong> хөтөлбөрийн төлбөр баталгаажиж, таны суудал баталгаажлаа.</p>${url ? `<p><a href="${url}">Элсэлтийн мэдээллээ харах</a></p>` : ''}`
            : `<p>Сайн байна уу, ${escapeHtml(input.recipientName)}!</p><p><strong>${escapeHtml(title)}</strong> хөтөлбөрийн төлбөрийн баримтыг баталгаажуулж чадсангүй. Баримтаа шалгаад дахин илгээнэ үү.</p>${reasonHtml}${url ? `<p><a href="${url}">Баримтаа дахин илгээх</a></p>` : ''}`,
    })
}
