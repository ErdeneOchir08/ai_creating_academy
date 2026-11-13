import type { MetadataRoute } from 'next'
import { blogPath } from '@/features/blog/model'
import { listPublishedBlogSitemap } from '@/features/blog/server/blog-public'
import { getConfiguredSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getConfiguredSiteUrl()
  if (!siteUrl) return []

  const lastModified = new Date()
  const posts = await listPublishedBlogSitemap().catch((error: unknown) => {
    console.error('Could not include blog posts in the sitemap.', error)
    return []
  })

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
    {
      url: `${siteUrl}/blog`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...posts.map(({ slug, updatedAt }) => ({
      url: `${siteUrl}${blogPath(slug)}`,
      lastModified: updatedAt,
    })),
  ]
}
