import { getCourseBonusCourses, getCourseById, getCourseLessons } from '@/features/courses/actions/course-actions'
import { checkPaymentStatus, getRejectedPaymentReason } from '@/features/payments/actions/payment-actions'
import { CourseCurriculumList } from '@/components/course-curriculum-list'
import { PaymentModal } from '@/features/payments/components/payment-modal'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Gift, MessageCircleQuestion, MonitorPlay } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getPaymentConfiguration } from '@/features/admin/actions/settings-actions.admin'
import { getPublicCourseOfferingCheckout } from '@/features/courses/actions/public-course-offering-actions'
import { CourseOfferingOptions } from '@/features/courses/components/course-offering-options'
import { CourseDescription } from '@/features/courses/components/course-description'

export default async function CourseSalesPage(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params
    const course = await getCourseById(id)

    if (!course) {
        notFound()
    }

    // Redirect to the player if they are already enrolled
    const paymentStatus = await checkPaymentStatus(id)
    if (course.archived_at && paymentStatus !== 'enrolled') {
        notFound()
    }
    const rejectionReason = paymentStatus === 'rejected' ? await getRejectedPaymentReason(id) : null
    if (paymentStatus === 'enrolled') {
        redirect(`/courses/${id}`)
    }

    const [lessons, bonusCourses, offeringCheckout] = await Promise.all([
        getCourseLessons(id),
        getCourseBonusCourses(id),
        getPublicCourseOfferingCheckout(id),
    ])
    const isPurchasable = lessons.length > 0

    // Determine if the user is authenticated (to show login vs payment modal)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const paymentConfiguration = offeringCheckout.usesOfferingCheckout
        ? null
        : await getPaymentConfiguration()

    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            {/* Ambient Backlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full lg:w-[800px] h-[300px] md:h-[400px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 py-8 relative z-10">
                {/* Back Button */}
                <Link href="/" className="inline-flex items-center text-zinc-400 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Бүх хичээл рүү буцах
                </Link>

                <div className="grid lg:grid-cols-12 gap-12 items-start">
                    {/* Left Column: Course Details */}
                    <div className="lg:col-span-7 space-y-8">
                        <div>
                            <div className="mb-6">
                                <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-400 border border-indigo-500/20">
                                    Мастеркласс
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-6xl font-black tracking-tight">
                                {course.title}
                            </h1>
                        </div>

                        <CourseDescription description={course.description} />

                        {/* Value Props Row */}
                        <div className="flex gap-6 py-6 border-y border-white/5">
                            <div className="flex items-center gap-3">
                                <MonitorPlay className="w-8 h-8 text-indigo-400" />
                                <div>
                                    <p className="font-bold">{lessons.length} Хичээл</p>
                                    <p className="text-sm text-zinc-500">Видео хичээл</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <MessageCircleQuestion className="w-8 h-8 text-purple-400" />
                                <div>
                                    <p className="font-bold">Асуулт, хариулт</p>
                                    <p className="text-sm text-zinc-500">Хичээлийн хэсэг бүрт</p>
                                </div>
                            </div>
                            {bonusCourses.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <Gift className="w-8 h-8 text-emerald-400" />
                                    <div>
                                        <p className="font-bold">{bonusCourses.length} дагалдах үнэгүй хичээл</p>
                                        <p className="text-sm text-zinc-500">Төлбөр баталгаажмагц нээгдэнэ</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {bonusCourses.length > 0 && (
                            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-emerald-300">
                                    <Gift className="h-5 w-5" /> Дагалдах үнэгүй хичээлүүд
                                </h2>
                                <ul className="space-y-2 text-zinc-300">
                                    {bonusCourses.map((bonusCourse) => (
                                        <li key={bonusCourse.id} className="flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                                            {bonusCourse.title}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Curriculum List */}
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Хичээлийн хөтөлбөр</h2>
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
                                {!offeringCheckout.usesOfferingCheckout && (
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
                                )}

                                {offeringCheckout.usesOfferingCheckout ? (
                                    <CourseOfferingOptions
                                        offerings={offeringCheckout.offerings}
                                        lookupFailed={offeringCheckout.lookupFailed}
                                    />
                                ) : !isPurchasable ? (
                                    <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-sm font-medium text-amber-200">
                                        Энэ хичээлийн хөтөлбөр бэлэн болоогүй байна. Удахгүй дахин шалгана уу.
                                    </div>
                                ) : paymentStatus === 'pending' ? (
                                    <div className="w-full text-center py-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500 font-bold">
                                        Төлбөр хүлээгдэх төлөвтэй байна
                                    </div>
                                ) : !user ? (
                                    <Link href="/login" className="block w-full">
                                        <Button className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] rounded-xl relative overflow-hidden group">
                                            <span className="relative z-10">Нэвтэрч элсэх</span>
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                                        </Button>
                                    </Link>
                                ) : paymentConfiguration ? (
                                    <PaymentModal courseId={course.id} coursePrice={course.price_display} paymentInstructions={paymentConfiguration.instructions} isTestMode={paymentConfiguration.isTestMode} rejectionReason={rejectionReason} />
                                ) : null}

                                <div className="mt-6 space-y-3 shrink-0">
                                    {[
                                        'Төлбөрөө баталгаажуулсны дараа хичээлд нэвтэрнэ',
                                        'Хичээлийн хэсэг бүрт асуулт үлдээж болно',
                                        'Сургалтын агуулга таны суралцах самбарт хадгалагдана'
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
