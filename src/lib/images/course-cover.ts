import type { RemotePattern } from 'next/dist/shared/lib/image-config'

const courseCoverPathPrefix = '/storage/v1/object/public/course-media/'
const mirroredCourseCoverPath = `${courseCoverPathPrefix}bb89bba3-3170-4f32-baa8-001daa0a5657.png`
const mirroredCourseCoverSource = '/course-covers/ai-content-creator-ba840ecc4f990edc.webp'

function configuredSupabaseUrl() {
    return process.env.NEXT_PUBLIC_ACADEMY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

export function courseCoverRemotePatterns(supabaseUrl = configuredSupabaseUrl()): RemotePattern[] {
    if (!supabaseUrl) return []
    try {
        const url = new URL(supabaseUrl)
        if (url.protocol !== 'https:' || url.port || url.username || url.password) return []
        return [{
            protocol: 'https',
            hostname: url.hostname,
            port: '',
            pathname: `${courseCoverPathPrefix}**`,
            search: '',
        }]
    } catch {
        return []
    }
}

// The optimizer is public and cached. Only public cover images may pass through
// it; signed URLs, receipt buckets, and unrelated origins must never be cached.
export function canOptimizeCourseCover(source: string, supabaseUrl = configuredSupabaseUrl()) {
    const [pattern] = courseCoverRemotePatterns(supabaseUrl)
    if (!pattern) return false
    try {
        const url = new URL(source)
        return url.protocol === 'https:'
            && url.hostname === pattern.hostname
            && url.port === ''
            && url.username === ''
            && url.password === ''
            && url.pathname.startsWith(courseCoverPathPrefix)
            && url.pathname.length > courseCoverPathPrefix.length
            && url.search === ''
            && url.hash === ''
    } catch {
        return false
    }
}

// This already-public cover was identified in the download logs. Its optimized
// immutable copy is served by the website, avoiding Supabase reads entirely.
// A changed upload UUID continues through the normal public-image optimizer.
export function getCourseCoverSource(source: string, supabaseUrl = configuredSupabaseUrl()) {
    return canOptimizeCourseCover(source, supabaseUrl) && new URL(source).pathname === mirroredCourseCoverPath
        ? mirroredCourseCoverSource
        : source
}
