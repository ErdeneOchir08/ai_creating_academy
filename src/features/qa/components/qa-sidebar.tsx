'use client'

import { useState, useTransition } from 'react'
import { MessageSquareText, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { postQuestion } from '@/features/qa/actions/qa-actions'

type Thread = { id: string; content: string; is_answered: boolean; created_at: string; profiles: { display_name: string | null } | { display_name: string | null }[] | null; answers: { id: string; content: string; created_at: string; profiles: { display_name: string | null } | { display_name: string | null }[] | null }[] }

export function QASidebar({ courseId, lessonId, initialData }: { courseId: string; lessonId: string; initialData: Thread[] }) {
    const router = useRouter()
    const [content, setContent] = useState('')
    const [message, setMessage] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const nameOf = (profile: Thread['profiles']) => Array.isArray(profile) ? profile[0]?.display_name : profile?.display_name

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!content.trim() || pending) return
        const data = new FormData()
        data.set('course_id', courseId); data.set('lesson_id', lessonId); data.set('content', content)
        startTransition(async () => {
            const result = await postQuestion(data)
            if (result.error) setMessage(result.error)
            else { setContent(''); setMessage('Асуулт илгээгдлээ.'); router.refresh() }
        })
    }

    return <div className="flex h-full w-full flex-col bg-zinc-950 p-5 text-white">
        <div className="mb-4 flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-indigo-400" /><h2 className="font-semibold">Асуулт, хариулт</h2></div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {initialData.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">Энэ хичээл дээр асуулт алга. Эхний асуултаа асуугаарай.</p> : initialData.map(question => <article key={question.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-sm text-zinc-200">{question.content}</p><p className="mt-2 text-xs text-zinc-500">{nameOf(question.profiles) || 'Суралцагч'}</p>
                {question.answers.map(answer => <div key={answer.id} className="mt-3 border-l-2 border-indigo-500 pl-3 text-sm text-zinc-300"><p>{answer.content}</p><p className="mt-1 text-xs text-zinc-500">{nameOf(answer.profiles) || 'Mind Academy'}</p></div>)}
            </article>)}
        </div>
        <form onSubmit={submit} className="mt-4 border-t border-zinc-800 pt-4"><textarea value={content} onChange={event => setContent(event.target.value)} maxLength={2000} placeholder="Асуултаа бичнэ үү..." className="min-h-24 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm outline-none focus:border-indigo-500" disabled={pending} />
            {message && <p className="mt-2 text-xs text-zinc-400">{message}</p>}<button type="submit" disabled={pending || !content.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"><Send className="h-4 w-4" />{pending ? 'Илгээж байна...' : 'Асуулт илгээх'}</button></form>
    </div>
}
