import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogArticle } from '@/features/blog/components/blog-article'
import { blogMediaPath, blogPath } from '@/features/blog/model'
import { getPublishedBlogPost } from '@/features/blog/server/blog-public'
import { getConfiguredSiteUrl } from '@/lib/site-url'

type BlogPostProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
    const { slug } = await params
    const post = await getPublishedBlogPost(slug)
    if (!post) notFound()

    const { content } = post
    const siteUrl = getConfiguredSiteUrl()
    const url = siteUrl ? `${siteUrl}${blogPath(content.slug)}` : undefined
    const image = siteUrl && content.coverAssetId ? `${siteUrl}${blogMediaPath(content.coverAssetId)}` : undefined
    const description = content.excerpt || undefined

    return {
        title: content.title,
        description,
        alternates: { canonical: url },
        openGraph: {
            title: content.title,
            description,
            url,
            type: 'article',
            locale: content.language === 'en' ? 'en_US' : 'mn_MN',
            siteName: 'Mind Academy',
            publishedTime: post.publishedAt,
            modifiedTime: post.updatedAt,
            images: image ? [{ url: image, alt: content.coverAlt || content.title }] : undefined,
        },
        twitter: {
            card: image ? 'summary_large_image' : 'summary',
            title: content.title,
            description,
            images: image ? [image] : undefined,
        },
    }
}

export default async function BlogPost({ params }: BlogPostProps) {
    const { slug } = await params
    const post = await getPublishedBlogPost(slug)
    if (!post) notFound()

    return <BlogArticle post={post} />
}
