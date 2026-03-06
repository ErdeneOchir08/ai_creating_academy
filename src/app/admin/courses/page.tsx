import { getAllAdminCourses, deleteCourse } from '@/features/admin/actions/course-actions.admin'
import { CreateCourseDialog } from '@/features/admin/components/create-course-dialog'
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
import { Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default async function AdminCoursesPage() {
    const courses = await getAllAdminCourses()

    return (
        <div className="p-8">
            <header className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Courses</h1>
                    <p className="text-zinc-400">Manage course catalogs and lesson structures.</p>
                </div>
                <CreateCourseDialog />
            </header>

            <Card className="bg-zinc-950 border-zinc-800 text-white">
                <CardHeader>
                    <CardTitle>All Courses</CardTitle>
                    <CardDescription className="text-zinc-500">
                        {courses.length} total courses on the platform.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-zinc-800">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                                    <TableHead className="text-zinc-400">Title</TableHead>
                                    <TableHead className="text-zinc-400">Status</TableHead>
                                    <TableHead className="text-zinc-400 text-center">Lessons</TableHead>
                                    <TableHead className="text-zinc-400">Price</TableHead>
                                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {courses.length === 0 ? (
                                    <TableRow className="border-0 hover:bg-transparent">
                                        <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                                            No courses found. Try creating one!
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    courses.map((course: any) => (
                                        <TableRow key={course.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                            <TableCell className="font-medium">
                                                <Link href={`/admin/courses/${course.id}`} className="hover:text-indigo-400 transition-colors">
                                                    {course.title}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                {course.published ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">Published</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-zinc-500 border-zinc-700">Draft</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center text-zinc-300">
                                                {course.lessons?.[0]?.count || 0}
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

                                                    <form action={async () => {
                                                        'use server';
                                                        await deleteCourse(course.id)
                                                    }}>
                                                        <Button type="submit" variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-950/50">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </form>
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
