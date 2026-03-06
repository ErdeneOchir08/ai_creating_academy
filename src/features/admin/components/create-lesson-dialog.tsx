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
            alert('Failed to create lesson. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lesson
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Add New Lesson</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Add a YouTube video lesson to this course.
                    </DialogDescription>
                </DialogHeader>

                <form action={onSubmit} className="space-y-4 py-4">
                    <input type="hidden" name="course_id" value={courseId} />

                    <div className="space-y-2">
                        <Label htmlFor="title">Lesson Title <span className="text-red-500">*</span></Label>
                        <Input id="title" name="title" required placeholder="e.g., Installing Flowise" className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="video_url">YouTube Video URL <span className="text-red-500">*</span></Label>
                        <Input id="video_url" name="video_url" required placeholder="https://youtube.com/watch?v=..." className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="order_index">Order Index</Label>
                        <Input id="order_index" name="order_index" type="number" defaultValue={nextOrderIndex} className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isLoading ? 'Saving...' : 'Save Lesson'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
