import { QASidebar } from '@/features/qa/components/qa-sidebar'
import { getCourseById, getCourseLessons } from '@/features/courses/actions/course-actions'
import { getLessonQA } from '@/features/qa/actions/qa-actions'
import { getUserProgress } from '@/features/courses/actions/progress-actions'
import { checkPaymentStatus, getRejectedPaymentReason } from '@/features/payments/actions/payment-actions'
import { PaymentModal } from '@/features/payments/components/payment-modal'
import { ProgressToggle } from '@/features/courses/components/progress-toggle'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Video, PlayCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPaymentConfiguration } from '@/features/admin/actions/settings-actions.admin'
import { getCloudflareStreamPlaybackUrl } from '@/lib/cloudflare-stream/playback'
import { getPublicCourseOfferingCheckout } from '@/features/courses/actions/public-course-offering-actions'
import { CourseOfferingOptions } from '@/features/courses/components/course-offering-options'

function getYouTubeEmbedUrl(url: string) {
    if (!url) return ''

    try {
        const parsed = new URL(url)
        const hostname = parsed.hostname.toLowerCase()
        const allowedHosts = new Set([
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'youtu.be',
            'www.youtu.be',
            'youtube-nocookie.com',
            'www.youtube-nocookie.com',
        ])

        if (parsed.protocol !== 'https:' || !allowedHosts.has(hostname)) return ''

        let videoId = ''
        if (hostname.endsWith('youtu.be')) {
            videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? ''
        } else if (parsed.pathname === '/watch') {
            videoId = parsed.searchParams.get('v') ?? ''
        } else if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/shorts/')) {
            videoId = parsed.pathname.split('/').filter(Boolean)[1] ?? ''
        }

        return /^[A-Za-z0-9_-]{11}$/.test(videoId)
            ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
            : ''
    } catch {
        return ''
    }
}

export default async function CoursePlayerPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ lesson?: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { id } = await props.params
    const searchParams = await props.searchParams
    const course = await getCourseById(id)

    if (!course) {
        notFound()
    }

    const [paymentStatus, offeringCheckout] = await Promise.all([
        checkPaymentStatus(id),
        getPublicCourseOfferingCheckout(id),
    ])
    const rejectionReason = paymentStatus === 'rejected' ? await getRejectedPaymentReason(id) : null
    const isEnrolled = paymentStatus === 'enrolled'
    const isPending = paymentStatus === 'pending'

    const [lessons, progress] = await Promise.all([
        getCourseLessons(id),
        getUserProgress(id)
    ])

    // Map completed lesson IDs for easy lookup
    const completedLessonIds = new Set(progress.filter((item) => item.completed).map((item) => item.lesson_id))

    const requestedLessonId = searchParams.lesson
    const currentLesson = lessons.find((lesson) => lesson.id === requestedLessonId) || lessons[0]
    const currentLessonId = currentLesson?.id ?? null

    // Fetch Q&A threads for current lesson
    const qaThreads = currentLessonId && isEnrolled ? await getLessonQA(currentLessonId) : []

    const currentLessonIndex = lessons.findIndex((lesson) => lesson.id === currentLesson?.id)
    const nextLesson = currentLessonIndex !== -1 && currentLessonIndex < lessons.length - 1 ? lessons[currentLessonIndex + 1] : null
    const isCurrentLessonCompleted = currentLesson ? completedLessonIds.has(currentLesson.id) : false

    const hasVideoAccess = isEnrolled || currentLesson?.is_preview === true
    const videoUrl = currentLesson?.video_provider === 'youtube' && currentLesson.video_url
        ? getYouTubeEmbedUrl(currentLesson.video_url)
        : ''
    const cloudflareVideoUrl = hasVideoAccess
        && currentLesson?.video_provider === 'cloudflare'
        && currentLesson.provider_video_id
        && currentLesson.playback_status === 'ready'
        ? await getCloudflareStreamPlaybackUrl(currentLesson.provider_video_id)
        : ''

    const paymentConfiguration = offeringCheckout.usesOfferingCheckout
        ? null
        : await getPaymentConfiguration()

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
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Хичээлийн агуулга</h3>
                    {lessons.length > 0 ? (
                        lessons.map((lesson, index) => {
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
                        <p className="text-sm text-zinc-500 text-center py-4">Одоогоор хичээл нэмэгдээгүй байна.</p>
                    )}
                </div>
            </div>

            {/* Main Content Area (Video Player) */}
            <div className="flex-1 overflow-y-auto w-full relative z-10">
                {/* Mobile Header (Clean Back Button) */}
                <div className="lg:hidden p-4 flex items-center gap-3 border-b border-white/5 shrink-0 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
                    <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h2 className="font-bold text-sm truncate text-zinc-200">{course.title}</h2>
                </div>

                <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8 lg:py-12">
                    {/* TV Glowing Video Container */}
                    <div className="w-full aspect-video rounded-[2rem] overflow-hidden bg-black border-[4px] border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.2)] relative mb-8 transition-all duration-700 hover:shadow-[0_0_80px_rgba(99,102,241,0.3)]">
                        {hasVideoAccess ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                                {videoUrl || cloudflareVideoUrl ? (
                                    <iframe
                                        src={cloudflareVideoUrl || videoUrl}
                                        className="w-full h-full border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                ) : (
                                    <div className="text-center">
                                        <Video className="h-20 w-20 text-indigo-500/50 mb-4 mx-auto drop-shadow-lg" />
                                        <p className="text-2xl font-bold text-zinc-300">Видео байхгүй байна</p>
                                        <p className="text-zinc-500 text-base mt-2">Энэ хичээлд одоогоор видео ороогүй байна. Дараа дахин шалгана уу!</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-zinc-950/90 backdrop-blur-md z-20">
                                <h2 className="text-3xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                                    {offeringCheckout.usesOfferingCheckout ? 'Нээлттэй элсэлтээс сонгох' : 'Үзэхийн тулд элсэх'}
                                </h2>
                                <p className="text-zinc-400 mb-8 max-w-md text-lg">
                                    {offeringCheckout.usesOfferingCheckout
                                        ? 'Танд тохирох сургалтын хэлбэр, хуваарьтай элсэлтийг сонгоно уу.'
                                        : 'Видео болон асуулт хариултын хэсэгт хандахын тулд энэ хичээлийг худалдан авах шаардлагатай.'}
                                </p>
                                {offeringCheckout.usesOfferingCheckout ? (
                                    <div className="max-h-[70%] w-full max-w-xl overflow-y-auto px-1">
                                        <CourseOfferingOptions
                                            offerings={offeringCheckout.offerings}
                                            lookupFailed={offeringCheckout.lookupFailed}
                                            compact
                                        />
                                    </div>
                                ) : isPending ? (
                                    <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-6 py-3 text-base font-bold text-yellow-500 ring-1 ring-inset ring-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                                        Төлбөр хүлээгдэх төлөвтэй байна
                                    </span>
                                ) : user && paymentConfiguration ? (
                                    <div className="w-72 mx-auto scale-110">
                                        <PaymentModal
                                            courseId={course.id}
                                            coursePrice={course.price_display}
                                            paymentInstructions={paymentConfiguration.instructions}
                                            isTestMode={paymentConfiguration.isTestMode}
                                            rejectionReason={rejectionReason}
                                        />
                                    </div>
                                ) : (
                                    <Link href={`/course/${course.id}`} className="inline-flex">
                                        <Button className="h-12 bg-indigo-600 px-6 font-bold text-white hover:bg-indigo-700">Хичээлд бүртгүүлэх</Button>
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex-1">
                            <h1 className="text-4xl font-black mb-4 tracking-tight text-white drop-shadow-sm">{currentLesson?.title || course.title}</h1>
                            <p className="text-zinc-300 text-lg leading-relaxed max-w-3xl">{course.description || "Энэ хичээлээр та үндсэн ойлголтуудыг сурах болно..."}</p>
                        </div>

                        {!isEnrolled && (
                            <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/30 text-center shadow-xl shadow-indigo-500/10">
                                    <h3 className="text-lg font-bold text-white mb-2">
                                        {offeringCheckout.usesOfferingCheckout ? 'Нээлттэй элсэлтээс сонгох' : 'Бүтэн хичээлийг нээх'}
                                    </h3>
                                    <p className="text-sm text-indigo-200/80 mb-5 leading-relaxed">
                                        {offeringCheckout.usesOfferingCheckout
                                            ? 'Танд тохирох сургалтын хэлбэр, хуваарьтай элсэлтийг сонгоно уу.'
                                            : 'Үнэгүй хичээл таалагдаж байна уу? Бүх хичээл болон нийгэмлэгт хандах эрхээ аваарай.'}
                                    </p>
                                    {offeringCheckout.usesOfferingCheckout ? (
                                        <CourseOfferingOptions
                                            offerings={offeringCheckout.offerings}
                                            lookupFailed={offeringCheckout.lookupFailed}
                                            compact
                                        />
                                    ) : user && paymentConfiguration ? (
                                        <PaymentModal
                                            courseId={course.id}
                                            coursePrice={course.price_display}
                                            paymentInstructions={paymentConfiguration.instructions}
                                            isTestMode={paymentConfiguration.isTestMode}
                                            rejectionReason={rejectionReason}
                                        />
                                    ) : (
                                        <Link href={`/course/${course.id}`} className="block">
                                            <Button className="h-12 w-full bg-indigo-600 font-bold text-white hover:bg-indigo-700">Хичээлд бүртгүүлэх</Button>
                                        </Link>
                                    )}
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
                                            Дараагийн хичээл
                                            <span className="ml-2 group-hover:translate-x-1 transition-transform duration-300 inline-block">➡️</span>
                                        </Button>
                                    </Link>
                                )}

                                {isCurrentLessonCompleted && !nextLesson && (
                                    <div className="w-full p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-center text-emerald-300 font-bold shadow-lg shadow-emerald-500/5">
                                        🎉 Хичээл дууслаа!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mobile / Tablet Lessons List Structure */}
                    <div className="lg:hidden mt-8 pt-8 border-t border-white/5">
                        <h3 className="text-xl font-bold mb-4 text-white">Хичээлүүд</h3>
                        <div className="flex flex-col gap-2">
                            {lessons.length > 0 ? (
                                lessons.map((lesson, index) => {
                                    const isActive = lesson.id === currentLesson?.id
                                    const isCompleted = completedLessonIds.has(lesson.id)
                                    return (
                                        <Link key={lesson.id} href={`/courses/${course.id}?lesson=${lesson.id}`}>
                                            <div className={`flex items-start gap-3 p-4 rounded-xl transition-all duration-300 cursor-pointer ${isActive ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 border border-indigo-500/30' : 'bg-zinc-900/50 hover:bg-zinc-800 border border-transparent'}`}>
                                                {isCompleted ? (
                                                    <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 text-emerald-400`} />
                                                ) : (
                                                    <PlayCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                                                )}
                                                <div>
                                                    <p className={`text-base tracking-tight ${isActive ? 'text-indigo-200 font-bold' : isCompleted ? 'text-emerald-300 font-medium' : 'text-zinc-300'}`}>
                                                        {index + 1}. {lesson.title}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    )
                                })
                            ) : (
                                <p className="text-sm text-zinc-500 py-4">Одоогоор хичээл нэмэгдээгүй байна.</p>
                            )}
                        </div>
                    </div>

                    {/* Mobile / Tablet Q&A Section */}
                    <div className="xl:hidden mt-8 pt-8 border-t border-white/5 pb-12">
                        <h3 className="text-xl font-bold mb-4 text-white">Асуулт, хариулт</h3>
                        {!isEnrolled ? (
                            <div className="bg-zinc-900/50 rounded-xl p-6 text-center border border-white/5">
                                <p className="text-zinc-400">Багшаас асуулт асуухын тулд хичээлд элсэнэ үү.</p>
                            </div>
                        ) : (
                            currentLessonId && (
                                <div className="bg-zinc-950 rounded-xl border border-white/5 overflow-hidden h-[600px] flex flex-col">
                                    <QASidebar
                                        courseId={course.id}
                                        lessonId={currentLessonId}
                                        initialData={qaThreads}
                                    />
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Desktop Sidebar Area (Q&A) */}
            <div className="hidden xl:block w-[400px] shrink-0 border-l border-white/5 h-full relative z-10 bg-zinc-950/50 backdrop-blur-2xl shadow-2xl">
                {!isEnrolled ? (
                    <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                        <p className="text-zinc-400 font-medium">Багшаас асуулт асуухын тулд хичээлд элсэнэ үү.</p>
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
