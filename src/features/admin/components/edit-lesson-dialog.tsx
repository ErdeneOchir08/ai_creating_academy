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
import { updateLesson } from '@/features/admin/actions/course-actions.admin'
import { Edit2 } from 'lucide-react'

// Basic type for what we need from the lesson
export function EditLessonDialog({ lesson, courseId }: { lesson: { id: string; title: string; video_url: string; order_index: number }, courseId: string }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(formData: FormData) {
        setIsLoading(true)
        try {
            await updateLesson(lesson.id, courseId, formData)
            setOpen(false)
        } catch (error) {
            console.error(error)
            alert('Failed to update lesson. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-white hover:bg-zinc-800">
                    <Edit2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Lesson</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Update the lesson title and video URL.
                    </DialogDescription>
                </DialogHeader>

                <form action={onSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Lesson Title <span className="text-red-500">*</span></Label>
                        <Input id="title" name="title" required defaultValue={lesson.title} className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="video_url">Video URL</Label>
                        <Input id="video_url" name="video_url" placeholder="https://youtube.com/..." defaultValue={lesson.video_url || ''} className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="order_index">Order Index</Label>
                        <Input id="order_index" name="order_index" type="number" required defaultValue={lesson.order_index} className="bg-zinc-900 border-zinc-800 w-24" />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
