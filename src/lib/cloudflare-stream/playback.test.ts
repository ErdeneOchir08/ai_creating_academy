import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  getCloudflareStreamPlaybackUrl,
  getCloudflareStreamVideoReadiness,
} from './playback'

describe('Cloudflare Stream playback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('does not request a token when playback is unconfigured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('CLOUDFLARE_STREAM_ACCOUNT_ID', '')
    vi.stubEnv('CLOUDFLARE_STREAM_API_TOKEN', '')
    vi.stubEnv('CLOUDFLARE_STREAM_CUSTOMER_CODE', '')

    await expect(getCloudflareStreamPlaybackUrl('video-id')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects invalid video identifiers before contacting Cloudflare', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('CLOUDFLARE_STREAM_ACCOUNT_ID', 'account-id')
    vi.stubEnv('CLOUDFLARE_STREAM_API_TOKEN', 'api-token')
    vi.stubEnv('CLOUDFLARE_STREAM_CUSTOMER_CODE', 'customer-code')

    await expect(getCloudflareStreamPlaybackUrl('../video')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a signed iframe URL without exposing the API token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result: { token: 'signed-playback-token' },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('CLOUDFLARE_STREAM_ACCOUNT_ID', 'account-id')
    vi.stubEnv('CLOUDFLARE_STREAM_API_TOKEN', 'api-token')
    vi.stubEnv('CLOUDFLARE_STREAM_CUSTOMER_CODE', 'customer-code')

    await expect(getCloudflareStreamPlaybackUrl('video_123')).resolves.toBe(
      'https://customer-customer-code.cloudflarestream.com/signed-playback-token/iframe',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-id/stream/video_123/token',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer api-token' },
        cache: 'no-store',
      },
    )
  })

  it.each([
    [{ readyToStream: false }, 'processing'],
    [{ readyToStream: true, requireSignedURLs: false, allowedOrigins: [] }, 'unprotected'],
    [{ readyToStream: true, requireSignedURLs: true, allowedOrigins: ['mindacademy.mn'] }, 'ready'],
  ] as const)('reports Cloudflare protection readiness', async (result, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result,
    }), { status: 200 })))
    vi.stubEnv('CLOUDFLARE_STREAM_ACCOUNT_ID', 'account-id')
    vi.stubEnv('CLOUDFLARE_STREAM_API_TOKEN', 'api-token')

    await expect(getCloudflareStreamVideoReadiness('video-id')).resolves.toBe(expected)
  })
})
