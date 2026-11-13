import type { Viewport } from 'next'
import { notFound } from 'next/navigation'
import { BlogEditor } from '@/features/blog/components/blog-editor'
import { blogIdSchema } from '@/features/blog/model'
import { getAdminBlogPost } from '@/features/blog/server/blog-admin'

export const viewport: Viewport = { interactiveWidget: 'resizes-content' }

export default async function EditBlogPostPage({ params }: { params: Promise<{ postId: string }> }) {
    const { postId } = await params
    if (!blogIdSchema.safeParse(postId).success) notFound()

    const post = await getAdminBlogPost(postId)
    if (!post) notFound()

    return <BlogEditor key={post.id} initialPost={post} />
}
