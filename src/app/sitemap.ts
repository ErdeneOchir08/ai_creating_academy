import type { MetadataRoute } from 'next'
import { getConfiguredSiteUrl } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getConfiguredSiteUrl()
  if (!siteUrl) return []

  return [{
    url: siteUrl,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1,
  }]
}
