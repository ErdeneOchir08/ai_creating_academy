import 'server-only'

import nodemailer from 'nodemailer'

import { getConfiguredSiteUrl } from '../site-url'

export type ClassScheduleEmailSession = {
    title: string
    startsAt: string
    endsAt: string
    meetingUrl: string | null
    location: string
}

export type ClassScheduleEmailInput = {
    to: string
    learnerName: string
    className: string
    reason: string
    sessions: readonly ClassScheduleEmailSession[]
}

export type ClassScheduleEmailResult =
    | { sent: true }
    | { sent: false; error: string }

const scheduleFormatter = new Intl.DateTimeFormat('mn-MN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ulaanbaatar',
})

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

function formatSessionTime(value: string) {
    return scheduleFormatter.format(new Date(value))
}

function getSmtpConfiguration() {
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()
    const port = Number(process.env.SMTP_PORT?.trim() || '465')
    const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Mind Academy'

    return {
        host,
        user,
        pass,
        port,
        fromName,
        configured: Boolean(host && user && pass && Number.isInteger(port) && port > 0 && port <= 65_535),
    }
}

export async function sendClassScheduleChangedEmail(
    input: ClassScheduleEmailInput,
): Promise<ClassScheduleEmailResult> {
    const config = getSmtpConfiguration()
    if (!config.configured || !config.host || !config.user || !config.pass) {
        return { sent: false, error: 'Хуваарийн и-мэйл илгээх SMTP тохиргоо дутуу байна.' }
    }

    const dashboardUrl = getConfiguredSiteUrl()
        ? `${getConfiguredSiteUrl()}/dashboard/courses`
        : null
    const sessionHtml = input.sessions.map((session) => {
        const destination = session.meetingUrl
            ? `<a href="${escapeHtml(session.meetingUrl)}">Онлайн хичээлд орох</a>`
            : escapeHtml(session.location)
        return `<li><strong>${escapeHtml(session.title)}</strong><br>${escapeHtml(formatSessionTime(session.startsAt))} – ${escapeHtml(formatSessionTime(session.endsAt))}<br>${destination}</li>`
    }).join('')
    const sessionText = input.sessions.map((session) => [
        session.title,
        `${formatSessionTime(session.startsAt)} – ${formatSessionTime(session.endsAt)}`,
        session.meetingUrl ?? session.location,
    ].join('\n')).join('\n\n')
    const html = [
        `<p>Сайн байна уу, ${escapeHtml(input.learnerName)}!</p>`,
        `<p><strong>${escapeHtml(input.className)}</strong> ангийн хуваарь шинэчлэгдлээ.</p>`,
        `<p><strong>Өөрчлөлтийн тайлбар:</strong> ${escapeHtml(input.reason)}</p>`,
        `<ul>${sessionHtml}</ul>`,
        dashboardUrl ? `<p><a href="${escapeHtml(dashboardUrl)}">Миний хичээлүүдээс шинэ хуваарь харах</a></p>` : '',
        '<p>Таны төлбөр, гэрээ болон хичээл үзэх эрх өөрчлөгдөөгүй.</p>',
    ].join('')
    const text = [
        `Сайн байна уу, ${input.learnerName}!`,
        `${input.className} ангийн хуваарь шинэчлэгдлээ.`,
        `Өөрчлөлтийн тайлбар: ${input.reason}`,
        sessionText,
        dashboardUrl ? `Миний хичээлүүд: ${dashboardUrl}` : null,
        'Таны төлбөр, гэрээ болон хичээл үзэх эрх өөрчлөгдөөгүй.',
    ].filter((line): line is string => Boolean(line)).join('\n\n')

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
            subject: `Mind Academy — Хуваарь шинэчлэгдлээ: ${normalizeSubjectPart(input.className)}`,
            text,
            html,
        })
        return { sent: true }
    } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
        if (code === 'EAUTH') return { sent: false, error: 'SMTP нэвтрэх мэдээллийг шалгана уу.' }
        if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
            return { sent: false, error: 'SMTP сервертэй холбогдож чадсангүй.' }
        }
        return { sent: false, error: 'Хуваарийн и-мэйлийг илгээж чадсангүй.' }
    }
}
