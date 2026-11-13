import 'server-only'

import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, FileText } from 'lucide-react'
import { common, createLowlight } from 'lowlight'
import { Fragment, type ReactNode } from 'react'
import { blogBlockText, blogMediaPath, type BlogBlock, type BlogInline, type PublishedBlogPost } from '@/features/blog/model'
import { createTranslator } from '@/lib/i18n/translator'
import { getTranslations } from '@/lib/i18n/server'
import { BlogCopyButton, BlogYouTube } from './blog-article-controls'
import { BlogCover, BlogDate } from './blog-article-details'
import styles from './blog-article.module.css'

const highlighter = createLowlight(common)
const headingTags = ['h2', 'h3', 'h4', 'h5', 'h6'] as const

type ArticleContext = {
    preview: boolean
    t: ReturnType<typeof createTranslator>
}

function getText(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function renderInline(items: BlogInline[]): ReactNode {
    return items.map((item, index) => {
        if (item.type === 'link') {
            return (
                <a key={index} href={item.href} className="font-medium text-indigo-300 underline decoration-indigo-400/55 underline-offset-4 hover:text-indigo-100">
                    {renderInline(item.content)}
                </a>
            )
        }

        let text: ReactNode = item.text
        if (item.styles?.code) text = <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.9em] text-indigo-100">{text}</code>
        if (item.styles?.bold) text = <strong className="font-semibold text-zinc-50">{text}</strong>
        if (item.styles?.italic) text = <em>{text}</em>
        if (item.styles?.underline) text = <u>{text}</u>
        if (item.styles?.strike) text = <s>{text}</s>
        return <Fragment key={index}>{text}</Fragment>
    })
}

type HighlightNode = ReturnType<typeof highlighter.highlight>['children'][number]

function renderHighlight(nodes: HighlightNode[]): ReactNode {
    return nodes.map((node, index) => {
        if (node.type === 'text') return node.value
        if (node.type !== 'element') return null
        const classNames = node.properties.className
        return <span key={index} className={Array.isArray(classNames) ? classNames.join(' ') : undefined}>{renderHighlight(node.children)}</span>
    })
}

function CopyableBlock({ block, t }: { block: BlogBlock; t: ArticleContext['t'] }) {
    const isPrompt = block.type === 'prompt'
    const value = blogBlockText(block.content)
    const language = getText(block.props.language).toLowerCase()
    const title = isPrompt ? getText(block.props.label) || t('Промпт') : language || t('Код')
    const highlighted = !isPrompt && value.length <= 30_000 && highlighter.registered(language)
        ? renderHighlight(highlighter.highlight(language, value).children)
        : value

    return (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/70 px-4 py-2">
                <span className="min-w-0 text-sm font-medium text-zinc-200 [overflow-wrap:anywhere]">{title}</span>
                {value && (
                    <BlogCopyButton
                        value={value}
                        label={isPrompt ? t('Промпт хуулах') : t('Код хуулах')}
                        copiedLabel={t('Хууллаа')}
                        errorLabel={t('Текстийг сонгоод гараар хуулна уу.')}
                    />
                )}
            </div>
            {isPrompt ? (
                <p className="whitespace-pre-wrap px-4 py-5 text-base leading-7 text-zinc-200 [overflow-wrap:anywhere] sm:px-5">{value}</p>
            ) : (
                <pre tabIndex={0} aria-label={title} className={`${styles.code} max-w-full overflow-x-auto p-4 text-sm leading-6 text-zinc-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400 sm:p-5`}>
                    <code className="font-mono">{highlighted}</code>
                </pre>
            )}
        </div>
    )
}

function BlockContent({ block, context }: { block: BlogBlock; context: ArticleContext }) {
    const { preview, t } = context
    const content = renderInline(block.content)

    switch (block.type) {
        case 'heading': {
            const level = Number(block.props.level)
            const Tag = headingTags[Math.max(0, level - 2)] ?? 'h2'
            const size = Tag === 'h2' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
            return <Tag className={`mt-4 whitespace-pre-wrap font-semibold tracking-tight text-white ${size}`}>{content}</Tag>
        }
        case 'quote':
            return <blockquote className="whitespace-pre-wrap border-l-2 border-indigo-400/70 py-1 pl-4 italic text-zinc-300 sm:pl-6">{content}</blockquote>
        case 'codeBlock':
        case 'prompt':
            return <CopyableBlock block={block} t={t} />
        case 'image': {
            const assetId = getText(block.props.assetId)
            const caption = getText(block.props.caption)
            if (!assetId) return null
            return (
                <figure className="min-w-0">
                    {/* The upload is already compressed and draft images require the admin session. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={blogMediaPath(assetId, preview)} alt={getText(block.props.alt)} loading="lazy" decoding="async" className="mx-auto block max-h-[44rem] max-w-full rounded-xl border border-zinc-800 object-contain" />
                    {caption && <figcaption className="mt-2 text-center text-sm text-zinc-400">{caption}</figcaption>}
                </figure>
            )
        }
        case 'pdf': {
            const assetId = getText(block.props.assetId)
            if (!assetId) return null
            const url = blogMediaPath(assetId, preview)
            const download = `${url}${url.includes('?') ? '&' : '?'}download=1`
            const caption = getText(block.props.caption)
            const name = getText(block.props.name) || t('PDF файл')
            const openLabel = t('PDF нээх')
            const downloadLabel = t('PDF татах')
            return (
                <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/55 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <FileText className="mt-1 size-5 shrink-0 text-indigo-300" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="font-medium leading-snug text-zinc-100 [overflow-wrap:anywhere]">{name}</p>
                            {caption && <p className="mt-1 text-sm text-zinc-400">{caption}</p>}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 text-sm">
                        <a href={url} target="_blank" rel="noreferrer" aria-label={`${openLabel} · ${name}`} className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white">
                            <ExternalLink className="size-4" aria-hidden="true" /> {openLabel}
                        </a>
                        <a href={download} aria-label={`${downloadLabel} · ${name}`} className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white">
                            <Download className="size-4" aria-hidden="true" /> {downloadLabel}
                        </a>
                    </div>
                </div>
            )
        }
        case 'youtube': {
            const videoId = getText(block.props.videoId)
            if (!/^[\w-]{11}$/.test(videoId)) return null
            return <BlogYouTube videoId={videoId} title={getText(block.props.title) || t('YouTube бичлэг')} playLabel={t('Бичлэг тоглуулах')} watchLabel={t('YouTube дээр үзэх')} />
        }
        case 'paragraph':
            return <p className="min-h-[1em] whitespace-pre-wrap">{content}</p>
        default:
            return null
    }
}

function BlogBlocks({ blocks, context }: { blocks: BlogBlock[]; context: ArticleContext }) {
    const output: ReactNode[] = []

    for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index]
        if (block.type === 'bulletListItem' || block.type === 'numberedListItem') {
            const ordered = block.type === 'numberedListItem'
            const items = [block]
            while (blocks[index + 1]?.type === block.type) items.push(blocks[++index])
            const Tag = ordered ? 'ol' : 'ul'
            output.push(
                <Tag key={block.id} className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-6 marker:text-indigo-300`}>
                    {items.map((item) => (
                        <li key={item.id} className="pl-1">
                            <div className="whitespace-pre-wrap">{renderInline(item.content)}</div>
                            {item.children.length > 0 && <div className="mt-2 flex min-w-0 flex-col gap-2"><BlogBlocks blocks={item.children} context={context} /></div>}
                        </li>
                    ))}
                </Tag>
            )
            continue
        }

        output.push(
            <Fragment key={block.id}>
                <BlockContent block={block} context={context} />
                {block.children.length > 0 && <div className="flex min-w-0 flex-col gap-4 pl-3 sm:pl-5"><BlogBlocks blocks={block.children} context={context} /></div>}
            </Fragment>
        )
    }

    return output
}

export async function BlogArticle({ post, preview = false }: { post: PublishedBlogPost; preview?: boolean }) {
    const { content } = post
    const articleTranslation = createTranslator(content.language)
    const t = preview ? articleTranslation : await getTranslations()

    return (
        <div className="bg-zinc-950 px-4 pb-20 pt-8 text-zinc-100 sm:px-8 sm:pt-12">
            {!preview && (
                <div className="mx-auto mb-8 max-w-3xl">
                    <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-300 transition-colors hover:text-indigo-100">
                        <ArrowLeft className="size-4" aria-hidden="true" /> {t('Бүх нийтлэл')}
                    </Link>
                </div>
            )}
            <article lang={content.language} className="min-w-0">
                <header className="mx-auto max-w-3xl border-b border-zinc-800 pb-7">
                    {!preview && <p className="mb-3 text-sm text-zinc-400"><BlogDate value={post.publishedAt} locale={content.language} /></p>}
                    <h1 className="text-3xl font-bold leading-tight tracking-tight text-white [overflow-wrap:anywhere] sm:text-5xl">{content.title || t('Гарчиггүй нийтлэл')}</h1>
                    {content.excerpt && <p className="mt-4 text-lg leading-relaxed text-zinc-400 [overflow-wrap:anywhere] sm:text-xl">{content.excerpt}</p>}
                </header>
                {content.coverAssetId && (
                    <div className="relative mx-auto mt-8 aspect-video max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                        <BlogCover assetId={content.coverAssetId} alt={content.coverAlt} preview={preview} eager />
                    </div>
                )}
                <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-5 text-base leading-7 text-zinc-200 [overflow-wrap:anywhere] sm:mt-10 sm:text-lg sm:leading-8">
                    <BlogBlocks blocks={content.blocks} context={{ preview, t: articleTranslation }} />
                </div>
            </article>
        </div>
    )
}
