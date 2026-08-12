import { getAllAdminCourses } from '@/features/admin/actions/course-actions.admin'
import { CreateCourseDialog } from '@/features/admin/components/create-course-dialog'
import { CourseDeleteButton } from '@/features/admin/components/course-delete-button'
import { CourseArchiveButton } from '@/features/admin/components/course-archive-button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, Edit } from 'lucide-react'
import Link from 'next/link'

export default async function AdminCoursesPage() {
    const courses = await getAllAdminCourses()

    return (
        <div className="p-5 md:p-8">
            <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Хичээлийн контент</h1>
                    <p className="max-w-2xl text-zinc-400">Сургалтуудад дахин ашиглах видео хичээл, бүлэг, preview болон ангиллыг энд бэлтгэнэ. Үнэ, хуваарь, гэрээг анги / элсэлт дээр тохируулна.</p>
                </div>
                <CreateCourseDialog />
            </header>

            <Card className="mb-6 border-indigo-500/20 bg-indigo-500/5 text-white">
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="font-semibold">Ажиллах дараалал</p>
                        <p className="mt-1 text-sm text-zinc-400">1. Контент бэлтгэх → 2. Сургалтад холбох → 3. Анги / элсэлт нээх</p>
                    </div>
                    <Button asChild variant="outline" className="shrink-0 border-indigo-400/30 bg-zinc-950">
                        <Link href="/admin/programs">Сургалтууд руу очих<ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800 text-white">
                <CardHeader>
                    <CardTitle>Видео хичээлийн багцууд</CardTitle>
                    <CardDescription className="text-zinc-500">
                        Нийт {courses.length} контентын багц байна.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-zinc-800">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                                    <TableHead className="text-zinc-400">Гарчиг</TableHead>
                                    <TableHead className="text-zinc-400">Төлөв</TableHead>
                                    <TableHead className="text-zinc-400 text-center">Бүлэг</TableHead>
                                    <TableHead className="text-zinc-400">Бэлэн байдал</TableHead>
                                    <TableHead className="text-zinc-400">Үнэ</TableHead>
                                    <TableHead className="text-zinc-400 text-right">Үйлдэл</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {courses.length === 0 ? (
                                    <TableRow className="border-0 hover:bg-transparent">
                                        <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                                            Контентын багц алга байна. Эхний багцаа үүсгэнэ үү.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    courses.map((course) => (
                                        <TableRow key={course.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                            <TableCell className="font-medium">
                                                <Link href={`/admin/courses/${course.id}`} className="hover:text-indigo-400 transition-colors">
                                                    {course.title}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                {course.archived_at ? (
                                                    <Badge variant="outline" className="border-zinc-700 text-zinc-400">Архив</Badge>
                                                ) : course.published ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">Нийтлэгдсэн</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-zinc-500 border-zinc-700">Ноорог</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center text-zinc-300">
                                                {course.lesson_count}
                                            </TableCell>
                                            <TableCell>
                                                {course.is_ready_for_publication ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">Нийтлэхэд бэлэн</Badge>
                                                ) : course.published ? (
                                                    <Badge className="bg-amber-500/10 text-amber-300 hover:bg-amber-500/20">Засвар шаардлагатай</Badge>
                                                ) : course.lesson_count === 0 ? (
                                                    <Badge variant="outline" className="border-zinc-700 text-zinc-400">Бүлэг нэмнэ үү</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-zinc-700 text-zinc-400">Видео нэмнэ үү</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-zinc-300">
                                                {course.price_display}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" asChild>
                                                        <Link href={`/admin/courses/${course.id}`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>

                                                    <CourseArchiveButton courseId={course.id} courseTitle={course.title} archived={Boolean(course.archived_at)} />

                                                    {!course.archived_at && <CourseDeleteButton courseId={course.id} courseTitle={course.title} />}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
