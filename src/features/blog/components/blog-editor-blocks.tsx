'use client'

import '@blocknote/mantine/style.css'
import { createContext, useContext, useEffect, useId, useState } from 'react'
import Image from 'next/image'
import { Code2, FileText, ImageIcon, List, ListOrdered, Play, Quote, Sparkles, Type } from 'lucide-react'
import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs, defaultStyleSpecs } from '@blocknote/core'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import { BlockNoteView } from '@blocknote/mantine'
import { createReactBlockSpec, SuggestionMenuController, useCreateBlockNote, type DefaultReactSuggestionItem } from '@blocknote/react'
import { useLocale } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { blogBlockText, blogMediaPath, parseBlogYouTubeId, type BlogBlock } from '@/features/blog/model'
import { BlogEditorAssetUpload } from './blog-editor-assets'
import { getBlogEditorCopy } from './blog-editor-copy'

type EditorControls = {
    postId: string
    disabled: boolean
    onUploadStateChange: (uploading: boolean) => void
}

const EditorControlsContext = createContext<EditorControls | null>(null)

function useEditorControls() {
    const controls = useContext(EditorControlsContext)
    if (!controls) throw new Error('Blog blocks require editor controls.')
    return controls
}

function BlockField({ label, value, maxLength, onChange, placeholder, invalid }: {
    label: string
    value: string
    maxLength?: number
    onChange: (value: string) => void
    placeholder?: string
    invalid?: boolean
}) {
    const inputId = useId()
    const { disabled } = useEditorControls()

    return (
        <label htmlFor={inputId} className="block space-y-1 text-xs text-zinc-300">
            <span>{label}</span>
            <Input id={inputId} value={value} maxLength={maxLength} disabled={disabled} placeholder={placeholder}
                aria-invalid={invalid} onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) => onChange(event.target.value)}
                className="h-8 border-zinc-700 bg-zinc-950 text-zinc-100" />
        </label>
    )
}

const imageBlock = createReactBlockSpec({
    type: 'image',
    content: 'none',
    propSchema: { assetId: { default: '' }, alt: { default: '' }, caption: { default: '' } },
}, {
    toExternalHTML: ({ block }) => <p>{block.props.caption || block.props.alt || 'Image'}</p>,
    render: function BlogImageBlock({ block, editor }) {
        const copy = getBlogEditorCopy(useLocale())
        const controls = useEditorControls()
        const { assetId, alt, caption } = block.props

        return (
            <div contentEditable={false} className="my-2 w-full space-y-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                {assetId && (
                    <Image src={blogMediaPath(assetId, true)} alt={alt} width={640} height={360} unoptimized
                        className="max-h-64 w-full rounded-lg bg-zinc-950 object-contain" />
                )}
                <BlogEditorAssetUpload {...controls} kind="image" label={assetId ? copy.replace : copy.addImage}
                    onUploaded={(asset) => {
                        if (editor.getBlock(block.id)) editor.updateBlock(block.id, { props: { assetId: asset.id } })
                    }} />
                <BlockField label={copy.alt} value={alt} maxLength={300}
                    onChange={(value) => editor.updateBlock(block.id, { props: { alt: value } })} />
                <BlockField label={copy.caption} value={caption} maxLength={500}
                    onChange={(value) => editor.updateBlock(block.id, { props: { caption: value } })} />
            </div>
        )
    },
})

const pdfBlock = createReactBlockSpec({
    type: 'pdf',
    content: 'none',
    propSchema: { assetId: { default: '' }, name: { default: '' }, caption: { default: '' } },
}, {
    toExternalHTML: ({ block }) => <p>{block.props.name || 'PDF'}</p>,
    render: function BlogPdfBlock({ block, editor }) {
        const copy = getBlogEditorCopy(useLocale())
        const controls = useEditorControls()
        const { assetId, name, caption } = block.props

        return (
            <div contentEditable={false} className="my-2 w-full space-y-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                {assetId && (
                    <a href={blogMediaPath(assetId, true)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-indigo-200 underline underline-offset-4">
                        <FileText className="size-4" aria-hidden="true" />{copy.openPdf}
                    </a>
                )}
                <BlogEditorAssetUpload {...controls} kind="pdf" label={assetId ? copy.replace : copy.addPdf}
                    onUploaded={(asset) => {
                        const current = editor.getBlock(block.id)
                        if (current) editor.updateBlock(block.id, { props: { assetId: asset.id, name: current.props.name || asset.name.slice(0, 180) } })
                    }} />
                <BlockField label={copy.pdfTitle} value={name} maxLength={180}
                    onChange={(value) => editor.updateBlock(block.id, { props: { name: value } })} />
                <BlockField label={copy.caption} value={caption} maxLength={500}
                    onChange={(value) => editor.updateBlock(block.id, { props: { caption: value } })} />
            </div>
        )
    },
})

const youtubeBlock = createReactBlockSpec({
    type: 'youtube',
    content: 'none',
    propSchema: { videoId: { default: '' }, title: { default: '' } },
}, {
    toExternalHTML: ({ block }) => {
        const videoId = parseBlogYouTubeId(block.props.videoId)
        return videoId ? <a href={`https://youtu.be/${videoId}`}>{block.props.title || 'YouTube'}</a> : <p>YouTube</p>
    },
    render: function BlogYouTubeBlock({ block, editor }) {
        const copy = getBlogEditorCopy(useLocale())
        const { videoId, title } = block.props
        const [input, setInput] = useState<{ value: string; videoId: string } | null>(null)
        const displayUrl = input?.videoId === videoId ? input.value : videoId ? `https://youtu.be/${videoId}` : ''
        const invalid = Boolean(displayUrl.trim()) && !parseBlogYouTubeId(displayUrl)

        return (
            <div contentEditable={false} className="my-2 w-full space-y-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
                <BlockField label={copy.youtubeUrl} value={displayUrl} placeholder="https://youtu.be/…" maxLength={2000} invalid={invalid}
                    onChange={(value) => {
                        const nextId = parseBlogYouTubeId(value) ?? ''
                        setInput({ value, videoId: nextId })
                        if (nextId !== videoId) editor.updateBlock(block.id, { props: { videoId: nextId } })
                    }} />
                {invalid && <p className="text-xs text-amber-300">{copy.invalidYoutube}</p>}
                <BlockField label={copy.youtubeTitle} value={title} maxLength={160}
                    onChange={(value) => editor.updateBlock(block.id, { props: { title: value } })} />
            </div>
        )
    },
})

const promptBlock = createReactBlockSpec({
    type: 'prompt',
    content: 'plain',
    propSchema: { label: { default: '' } },
}, {
    meta: { code: true },
    experimental_keyboard: { enter: 'line-break' },
    toExternalHTML: ({ contentRef }) => <pre ref={contentRef} />,
    render: function BlogPromptBlock({ block, editor, contentRef }) {
        const copy = getBlogEditorCopy(useLocale())

        return (
            <div className="my-2 w-full space-y-3 rounded-xl border border-indigo-900/70 bg-indigo-950/40 p-3">
                <div contentEditable={false}>
                    <BlockField label={copy.promptLabel} value={block.props.label} maxLength={120}
                        onChange={(value) => editor.updateBlock(block.id, { props: { label: value } })} />
                </div>
                <div ref={contentRef} aria-label={copy.prompt} className="min-h-12 whitespace-pre-wrap rounded-lg bg-zinc-950 p-2 font-mono text-sm text-zinc-100" />
            </div>
        )
    },
})

const schema = BlockNoteSchema.create({
    blockSpecs: {
        paragraph: defaultBlockSpecs.paragraph,
        heading: defaultBlockSpecs.heading,
        bulletListItem: defaultBlockSpecs.bulletListItem,
        numberedListItem: defaultBlockSpecs.numberedListItem,
        quote: defaultBlockSpecs.quote,
        codeBlock: createCodeBlockSpec({
            defaultLanguage: 'text',
            supportedLanguages: {
                text: { name: 'Plain text' }, javascript: { name: 'JavaScript', aliases: ['js'] },
                typescript: { name: 'TypeScript', aliases: ['ts'] }, python: { name: 'Python', aliases: ['py'] },
                tsx: { name: 'TSX' }, html: { name: 'HTML' }, css: { name: 'CSS' },
                json: { name: 'JSON' }, sql: { name: 'SQL' }, bash: { name: 'Bash', aliases: ['sh'] },
            },
        }),
        image: imageBlock(),
        pdf: pdfBlock(),
        youtube: youtubeBlock(),
        prompt: promptBlock(),
    },
    styleSpecs: {
        bold: defaultStyleSpecs.bold, italic: defaultStyleSpecs.italic, underline: defaultStyleSpecs.underline,
        strike: defaultStyleSpecs.strike, code: defaultStyleSpecs.code,
    },
})

type EditorBlock = typeof schema.Block
type PartialEditorBlock = typeof schema.PartialBlock

function toEditorBlock(block: BlogBlock): PartialEditorBlock {
    const { content, children, ...attrs } = block
    if (block.type === 'image' || block.type === 'pdf' || block.type === 'youtube') {
        return { ...attrs, children: children.map(toEditorBlock) } as PartialEditorBlock
    }
    const editorContent = block.type === 'prompt' || block.type === 'codeBlock' ? blogBlockText(content) : content
    // The server validates the block type and its properties before passing a draft to the editor.
    return { ...attrs, content: editorContent, children: children.map(toEditorBlock) } as PartialEditorBlock
}

function fromEditorBlock(block: EditorBlock): BlogBlock {
    return { ...block, content: block.content ?? [], children: block.children.map(fromEditorBlock) }
}

export function BlogEditorBlocks({ postId, initialBlocks, disabled, onChange, onReady, onUploadStateChange }: EditorControls & {
    initialBlocks: BlogBlock[]
    onChange: (blocks: BlogBlock[]) => void
    onReady: (ready: boolean) => void
}) {
    const locale = useLocale()
    const copy = getBlogEditorCopy(locale)
    const editor = useCreateBlockNote({
        schema,
        initialContent: initialBlocks.length ? initialBlocks.map(toEditorBlock) : undefined,
        domAttributes: { editor: { 'aria-label': copy.content } },
    })

    useEffect(() => {
        onReady(true)
        return () => onReady(false)
    }, [onReady])

    const insert = (block: PartialEditorBlock) => insertOrUpdateBlockForSlashMenu(editor, block)
    const specialBlocks = [
        { title: copy.image, aliases: ['image', 'photo', 'зураг'], icon: <ImageIcon aria-hidden="true" />, onItemClick: () => insert({ type: 'image' }) },
        { title: copy.pdf, aliases: ['pdf', 'document'], icon: <FileText aria-hidden="true" />, onItemClick: () => insert({ type: 'pdf' }) },
        { title: copy.youtube, aliases: ['youtube', 'video'], icon: <Play aria-hidden="true" />, onItemClick: () => insert({ type: 'youtube' }) },
        { title: copy.prompt, aliases: ['prompt', 'промпт'], icon: <Sparkles aria-hidden="true" />, onItemClick: () => insert({ type: 'prompt' }) },
        { title: copy.code, aliases: ['code', 'код'], icon: <Code2 aria-hidden="true" />, onItemClick: () => insert({ type: 'codeBlock' }) },
    ]
    const slashItems: DefaultReactSuggestionItem[] = [
        { title: locale === 'en' ? 'Text' : 'Текст', aliases: ['text', 'paragraph'], icon: <Type />, onItemClick: () => insert({ type: 'paragraph' }) },
        { title: locale === 'en' ? 'Heading' : 'Дэд гарчиг', aliases: ['heading', 'h2'], icon: <Type />, onItemClick: () => insert({ type: 'heading', props: { level: 2 } }) },
        { title: locale === 'en' ? 'Subheading' : 'Жижиг дэд гарчиг', aliases: ['subheading', 'h3'], icon: <Type />, onItemClick: () => insert({ type: 'heading', props: { level: 3 } }) },
        { title: locale === 'en' ? 'Bulleted list' : 'Жагсаалт', aliases: ['bullet', 'list'], icon: <List />, onItemClick: () => insert({ type: 'bulletListItem' }) },
        { title: locale === 'en' ? 'Numbered list' : 'Дугаартай жагсаалт', aliases: ['number', 'list'], icon: <ListOrdered />, onItemClick: () => insert({ type: 'numberedListItem' }) },
        { title: locale === 'en' ? 'Quote' : 'Эшлэл', aliases: ['quote'], icon: <Quote />, onItemClick: () => insert({ type: 'quote' }) },
        ...specialBlocks,
    ]

    return (
        <EditorControlsContext.Provider value={{ postId, disabled, onUploadStateChange }}>
            <div className="overflow-visible rounded-xl border border-zinc-800 bg-zinc-950">
                <div className="flex flex-wrap gap-1 border-b border-zinc-800 p-2" aria-label={copy.content}>
                    {specialBlocks.map((item) => (
                        <Button key={item.title} type="button" size="sm" variant="ghost" disabled={disabled}
                            className="text-zinc-300 hover:bg-zinc-800 hover:text-white"
                            onClick={item.onItemClick}>
                            {item.icon}{item.title}
                        </Button>
                    ))}
                </div>
                <BlockNoteView editor={editor} theme="dark" editable={!disabled} slashMenu={false}
                    onChange={() => onChange(editor.document.map(fromEditorBlock))}
                    className="[&_.bn-editor]:min-h-[380px] [&_.bn-editor]:bg-zinc-950 [&_.bn-editor]:py-5">
                    <SuggestionMenuController triggerCharacter="/" getItems={async (query) => filterSuggestionItems(slashItems, query)} />
                </BlockNoteView>
            </div>
        </EditorControlsContext.Provider>
    )
}
