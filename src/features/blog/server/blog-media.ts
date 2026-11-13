'use server'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { blogIdSchema } from '@/features/blog/model'
import { getTranslations } from '@/lib/i18n/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { prepareCourseCover } from '@/lib/uploads/course-cover'

const bucket = 'blog-media'
const maximumImageBytes = 4 * 1024 * 1024
const maximumPdfBytes = 20 * 1024 * 1024

const pdfUpload = z.object({
    name: z.string().trim().min(5).max(180).regex(/\.pdf$/i),
    size: z.number().int().positive().max(maximumPdfBytes),
    type: z.enum(['application/pdf', '']),
})

type BlogMediaFailure = { ok: false; error: string }
type BlogMediaAsset = {
    id: string
    name: string
}
type BlogMediaResult = { ok: true; asset: BlogMediaAsset } | BlogMediaFailure
type BlogPdfUploadResult = {
    ok: true
    assetId: string
    uploadUrl: string
} | BlogMediaFailure

const accessError = 'Файл оруулахын тулд нийтлэлээ хадгалж, админ эрхээр нэвтэрнэ үү.'
const pdfMissingError = 'PDF файлын илгээлт олдсонгүй.'

async function mediaError(message: string): Promise<BlogMediaFailure> {
    const t = await getTranslations()
    return { ok: false, error: t(message) }
}

async function getAdminForPost(postId: string) {
    if (!blogIdSchema.safeParse(postId).success) return null

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const [{ data: role }, { data: post }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
        supabase.from('blog_posts').select('id').eq('id', postId).maybeSingle(),
    ])
    return role?.role === 'admin' && post ? createAdminClient() : null
}

function fileName(value: string) {
    const basename = value.split(/[\\/]/).at(-1) ?? ''
    return Array.from(basename)
        .filter(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
        .join('')
        .trim()
        .slice(0, 180)
}

export async function uploadBlogImage(postId: string, formData: FormData): Promise<BlogMediaResult> {
    try {
        const admin = await getAdminForPost(postId)
        if (!admin) return mediaError(accessError)

        const file = formData.get('file')
        if (!(file instanceof File) || file.size === 0 || file.size > maximumImageBytes) {
            return mediaError('4 МБ хүртэлх JPG, PNG эсвэл WebP зураг сонгоно уу.')
        }

        const prepared = await prepareCourseCover(file).catch(() => null)
        if (!prepared) return mediaError('Зургийг боловсруулах боломжгүй байна. Хөдөлгөөнгүй JPG, PNG эсвэл WebP зураг сонгоно уу.')

        const id = randomUUID()
        const path = `${postId}/${id}.webp`
        const name = fileName(file.name) || 'image.webp'
        const storage = admin.storage.from(bucket)
        const { error: uploadError } = await storage.upload(path, prepared.data, {
            contentType: prepared.contentType,
            cacheControl: '60',
            upsert: false,
        })
        if (uploadError) throw uploadError

        const sizeBytes = prepared.data.length
        const { error: saveError } = await admin.from('blog_assets').insert({
            id, post_id: postId, kind: 'image', name, path, size_bytes: sizeBytes, validated: true,
        })
        if (saveError) {
            await storage.remove([path])
            throw saveError
        }

        return { ok: true, asset: { id, name } }
    } catch (error) {
        console.error('Blog image upload failed', error)
        return mediaError('Зургийг оруулж чадсангүй. Дахин оролдоно уу.')
    }
}

export async function beginBlogPdfUpload(
    postId: string,
    file: { name: string; size: number; type: string },
): Promise<BlogPdfUploadResult> {
    try {
        const admin = await getAdminForPost(postId)
        if (!admin) return mediaError(accessError)

        const parsed = pdfUpload.safeParse(file)
        if (!parsed.success) return mediaError('20 МБ хүртэлх, 180-аас олонгүй тэмдэгттэй нэр бүхий PDF файл сонгоно уу.')

        const assetId = randomUUID()
        const path = `${postId}/${assetId}.pdf`
        const { data: signed, error: signingError } = await admin.storage.from(bucket).createSignedUploadUrl(path)
        if (signingError) throw signingError

        const name = fileName(parsed.data.name)
        const { error: saveError } = await admin.from('blog_assets').insert({
            id: assetId, post_id: postId, kind: 'pdf', name, path, size_bytes: parsed.data.size,
        })
        if (saveError) throw saveError

        return { ok: true, assetId, uploadUrl: signed.signedUrl }
    } catch (error) {
        console.error('Blog PDF upload could not start', error)
        return mediaError('PDF файлыг оруулж эхэлж чадсангүй. Дахин оролдоно уу.')
    }
}

async function hasPdfHeader(url: string) {
    const response = await fetch(url, {
        headers: { Range: 'bytes=0-4' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok || !response.body) throw new Error(`Could not verify the uploaded PDF (${response.status}).`)

    const reader = response.body.getReader()
    const signature = Buffer.from('%PDF-')
    let offset = 0
    try {
        while (offset < signature.length) {
            const { value, done } = await reader.read()
            if (done) return false
            for (const byte of value) {
                if (byte !== signature[offset++]) return false
                if (offset === signature.length) return true
            }
        }
        return false
    } finally {
        await reader.cancel().catch(() => undefined)
    }
}

export async function finishBlogPdfUpload(postId: string, assetId: string): Promise<BlogMediaResult> {
    try {
        const admin = await getAdminForPost(postId)
        if (!admin || !blogIdSchema.safeParse(assetId).success) return mediaError(pdfMissingError)

        const { data: row, error: readError } = await admin.from('blog_assets')
            .select('id, name, path, size_bytes, validated')
            .eq('id', assetId)
            .eq('post_id', postId)
            .eq('kind', 'pdf')
            .maybeSingle()
        if (readError) throw readError
        if (!row) return mediaError(pdfMissingError)

        const asset: BlogMediaAsset = { id: row.id, name: row.name }
        if (row.validated) return { ok: true, asset }

        const storage = admin.storage.from(bucket)
        const { data: info, error: infoError } = await storage.info(row.path)
        if (infoError) throw infoError

        const actualSize = info.size ?? info.metadata?.size
        const contentType = info.contentType ?? info.metadata?.mimetype
        const matchesFile = Number(actualSize) === row.size_bytes && contentType === 'application/pdf'
        let hasHeader = false
        if (matchesFile) {
            const { data: signed, error: signingError } = await storage.createSignedUrl(row.path, 60)
            if (signingError) throw signingError
            hasHeader = await hasPdfHeader(signed.signedUrl)
        }
        if (!hasHeader) {
            const { error: removeError } = await storage.remove([row.path])
            if (removeError) throw removeError
            return mediaError('Оруулсан файлыг PDF хэлбэрээр уншиж чадсангүй. Өөр PDF файл сонгоно уу.')
        }

        const { error: saveError } = await admin.from('blog_assets').update({ validated: true }).eq('id', row.id)
        if (saveError) throw saveError

        return { ok: true, asset }
    } catch (error) {
        console.error('Blog PDF upload could not be verified', error)
        return mediaError('PDF файлыг шалгаж чадсангүй. Дахин оролдоно уу.')
    }
}
