'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useLocale } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { createBlogPost } from '@/features/blog/server/blog-admin'
import { getBlogEditorCopy } from './blog-editor-copy'

export function BlogEditorCreateButton() {
    const copy = getBlogEditorCopy(useLocale())
    const router = useRouter()
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')

    async function createPost() {
        if (creating) return
        setCreating(true)
        setError('')
        try {
            const result = await createBlogPost()
            if (result.ok) {
                router.push(`/admin/blog/${result.post.id}`)
                return
            }
            setError(result.error)
        } catch {
            setError(copy.actionError)
        }
        setCreating(false)
    }

    return (
        <div className="space-y-2">
            <Button type="button" onClick={() => void createPost()} disabled={creating} className="bg-indigo-500 text-white hover:bg-indigo-400">
                <Plus aria-hidden="true" />{creating ? copy.creating : copy.newPost}
            </Button>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        </div>
    )
}
