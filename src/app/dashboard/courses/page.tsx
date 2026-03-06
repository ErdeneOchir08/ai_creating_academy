import { getEnrolledCourses, getPendingCourses, getStudentProfile } from '@/features/dashboard/actions/dashboard-actions'
import { logout } from '@/features/auth/actions/auth-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Play, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardCoursesPage() {
    const profile = await getStudentProfile()
    const enrollments = await getEnrolledCourses()
    const pendingCourses = await getPendingCourses()

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="mb-10">
                <h1 className="text-3xl font-bold mb-2">My Courses</h1>
                <p className="text-zinc-400">Welcome back, {profile?.display_name || 'Student'}. Pick up where you left off!</p>
            </header>

            {/* Enrolled Courses */}
            {enrollments && enrollments.length > 0 && (
                <div className="mb-12">
                    <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                        Active Courses <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-1 rounded-full">{enrollments.length}</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {enrollments.map((enrollment: any) => {
                            const course = enrollment.courses
                            return (
                                <Card key={enrollment.id} className="bg-zinc-900 border-zinc-800 text-white overflow-hidden group">
                                    <div className="aspect-video relative bg-zinc-800">
                                        {course.thumbnail_url ? (
                                            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
                                                <Play className="h-10 w-10 text-white/30" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <Link href={`/courses/${course.id}`}>
                                                <Button className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                                    Resume Course
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                    <CardContent className="p-4">
                                        <h3 className="font-semibold text-lg line-clamp-1">{course.title}</h3>
                                        <p className="text-zinc-400 text-sm mt-1">Enrolled: {new Date(enrollment.granted_at).toLocaleDateString()}</p>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Pending Courses */}
            {pendingCourses && pendingCourses.length > 0 && (
                <div className="mb-12">
                    <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                        Pending Approval <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-xs px-2 py-1 rounded-full">{pendingCourses.length}</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingCourses.map((request: any) => {
                            const course = request.courses
                            return (
                                <Card key={request.id} className="bg-zinc-950 border-zinc-800 text-white overflow-hidden opacity-75">
                                    <div className="aspect-video relative bg-zinc-800">
                                        {course.thumbnail_url ? (
                                            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover grayscale" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                                <Clock className="h-10 w-10 text-white/20" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-yellow-500/20 backdrop-blur-md border border-yellow-500/50 text-yellow-500 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Under Review
                                        </div>
                                    </div>
                                    <CardContent className="p-4">
                                        <h3 className="font-semibold text-lg line-clamp-1">{course.title}</h3>
                                        <p className="text-zinc-400 text-sm mt-1">Requested: {new Date(request.created_at).toLocaleDateString()}</p>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {(!enrollments || enrollments.length === 0) && (!pendingCourses || pendingCourses.length === 0) && (
                <div className="text-center p-12 bg-zinc-900/50 rounded-xl border border-zinc-800">
                    <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
                    <p className="text-zinc-400 mb-6">You haven't enrolled in any courses. Explore the academy to get started!</p>
                    <Link href="/#courses">
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Browse Courses</Button>
                    </Link>
                </div>
            )}
        </div>
    )
}
