import { QASidebar } from '@/features/qa/components/qa-sidebar'
import { getCourseById, getCourseLessons } from '@/features/courses/actions/course-actions'
import { getLessonQA } from '@/features/qa/actions/qa-actions'
import { getUserProgress } from '@/features/courses/actions/progress-actions'
import { getUserProgressDashboard } from '@/features/dashboard/actions/progress-dashboard-actions'
import { checkPaymentStatus } from '@/features/payments/actions/payment-actions'
import { PaymentModal } from '@/features/payments/components/payment-modal'
import { ProgressToggle } from '@/features/courses/components/progress-toggle'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Video, PlayCircle, CheckCircle2, Menu, MessageSquare } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'

function getYouTubeEmbedUrl(url: string) {
    if (!url) return '';
    try {
        let videoId = '';
        if (url.includes('youtube.com/watch')) {
            const urlObj = new URL(url);
            videoId = urlObj.searchParams.get('v') || '';
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/embed/')) {
            return url;
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    } catch (e) {
        return url;
    }
}

export default async function CoursePlayerPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ lesson?: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { id } = await props.params
    const searchParams = await props.searchParams
    const course = await getCourseById(id)

    if (!course) {
        notFound()
    }

    const paymentStatus = await checkPaymentStatus(id)
    const isEnrolled = paymentStatus === 'enrolled'
    const isPending = paymentStatus === 'pending'

    const [lessons, progress] = await Promise.all([
        getCourseLessons(id),
        getUserProgress(id)
    ])

    // Map completed lesson IDs for easy lookup
    const completedLessonIds = new Set(progress.filter((p: any) => p.completed).map((p: any) => p.lesson_id))

    const currentLessonId = searchParams.lesson || (lessons.length > 0 ? lessons[0].id : null)
    const currentLesson = lessons.find((l: any) => l.id === currentLessonId) || lessons[0]

    // Fetch Q&A threads for current lesson
    const qaThreads = currentLessonId ? await getLessonQA(currentLessonId) : []

    const currentLessonIndex = lessons.findIndex((l: any) => l.id === currentLesson?.id)
    const nextLesson = currentLessonIndex !== -1 && currentLessonIndex < lessons.length - 1 ? lessons[currentLessonIndex + 1] : null
    const isCurrentLessonCompleted = currentLesson ? completedLessonIds.has(currentLesson.id) : false

    const videoUrl = currentLesson?.video_url ? getYouTubeEmbedUrl(currentLesson.video_url) : ''

    // Check Free Preview Logic
    const isFirstLesson = lessons.length > 0 && currentLessonId === lessons[0].id
    const hasVideoAccess = isEnrolled || isFirstLesson

    // Fetch active XP discount
    const { data: activeDiscountData } = await supabase
        .from('xp_redemptions')
        .select('id, discount_percentage')
        .eq('user_id', user.id)
        .eq('is_used', false)
        .order('discount_percentage', { ascending: false })
        .limit(1)
        .single()

    const activeDiscount = activeDiscountData?.discount_percentage || 0
    const activeDiscountId = activeDiscountData?.id || null

    // Get User Total XP to allow them to buy a new discount at checkout
    let totalXP = 0
    if (user) {
        const progressDashboard = await getUserProgressDashboard()
        totalXP = progressDashboard?.gamification.totalXP || 0
    }

    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#09090b] text-white relative">
            {/* Ambient Ambient Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden blur-[100px] opacity-20 pointer-events-none select-none z-0">
                <div className="absolute top-0 left-1/4 w-1/3 h-1/3 rounded-full bg-indigo-600/30 mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
                <div className="absolute bottom-0 right-1/4 w-1/3 h-1/3 rounded-full bg-pink-600/20 mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
            </div>

            {/* Desktop Left Sidebar (Lessons) */}
            <div className="w-[300px] shrink-0 border-r border-white/5 flex-col hidden lg:flex bg-zinc-950/50 backdrop-blur-2xl relative z-10 shadow-2xl">
                <div className="p-4 border-b border-white/5 flex items-center gap-2 shrink-0">
                    <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h2 className="font-bold text-sm truncate bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{course.title}</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Course Content</h3>
                    {lessons.length > 0 ? (
                        lessons.map((lesson: any, index: number) => {
                            const isActive = lesson.id === currentLesson?.id
                            const isCompleted = completedLessonIds.has(lesson.id)
                            return (
                                <Link key={lesson.id} href={`/courses/${course.id}?lesson=${lesson.id}`}>
                                    <div className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-300 cursor-pointer ${isActive ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 border border-indigo-500/30 shadow-inner' : 'hover:bg-white/5 border border-transparent'}`}>
                                        {isCompleted ? (
                                            <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]`} />
                                        ) : (
                                            <PlayCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                                        )}
                                        <div>
                                            <p className={`text-sm ${isActive ? 'text-indigo-200 font-bold' : isCompleted ? 'text-emerald-300 font-medium' : 'text-zinc-300'}`}>
                                                {index + 1}. {lesson.title}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })
                    ) : (
                        <p className="text-sm text-zinc-500 text-center py-4">No lessons added yet.</p>
                    )}
                </div>
            </div>

            {/* Main Content Area (Video Player) */}
            <div className="flex-1 overflow-y-auto w-full relative z-10">
                {/* Mobile Header (since sidebars are hidden) */}
                <div className="lg:hidden p-4 flex items-center justify-between border-b border-white/5 shrink-0 bg-zinc-950/80 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 lg:hidden">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-[300px] border-zinc-800 bg-zinc-950 flex flex-col">
                                <VisuallyHidden.Root>
                                    <SheetTitle>Course Lessons</SheetTitle>
                                    <SheetDescription>List of lessons available in this course.</SheetDescription>
                                </VisuallyHidden.Root>
                                <div className="p-4 border-b border-zinc-800 flex items-center gap-2 shrink-0">
                                    <h2 className="font-bold text-sm truncate">{course.title}</h2>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Course Content</h3>
                                    {lessons.length > 0 ? (
                                        lessons.map((lesson: any, index: number) => {
                                            const isActive = lesson.id === currentLesson?.id
                                            const isCompleted = completedLessonIds.has(lesson.id)
                                            return (
                                                <Link key={lesson.id} href={`/courses/${course.id}?lesson=${lesson.id}`}>
                                                    <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${isActive ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-zinc-900 border border-transparent'}`}>
                                                        {isCompleted ? (
                                                            <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 text-emerald-500`} />
                                                        ) : (
                                                            <PlayCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                                                        )}
                                                        <div>
                                                            <p className={`text-sm ${isActive ? 'text-indigo-200 font-medium' : isCompleted ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                                                {index + 1}. {lesson.title}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Link>
                                            )
                                        })
                                    ) : (
                                        <p className="text-sm text-zinc-500 text-center py-4">No lessons added yet.</p>
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <Link href="/dashboard" className="text-zinc-400 hover:text-white flex items-center text-sm transition-colors text-center font-medium truncate px-4">
                        Exit
                    </Link>

                    {isEnrolled && currentLessonId && (
                        <div className="flex items-center gap-2">
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 xl:hidden">
                                        <MessageSquare className="h-5 w-5" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="p-0 w-[85vw] sm:w-[400px] border-zinc-800 bg-zinc-950 flex flex-col">
                                    <VisuallyHidden.Root>
                                        <SheetTitle>Lesson Q&A</SheetTitle>
                                        <SheetDescription>Ask questions and see replies for this lesson.</SheetDescription>
                                    </VisuallyHidden.Root>
                                    <QASidebar
                                        courseId={course.id}
                                        lessonId={currentLessonId}
                                        initialData={qaThreads}
                                    />
                                </SheetContent>
                            </Sheet>
                        </div>
                    )}
                </div>

                <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8 lg:py-12">
                    {/* TV Glowing Video Container */}
                    <div className="w-full aspect-video rounded-[2rem] overflow-hidden bg-black border-[4px] border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.2)] relative mb-8 transition-all duration-700 hover:shadow-[0_0_80px_rgba(99,102,241,0.3)]">
                        {hasVideoAccess ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                                {isFirstLesson && !isEnrolled && (
                                    <div className="absolute top-4 left-4 z-50 bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-indigo-400 flex items-center gap-1">
                                        <PlayCircle className="h-3 w-3" /> FREE PREVIEW
                                    </div>
                                )}
                                {videoUrl ? (
                                    <iframe
                                        src={videoUrl}
                                        className="w-full h-full border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                ) : (
                                    <div className="text-center">
                                        <Video className="h-20 w-20 text-indigo-500/50 mb-4 mx-auto drop-shadow-lg" />
                                        <p className="text-2xl font-bold text-zinc-300">No Video Available</p>
                                        <p className="text-zinc-500 text-base mt-2">This lesson does not have a video attached yet. Check back soon!</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-950/90 backdrop-blur-md z-20">
                                <h2 className="text-3xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Enroll to Unlock</h2>
                                <p className="text-zinc-400 mb-8 max-w-md text-lg">You need to purchase this course to access the video content and the Q&A section.</p>
                                {isPending ? (
                                    <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-6 py-3 text-base font-bold text-yellow-500 ring-1 ring-inset ring-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                                        Payment Review Pending
                                    </span>
                                ) : (
                                    <div className="w-72 mx-auto scale-110">
                                        <PaymentModal
                                            courseId={course.id}
                                            coursePrice={course.price_display}
                                            discountPercentage={activeDiscount}
                                            discountId={activeDiscountId}
                                            totalXP={totalXP}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex-1">
                            <h1 className="text-4xl font-black mb-4 tracking-tight text-white drop-shadow-sm">{currentLesson?.title || course.title}</h1>
                            <p className="text-zinc-300 text-lg leading-relaxed max-w-3xl">{course.description || "In this lesson, you will learn the core concepts..."}</p>
                        </div>

                        {!isEnrolled && (
                            <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/30 text-center shadow-xl shadow-indigo-500/10">
                                    <h3 className="text-lg font-bold text-white mb-2">Unlock the Full Course</h3>
                                    <p className="text-sm text-indigo-200/80 mb-5 leading-relaxed">Enjoying the free preview? Get full access to all lessons and the Q&A community.</p>
                                    <PaymentModal
                                        courseId={course.id}
                                        coursePrice={course.price_display}
                                        discountPercentage={activeDiscount}
                                        discountId={activeDiscountId}
                                        totalXP={totalXP}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Progress and "Next" Flow Navigation */}
                        {isEnrolled && currentLesson && (
                            <div className="w-full md:w-72 shrink-0 flex flex-col gap-4">
                                <ProgressToggle
                                    lessonId={currentLesson.id}
                                    courseId={course.id}
                                    isCompleted={completedLessonIds.has(currentLesson.id)}
                                />

                                {/* Dynamic Next Lesson Button */}
                                {isCurrentLessonCompleted && nextLesson && (
                                    <Link href={`/courses/${course.id}?lesson=${nextLesson.id}`} className="w-full block">
                                        <Button className="w-full h-14 text-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/20 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-indigo-500/40 border border-white/10 active:scale-95 group">
                                            Next Lesson
                                            <span className="ml-2 group-hover:translate-x-1 transition-transform duration-300 inline-block">➡️</span>
                                        </Button>
                                    </Link>
                                )}

                                {isCurrentLessonCompleted && !nextLesson && (
                                    <div className="w-full p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-center text-emerald-300 font-bold shadow-lg shadow-emerald-500/5">
                                        🎉 Course Completed!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Desktop Sidebar Area (Q&A) */}
            <div className="hidden xl:block w-[400px] shrink-0 border-l border-white/5 h-full relative z-10 bg-zinc-950/50 backdrop-blur-2xl shadow-2xl">
                {!isEnrolled ? (
                    <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                        <p className="text-zinc-400 font-medium">Enroll in the course to ask the Instructor questions.</p>
                    </div>
                ) : (
                    currentLessonId && (
                        <QASidebar
                            courseId={course.id}
                            lessonId={currentLessonId}
                            initialData={qaThreads}
                        />
                    )
                )}
            </div>
        </div>
    )
}
