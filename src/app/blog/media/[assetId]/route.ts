import { blogIdSchema } from '@/features/blog/model'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
}

async function getPreviewAsset(assetId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: null }

    // The table's SELECT policy allows access only to admins.
    return supabase.from('blog_assets')
        .select('kind, name, path')
        .eq('id', assetId)
        .eq('validated', true)
        .maybeSingle()
}

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
    const { assetId } = await params
    if (!blogIdSchema.safeParse(assetId).success) return new Response(null, { status: 404, headers })

    const search = new URL(request.url).searchParams
    try {
        const admin = createAdminClient()
        const preview = search.get('preview') === '1'
        const { data: asset, error: lookupError } = preview
            ? await getPreviewAsset(assetId)
            : await admin.rpc('get_published_blog_asset', { p_asset_id: assetId })
                .maybeSingle<{ kind: string; name: string; path: string }>()
        if (lookupError) throw lookupError
        if (!asset) return new Response(null, { status: 404, headers })

        const expirySeconds = asset.kind === 'pdf' && !preview ? 300 : 60
        const { data, error } = await admin.storage.from('blog-media').createSignedUrl(asset.path, expirySeconds)
        if (error) throw error

        const destination = new URL(data.signedUrl)
        if (asset.kind === 'pdf' && search.get('download') === '1') {
            destination.searchParams.set('download', asset.name)
        }
        return new Response(null, { status: 307, headers: { ...headers, Location: destination.toString() } })
    } catch (error) {
        console.error('Blog media could not be served', error)
        return new Response(null, { status: 503, headers })
    }
}
