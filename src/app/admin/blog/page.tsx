import Link from 'next/link'
import { ArrowLeft, ArrowRight, ExternalLink, PencilLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BlogEditorCreateButton } from '@/features/blog/components/blog-editor-create-button'
import { getBlogEditorCopy } from '@/features/blog/components/blog-editor-copy'
import { listAdminBlogPosts } from '@/features/blog/server/blog-admin'
import { getLocale } from '@/lib/i18n/server'

const outlineButton = 'border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-800 hover:text-white'

export default async function AdminBlogPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
    const [params, locale] = await Promise.all([searchParams, getLocale()])
    const requestedPage = Number(params.page)
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const { posts, hasNextPage } = await listAdminBlogPosts(page)
    const copy = getBlogEditorCopy(locale)
    const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'mn-MN', {
        dateStyle: 'medium', timeZone: 'Asia/Ulaanbaatar',
    })

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-5 text-white md:p-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
                    <p className="mt-2 text-sm text-zinc-400">{copy.listDescription}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className={outlineButton}>
                        <Link href="/blog" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />{copy.publicBlog}</Link>
                    </Button>
                    <BlogEditorCreateButton />
                </div>
            </header>

            {posts.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-10 text-center text-sm text-zinc-400">{copy.noPosts}</p>
            ) : (
                <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950">
                    {posts.map((post) => (
                        <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
                            <div className="min-w-0 space-y-1.5">
                                <Link href={`/admin/blog/${post.id}`} className="break-words font-semibold hover:text-indigo-300">
                                    {post.title || copy.untitled}
                                </Link>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                    <Badge variant="outline" className={post.publishedAt ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300'}>
                                        {post.publishedAt ? copy.published : copy.draft}
                                    </Badge>
                                    <span>{post.language === 'en' ? 'English' : 'Монгол'}</span>
                                    <span>{copy.updated} <time dateTime={post.updatedAt}>{date.format(new Date(post.updatedAt))}</time></span>
                                </div>
                            </div>
                            <Button asChild size="sm" variant="outline" className={outlineButton}>
                                <Link href={`/admin/blog/${post.id}`} aria-label={`${copy.edit} ${post.title || copy.untitled}`}>
                                    <PencilLine aria-hidden="true" />{copy.edit}
                                </Link>
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {(page > 1 || hasNextPage) && (
                <nav className="flex flex-wrap gap-2" aria-label={copy.heading}>
                    {page > 1 && (
                        <Button asChild size="sm" variant="outline" className={outlineButton}>
                            <Link href={page === 2 ? '/admin/blog' : `/admin/blog?page=${page - 1}`}><ArrowLeft aria-hidden="true" />{copy.newer}</Link>
                        </Button>
                    )}
                    {hasNextPage && (
                        <Button asChild size="sm" variant="outline" className={outlineButton}>
                            <Link href={`/admin/blog?page=${page + 1}`}>{copy.older}<ArrowRight aria-hidden="true" /></Link>
                        </Button>
                    )}
                </nav>
            )}
        </div>
    )
}
