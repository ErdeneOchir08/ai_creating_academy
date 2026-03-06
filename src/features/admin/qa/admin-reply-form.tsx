'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { adminPostAnswer } from '@/features/admin/qa/qa-admin-actions'
import { Send } from 'lucide-react'

export function AdminReplyForm({
    questionId,
    onReplyPosted
}: {
    questionId: string
    onReplyPosted?: (answer: any) => void
}) {
    const [reply, setReply] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!reply.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            const newAnswer = await adminPostAnswer(questionId, reply)
            setReply('')
            if (onReplyPosted && newAnswer) {
                onReplyPosted(newAnswer)
            }
        } catch (error) {
            console.error(error)
            alert('Failed to post reply')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-3 items-end max-w-4xl mx-auto w-full">
            <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write your reply to the student... (This will instantly mark the thread as resolved)"
                className="min-h-[60px] max-h-[200px] bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500 resize-y"
                disabled={isSubmitting}
            />
            <Button
                type="submit"
                size="icon"
                disabled={!reply.trim() || isSubmitting}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 h-12 w-12 rounded-xl"
            >
                <Send className="h-5 w-5" />
            </Button>
        </form>
    )
}
