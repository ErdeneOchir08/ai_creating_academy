"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, User, ShieldCheck } from 'lucide-react'
import { postQuestion } from '@/features/qa/actions/qa-actions'

type QAProps = {
    courseId: string;
    lessonId: string;
    initialData: any[];
}

export function QASidebar({ courseId, lessonId, initialData }: QAProps) {
    const [questions, setQuestions] = useState(initialData)
    const [inputValue, setInputValue] = useState('')
    const [isPosting, setIsPosting] = useState(false)
    const [mounted, setMounted] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Update local state if server data changes (e.g. on navigation or revalidation)
    useEffect(() => {
        setQuestions(initialData)
    }, [initialData])

    // Scroll to bottom whenever questions change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [questions])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!inputValue.trim() || isPosting) return

        setIsPosting(true)
        const currentContent = inputValue.trim()

        try {
            // Optimistic UI update
            const tempQuestion = {
                id: 'temp-' + Date.now(),
                content: currentContent,
                created_at: new Date().toISOString(),
                profiles: { display_name: 'You', avatar_url: '' },
                answers: []
            }
            setQuestions(prev => [tempQuestion, ...prev])
            setInputValue('')

            // Construct FormData and post to server action
            const formData = new FormData()
            formData.append('content', currentContent)
            formData.append('courseId', courseId)
            formData.append('lessonId', lessonId)

            await postQuestion(formData)

            // Note: The actual revalidation is handled by the server action `revalidatePath`, 
            // which will cause `initialData` to refresh and flow through the useEffect above.
        } catch (error) {
            console.error(error)
            // Rollback optimistic update
            setQuestions(initialData)
            setInputValue(currentContent)
            alert('Failed to post question. Please try again.')
        } finally {
            setIsPosting(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-white w-full">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                <h2 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-400" />
                    Teacher Q&A
                </h2>
                <p className="text-xs text-zinc-400 mt-1">Ask questions and get help directly from the instructor.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 flex flex-col-reverse">
                <div ref={messagesEndRef} />

                {questions.length === 0 && (
                    <div className="text-center text-zinc-500 py-10 my-auto">
                        <p className="text-sm">No questions asked yet for this lesson.</p>
                        <p className="text-xs mt-2">Be the first to ask!</p>
                    </div>
                )}

                {questions.map((q) => (
                    <div key={q.id} className="space-y-3 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                        {/* Question Bubble */}
                        <div className="flex gap-3">
                            <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold overflow-hidden">
                                {q.profiles?.avatar_url ? (
                                    <img src={q.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-4 w-4" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="font-medium text-sm text-zinc-200 truncate">
                                        {q.profiles?.display_name || 'Student'}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 shrink-0">
                                        {mounted ? new Date(q.created_at).toLocaleDateString() : ''}
                                    </span>
                                </div>
                                <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                    {q.content}
                                </div>
                            </div>
                        </div>

                        {/* Answers (Replies) */}
                        {q.answers && q.answers.length > 0 && (
                            <div className="pl-11 space-y-3 mt-2">
                                {q.answers.map((ans: any) => (
                                    <div key={ans.id} className="flex gap-3">
                                        <div className="h-6 w-6 shrink-0 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                                            <ShieldCheck className="h-3 w-3" />
                                        </div>
                                        <div className="flex-1 min-w-0 bg-indigo-950/20 rounded-md p-2 border border-indigo-500/10">
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className="font-medium text-xs text-indigo-300">
                                                    Instructor
                                                </span>
                                            </div>
                                            <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                                                {ans.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
                <form onSubmit={handleSubmit} className="flex relative">
                    <Textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask the instructor a question..."
                        className="pr-12 resize-none bg-zinc-900 border-zinc-800 focus-visible:ring-indigo-500 rounded-xl min-h-[60px] max-h-[150px]"
                        disabled={isPosting}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={!inputValue.trim() || isPosting}
                        className="absolute bottom-2 right-2 h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
                <div className="text-center mt-2">
                    <span className="text-[10px] text-zinc-500">Press Enter to send, Shift+Enter for new line</span>
                </div>
            </div>
        </div>
    )
}
