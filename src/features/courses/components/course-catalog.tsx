'use client'

import { useMemo, useState } from 'react'
import { CourseCard } from '@/features/courses/components/course-card'

type Category = { id: string; name: string }
type Course = { id: string; title: string; description: string; thumbnail_url: string; price_display: string; original_price_display?: string | null; payment_status?: 'none' | 'pending' | 'enrolled'; categories: Category[] }

export function CourseCatalog({ courses }: { courses: Course[] }) {
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const categories = useMemo(() => {
        const map = new Map<string, Category>()
        courses.forEach((course) => course.categories.forEach((category) => map.set(category.id, category)))
        return [...map.values()]
    }, [courses])
    const visibleCourses = selectedCategoryId ? courses.filter((course) => course.categories.some((category) => category.id === selectedCategoryId)) : courses
    return <>
        {categories.length > 0 && <div className="mb-8 flex flex-wrap gap-2" aria-label="Хичээлийн ангиллаар шүүх">
            <button type="button" onClick={() => setSelectedCategoryId(null)} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${selectedCategoryId === null ? 'bg-indigo-600 text-white' : 'border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-indigo-500/50'}`}>Бүгд</button>
            {categories.map((category) => <button key={category.id} type="button" onClick={() => setSelectedCategoryId(category.id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${selectedCategoryId === category.id ? 'bg-indigo-600 text-white' : 'border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-indigo-500/50'}`}>{category.name}</button>)}
        </div>}
        {visibleCourses.length ? <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleCourses.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center text-zinc-400">Энэ ангилалд нийтлэгдсэн хичээл одоогоор байхгүй байна.</div>}
    </>
}
