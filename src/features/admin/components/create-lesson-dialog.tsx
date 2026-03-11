'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { createLesson } from '@/features/admin/actions/course-actions.admin'
import { Plus } from 'lucide-react'

export function CreateLessonDialog({ courseId, nextOrderIndex }: { courseId: string; nextOrderIndex: number }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(formData: FormData) {
        setIsLoading(true)
        try {
            await createLesson(formData)
            setOpen(false)
        } catch (error) {
            console.error(error)
            alert('Хичээл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Хичээл нэмэх
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Шинэ хичээл нэмэх</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Энэ хичээлд YouTube видео нэмэх.
                    </DialogDescription>
                </DialogHeader>

                <form action={onSubmit} className="space-y-4 py-4">
                    <input type="hidden" name="course_id" value={courseId} />

                    <div className="space-y-2">
                        <Label htmlFor="title">Хичээлийн гарчиг <span className="text-red-500">*</span></Label>
                        <Input id="title" name="title" required placeholder="ж.нь: Flowise суулгах" className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="video_url">YouTube видеоны холбоос <span className="text-red-500">*</span></Label>
                        <Input id="video_url" name="video_url" required placeholder="https://youtube.com/watch?v=..." className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="order_index">Дарааллын дугаар</Label>
                        <Input id="order_index" name="order_index" type="number" defaultValue={nextOrderIndex} className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
                            Болих
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isLoading ? 'Хадгалж байна...' : 'Хичээл хадгалах'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
