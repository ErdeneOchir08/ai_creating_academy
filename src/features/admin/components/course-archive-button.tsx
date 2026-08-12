'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore } from 'lucide-react'
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
import { setCourseArchived } from '@/features/admin/actions/course-actions.admin'

export function CourseArchiveButton({
    courseId,
    courseTitle,
    archived,
}: {
    courseId: string
    courseTitle: string
    archived: boolean
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    function confirmChange() {
        setError(null)
        startTransition(async () => {
            const result = await setCourseArchived(courseId, !archived)
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
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    aria-label={archived ? `${courseTitle} хичээлийг архиваас гаргах` : `${courseTitle} хичээлийг архивлах`}
                    title={archived ? 'Архиваас гаргах' : 'Архивлах'}
                >
                    {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-white">
                <AlertDialogHeader>
                    <AlertDialogTitle>{archived ? 'Хичээлийг архиваас гаргах уу?' : 'Хичээлийг архивлах уу?'}</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                        {archived
                            ? `“${courseTitle}” хичээл дахин админ хэсэгт идэвхтэй болно. Элсэлтийг тусад нь нээх шаардлагатай.`
                            : `“${courseTitle}” хичээл нийтэд харагдахгүй болж, шинэ бүртгэл хаагдана. Одоогийн суралцагчдын хандах эрх болон бүх төлбөр, гэрээ, элсэлтийн түүх хадгалагдана.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && <p className="text-sm text-amber-300">{error}</p>}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending} className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white">
                        Болих
                    </AlertDialogCancel>
                    <Button type="button" onClick={confirmChange} disabled={isPending} className="bg-indigo-600 text-white hover:bg-indigo-700">
                        {isPending ? 'Хадгалж байна…' : archived ? 'Архиваас гаргах' : 'Архивлах'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
