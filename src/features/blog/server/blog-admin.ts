'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import {
    blogIdSchema,
    blogPublishDetails,
    emptyBlogDraft,
    parseBlogDraft,
    suggestBlogSlug,
    type AdminBlogPost,
    type AdminBlogSummary,
} from '../model'

const adminFields = 'id,draft,published,slug,revision,created_at,updated_at,published_at'
const adminPageSize = 25

type AdminRow = {
    id: string
    draft: unknown
    published: unknown
    slug: string | null
    revision: number
    created_at: string
    updated_at: string
    published_at: string | null
}

async function getAdminContext() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    return role?.role === 'admin' ? { supabase, userId: user.id } : null
}

function readPost(row: AdminRow): AdminBlogPost {
    const draft = parseBlogDraft(row.draft)
    const published = row.published == null ? null : parseBlogDraft(row.published)
    if (!draft || (row.published != null && !published)) throw new Error('Invalid stored blog post.')

    return {
        id: row.id,
        draft,
        published,
        slug: row.slug,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
    }
}

async function actionError(message: string) {
    const t = await getTranslations()
    return { ok: false, error: t(message) } as const
}

const accessError = 'Блог засах эрх шаардлагатай.'
const changedError = 'Энэ нийтлэл өөрчлөгдсөн байна. Дахин нээгээд үргэлжлүүлнэ үү.'
const saveError = 'Нийтлэлийг хадгалж чадсангүй. Дахин оролдоно уу.'

export async function listAdminBlogPosts(page = 1): Promise<{ posts: AdminBlogSummary[]; hasNextPage: boolean }> {
    const context = await getAdminContext()
    if (!context) return { posts: [], hasNextPage: false }

    const offset = Math.max(0, (Number.isSafeInteger(page) && page <= 100_000 ? page - 1 : 0) * adminPageSize)
    const { data, error } = await context.supabase.from('blog_posts')
        .select('id,slug,created_at,updated_at,published_at,title:draft->>title,language:draft->>language')
        .order('updated_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + adminPageSize)
    if (error) throw new Error('Could not load blog posts.', { cause: error })

    const posts = data.slice(0, adminPageSize).map((row) => ({
        id: row.id,
        slug: row.slug,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        title: row.title ?? '',
        language: row.language === 'en' ? 'en' as const : 'mn' as const,
    }))
    return { posts, hasNextPage: data.length > adminPageSize }
}

export async function getAdminBlogPost(id: string) {
    if (!blogIdSchema.safeParse(id).success) return null
    const context = await getAdminContext()
    if (!context) return null

    const { data, error } = await context.supabase.from('blog_posts').select(adminFields).eq('id', id).maybeSingle()
    if (error) throw new Error('Could not load blog post.', { cause: error })
    return data ? readPost(data) : null
}

export async function createBlogPost() {
    const context = await getAdminContext()
    if (!context) return actionError(accessError)

    const { data, error } = await context.supabase.from('blog_posts')
        .insert({ created_by: context.userId, draft: emptyBlogDraft() })
        .select(adminFields).single()
    if (error) {
        console.error('Blog draft creation failed', error.code)
        return actionError(saveError)
    }

    revalidatePath('/admin/blog')
    return { ok: true, post: readPost(data) } as const
}

function validRevision(id: string, revision: number) {
    return blogIdSchema.safeParse(id).success && Number.isInteger(revision) && revision >= 1 && revision < 2_147_483_647
}

type AdminContext = NonNullable<Awaited<ReturnType<typeof getAdminContext>>>

async function updateBlogPost(context: AdminContext, id: string, revision: number, changes: Record<string, unknown>) {
    const { data, error } = await context.supabase.from('blog_posts').update({ ...changes, revision: revision + 1 })
        .eq('id', id).eq('revision', revision).select(adminFields).maybeSingle()
    if (error?.code === '23505') return actionError('Энэ нийтлэлийн холбоосыг өөр нийтлэл ашиглаж байна.')
    if (error) {
        console.error('Blog post update failed', error.code)
        return actionError(saveError)
    }
    if (!data) return actionError(changedError)

    revalidatePath('/admin/blog')
    revalidatePath(`/admin/blog/${id}`)
    revalidatePath(`/admin/blog/${id}/preview`)
    return { ok: true, post: readPost(data) } as const
}

async function getCurrentPost(context: AdminContext, id: string, revision: number) {
    const { data, error } = await context.supabase.from('blog_posts').select(adminFields)
        .eq('id', id).eq('revision', revision).maybeSingle()
    if (error) console.error('Blog post lookup failed', error.code)
    return data ? readPost(data) : null
}

export async function saveBlogDraft(id: string, revision: number, input: unknown) {
    const context = await getAdminContext()
    if (!context) return actionError(accessError)
    if (!validRevision(id, revision)) return actionError(changedError)
    const draft = parseBlogDraft(input)
    if (!draft) return actionError('Нийтлэлийн агуулга эсвэл холбоос буруу байна.')

    const current = await getCurrentPost(context, id, revision)
    if (!current) return actionError(changedError)
    draft.slug = current.slug ?? (draft.slug || suggestBlogSlug(draft.title))
    return updateBlogPost(context, id, revision, { draft })
}

function revalidatePublicBlog() {
    revalidatePath('/blog')
    revalidatePath('/blog/[slug]', 'page')
    revalidatePath('/sitemap.xml')
}

export async function publishBlogPost(id: string, revision: number) {
    const context = await getAdminContext()
    if (!context) return actionError(accessError)
    if (!validRevision(id, revision)) return actionError(changedError)
    const current = await getCurrentPost(context, id, revision)
    if (!current) return actionError(changedError)

    const details = blogPublishDetails(current.draft)
    if (!details.ok) {
        if (details.reason === 'title-or-slug') return actionError('Гарчиг болон нийтлэлийн холбоосоо оруулна уу.')
        if (details.reason === 'empty-article') return actionError('Нийтлэхээс өмнө агуулгаа оруулна уу.')
        return actionError('Нийтлэхээс өмнө зураг, PDF болон YouTube блокуудыг бүрэн бөглөнө үү.')
    }

    const assetIds = [...details.assets.keys()]
    if (assetIds.length) {
        const { data: assets, error } = await context.supabase.from('blog_assets').select('id,kind')
            .eq('post_id', id).eq('validated', true).in('id', assetIds)
        if (error) return actionError(saveError)
        const byId = new Map(assets.map(({ id, kind }) => [id, kind]))
        if (assetIds.some((assetId) => byId.get(assetId) !== details.assets.get(assetId))) {
            return actionError('Зураг эсвэл PDF файл бэлэн болоогүй байна. Файлаа дахин оруулна уу.')
        }
    }

    const result = await updateBlogPost(context, id, revision, {
        slug: current.slug ?? details.content.slug,
        published: details.content,
        published_asset_ids: assetIds,
        published_at: current.publishedAt ?? new Date().toISOString(),
    })
    if (result.ok) revalidatePublicBlog()
    return result
}

export async function unpublishBlogPost(id: string, revision: number) {
    const context = await getAdminContext()
    if (!context) return actionError(accessError)
    if (!validRevision(id, revision)) return actionError(changedError)

    const result = await updateBlogPost(context, id, revision, {
        published: null,
        published_asset_ids: [],
        published_at: null,
    })
    if (result.ok) revalidatePublicBlog()
    return result
}
