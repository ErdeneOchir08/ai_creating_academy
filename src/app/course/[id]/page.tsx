import { getCourseById, getCourseLessons } from '@/features/courses/actions/course-actions'
import { checkPaymentStatus } from '@/features/payments/actions/payment-actions'
import { getUserProgressDashboard } from '@/features/dashboard/actions/progress-dashboard-actions'
import { CourseCurriculumList } from '@/components/course-curriculum-list'
import { PaymentModal } from '@/features/payments/components/payment-modal'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, MonitorPlay, Users, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

export default async function CourseSalesPage(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params
    const course = await getCourseById(id)

    if (!course) {
        notFound()
    }

    // Redirect to the player if they are already enrolled
    const paymentStatus = await checkPaymentStatus(id)
    if (paymentStatus === 'enrolled') {
        redirect(`/courses/${id}`)
    }

    const lessons = await getCourseLessons(id)

    // Determine if the user is authenticated (to show login vs payment modal)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let totalXP = 0
    if (user) {
        const progressDashboard = await getUserProgressDashboard()
        totalXP = progressDashboard?.gamification.totalXP || 0
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            {/* Ambient Backlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 py-8 relative z-10">
                {/* Back Button */}
                <Link href="/" className="inline-flex items-center text-zinc-400 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to all courses
                </Link>

                <div className="grid lg:grid-cols-12 gap-12 items-start">
                    {/* Left Column: Course Details */}
                    <div className="lg:col-span-7 space-y-8">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-400 border border-indigo-500/20">
                                    Masterclass
                                </span>
                                <span className="flex items-center text-sm text-zinc-400">
                                    <Star className="w-4 h-4 text-emerald-400 fill-emerald-400 mr-1" />
                                    4.9 (120+ reviews)
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                                {course.title}
                            </h1>

                            <p className="text-xl text-zinc-400 leading-relaxed font-light">
                                {course.description}
                            </p>
                        </div>

                        {/* Value Props Row */}
                        <div className="flex gap-6 py-6 border-y border-white/5">
                            <div className="flex items-center gap-3">
                                <MonitorPlay className="w-8 h-8 text-indigo-400" />
                                <div>
                                    <p className="font-bold">{lessons.length} Lessons</p>
                                    <p className="text-sm text-zinc-500">Video Content</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Users className="w-8 h-8 text-purple-400" />
                                <div>
                                    <p className="font-bold">Community</p>
                                    <p className="text-sm text-zinc-500">Q&A Support</p>
                                </div>
                            </div>
                        </div>

                        {/* Curriculum List */}
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Course Curriculum</h2>
                            <CourseCurriculumList lessons={lessons} courseId={course.id} />
                        </div>
                    </div>

                    {/* Right Column: Checkout Sticky Card */}
                    <div className="lg:col-span-5 relative">
                        <div className="sticky top-24 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
                            {/* Course Image */}
                            <div className="aspect-video w-full bg-zinc-800 relative">
                                {course.thumbnail_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={course.thumbnail_url}
                                        alt={course.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400">
                                        <MonitorPlay className="w-16 h-16 opacity-50" />
                                    </div>
                                )}
                            </div>

                            {/* Checkout Actions */}
                            <div className="p-8">
                                <div className="mb-8">
                                    {course.original_price_display && (
                                        <p className="text-xl text-zinc-500 line-through mb-1">
                                            {course.original_price_display}
                                        </p>
                                    )}
                                    <p className="text-5xl font-black text-white">
                                        {course.price_display}
                                    </p>
                                </div>

                                {paymentStatus === 'pending' ? (
                                    <div className="w-full text-center py-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500 font-bold">
                                        Payment Pending Admin Review
                                    </div>
                                ) : !user ? (
                                    <Link href="/login" className="block w-full">
                                        <Button className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] rounded-xl relative overflow-hidden group">
                                            <span className="relative z-10">Log in to Enroll</span>
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                                        </Button>
                                    </Link>
                                ) : (
                                    <PaymentModal courseId={course.id} coursePrice={course.price_display} totalXP={totalXP} />
                                )}

                                <div className="mt-6 space-y-3 shrink-0">
                                    {[
                                        'Lifetime access to all videos',
                                        'Direct Q&A with the instructor',
                                        'Certificate of completion'
                                    ].map((feature, i) => (
                                        <div key={i} className="flex items-center text-zinc-300 text-sm">
                                            <CheckCircle2 className="w-4 h-4 mr-3 text-emerald-400 shrink-0" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
