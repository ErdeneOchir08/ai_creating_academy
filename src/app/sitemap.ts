import type { MetadataRoute } from 'next'
import { getConfiguredSiteUrl } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getConfiguredSiteUrl()
  if (!siteUrl) return []

  const lastModified = new Date()

  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/programs`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]
}
