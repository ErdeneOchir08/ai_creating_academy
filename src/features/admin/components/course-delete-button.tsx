'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteCourse } from '@/features/admin/actions/course-actions.admin'

export function CourseDeleteButton({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    function confirmDelete() {
        setError(null)
        startTransition(async () => {
            const result = await deleteCourse(courseId)
            if (result?.error) {
                setError(result.error)
                return
            }
            setOpen(false)
            router.refresh()
        })
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="text-red-400 hover:bg-red-950/50 hover:text-red-300" aria-label={`${courseTitle} хичээлийг устгах`}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-white">
                <AlertDialogHeader>
                    <AlertDialogTitle>Хичээлийг устгах уу?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                        “{courseTitle}” хичээл, түүний бүх хичээлийн агуулга устах болно. Суралцагч эсвэл төлбөрийн түүхтэй хичээлийг хамгаалж, устгахыг зөвшөөрөхгүй.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && <p className="text-sm text-amber-300">{error}</p>}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending} className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white">Болих</AlertDialogCancel>
                    <Button type="button" onClick={confirmDelete} disabled={isPending} variant="destructive">
                        {isPending ? 'Устгаж байна…' : 'Устгах'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
