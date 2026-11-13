import { describe, expect, it } from 'vitest'
import { blogBlockText, blogPath, blogPublishDetails, emptyBlogDraft, parseBlogDraft, parseBlogYouTubeId, suggestBlogSlug } from './model'

const imageId = '99a393e5-7e08-4740-8c57-bd48c4a6ba88'
const pdfId = '7e9a28e0-e06d-4ae8-8664-3a66910e58a3'
const videoId = 'dQw4w9WgXcQ'

function draftWith(blocks: unknown[]) {
    return parseBlogDraft({ ...emptyBlogDraft(), title: 'Build a tool', slug: 'build-a-tool', blocks })
}

describe('blog documents', () => {
    it('preserves source formatting for copy and collects nested, typed assets for publication', () => {
        const prompt = 'Use this data:\n  {"topic": "AI"}\n'
        const draft = draftWith([
            { id: 'intro', type: 'paragraph', content: [{ type: 'text', text: 'A practical guide.' }], children: [
                { id: 'image', type: 'image', props: { assetId: imageId, alt: 'Example', caption: 'Result' } },
                { id: 'pdf', type: 'pdf', props: { assetId: pdfId, name: 'guide.pdf' } },
            ] },
            { id: 'prompt', type: 'prompt', props: { label: 'Starter prompt' }, content: [{ type: 'text', text: prompt }] },
            { id: 'video', type: 'youtube', props: { videoId } },
        ])
        expect(draft).not.toBeNull()
        expect(blogBlockText(draft!.blocks[1].content)).toBe(prompt)
        const publication = blogPublishDetails(draft!)
        expect(publication).toMatchObject({ ok: true, content: { excerpt: 'A practical guide.' } })
        if (!publication.ok) throw new Error('Expected publishable content')
        expect([...publication.assets.entries()]).toEqual([[imageId, 'image'], [pdfId, 'pdf']])
    })

    it('allows incomplete media in a private draft and requires it to be ready before publishing', () => {
        const draft = draftWith([{ id: 'video', type: 'youtube' }])
        expect(draft).not.toBeNull()
        expect(blogPublishDetails(draft!)).toEqual({ ok: false, reason: 'incomplete-media' })
        expect(blogPublishDetails(draftWith([])!)).toEqual({ ok: false, reason: 'empty-article' })
    })

    it('rejects links and block shapes that would bypass the reader’s renderer', () => {
        for (const href of ['javascript:alert(1)', 'data:text/html,unsafe', '//evil.test', '/\\evil.test']) {
            expect(draftWith([{ id: 'link', type: 'paragraph', content: [
                { type: 'link', href, content: [{ type: 'text', text: 'Open' }] },
            ] }])).toBeNull()
        }
        expect(draftWith([{ id: 'iframe', type: 'iframe', props: { src: 'https://evil.test' } }])).toBeNull()
        expect(draftWith([{ id: 'same', type: 'heading' }, { id: 'same', type: 'paragraph' }])).toBeNull()
    })
})

describe('blog links', () => {
    it('preserves Mongolian letters and reserves the media route', () => {
        const slug = suggestBlogSlug(' AI контент бүтээгч! ')
        expect(slug).toBe('ai-контент-бүтээгч')
        expect(decodeURI(blogPath(slug))).toBe('/blog/ai-контент-бүтээгч')
        expect(suggestBlogSlug('Media')).toBe('media-guide')
    })

    it('supports watch, short, live, and share links while rejecting other hosts', () => {
        for (const url of [
            `https://www.youtube.com/watch?v=${videoId}&t=4`,
            `https://youtu.be/${videoId}`,
            `https://m.youtube.com/shorts/${videoId}`,
            `https://www.youtube.com/live/${videoId}`,
            `https://www.youtube-nocookie.com/embed/${videoId}`,
        ]) expect(parseBlogYouTubeId(url)).toBe(videoId)
        expect(parseBlogYouTubeId(`https://youtube.com.evil.test/watch?v=${videoId}`)).toBeNull()
        expect(parseBlogYouTubeId(`https://youtube.com@evil.test/watch?v=${videoId}`)).toBeNull()
        expect(parseBlogYouTubeId('https://youtu.be/missing')).toBeNull()
    })
})
