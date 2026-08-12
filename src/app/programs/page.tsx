import { BookOpen } from 'lucide-react'
import { getPublishedCourses } from '@/features/courses/actions/course-actions'
import { CourseCatalog } from '@/features/courses/components/course-catalog'

export const metadata = {
    title: 'Сургалтууд | Mind Academy',
    description: 'Mind Academy-ийн нийтэд нээлттэй сургалтуудтай танилцаж, өөрт тохирох сургалтаа сонгоно уу.',
}

export default async function ProgramsPage() {
    const courses = await getPublishedCourses()

    return (
        <main className="min-h-[calc(100vh-64px)] bg-zinc-950 px-4 py-14 text-white">
            <div className="mx-auto max-w-7xl">
                <div className="max-w-3xl">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">Mind Academy</p>
                    <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Бүх сургалтууд</h1>
                    <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                        Сургалтын агуулга, хөтөлбөр болон нээлттэй онлайн, танхимын бүртгэлийн сонголтуудтай танилцана уу.
                    </p>
                </div>

                <section className="mt-12" aria-label="Нийтэд нээлттэй сургалтууд">
                    {courses.length > 0 ? (
                        <CourseCatalog courses={courses} />
                    ) : (
                        <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
                            <BookOpen className="mb-4 h-12 w-12 text-zinc-600" />
                            <h2 className="text-xl font-semibold">Одоогоор нийтэд нээлттэй сургалт алга.</h2>
                            <p className="mt-2 text-sm text-zinc-500">Шинэ сургалт нийтлэгдэхэд энэ хуудсанд автоматаар харагдана.</p>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}
