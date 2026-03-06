import { getCourseById, getCourseLessons } from '@/features/courses/actions/course-actions'
import { deleteLesson, reorderLesson } from '@/features/admin/actions/course-actions.admin'
import { CreateLessonDialog } from '@/features/admin/components/create-lesson-dialog'
import { EditLessonDialog } from '@/features/admin/components/edit-lesson-dialog'
import { EditCourseDialog } from '@/features/admin/components/edit-course-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trash2, GripVertical, PlayCircle, ChevronUp, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminCourseDetailsPage({
    params
}: {
    params: { courseId: string }
}) {
    // Wait for params in NextJS 15
    const { courseId } = await Promise.resolve(params);

    const [course, lessons] = await Promise.all([
        getCourseById(courseId),
        getCourseLessons(courseId)
    ])

    if (!course) {
        notFound()
    }

    const nextOrderIndex = lessons.length > 0 ? Math.max(...lessons.map((l: { order_index: number }) => l.order_index)) + 1 : 1

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <header className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="h-10 w-10 border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800" asChild>
                    <Link href="/admin/courses">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-white mb-1">{course.title}</h1>
                        {course.published ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400">Published</Badge>
                        ) : (
                            <Badge variant="outline" className="text-zinc-500 border-zinc-700">Draft</Badge>
                        )}
                    </div>
                    <p className="text-zinc-400">{course.id}</p>
                </div>
            </header>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Left Col: Lessons */}
                <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Course Curriculum</h2>
                        <CreateLessonDialog courseId={course.id} nextOrderIndex={nextOrderIndex} />
                    </div>

                    <div className="space-y-3">
                        {lessons.length === 0 ? (
                            <div className="p-12 border border-zinc-800 border-dashed rounded-xl text-center text-zinc-500 bg-zinc-900/20">
                                No lessons added yet. Click &quot;Add Lesson&quot; to start building the curriculum.
                            </div>
                        ) : (
                            lessons.map((lesson: { id: string; title: string; video_url: string; order_index: number }, index: number) => (
                                <Card key={lesson.id} className="bg-zinc-950 border-zinc-800 text-white overflow-hidden group">
                                    <div className="flex items-center">
                                        <div className="p-2 sm:p-4 flex flex-col justify-center items-center gap-1 border-r border-zinc-800 bg-zinc-900/50 shrink-0 min-w-[3rem]">
                                            <form action={async () => {
                                                'use server';
                                                await reorderLesson(course.id, lesson.id, 'up');
                                            }}>
                                                <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" disabled={index === 0}>
                                                    <ChevronUp className="h-4 w-4" />
                                                </Button>
                                            </form>
                                            <form action={async () => {
                                                'use server';
                                                await reorderLesson(course.id, lesson.id, 'down');
                                            }}>
                                                <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" disabled={index === lessons.length - 1}>
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                            </form>
                                        </div>

                                        <div className="p-4 flex-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                                                    {lesson.order_index}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-lg">{lesson.title}</p>
                                                    <a href={lesson.video_url} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:text-indigo-400 flex items-center gap-1 mt-1">
                                                        <PlayCircle className="h-3 w-3" /> External Link
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <EditLessonDialog lesson={lesson} courseId={course.id} />
                                                <form action={async () => {
                                                    'use server';
                                                    await deleteLesson(lesson.id, course.id);
                                                }}>
                                                    <Button type="submit" variant="ghost" size="icon" className="text-zinc-500 hover:text-red-400 hover:bg-red-950/50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Col: Details Summary */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white mb-4">Course Info</h2>
                    <Card className="bg-zinc-950 border-zinc-800 text-white">
                        <CardHeader className="bg-zinc-900/50 border-b border-zinc-800 pb-4">
                            <CardTitle className="text-lg">Metadata</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div>
                                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Price String</h3>
                                <p className="font-mono text-emerald-400">{course.price_display}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Description</h3>
                                <p className="text-sm text-zinc-300 line-clamp-4">{course.description}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Thumbnail</h3>
                                <img src={course.thumbnail_url} alt="Cover" className="w-full h-auto aspect-video object-cover rounded-md border border-zinc-800 mt-2 bg-black" />
                            </div>
                        </CardContent>
                    </Card>
                    <EditCourseDialog course={course} />
                </div>
            </div >
        </div >
    )
}
