import { getUserProgressDashboard } from '@/features/dashboard/actions/progress-dashboard-actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, PlayCircle, Trophy, Flame, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
export default async function ProgressDashboardPage() {
    const data = await getUserProgressDashboard()

    if (!data) return (
        <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
            <p className="text-zinc-500">Please sign in to view your progress.</p>
        </div>
    )

    const { courses, gamification, focalCourse } = data

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-10">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2 text-white flex items-center gap-3">
                        Creator Profile
                        <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black border-0 text-md px-3 py-1">
                            Lvl {gamification.currentLevel}
                        </Badge>
                    </h1>
                    <p className="text-zinc-400">Level up by completing lessons and mastering courses.</p>
                </div>
            </header>

            {/* EXP / Gamification Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Level Progress Bar Ring or Bar */}
                <Card className="lg:col-span-2 bg-zinc-950 border-zinc-800 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none">
                        <Flame className="w-64 h-64 text-orange-500 blur-sm mix-blend-screen" />
                    </div>

                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-end mb-2">
                            <CardTitle className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500 font-bold">
                                {gamification.totalXP.toLocaleString()} XP Total
                            </CardTitle>
                            <span className="text-sm font-medium text-zinc-500 uppercase tracking-widest">{gamification.xpForNextLevel - gamification.xpIntoCurrentLevel} XP to Level {gamification.currentLevel + 1}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4 relative z-10">
                        <Progress value={gamification.levelPercentage} className="h-4 bg-zinc-900 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-pink-500 shadow-inner" />
                        <p className="text-sm text-zinc-400 text-right font-medium">
                            {gamification.xpIntoCurrentLevel} / {gamification.xpForNextLevel} XP
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-950 border-zinc-800 text-white flex flex-col justify-center items-center p-6 text-center">
                    <div className="h-16 w-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                        <Trophy className="h-8 w-8 text-indigo-400" />
                    </div>
                    <CardTitle className="text-4xl mb-1">{gamification.totalCompletedLessons}</CardTitle>
                    <CardDescription className="text-zinc-400 font-medium">Lessons Mastered</CardDescription>
                </Card>
            </div>

            {/* Quick Resume focal action */}
            {focalCourse && (
                <div className="mt-12">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <PlayCircle className="h-5 w-5 text-indigo-400" /> Continue Learning
                    </h2>

                    <div className="group relative rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-indigo-500/50 transition-colors shadow-none hover:shadow-2xl hover:shadow-indigo-500/10 block cursor-pointer">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex flex-col sm:flex-row relative z-10 p-6 sm:p-8 gap-8 items-center">
                            <div className="w-full sm:w-64 aspect-video rounded-xl bg-zinc-950 overflow-hidden shrink-0 border border-zinc-800">
                                {focalCourse.thumbnailUrl ? (
                                    <img src={focalCourse.thumbnailUrl} alt={focalCourse.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
                                ) : (
                                    <div className="w-full h-full bg-indigo-900/20 flex items-center justify-center" />
                                )}
                            </div>

                            <div className="flex-1 w-full space-y-4">
                                <div>
                                    <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 bg-indigo-500/5 mb-3">{focalCourse.title}</Badge>
                                    <h3 className="text-2xl font-bold text-white leading-tight">Up Next: {focalCourse.nextLessonTitle || 'Keep Learning'}</h3>
                                </div>

                                <div className="max-w-md">
                                    <div className="flex justify-between items-center mb-2 text-sm text-zinc-400 font-medium tracking-wide">
                                        <span>Course Progress</span>
                                        <span>{focalCourse.percentage}%</span>
                                    </div>
                                    <Progress value={focalCourse.percentage} className="h-2 bg-zinc-950" />
                                </div>

                                <div className="pt-2">
                                    <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold px-8 shadow-lg shadow-indigo-500/20 group-hover:translate-x-1 transition-transform">
                                        <Link href={`/courses/${focalCourse.courseId}`}>
                                            Resume Course <ChevronRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Course Mastery Badges */}
            <div className="mt-16">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-white">Course Mastery</h2>
                    <span className="text-sm font-medium text-zinc-500">{courses.length} Active Courses</span>
                </div>

                {courses.length === 0 ? (
                    <div className="text-center p-12 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
                        <Flame className="h-12 w-12 text-zinc-600 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-white mb-2">Your journey begins here</h3>
                        <p className="text-zinc-400 mb-6">Enroll in a masterclass and earn your first XP!</p>
                        <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                            <Link href="/#courses">Browse Catalog</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {courses.map((course) => (
                            <Link key={course.courseId} href={`/courses/${course.courseId}`} className="block">
                                <Card className={`bg-zinc-900 border-zinc-800 text-white overflow-hidden hover:border-zinc-600 transition-colors h-full flex flex-col relative ${course.percentage === 100 ? 'border-amber-500/30' : ''}`}>
                                    {course.percentage === 100 && (
                                        <div className="absolute top-0 right-0 bg-gradient-to-bl from-amber-500/20 to-transparent p-6 rounded-bl-3xl pointer-events-none">
                                            <Trophy className="h-6 w-6 text-amber-500" />
                                        </div>
                                    )}
                                    <div className="p-6 flex-1">
                                        <h3 className="font-bold text-lg mb-2 pr-8 leading-tight line-clamp-2">{course.title}</h3>
                                        <p className="text-sm text-zinc-400">
                                            {course.completedLessons} / {course.totalLessons} Lessons
                                        </p>
                                    </div>
                                    <div className="px-6 pb-6 mt-auto">
                                        <div className="flex items-center gap-4">
                                            <Progress value={course.percentage} className={`h-1.5 flex-1 bg-zinc-950 ${course.percentage === 100 ? '[&>div]:bg-amber-500' : ''}`} />
                                            <span className={`text-sm font-bold w-12 text-right ${course.percentage === 100 ? 'text-amber-500' : 'text-zinc-300'}`}>{course.percentage}%</span>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
