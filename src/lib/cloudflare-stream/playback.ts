import 'server-only'

type CloudflareTokenResponse = {
    success?: boolean
    result?: { token?: string }
}

type CloudflareVideoResponse = {
    success?: boolean
    result?: {
        readyToStream?: boolean
        requireSignedURLs?: boolean
        allowedOrigins?: string[]
        status?: { state?: string }
    }
}

function configuredValue(name: string) {
    const value = process.env[name]?.trim()
    return value || null
}

/**
 * Creates a one-hour Cloudflare Stream playback URL. The API credential never
 * reaches the browser; callers must perform enrollment authorization first.
 */
export async function getCloudflareStreamPlaybackUrl(videoId: string) {
    const accountId = configuredValue('CLOUDFLARE_STREAM_ACCOUNT_ID')
    const apiToken = configuredValue('CLOUDFLARE_STREAM_API_TOKEN')
    const customerCode = configuredValue('CLOUDFLARE_STREAM_CUSTOMER_CODE')

    if (!accountId || !apiToken || !customerCode) {
        console.error('Cloudflare Stream playback is not configured.')
        return null
    }

    if (!/^[A-Za-z0-9_-]{1,64}$/.test(videoId) || !/^[a-z0-9-]+$/i.test(customerCode)) {
        console.error('Cloudflare Stream video configuration is invalid.')
        return null
    }

    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(videoId)}/token`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiToken}` },
                cache: 'no-store',
            },
        )

        if (!response.ok) {
            console.error('Cloudflare Stream token request failed:', response.status)
            return null
        }

        const payload = await response.json() as CloudflareTokenResponse
        const token = payload.success ? payload.result?.token : null
        if (!token) {
            console.error('Cloudflare Stream token response did not contain a token.')
            return null
        }

        return `https://customer-${customerCode}.cloudflarestream.com/${encodeURIComponent(token)}/iframe`
    } catch (error) {
        console.error('Cloudflare Stream token request failed:', error)
        return null
    }
}

/**
 * Confirms that a Stream video has finished encoding before an admin can
 * attach it to a lesson. This prevents a course from being published with a
 * copied, mistyped, or still-processing Cloudflare video ID.
 */
export async function getCloudflareStreamVideoReadiness(videoId: string) {
    const accountId = configuredValue('CLOUDFLARE_STREAM_ACCOUNT_ID')
    const apiToken = configuredValue('CLOUDFLARE_STREAM_API_TOKEN')

    if (!accountId || !apiToken) return 'unconfigured' as const
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(videoId)) return 'unavailable' as const

    try {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(videoId)}`,
            {
                headers: { Authorization: `Bearer ${apiToken}` },
                cache: 'no-store',
            },
        )

        if (!response.ok) return 'unavailable' as const

        const payload = await response.json() as CloudflareVideoResponse
        if (!payload.success) return 'unavailable' as const

        const isReady = payload.result?.readyToStream === true || payload.result?.status?.state === 'ready'
        if (!isReady) return 'processing' as const

        return payload.result?.requireSignedURLs === true && (payload.result.allowedOrigins?.length ?? 0) > 0
            ? 'ready' as const
            : 'unprotected' as const
    } catch (error) {
        console.error('Cloudflare Stream readiness request failed:', error)
        return 'unavailable' as const
    }
}
