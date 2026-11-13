import { z } from 'zod'

const maximumBlocks = 250
const maximumDepth = 8
const maximumDocumentLength = 240_000
const slugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/

export const blogIdSchema = z.uuid()

export function isBlogSlug(slug: string) {
    return slug.length <= 100 && slug !== 'media' && slug === slug.normalize('NFC').toLowerCase() && slugPattern.test(slug)
}

export function suggestBlogSlug(title: string) {
    const slug = title.normalize('NFC').toLowerCase().trim()
        .replace(/['’]/gu, '')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-|-$/gu, '')
        .slice(0, 100)
        .replace(/[-\uD800-\uDBFF]$/u, '')
    return slug === 'media' ? 'media-guide' : slug
}

export function blogPath(slug: string) {
    return `/blog/${encodeURIComponent(slug)}`
}

export function blogMediaPath(assetId: string, preview = false) {
    return `/blog/media/${encodeURIComponent(assetId)}${preview ? '?preview=1' : ''}`
}

export function parseBlogYouTubeId(input: string) {
    const value = input.trim()
    if (videoIdPattern.test(value)) return value

    try {
        const url = new URL(value)
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
        const parts = url.pathname.split('/').filter(Boolean)
        let id: string | null = null
        if (url.hostname === 'youtu.be' && parts.length === 1) id = parts[0]
        if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
            if (url.pathname === '/watch') id = url.searchParams.get('v')
            if (parts.length === 2 && ['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1]
        }
        if (['youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(url.hostname)
            && parts.length === 2 && parts[0] === 'embed') id = parts[1]
        return id && videoIdPattern.test(id) ? id : null
    } catch {
        return null
    }
}

function isBlogLink(href: string) {
    if (/[\u0000-\u0020\u007f\\]/u.test(href)) return false
    if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) return true
    try {
        const url = new URL(href)
        return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
    } catch {
        return false
    }
}

const textSchema = z.object({
    type: z.literal('text'),
    text: z.string().max(maximumDocumentLength),
    styles: z.object({
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        underline: z.boolean().optional(),
        strike: z.boolean().optional(),
        code: z.boolean().optional(),
    }).default({}),
})

const inlineSchema = z.discriminatedUnion('type', [
    textSchema,
    z.object({
        type: z.literal('link'),
        href: z.string().trim().min(1).max(2000).refine(isBlogLink),
        content: z.array(textSchema).max(300),
    }),
])

export type BlogText = z.infer<typeof textSchema>
export type BlogInline = z.infer<typeof inlineSchema>
export type BlogBlock = {
    id: string
    type: string
    props: Record<string, unknown>
    content: BlogInline[]
    children: BlogBlock[]
}

const headingProps = z.object({ level: z.number().int().min(1).max(6).default(2) })
const noProps = z.object({})
const assetIdProp = z.union([blogIdSchema, z.literal('')]).default('')
const captionProp = z.string().trim().max(500).default('')

const blockProps = {
    paragraph: noProps,
    heading: headingProps,
    bulletListItem: noProps,
    numberedListItem: noProps,
    quote: noProps,
    codeBlock: z.object({ language: z.string().max(40).regex(/^[a-zA-Z0-9_+#.-]*$/u).default('') }),
    prompt: z.object({ label: z.string().trim().max(120).default('') }),
    youtube: z.object({
        videoId: z.string().refine((id) => id === '' || videoIdPattern.test(id)).default(''),
        title: z.string().trim().max(160).default(''),
    }),
    image: z.object({
        assetId: assetIdProp,
        alt: z.string().trim().max(300).default(''),
        caption: captionProp,
    }),
    pdf: z.object({
        assetId: assetIdProp,
        name: z.string().trim().max(180).default(''),
        caption: captionProp,
    }),
}

const mediaBlocks = new Set(['youtube', 'image', 'pdf'])
const blockSchema = z.object({
    id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/u),
    type: z.enum(Object.keys(blockProps) as (keyof typeof blockProps)[]),
    props: z.record(z.string(), z.unknown()).default({}),
    content: z.array(inlineSchema).max(300).default([]),
    children: z.array(z.unknown()).max(maximumBlocks).default([]),
})

const summarySchema = z.object({
    title: z.string().trim().max(160),
    excerpt: z.string().trim().max(300),
    slug: z.string().trim().refine((slug) => slug === '' || isBlogSlug(slug)),
    language: z.enum(['mn', 'en']),
    coverAssetId: blogIdSchema.nullable(),
    coverAlt: z.string().trim().max(300),
})

const draftSchema = summarySchema.extend({ blocks: z.array(z.unknown()).max(maximumBlocks) })

export type BlogDraft = z.infer<typeof summarySchema> & { blocks: BlogBlock[] }

export type AdminBlogPost = {
    id: string
    draft: BlogDraft
    published: BlogDraft | null
    slug: string | null
    revision: number
    createdAt: string
    updatedAt: string
    publishedAt: string | null
}

export type AdminBlogSummary = Pick<AdminBlogPost, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'publishedAt'> & {
    title: string
    language: BlogDraft['language']
}

export type PublishedBlogPost = {
    id: string
    content: BlogDraft
    publishedAt: string
    updatedAt: string
}

export type PublishedBlogSummary = Omit<PublishedBlogPost, 'content'> & {
    content: Omit<BlogDraft, 'blocks'>
}

export function emptyBlogDraft(): BlogDraft {
    return { title: '', excerpt: '', slug: '', language: 'mn', coverAssetId: null, coverAlt: '', blocks: [] }
}

export function parseBlogDraft(input: unknown): BlogDraft | null {
    try {
        if (JSON.stringify(input).length > maximumDocumentLength) return null
    } catch {
        return null
    }

    const draft = draftSchema.safeParse(input)
    if (!draft.success) return null

    const seen = new Set<string>()
    function parseBlocks(items: unknown[], depth: number): BlogBlock[] | null {
        const result: BlogBlock[] = []
        if (items.length && depth > maximumDepth) return null

        for (const item of items) {
            const parsed = blockSchema.safeParse(item)
            if (!parsed.success) return null
            const { id, type, props, content, children } = parsed.data
            if (seen.has(id) || seen.size >= maximumBlocks) return null
            seen.add(id)

            const parsedProps = blockProps[type].safeParse(props)
            if (!parsedProps.success) return null
            if (mediaBlocks.has(type) && content.length) return null
            const parsedChildren = parseBlocks(children, depth + 1)
            if (!parsedChildren) return null
            result.push({ id, type, props: parsedProps.data, content, children: parsedChildren })
        }
        return result
    }

    const blocks = parseBlocks(draft.data.blocks, 1)
    return blocks ? { ...draft.data, blocks } : null
}

export function parseBlogSummary(input: unknown) {
    const summary = summarySchema.safeParse(input)
    return summary.success ? summary.data : null
}

export function blogBlockText(content: BlogInline[]) {
    return content.map((inline) => inline.type === 'text'
        ? inline.text
        : inline.content.map(({ text }) => text).join('')).join('')
}

export function blogPublishDetails(draft: BlogDraft) {
    const assets = new Map<string, 'image' | 'pdf'>()
    if (draft.coverAssetId) assets.set(draft.coverAssetId, 'image')
    let hasContent = false
    let summary = ''

    function collect(blocks: BlogBlock[]): boolean {
        for (const block of blocks) {
            const text = blogBlockText(block.content).trim()
            if (block.type === 'image' || block.type === 'pdf') {
                const assetId = block.props.assetId as string
                const current = assets.get(assetId)
                if (!assetId || (current && current !== block.type)) return false
                assets.set(assetId, block.type)
                hasContent = true
            } else if (block.type === 'youtube') {
                if (!block.props.videoId) return false
                hasContent = true
            } else if (text) {
                if (!summary && ['paragraph', 'quote', 'bulletListItem', 'numberedListItem'].includes(block.type)) {
                    summary = text.replace(/\s+/gu, ' ').slice(0, 300)
                }
                hasContent = true
            }
            if (!collect(block.children)) return false
        }
        return true
    }

    if (!draft.title || !draft.slug) return { ok: false, reason: 'title-or-slug' } as const
    if (!collect(draft.blocks)) return { ok: false, reason: 'incomplete-media' } as const
    if (!hasContent) return { ok: false, reason: 'empty-article' } as const
    return { ok: true, content: { ...draft, excerpt: draft.excerpt || summary }, assets } as const
}
