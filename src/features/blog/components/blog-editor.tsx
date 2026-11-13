'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Eye, LoaderCircle, Save, Send, X } from 'lucide-react'
import { useLocale } from '@/components/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { blogMediaPath, blogPath, blogPublishDetails, suggestBlogSlug, type AdminBlogPost, type BlogBlock, type BlogDraft } from '@/features/blog/model'
import { publishBlogPost, saveBlogDraft, unpublishBlogPost } from '@/features/blog/server/blog-admin'
import { BlogEditorAssetUpload } from './blog-editor-assets'
import { getBlogEditorCopy } from './blog-editor-copy'

function BlogEditorLoading() {
    const copy = getBlogEditorCopy(useLocale())
    return (
        <div className="flex min-h-96 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-400" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{copy.loading}
        </div>
    )
}

const BlogEditorBlocks = dynamic(() => import('./blog-editor-blocks').then(({ BlogEditorBlocks }) => BlogEditorBlocks), {
    ssr: false,
    loading: BlogEditorLoading,
})

type EditorAction = 'save' | 'preview' | 'publish' | 'unpublish'
const secondaryButton = 'border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-800 hover:text-white'
const fieldClass = 'border-zinc-700 bg-zinc-950 text-zinc-100'

export function BlogEditor({ initialPost }: { initialPost: AdminBlogPost }) {
    const copy = getBlogEditorCopy(useLocale())
    const router = useRouter()
    const [post, setPost] = useState(initialPost)
    const [draft, setDraft] = useState(initialPost.draft)
    const blocks = useRef(initialPost.draft.blocks)
    const [slugEdited, setSlugEdited] = useState(Boolean(initialPost.draft.slug))
    const [dirty, setDirty] = useState(false)
    const [ready, setReady] = useState(false)
    const [uploadCount, setUploadCount] = useState(0)
    const [pendingAction, setPendingAction] = useState<EditorAction | null>(null)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const busy = pendingAction !== null
    const canSave = ready && uploadCount === 0 && !busy
    const slugLocked = post.slug !== null
    const liveDraft = post.published ? blogPublishDetails(post.draft) : null
    const draftChangesSaved = liveDraft && (!liveDraft.ok || JSON.stringify(liveDraft.content) !== JSON.stringify(post.published))

    const onBlocksChange = useCallback((next: BlogBlock[]) => {
        blocks.current = next
        setDirty(true)
        setNotice('')
    }, [])

    const onUploadStateChange = useCallback((uploading: boolean) => {
        setUploadCount((count) => count + (uploading ? 1 : -1))
    }, [])

    useEffect(() => {
        if (!dirty && uploadCount === 0) return

        function confirmUnload(event: BeforeUnloadEvent) {
            event.preventDefault()
            event.returnValue = ''
        }

        window.addEventListener('beforeunload', confirmUnload)
        return () => window.removeEventListener('beforeunload', confirmUnload)
    }, [dirty, uploadCount])

    function updateDraft<Field extends keyof Omit<BlogDraft, 'blocks'>>(field: Field, value: BlogDraft[Field]) {
        setDraft((current) => ({ ...current, [field]: value }))
        setDirty(true)
        setNotice('')
    }

    function updateTitle(title: string) {
        setDraft((current) => ({ ...current, title, slug: slugLocked || slugEdited ? current.slug : suggestBlogSlug(title) }))
        setDirty(true)
        setNotice('')
    }

    async function runAction(action: EditorAction) {
        if (!canSave) return
        if (action === 'unpublish' && !window.confirm(copy.unpublishConfirm)) return

        setPendingAction(action)
        setError('')
        setNotice('')
        try {
            if (action === 'unpublish') {
                const result = await unpublishBlogPost(post.id, post.revision)
                if (!result.ok) return setError(result.error)
                setPost(result.post)
                setNotice(copy.unpublishedNotice)
                return
            }

            if (action === 'preview' && !dirty) {
                router.push(`/admin/blog/${post.id}/preview`)
                return
            }

            const saved = await saveBlogDraft(post.id, post.revision, { ...draft, blocks: blocks.current })
            if (!saved.ok) return setError(saved.error)
            setPost(saved.post)
            setDraft(saved.post.draft)
            setDirty(false)

            if (action === 'publish') {
                const result = await publishBlogPost(post.id, saved.post.revision)
                if (!result.ok) return setError(result.error)
                setPost(result.post)
                setNotice(copy.publishedNotice)
            } else if (action === 'preview') {
                router.push(`/admin/blog/${post.id}/preview`)
            } else {
                setNotice(copy.saved)
            }
        } catch {
            setError(copy.actionError)
        } finally {
            setPendingAction(null)
        }
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-5 text-white md:p-8">
            <header className="space-y-4">
                <Link href="/admin/blog" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
                    onNavigate={(event) => {
                        if ((dirty || uploadCount > 0) && !window.confirm(copy.leaveConfirm)) event.preventDefault()
                    }}>
                    <ArrowLeft className="size-4" aria-hidden="true" />{copy.heading}
                </Link>

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{draft.title || copy.untitled}</h1>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={post.published ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-300'}>
                                {post.published ? copy.published : copy.draft}
                            </Badge>
                            {dirty ? (
                                <span className="text-xs text-amber-300">{copy.unsaved}</span>
                            ) : draftChangesSaved && (
                                <span className="text-xs text-indigo-200">{copy.draftChangesSaved}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2" aria-busy={busy}>
                        <Button type="button" variant="outline" className={secondaryButton} disabled={!canSave} onClick={() => void runAction('preview')}>
                            <Eye aria-hidden="true" />{copy.preview}
                        </Button>
                        <Button type="button" variant="outline" className={secondaryButton} disabled={!canSave} onClick={() => void runAction('save')}>
                            <Save aria-hidden="true" />{pendingAction === 'save' ? copy.saving : copy.save}
                        </Button>
                        <Button type="button" className="bg-indigo-500 text-white hover:bg-indigo-400" disabled={!canSave} onClick={() => void runAction('publish')}>
                            <Send aria-hidden="true" />{pendingAction === 'publish' ? copy.publishing : post.published ? copy.publishChanges : copy.publish}
                        </Button>
                    </div>
                </div>

                {error && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
                {notice && <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</p>}
            </header>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
                <div className="min-w-0 space-y-6">
                    <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
                        <div className="space-y-2">
                            <Label htmlFor="blog-title">{copy.title}</Label>
                            <Input id="blog-title" value={draft.title} maxLength={160} disabled={busy}
                                onChange={(event) => updateTitle(event.target.value)} className={fieldClass} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="blog-excerpt">{copy.excerpt}</Label>
                            <Textarea id="blog-excerpt" value={draft.excerpt} maxLength={300} disabled={busy}
                                placeholder={copy.excerptPlaceholder} onChange={(event) => updateDraft('excerpt', event.target.value)} className={fieldClass} />
                        </div>
                    </section>

                    <section className="space-y-3" aria-labelledby="blog-editor-heading">
                        <div>
                            <h2 id="blog-editor-heading" className="text-lg font-semibold">{copy.content}</h2>
                            <p className="mt-1 text-sm text-zinc-400">{copy.contentHelp}</p>
                        </div>
                        <BlogEditorBlocks postId={post.id} initialBlocks={initialPost.draft.blocks} disabled={busy}
                            onReady={setReady} onChange={onBlocksChange} onUploadStateChange={onUploadStateChange} />
                    </section>
                </div>

                <aside className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5" aria-labelledby="blog-settings-heading">
                    <h2 id="blog-settings-heading" className="text-lg font-semibold">{copy.settings}</h2>
                    <div className="space-y-2">
                        <Label htmlFor="blog-language">{copy.language}</Label>
                        <select id="blog-language" value={draft.language} disabled={busy}
                            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                            onChange={(event) => updateDraft('language', event.target.value === 'en' ? 'en' : 'mn')}>
                            <option value="mn">Монгол</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="blog-slug">{copy.slug}</Label>
                            {!slugLocked && (
                                <Button variant="ghost" size="xs" type="button" disabled={busy || !draft.title}
                                    className="text-indigo-200 hover:bg-indigo-900/40 hover:text-indigo-100" onClick={() => {
                                        setSlugEdited(false)
                                        updateDraft('slug', suggestBlogSlug(draft.title))
                                    }}>
                                    {copy.useTitle}
                                </Button>
                            )}
                        </div>
                        <Input id="blog-slug" value={draft.slug} maxLength={100} disabled={busy} readOnly={slugLocked} className={fieldClass} dir="ltr"
                            aria-describedby={slugLocked ? 'blog-slug-locked' : undefined}
                            onChange={(event) => {
                                setSlugEdited(true)
                                updateDraft('slug', event.target.value)
                            }} />
                        {draft.slug && <p className="break-all text-xs text-zinc-400" dir="ltr">/blog/{draft.slug}</p>}
                        {slugLocked && <p id="blog-slug-locked" className="text-xs text-zinc-400">{copy.slugLocked}</p>}
                    </div>

                    <section className="space-y-3 border-t border-zinc-800 pt-4" aria-labelledby="blog-cover-heading">
                        <h3 id="blog-cover-heading" className="text-sm font-semibold">{copy.cover}</h3>
                        {draft.coverAssetId && (
                            <Image src={blogMediaPath(draft.coverAssetId, true)} alt={draft.coverAlt} width={360} height={203} unoptimized
                                className="aspect-video w-full rounded-lg border border-zinc-800 bg-zinc-950 object-cover" />
                        )}
                        <BlogEditorAssetUpload postId={post.id} kind="image" disabled={busy}
                            label={draft.coverAssetId ? copy.replace : copy.addCover}
                            onUploadStateChange={onUploadStateChange} onUploaded={(asset) => updateDraft('coverAssetId', asset.id)} />
                        {draft.coverAssetId && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="blog-cover-alt">{copy.alt}</Label>
                                    <Input id="blog-cover-alt" value={draft.coverAlt} maxLength={300} disabled={busy} className={fieldClass}
                                        onChange={(event) => updateDraft('coverAlt', event.target.value)} />
                                </div>
                                <Button type="button" size="sm" variant="ghost" disabled={busy} className="text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                    onClick={() => {
                                        updateDraft('coverAssetId', null)
                                        updateDraft('coverAlt', '')
                                    }}>
                                    <X aria-hidden="true" />{copy.removeCover}
                                </Button>
                            </>
                        )}
                    </section>

                    {post.published && post.slug && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
                            <Button asChild variant="outline" size="sm" className={secondaryButton}>
                                <Link href={blogPath(post.slug)} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />{copy.viewLive}</Link>
                            </Button>
                            <Button variant="ghost" size="sm" type="button" className="text-amber-200 hover:bg-amber-950 hover:text-amber-100"
                                disabled={!canSave} onClick={() => void runAction('unpublish')}>
                                {pendingAction === 'unpublish' ? copy.unpublishing : copy.unpublish}
                            </Button>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    )
}
