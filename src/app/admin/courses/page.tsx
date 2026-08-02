import { getAllAdminCourses } from '@/features/admin/actions/course-actions.admin'
import { CreateCourseDialog } from '@/features/admin/components/create-course-dialog'
import { CourseDeleteButton } from '@/features/admin/components/course-delete-button'
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
import { Edit } from 'lucide-react'
import Link from 'next/link'

export default async function AdminCoursesPage() {
    const courses = await getAllAdminCourses()

    return (
        <div className="p-8">
            <header className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Хичээлүүд</h1>
                    <p className="text-zinc-400">Хичээлийн каталог болон хичээлийн бүтцийг удирдах.</p>
                </div>
                <CreateCourseDialog />
            </header>

            <Card className="bg-zinc-950 border-zinc-800 text-white">
                <CardHeader>
                    <CardTitle>Бүх хичээлүүд</CardTitle>
                    <CardDescription className="text-zinc-500">
                        Платформ дээр нийт {courses.length} хичээл байна.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-zinc-800">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                                    <TableHead className="text-zinc-400">Гарчиг</TableHead>
                                    <TableHead className="text-zinc-400">Төлөв</TableHead>
                                    <TableHead className="text-zinc-400 text-center">Хичээлүүд</TableHead>
                                    <TableHead className="text-zinc-400">Бэлэн байдал</TableHead>
                                    <TableHead className="text-zinc-400">Үнэ</TableHead>
                                    <TableHead className="text-zinc-400 text-right">Үйлдэл</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {courses.length === 0 ? (
                                    <TableRow className="border-0 hover:bg-transparent">
                                        <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                                            Хичээл олдсонгүй. Шинээр үүсгэнэ үү!
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
                                                {course.published ? (
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
                                                    <Badge variant="outline" className="border-zinc-700 text-zinc-400">Хичээл нэмнэ үү</Badge>
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

                                                    <CourseDeleteButton courseId={course.id} courseTitle={course.title} />
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
