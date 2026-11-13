import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { cache } from 'react'
import { isBlogSlug, parseBlogDraft, parseBlogSummary, type PublishedBlogPost, type PublishedBlogSummary } from '../model'

type PublishedRow = {
    id: string
    published: unknown
    published_at: string
    updated_at: string
}

function createPublicBlogClient() {
    const url = process.env.NEXT_PUBLIC_ACADEMY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_ACADEMY_SUPABASE_PUBLISHABLE_KEY
        || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Public Supabase access is not configured.')

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    })
}

function publicationFields(row: PublishedRow) {
    return { id: row.id, publishedAt: row.published_at, updatedAt: row.updated_at }
}

export async function listPublishedBlogPosts(limit = 12, offset = 0): Promise<PublishedBlogSummary[]> {
    const { data, error } = await createPublicBlogClient().rpc('list_published_blog_posts', {
        p_limit: Math.max(1, Math.min(limit, 100)),
        p_offset: Math.max(0, offset),
    })
    if (error) throw new Error('Could not load published blog posts.', { cause: error })

    return (data as PublishedRow[]).map((row) => {
        const content = parseBlogSummary(row.published)
        if (!content) throw new Error('Invalid published blog summary.')
        return { ...publicationFields(row), content }
    })
}

export const getPublishedBlogPost = cache(async (slug: string): Promise<PublishedBlogPost | null> => {
    if (!isBlogSlug(slug)) return null
    const { data, error } = await createPublicBlogClient().rpc('get_published_blog_post', { p_slug: slug })
        .maybeSingle<PublishedRow>()
    if (error) throw new Error('Could not load the published blog post.', { cause: error })
    if (!data) return null

    const content = parseBlogDraft(data.published)
    if (!content) throw new Error('Invalid published blog post.')
    return { ...publicationFields(data), content }
})

export async function listPublishedBlogSitemap(): Promise<{ slug: string; updatedAt: string }[]> {
    const supabase = createPublicBlogClient()
    const pageSize = 1000
    const posts: { slug: string; updatedAt: string }[] = []

    for (let offset = 0; offset < 49_000; offset += pageSize) {
        const { data, error } = await supabase.rpc('list_published_blog_sitemap', { p_limit: pageSize, p_offset: offset })
        if (error) throw new Error('Could not load blog sitemap entries.', { cause: error })
        const rows = data as { slug: string; updated_at: string }[]
        posts.push(...rows.map(({ slug, updated_at }) => ({ slug, updatedAt: updated_at })))
        if (rows.length < pageSize) break
    }
    return posts
}
