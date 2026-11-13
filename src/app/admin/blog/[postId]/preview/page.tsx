import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BlogArticle } from '@/features/blog/components/blog-article'
import { getAdminBlogPost } from '@/features/blog/server/blog-admin'
import { getTranslations } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Blog preview', robots: { index: false, follow: false } }

export default async function BlogPreviewPage({ params }: { params: Promise<{ postId: string }> }) {
    const { postId } = await params
    const [post, t] = await Promise.all([getAdminBlogPost(postId), getTranslations()])
    if (!post) notFound()

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-400/20 bg-violet-950/30 px-5 py-4 text-sm text-violet-100 sm:px-8">
                <Link href={`/admin/blog/${post.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                    <ArrowLeft className="size-4" aria-hidden="true" /> {t('Засварлагч руу буцах')}
                </Link>
                <p>{t('Ноорог урьдчилан харах')}</p>
            </div>
            <BlogArticle preview post={{
                id: post.id,
                content: { ...post.draft, title: post.draft.title || t('Гарчиггүй нийтлэл') },
                publishedAt: post.publishedAt ?? post.updatedAt,
                updatedAt: post.updatedAt,
            }} />
        </div>
    )
}
