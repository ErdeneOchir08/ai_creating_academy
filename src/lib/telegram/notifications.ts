type TelegramSendResult = {
    sent: boolean
    error?: string
}

function getTelegramConfiguration() {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
    return { token, chatId, configured: Boolean(token && chatId) }
}

export function isTelegramConfigured() {
    return getTelegramConfiguration().configured
}

export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
    const { token, chatId, configured } = getTelegramConfiguration()
    if (!configured || !token || !chatId) return { sent: false, error: 'Telegram is not configured.' }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
            cache: 'no-store',
            signal: AbortSignal.timeout(8_000),
        })

        if (!response.ok) return { sent: false, error: `Telegram responded with status ${response.status}.` }
        const data = await response.json() as { ok?: boolean }
        return data.ok ? { sent: true } : { sent: false, error: 'Telegram rejected the notification.' }
    } catch {
        return { sent: false, error: 'Unable to reach Telegram.' }
    }
}

export async function sendPaymentSubmittedAlert(input: { studentName: string; courseTitle: string; adminUrl?: string }) {
    const lines = [
        '🔔 Шинэ төлбөрийн хүсэлт',
        `Суралцагч: ${input.studentName}`,
        `Хичээл: ${input.courseTitle}`,
        'Төлбөрийн баримтыг админ хэсгээс шалгана уу.',
    ]

    if (input.adminUrl) lines.push(input.adminUrl)
    return sendTelegramMessage(lines.join('\n'))
}

export async function sendCohortPaymentSubmittedAlert(input: {
    studentName: string
    programName: string
    cohortName: string
    adminUrl?: string
}) {
    const lines = [
        '🔔 Шинэ элсэлтийн төлбөр',
        `Суралцагч: ${input.studentName}`,
        `Хөтөлбөр: ${input.programName}`,
        `Ээлж: ${input.cohortName}`,
        'Төлбөрийн баримтыг админ хэсгээс шалгана уу.',
    ]

    if (input.adminUrl) lines.push(input.adminUrl)
    return sendTelegramMessage(lines.join('\n'))
}

export async function sendOfferingPaymentSubmittedAlert(input: {
    applicantName: string
    learnerName: string
    programName: string
    offeringName: string
    adminUrl?: string
}) {
    const lines = [
        '🔔 Шинэ элсэлтийн төлбөр',
        `Хүсэлт гаргагч: ${input.applicantName}`,
        `Суралцагч: ${input.learnerName}`,
        `Хөтөлбөр: ${input.programName}`,
        `Элсэлт: ${input.offeringName}`,
        'Төлбөрийн баримтыг админ самбараас шалгана уу.',
    ]

    if (input.adminUrl) lines.push(input.adminUrl)
    return sendTelegramMessage(lines.join('\n'))
}
