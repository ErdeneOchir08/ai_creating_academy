import { afterEach, describe, expect, it, vi } from 'vitest'

import { getConfiguredSiteUrl } from './site-url'

describe('getConfiguredSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when the site URL is not configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(getConfiguredSiteUrl()).toBeNull()
  })

  it('rejects malformed and non-HTTPS URLs', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'not-a-url')
    expect(getConfiguredSiteUrl()).toBeNull()

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://mindacademy.mn')
    expect(getConfiguredSiteUrl()).toBeNull()
  })

  it('returns only the normalized HTTPS origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '  https://mindacademy.mn/courses?source=test  ')
    expect(getConfiguredSiteUrl()).toBe('https://mindacademy.mn')
  })
})
