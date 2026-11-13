import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowUpRight, FileText } from 'lucide-react'
import { notFound } from 'next/navigation'
import { BlogCover, BlogDate } from '@/features/blog/components/blog-article-details'
import { blogPath, type PublishedBlogSummary } from '@/features/blog/model'
import { listPublishedBlogPosts } from '@/features/blog/server/blog-public'
import { getLocale, getTranslations } from '@/lib/i18n/server'
import { getConfiguredSiteUrl } from '@/lib/site-url'

type BlogIndexProps = { searchParams: Promise<{ page?: string | string[] }> }
const pageSize = 12

function getPageNumber(value: string | string[] | undefined) {
    if (typeof value !== 'string' || !/^\d{1,5}$/.test(value)) return 1
    return Math.max(1, Number(value))
}

function pagePath(page: number) {
    return page === 1 ? '/blog' : `/blog?page=${page}`
}

export async function generateMetadata({ searchParams }: BlogIndexProps): Promise<Metadata> {
    const [{ page }, t] = await Promise.all([searchParams, getTranslations()])
    const title = t('Блог')
    const description = t('Хиймэл оюун, кодчилол, технологийн тухай алхамчилсан заавар, жишээнүүд.')
    const siteUrl = getConfiguredSiteUrl()
    const url = siteUrl ? `${siteUrl}${pagePath(getPageNumber(page))}` : undefined

    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: { title: `${title} | Mind Academy`, description, url, type: 'website', siteName: 'Mind Academy' },
    }
}

function PostCard({ post }: { post: PublishedBlogSummary }) {
    const { content } = post
    return (
        <article className="min-w-0">
            <Link
                href={blogPath(content.slug)}
                prefetch={false}
                className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/55 outline-offset-4 transition-colors hover:border-indigo-400/55 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
                {content.coverAssetId && (
                    <div className="relative aspect-video overflow-hidden border-b border-zinc-800 bg-zinc-900">
                        <BlogCover assetId={content.coverAssetId} alt="" />
                    </div>
                )}
                <div lang={content.language} className="flex flex-1 items-start justify-between gap-4 p-5 sm:p-6">
                    <div className="min-w-0 space-y-2.5 [overflow-wrap:anywhere]">
                        <p className="text-xs font-medium text-zinc-400"><BlogDate value={post.publishedAt} locale={content.language} /></p>
                        <h2 className="text-xl font-semibold leading-snug tracking-tight text-zinc-100 group-hover:text-white">{content.title}</h2>
                        {content.excerpt && <p className="line-clamp-3 text-sm leading-6 text-zinc-400">{content.excerpt}</p>}
                    </div>
                    <ArrowUpRight className="mt-1 size-5 shrink-0 text-indigo-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
            </Link>
        </article>
    )
}

export default async function BlogIndex({ searchParams }: BlogIndexProps) {
    const { page: pageParam } = await searchParams
    const page = getPageNumber(pageParam)
    const [posts, t, locale] = await Promise.all([
        listPublishedBlogPosts(pageSize + 1, (page - 1) * pageSize),
        getTranslations(),
        getLocale(),
    ])
    if (page > 1 && posts.length === 0) notFound()

    return (
        <div className="min-h-[calc(100vh-64px)] bg-zinc-950 px-4 pb-20 pt-12 text-zinc-100 sm:px-8 sm:pt-16">
            <div className="mx-auto max-w-6xl">
                <header className="relative isolate overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/45 px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
                    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_85%_0%,rgba(79,70,229,0.28),transparent_70%)]" aria-hidden="true" />
                    <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">{t('Блог')}</h1>
                    <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">{t('Хиймэл оюун, кодчилол, технологийн тухай алхамчилсан заавар, жишээнүүд.')}</p>
                </header>

                {posts.length > 0 ? (
                    <section className="mt-8 grid gap-5 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('Бүх нийтлэл')}>
                        {posts.slice(0, pageSize).map((post) => <PostCard key={post.id} post={post} />)}
                    </section>
                ) : (
                    <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center sm:mt-10 sm:py-16">
                        <FileText className="size-8 text-indigo-300" aria-hidden="true" />
                        <p className="font-medium text-zinc-200">{t('Одоогоор нийтлэл алга.')}</p>
                        <Link href="/programs" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-indigo-100">
                            {t('Сургалтуудыг үзэх')} <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                    </div>
                )}

                {(page > 1 || posts.length > pageSize) && (
                    <nav aria-label={t('Нийтлэлийн хуудас')} className="mt-8 flex items-center justify-between gap-4 border-t border-zinc-800 pt-6 text-sm">
                        {page > 1 ? (
                            <Link href={pagePath(page - 1)} rel="prev" className="inline-flex items-center gap-2 font-medium text-indigo-300 hover:text-indigo-100">
                                <ArrowLeft className="size-4" aria-hidden="true" /> {t('Өмнөх хуудас')}
                            </Link>
                        ) : <span />}
                        <span className="text-zinc-400" aria-current="page">{new Intl.NumberFormat(locale).format(page)}</span>
                        {posts.length > pageSize ? (
                            <Link href={pagePath(page + 1)} rel="next" className="inline-flex items-center gap-2 font-medium text-indigo-300 hover:text-indigo-100">
                                {t('Дараагийн хуудас')} <ArrowRight className="size-4" aria-hidden="true" />
                            </Link>
                        ) : <span />}
                    </nav>
                )}
            </div>
        </div>
    )
}
