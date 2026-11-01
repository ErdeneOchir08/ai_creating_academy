import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageConfigContext } from 'next/dist/shared/lib/image-config-context.shared-runtime'
import { imageConfigDefault } from 'next/dist/shared/lib/image-config'
import { courseCoverRemotePatterns } from '@/lib/images/course-cover'
import { CourseCoverImage } from './course-cover-image'

const projectUrl = 'https://academy-test.supabase.co'

function renderCover(source: string) {
    return renderToStaticMarkup(
        <ImageConfigContext.Provider value={{ ...imageConfigDefault, remotePatterns: courseCoverRemotePatterns(projectUrl) }}>
            <CourseCoverImage src={source} alt="AI course cover" sizes="(max-width: 639px) 100vw, 25vw" />
        </ImageConfigContext.Provider>,
    )
}

describe('course cover delivery', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_ACADEMY_SUPABASE_URL', projectUrl)
    })
    afterEach(() => vi.unstubAllEnvs())

    it('renders responsive, lazy image variants through the website optimizer', () => {
        const html = renderCover(`${projectUrl}/storage/v1/object/public/course-media/cover.webp`)
        expect(html).toContain('alt="AI course cover"')
        expect(html).toContain('loading="lazy"')
        expect(html).toContain('srcSet=')
        expect(html).toContain('sizes="(max-width: 639px) 100vw, 25vw"')
        expect(html).toContain('/_next/image?url=')
        expect(html).toContain('position:absolute')
        expect(html).not.toContain('<link rel="preload"')
    })

    it('preserves legacy external covers without routing them through the public cache', () => {
        const html = renderCover('https://legacy.example.com/cover.jpg')
        expect(html).toContain('src="https://legacy.example.com/cover.jpg"')
        expect(html).toContain('loading="lazy"')
        expect(html).toContain('decoding="async"')
        expect(html).not.toContain('/_next/image')
        expect(html).not.toContain('srcSet=')
    })

    it('routes the identified original to its immutable website asset rather than Supabase', () => {
        const html = renderCover(`${projectUrl}/storage/v1/object/public/course-media/bb89bba3-3170-4f32-baa8-001daa0a5657.png`)
        expect(html).toContain('%2Fcourse-covers%2Fai-content-creator-ba840ecc4f990edc.webp')
        expect(html).not.toContain('supabase.co')
        expect(html).not.toContain('bb89bba3-3170-4f32-baa8-001daa0a5657.png')
    })
})
