'use client'

import { Lock, PlayCircle, Unlock } from 'lucide-react'
import Link from 'next/link'

type Lesson = {
    id: string
    title: string
    order_index: number
}

export function CourseCurriculumList({ lessons, courseId }: { lessons: Lesson[], courseId: string }) {
    if (!lessons.length) {
        return (
            <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <p className="text-zinc-400">Curriculum is being updated. Check back soon!</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {lessons.map((lesson, index) => {
                const isPreview = index === 0;

                const content = (
                    <div
                        key={lesson.id}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-colors group ${isPreview ? 'bg-indigo-900/20 border-indigo-500/30 hover:border-indigo-400 cursor-pointer' : 'bg-zinc-900/50 border-zinc-800'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`font-mono text-sm w-6 ${isPreview ? 'text-indigo-400' : 'text-zinc-500'}`}>
                                {String(index + 1).padStart(2, '0')}
                            </div>
                            <div className={`p-2 rounded-full transition-colors ${isPreview ? 'bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/30' : 'bg-zinc-800 text-zinc-500'}`}>
                                <PlayCircle className="w-5 h-5" />
                            </div>
                            <span className={`font-medium transition-colors ${isPreview ? 'text-indigo-100 group-hover:text-white' : 'text-zinc-300'}`}>
                                {lesson.title}
                            </span>
                        </div>

                        <div className={`flex items-center gap-2 text-sm ${isPreview ? 'text-indigo-400 font-bold' : 'text-zinc-500'}`}>
                            {isPreview ? (
                                <>
                                    <Unlock className="w-4 h-4" />
                                    <span className="hidden sm:inline text-xs uppercase tracking-wider">Preview</span>
                                </>
                            ) : (
                                <>
                                    <Lock className="w-4 h-4" />
                                    <span className="hidden sm:inline">Locked</span>
                                </>
                            )}
                        </div>
                    </div>
                );

                if (isPreview) {
                    return (
                        <Link key={lesson.id} href={`/courses/${courseId}?lesson=${lesson.id}`}>
                            {content}
                        </Link>
                    );
                }

                return content;
            })}
        </div>
    )
}
