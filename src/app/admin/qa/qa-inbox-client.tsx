'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, User, BookOpen, Clock, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { AdminReplyForm } from '@/features/admin/qa/admin-reply-form'
import { adminDeleteQuestion } from '@/features/admin/qa/qa-admin-actions'
import Link from 'next/link'

export function QAInboxClient({ initialQuestions }: { initialQuestions: any[] }) {
    const [questions, setQuestions] = useState(initialQuestions)
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
        initialQuestions.length > 0 ? initialQuestions[0].id : null
    )
    const [filter, setFilter] = useState<'all' | 'unread' | 'resolved'>('all')
    const [isDeleting, setIsDeleting] = useState(false)

    const unansweredCount = questions.filter(q => !q.is_answered).length

    const filteredQuestions = questions.filter(q => {
        if (filter === 'unread') return !q.is_answered
        if (filter === 'resolved') return q.is_answered
        return true
    })

    const selectedQuestion = questions.find(q => q.id === selectedQuestionId)

    // Callback when a teacher replies so we can update the UI instantly
    const handleReplyPosted = (questionId: string, newAnswer: any) => {
        setQuestions(prev => prev.map(q => {
            if (q.id === questionId) {
                return {
                    ...q,
                    is_answered: true,
                    answers: [...(q.answers || []), newAnswer]
                }
            }
            return q
        }))
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to permanently delete this thread? This action cannot be undone.')) return

        setIsDeleting(true)
        try {
            await adminDeleteQuestion(id)
            setQuestions(prev => prev.filter(q => q.id !== id))
            if (selectedQuestionId === id) {
                setSelectedQuestionId(null)
            }
        } catch (error) {
            console.error('Failed to delete question:', error)
            alert('Failed to delete the thread. Please try again.')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#09090b]">

            {/* LEFT PANE: Thread List */}
            <div className="w-full md:w-80 lg:w-[400px] border-r border-zinc-800 flex flex-col h-full bg-zinc-950/50 shrink-0">
                <div className="p-4 border-b border-zinc-800 shrink-0 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-white text-lg flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-indigo-400" />
                            Inbox
                        </h2>
                    </div>
                    {unansweredCount > 0 && (
                        <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">
                            {unansweredCount} New
                        </Badge>
                    )}
                </div>

                <div className="flex bg-zinc-950 p-2 border-b border-zinc-800 gap-1 shrink-0">
                    <button
                        onClick={() => setFilter('all')}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${filter === 'unread' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
                    >
                        Unread
                    </button>
                    <button
                        onClick={() => setFilter('resolved')}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${filter === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
                    >
                        Resolved
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto w-full">
                    {filteredQuestions.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">Inbox Zero. Great job!</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {filteredQuestions.map((q) => {
                                const isSelected = q.id === selectedQuestionId;
                                const studentName = Array.isArray(q.profiles) ? (q.profiles[0] as any)?.display_name : (q.profiles as any)?.display_name || 'Student'
                                const courseName = Array.isArray(q.courses) ? (q.courses[0] as any)?.title : (q.courses as any)?.title || 'Course'
                                const isUnread = !q.is_answered;

                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => setSelectedQuestionId(q.id)}
                                        className={`w-full text-left p-4 border-b border-zinc-800/50 transition-all ${isSelected
                                            ? 'bg-zinc-800/80 border-l-2 border-l-white'
                                            : isUnread
                                                ? 'bg-indigo-500/5 hover:bg-indigo-500/10 border-l-2 border-l-transparent'
                                                : 'hover:bg-zinc-900/50 border-l-2 border-l-transparent'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1 gap-2">
                                            <span className={`text-sm tracking-tight truncate pr-2 ${isUnread ? 'font-bold text-indigo-100' : 'font-semibold text-zinc-300'}`}>
                                                {studentName}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 whitespace-nowrap shrink-0 mt-0.5" suppressHydrationWarning>
                                                {new Date(q.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 mb-2 overflow-hidden">
                                            <BookOpen className="h-3 w-3 text-indigo-400 shrink-0" />
                                            <span className="text-[11px] font-medium text-zinc-400 truncate">
                                                {courseName}
                                            </span>
                                        </div>

                                        <p className="text-xs text-zinc-400 line-clamp-2">
                                            <span className={!q.is_answered ? 'font-medium pl-2 relative text-zinc-300' : ''}>
                                                {!q.is_answered && (
                                                    <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                )}
                                                {q.content}
                                            </span>
                                        </p>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANE: Active Chat */}
            <div className="flex-1 flex flex-col h-full bg-zinc-950 relative overflow-hidden hidden md:flex">
                {selectedQuestion ? (
                    <>
                        <div className="flex-1 overflow-y-auto w-full">
                            {/* Context Header */}
                            <div className="p-6 border-b border-zinc-800 bg-zinc-900/30 sticky top-0 z-10 backdrop-blur-md">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-2">
                                            Thread with {Array.isArray(selectedQuestion.profiles) ? (selectedQuestion.profiles[0] as any)?.display_name : (selectedQuestion.profiles as any)?.display_name || 'Student'}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                                            <div className="flex items-center gap-1.5">
                                                <BookOpen className="h-4 w-4 text-indigo-400" />
                                                <span className="font-medium text-zinc-300">{Array.isArray(selectedQuestion.courses) ? (selectedQuestion.courses[0] as any)?.title : (selectedQuestion.courses as any)?.title || 'Course'}</span>
                                            </div>
                                            {selectedQuestion.lessons && (
                                                <>
                                                    <span className="text-zinc-600">•</span>
                                                    <span className="truncate">
                                                        Lesson: {Array.isArray(selectedQuestion.lessons) ? (selectedQuestion.lessons[0] as any)?.title : (selectedQuestion.lessons as any).title}
                                                    </span>
                                                    <span className="text-zinc-600">•</span>
                                                    <Link
                                                        href={`/courses/${selectedQuestion.course_id}?lesson=${selectedQuestion.lesson_id}`}
                                                        target="_blank"
                                                        className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                                                    >
                                                        View Lesson Context
                                                    </Link>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                                        <Badge variant="outline" className={selectedQuestion.is_answered ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" : "border-indigo-500/30 text-indigo-400 bg-indigo-500/5"}>
                                            {selectedQuestion.is_answered ? 'Resolved' : 'Needs Reply'}
                                        </Badge>
                                        <button
                                            onClick={() => handleDelete(selectedQuestion.id)}
                                            disabled={isDeleting}
                                            className="text-zinc-500 hover:text-red-400 hover:bg-red-400/10 p-2 rounded-md transition-colors disabled:opacity-50"
                                            title="Delete Thread"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Chat History */}
                            <div className="p-6 space-y-6">
                                {/* Student Original Message */}
                                <div className="flex gap-4 max-w-3xl">
                                    <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
                                        <User className="h-5 w-5 text-zinc-400" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-zinc-200">
                                                {Array.isArray(selectedQuestion.profiles) ? (selectedQuestion.profiles[0] as any)?.display_name : (selectedQuestion.profiles as any)?.display_name || 'Student'}
                                            </span>
                                            <span className="text-xs text-zinc-500" suppressHydrationWarning>
                                                {new Date(selectedQuestion.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="bg-zinc-800/50 p-4 rounded-2xl rounded-tl-sm text-zinc-300 text-sm whitespace-pre-wrap border border-zinc-700/50 leading-relaxed shadow-sm">
                                            {selectedQuestion.content}
                                        </div>
                                    </div>
                                </div>

                                {/* Teacher Replies */}
                                {selectedQuestion.answers && selectedQuestion.answers.length > 0 && selectedQuestion.answers.map((ans: any) => (
                                    <div key={ans.id} className="flex gap-4 max-w-3xl ml-auto flex-row-reverse">
                                        <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
                                            <span className="text-indigo-400 font-bold text-sm">A</span>
                                        </div>
                                        <div className="flex-1 space-y-1 flex flex-col items-end">
                                            <div className="flex items-center gap-2 flex-row-reverse">
                                                <span className="font-semibold text-indigo-300">
                                                    You (Admin)
                                                </span>
                                                <span className="text-xs text-indigo-500/50" suppressHydrationWarning>
                                                    {new Date(ans.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-indigo-600 text-white p-4 rounded-2xl rounded-tr-sm text-sm whitespace-pre-wrap shadow-md leading-relaxed text-left">
                                                {ans.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Reply Form Footer */}
                        <div className="p-4 bg-zinc-950 border-t border-zinc-800 shrink-0 w-full z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                            <AdminReplyForm
                                questionId={selectedQuestion.id}
                                onReplyPosted={(ans) => handleReplyPosted(selectedQuestion.id, ans)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                        <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium text-zinc-400">Select a thread</p>
                        <p className="text-sm">Choose a conversation from the left to view and reply.</p>
                    </div>
                )}
            </div>

            {/* Mobile Empty State */}
            <div className="md:hidden flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center bg-zinc-950">
                <AlertCircle className="h-12 w-12 mb-4 opacity-20 mx-auto" />
                <p className="text-zinc-400">Please use a tablet or desktop computer to view and reply to the Q&A Inbox.</p>
            </div>
        </div>
    )
}
