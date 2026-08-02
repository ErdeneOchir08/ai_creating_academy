import { Lock, PlayCircle } from 'lucide-react'
import Link from 'next/link'

type Lesson = {
    id: string
    title: string
    order_index: number
    is_preview: boolean
}

export function CourseCurriculumList({ lessons, courseId }: { lessons: Lesson[]; courseId: string }) {
    if (!lessons.length) {
        return (
            <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <p className="text-zinc-400">Хичээлийн агуулгыг шинэчилж байна. Удахгүй дахин шалгана уу.</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {lessons.map((lesson, index) => {
                const item = (
                    <div
                        key={lesson.id}
                        className={`flex items-center justify-between rounded-xl border p-4 ${lesson.is_preview ? 'border-indigo-500/30 bg-indigo-950/20 transition-colors hover:border-indigo-400' : 'border-zinc-800 bg-zinc-900/50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-6 font-mono text-sm text-zinc-500">
                                {String(index + 1).padStart(2, '0')}
                            </div>
                            <div className={`rounded-full p-2 ${lesson.is_preview ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500'}`}>
                                <PlayCircle className="w-5 h-5" />
                            </div>
                            <span className={`font-medium ${lesson.is_preview ? 'text-indigo-100' : 'text-zinc-300'}`}>
                                {lesson.title}
                            </span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${lesson.is_preview ? 'font-semibold text-indigo-300' : 'text-zinc-500'}`}>
                            {lesson.is_preview ? <PlayCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            <span className="hidden sm:inline">{lesson.is_preview ? 'Үнэгүй үзэх' : 'Төлбөрийн дараа'}</span>
                        </div>
                    </div>
                )

                return lesson.is_preview ? (
                    <Link key={lesson.id} href={`/courses/${courseId}?lesson=${lesson.id}`}>
                        {item}
                    </Link>
                ) : item
            })}
        </div>
    )
}
