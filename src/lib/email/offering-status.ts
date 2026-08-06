import 'server-only'

import nodemailer from 'nodemailer'

import { getConfiguredSiteUrl } from '../site-url'

export type OfferingPaymentDecision = 'approved' | 'correction_required'

export type OfferingStatusEmailInput = {
    to: string
    recipientName: string
    learnerName: string
    programName: string
    offeringName: string
    offeringId: string
    decision: OfferingPaymentDecision
    rejectionReason?: string | null
}

export type OfferingStatusEmailResult =
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

function normalizeSubjectPart(value: string) {
    return value.replace(/[\r\n]+/g, ' ').trim()
}

function getSmtpConfiguration() {
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()
    const port = Number(process.env.SMTP_PORT?.trim() || '465')
    const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Mind Academy'
    const validPort = Number.isInteger(port) && port > 0 && port <= 65_535

    return {
        host,
        user,
        pass,
        port,
        fromName,
        configured: Boolean(host && user && pass && validPort),
    }
}

function getOfferingUrls(offeringId: string) {
    const siteUrl = getConfiguredSiteUrl()
    if (!siteUrl) return { offeringUrl: null, dashboardUrl: null }

    return {
        offeringUrl: `${siteUrl}/programs/${encodeURIComponent(offeringId)}`,
        dashboardUrl: `${siteUrl}/dashboard/courses`,
    }
}

function linkHtml(url: string | null, label: string) {
    return url ? `<p><a href="${escapeHtml(url)}">${label}</a></p>` : ''
}

function linkText(url: string | null, label: string) {
    return url ? `${label}: ${url}` : null
}

export async function sendOfferingPaymentDecisionEmail(
    input: OfferingStatusEmailInput,
): Promise<OfferingStatusEmailResult> {
    const config = getSmtpConfiguration()
    if (!config.configured || !config.host || !config.user || !config.pass) {
        return { sent: false, error: 'Төлбөрийн төлөвийн и-мэйл илгээх SMTP тохиргоо дутуу байна.' }
    }

    const approved = input.decision === 'approved'
    const offeringTitle = `${input.programName} · ${input.offeringName}`
    const subjectTitle = `${normalizeSubjectPart(input.programName)} · ${normalizeSubjectPart(input.offeringName)}`
    const reason = input.rejectionReason?.trim()
    const { offeringUrl, dashboardUrl } = getOfferingUrls(input.offeringId)

    const subject = approved
        ? `Mind Academy — Төлбөр баталгаажлаа: ${subjectTitle}`
        : `Mind Academy — Төлбөрийн баримтад засвар шаардлагатай: ${subjectTitle}`

    const recipientHtml = escapeHtml(input.recipientName)
    const learnerHtml = escapeHtml(input.learnerName)
    const offeringTitleHtml = escapeHtml(offeringTitle)
    const reasonHtml = reason
        ? `<p><strong>Шалгалтын тайлбар:</strong> ${escapeHtml(reason)}</p>`
        : ''

    const html = approved
        ? [
            `<p>Сайн байна уу, ${recipientHtml}!</p>`,
            `<p><strong>${learnerHtml}</strong> суралцагчийн <strong>${offeringTitleHtml}</strong> сургалтын төлбөр баталгаажлаа.</p>`,
            '<p>Сургалтын эрх идэвхжсэн. Та хичээл болон элсэлтийн мэдээллээ доорх холбоосуудаас шалгах боломжтой.</p>',
            linkHtml(dashboardUrl, 'Миний хичээлүүд рүү очих'),
            linkHtml(offeringUrl, 'Элсэлтийн дэлгэрэнгүй харах'),
        ].join('')
        : [
            `<p>Сайн байна уу, ${recipientHtml}!</p>`,
            `<p><strong>${learnerHtml}</strong> суралцагчийн <strong>${offeringTitleHtml}</strong> сургалтын төлбөрийн баримтыг одоогоор баталгаажуулж чадсангүй.</p>`,
            '<p>Доорх тайлбарыг шалгаад төлбөрийн баримтаа засварлан дахин илгээнэ үү.</p>',
            reasonHtml,
            linkHtml(offeringUrl, 'Төлбөрийн баримтаа дахин илгээх'),
        ].join('')

    const textLines = approved
        ? [
            `Сайн байна уу, ${input.recipientName}!`,
            `${input.learnerName} суралцагчийн ${offeringTitle} сургалтын төлбөр баталгаажлаа.`,
            'Сургалтын эрх идэвхжсэн.',
            linkText(dashboardUrl, 'Миний хичээлүүд'),
            linkText(offeringUrl, 'Элсэлтийн дэлгэрэнгүй'),
        ]
        : [
            `Сайн байна уу, ${input.recipientName}!`,
            `${input.learnerName} суралцагчийн ${offeringTitle} сургалтын төлбөрийн баримтыг одоогоор баталгаажуулж чадсангүй.`,
            'Төлбөрийн баримтаа засварлан дахин илгээнэ үү.',
            reason ? `Шалгалтын тайлбар: ${reason}` : null,
            linkText(offeringUrl, 'Баримтаа дахин илгээх'),
        ]
    const text = textLines.filter((line): line is string => Boolean(line)).join('\n\n')

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
            html,
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
        return { sent: false, error: 'Төлбөрийн төлөвийн и-мэйлийг илгээж чадсангүй.' }
    }
}
