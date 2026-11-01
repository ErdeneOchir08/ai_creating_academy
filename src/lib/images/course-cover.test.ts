import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern'
import { canOptimizeCourseCover, courseCoverRemotePatterns, getCourseCoverSource } from './course-cover'

const projectUrl = 'https://academy-test.supabase.co'
const publicCover = `${projectUrl}/storage/v1/object/public/course-media/cover.webp`

describe('public course cover image policy', () => {
    afterEach(() => vi.unstubAllEnvs())

    it('allows only covers from the configured project in the Next optimizer', () => {
        const patterns = courseCoverRemotePatterns(projectUrl)
        expect(hasRemoteMatch([], patterns, new URL(publicCover))).toBe(true)
        for (const source of [
            'https://another-project.supabase.co/storage/v1/object/public/course-media/cover.webp',
            `${projectUrl}/storage/v1/object/public/payment-receipts/private.png`,
            `${projectUrl}/storage/v1/object/sign/payment-receipts/private.png?token=private`,
            `${projectUrl}/storage/v1/object/authenticated/course-media/cover.webp`,
            `${publicCover}?token=private`,
            'http://academy-test.supabase.co/storage/v1/object/public/course-media/cover.webp',
        ]) {
            expect(hasRemoteMatch([], patterns, new URL(source)), source).toBe(false)
            expect(canOptimizeCourseCover(source, projectUrl), source).toBe(false)
        }
        expect(canOptimizeCourseCover(publicCover, projectUrl)).toBe(true)
    })

    it('uses the same academy-specific URL precedence as the Supabase client', () => {
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://old-project.supabase.co')
        vi.stubEnv('NEXT_PUBLIC_ACADEMY_SUPABASE_URL', projectUrl)
        expect(canOptimizeCourseCover(publicCover)).toBe(true)
        expect(canOptimizeCourseCover('https://old-project.supabase.co/storage/v1/object/public/course-media/a.png')).toBe(false)
    })

    it('does not enable a wildcard optimizer when the project URL is absent or invalid', () => {
        for (const base of ['', 'invalid', 'http://localhost:54321', 'https://user:secret@example.com']) {
            expect(courseCoverRemotePatterns(base)).toEqual([])
            expect(canOptimizeCourseCover(publicCover, base)).toBe(false)
        }
    })

    it('serves the confirmed bandwidth-heavy cover from the website while honoring changed upload IDs', () => {
        const source = `${projectUrl}/storage/v1/object/public/course-media/bb89bba3-3170-4f32-baa8-001daa0a5657.png`
        expect(getCourseCoverSource(source, projectUrl)).toBe('/course-covers/ai-content-creator-ba840ecc4f990edc.webp')
        expect(getCourseCoverSource(publicCover, projectUrl)).toBe(publicCover)
        expect(getCourseCoverSource(`${source}?token=private`, projectUrl)).toBe(`${source}?token=private`)
        const unrelatedProject = source.replace('academy-test.supabase.co', 'other.supabase.co')
        expect(getCourseCoverSource(unrelatedProject, projectUrl)).toBe(unrelatedProject)
    })
})
