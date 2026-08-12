import { getCourseById, getCourseLessons } from '@/features/courses/actions/course-actions'
import { deleteLesson, reorderLesson, getAllAdminCourses } from '@/features/admin/actions/course-actions.admin'
import { CreateLessonDialog } from '@/features/admin/components/create-lesson-dialog'
import { EditLessonDialog } from '@/features/admin/components/edit-lesson-dialog'
import { EditCourseDialog } from '@/features/admin/components/edit-course-dialog'
import { CourseArchiveButton } from '@/features/admin/components/course-archive-button'
import { CourseCategoryAssignment } from '@/features/admin/components/course-category-assignment'
import { CourseBonusAssignment } from '@/features/admin/components/course-bonus-assignment'
import { getAdminCategories, getCourseBonusIds, getCourseCategoryIds } from '@/features/admin/actions/category-actions.admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trash2, PlayCircle, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function AdminCourseDetailsPage({
    params
}: {
    params: Promise<{ courseId: string }>
}) {
    const { courseId } = await params

    const [course, lessons, categories, categoryIds, allCourses, bonusIds] = await Promise.all([
        getCourseById(courseId),
        getCourseLessons(courseId),
        getAdminCategories(),
        getCourseCategoryIds(courseId),
        getAllAdminCourses(),
        getCourseBonusIds(courseId),
    ])

    if (!course) {
        notFound()
    }

    const nextOrderIndex = lessons.length > 0 ? Math.max(...lessons.map((l: { order_index: number }) => l.order_index)) + 1 : 1
    const videoLessonCount = lessons.filter((lesson: { video_url: string | null; provider_video_id: string | null; playback_status: string | null }) => Boolean(lesson.video_url || lesson.provider_video_id) && lesson.playback_status === 'ready').length
    const isReadyForPublication = lessons.length > 0 && videoLessonCount > 0

    return (
        <div className="mx-auto max-w-5xl space-y-8 p-5 sm:p-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800" asChild>
                    <Link href="/admin/courses">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h1 className="mb-1 break-words text-2xl font-bold text-white sm:text-3xl">{course.title}</h1>
                        {course.archived_at ? (
                            <Badge variant="outline" className="border-zinc-700 text-zinc-400">Архив</Badge>
                        ) : course.published ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400">Нийтлэгдсэн</Badge>
                        ) : (
                            <Badge variant="outline" className="text-zinc-500 border-zinc-700">Ноорог</Badge>
                        )}
                    </div>
                    <p className="text-zinc-400">{course.id}</p>
                </div>
                </div>
                <Button asChild variant="outline" className="self-start border-indigo-400/30 bg-zinc-950">
                    <Link href="/admin/programs">Сургалтад холбох<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <CourseArchiveButton courseId={course.id} courseTitle={course.title} archived={Boolean(course.archived_at)} />
            </header>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Left Col: Lessons */}
                <div className="md:col-span-2 space-y-4">
                    <Card className={`border text-white ${isReadyForPublication ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                        <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-semibold">{isReadyForPublication ? 'Нийтлэхэд бэлэн' : 'Нийтлэхэд бэлэн биш'}</p>
                                <p className="text-sm text-zinc-400">{lessons.length} бүлгээс {videoLessonCount} нь видео агуулгатай.</p>
                            </div>
                            {!isReadyForPublication && <p className="text-sm text-amber-200">Нийтлэхийн тулд дор хаяж нэг видео хичээл нэмнэ үү.</p>}
                        </CardContent>
                    </Card>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Контентын бүтэц</h2>
                        <CreateLessonDialog courseId={course.id} nextOrderIndex={nextOrderIndex} />
                    </div>

                    <div className="space-y-3">
                        {lessons.length === 0 ? (
                            <div className="p-12 border border-zinc-800 border-dashed rounded-xl text-center text-zinc-500 bg-zinc-900/20">
                                Одоогоор хичээл нэмэгдээгүй байна. &quot;Хичээл нэмэх&quot; дээр дарж хөтөлбөрөө үүсгэж эхэлнэ үү.
                            </div>
                        ) : (
                            lessons.map((lesson: { id: string; title: string; display_code: string | null; video_url: string | null; video_provider: 'youtube' | 'cloudflare' | null; provider_video_id: string | null; playback_status: string | null; order_index: number; is_preview: boolean }, index: number) => (
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
                                                    {lesson.display_code || lesson.order_index}
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-semibold text-lg">{lesson.title}</p>
                                                        {lesson.is_preview && <Badge className="bg-indigo-500/15 text-indigo-300">Үнэгүй үзэх</Badge>}
                                                        {lesson.video_provider === 'cloudflare' && lesson.playback_status === 'ready' && (
                                                            <Badge className="bg-sky-500/15 text-sky-300">Cloudflare Stream · хамгаалагдсан</Badge>
                                                        )}
                                                        {lesson.video_provider === 'youtube' && lesson.video_url && (
                                                            <Badge variant="outline" className="border-red-500/30 text-red-300">YouTube</Badge>
                                                        )}
                                                    </div>
                                                    {lesson.video_url && (
                                                        <a href={lesson.video_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400">
                                                            <PlayCircle className="h-3 w-3" /> Гадаад холбоос
                                                        </a>
                                                    )}
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
                    <h2 className="text-xl font-bold text-white mb-4">Контентын мэдээлэл</h2>
                    <Card className="bg-zinc-950 border-zinc-800 text-white">
                        <CardHeader className="bg-zinc-900/50 border-b border-zinc-800 pb-4">
                            <CardTitle className="text-lg">Мэдээлэл</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div>
                                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Үнэ</h3>
                                <p className="font-mono text-emerald-400">{course.price_display}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Тайлбар</h3>
                                <p className="text-sm text-zinc-300 line-clamp-4">{course.description}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Зураг</h3>
                                {/* Dynamic storage URL; retain the original asset in the admin preview. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={course.thumbnail_url} alt="Cover" className="w-full h-auto aspect-video object-cover rounded-md border border-zinc-800 mt-2 bg-black" />
                            </div>
                        </CardContent>
                    </Card>
                    <CourseCategoryAssignment courseId={course.id} categories={categories} initialCategoryIds={categoryIds} />
                    <CourseBonusAssignment courseId={course.id} courses={allCourses} initialBonusIds={bonusIds} />
                    <EditCourseDialog course={course} />
                </div>
            </div >
        </div >
    )
}
