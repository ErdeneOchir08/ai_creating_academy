import { getEnrolledCourses, getPendingCourses, getStudentProfile } from '@/features/dashboard/actions/dashboard-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Play, Clock } from 'lucide-react'
import Link from 'next/link'
import { getMyOfferingCheckoutStatuses } from '@/features/checkout/actions/offering-checkout-actions'
import { OfferingCheckoutStatusList } from '@/features/dashboard/components/offering-checkout-status-list'
import { selectNonApprovedOfferingCheckoutStatuses } from '@/features/dashboard/domain/offering-checkout-status-presentation'

export default async function DashboardCoursesPage() {
    const [profile, enrollments, pendingCourses, offeringCheckoutStatuses] = await Promise.all([
        getStudentProfile(),
        getEnrolledCourses(),
        getPendingCourses(),
        getMyOfferingCheckoutStatuses(),
    ])
    const nonApprovedOfferingStatuses = selectNonApprovedOfferingCheckoutStatuses(offeringCheckoutStatuses)
    const serverNow = new Date().toISOString()

    return (
        <div className="mx-auto max-w-6xl p-5 sm:p-8">
            <header className="mb-8 sm:mb-10">
                <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Миний хичээлүүд</h1>
                <p className="text-zinc-400">Тавтай морилно уу, {profile?.display_name || 'Суралцагч'}. Хичээлээ үргэлжлүүлээрэй!</p>
            </header>

            {/* Enrolled Courses */}
            {enrollments && enrollments.length > 0 && (
                <div className="mb-12">
                    <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                        Идэвхтэй хичээлүүд <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-1 rounded-full">{enrollments.length}</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {enrollments.map((enrollment) => {
                            const course = enrollment.courses
                            if (!course) return null
                            return (
                                <Card key={enrollment.id} className="bg-zinc-900 border-zinc-800 text-white overflow-hidden group flex flex-col">
                                    <div className="aspect-video relative bg-zinc-800">
                                        {course.thumbnail_url ? (
                                            // Dynamic Supabase Storage URL.
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
                                                <Play className="h-10 w-10 text-white/30" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <Link href={`/courses/${course.id}`}>
                                                <Button className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                                    Үргэлжлүүлэх
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                    <CardContent className="p-4 flex flex-col flex-1">
                                        <h3 className="font-semibold text-lg line-clamp-1">{course.title}</h3>
                                        <div className="mt-1 mb-4 flex-1 space-y-2">
                                            {enrollment.grant_source === 'bonus' && <span className="inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-300">Дагалдах үнэгүй хичээл</span>}
                                            {enrollment.granted_at && (
                                                <p className="text-zinc-400 text-sm">Элссэн огноо: {new Date(enrollment.granted_at).toLocaleDateString()}</p>
                                            )}
                                        </div>
                                        <div className="mt-auto pt-4 border-t border-zinc-800/50">
                                            <Link href={`/courses/${course.id}`} className="w-full">
                                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/20 rounded-xl font-bold h-12 text-md">
                                                    Хичээл үзэх
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {nonApprovedOfferingStatuses.length > 0 && (
                <OfferingCheckoutStatusList statuses={nonApprovedOfferingStatuses} serverNow={serverNow} />
            )}

            {/* Pending Courses */}
            {pendingCourses && pendingCourses.length > 0 && (
                <div className="mb-12">
                    <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                        Зөвшөөрөл хүлээгдэж буй <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs px-2 py-1 rounded-full">{pendingCourses.length}</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingCourses.map((request) => {
                            const course = request.courses
                            if (!course) return null
                            return (
                                <Card key={request.id} className="bg-zinc-950 border-zinc-800 text-white overflow-hidden opacity-75 flex flex-col">
                                    <div className="aspect-video relative bg-zinc-800">
                                        {course.thumbnail_url ? (
                                            // Dynamic Supabase Storage URL.
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover grayscale" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                                <Clock className="h-10 w-10 text-white/20" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-yellow-500/20 backdrop-blur-md border border-yellow-500/50 text-yellow-500 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Хянагдаж байна
                                        </div>
                                    </div>
                                    <CardContent className="p-4 flex flex-col flex-1">
                                        <h3 className="font-semibold text-lg line-clamp-1">{course.title}</h3>
                                        <p className="text-zinc-400 text-sm mt-1 mb-4 flex-1">Хүсэлт илгээсэн: {new Date(request.created_at).toLocaleDateString()}</p>
                                        <div className="mt-auto pt-4 border-t border-zinc-800/50">
                                            <Link href={`/course/${course.id}`} className="w-full">
                                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/20 rounded-xl font-bold h-12 text-md">
                                                    Төлөв харах
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {(!enrollments || enrollments.length === 0)
                && (!pendingCourses || pendingCourses.length === 0)
                && nonApprovedOfferingStatuses.length === 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center sm:p-12">
                    <h3 className="text-xl font-semibold mb-2">Одоогоор хичээл алга</h3>
                    <p className="text-zinc-400 mb-6">Та ямар нэг хичээлд элсээгүй байна.</p>
                    <Link href="/#courses">
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Хичээл үзэх</Button>
                    </Link>
                </div>
            )}
        </div>
    )
}
