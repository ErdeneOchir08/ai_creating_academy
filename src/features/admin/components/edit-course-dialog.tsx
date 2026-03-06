'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { updateCourse } from '@/features/admin/actions/course-actions.admin'
import { Settings2 } from 'lucide-react'
import { ImageUpload } from '@/components/ui/image-upload'

// Assuming your Course type somewhat looks like this for the frontend props
type CourseProps = {
    id: string
    title: string
    description: string
    price_display: string
    original_price_display?: string | null
    thumbnail_url?: string | null
    published: boolean
}

export function EditCourseDialog({ course }: { course: CourseProps }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(formData: FormData) {
        setIsLoading(true)
        try {
            await updateCourse(course.id, formData)
            setOpen(false)
        } catch (error) {
            console.error(error)
            alert('Failed to update course. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="text-zinc-400 border-zinc-700 bg-transparent hover:bg-zinc-800 hover:text-white mt-4 w-full">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Edit Details
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Course</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Update the course metadata and pricing.
                    </DialogDescription>
                </DialogHeader>

                <form action={onSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Course Title <span className="text-red-500">*</span></Label>
                        <Input id="title" name="title" required defaultValue={course.title} className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
                        <Textarea id="description" name="description" required defaultValue={course.description} className="bg-zinc-900 border-zinc-800 min-h-[100px]" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price_display" className="text-emerald-400">Current Price</Label>
                            <Input id="price_display" name="price_display" defaultValue={course.price_display} className="bg-zinc-900 border-emerald-900/50 focus-visible:ring-emerald-500/50" />
                            <p className="text-[10px] text-zinc-500">The selling price.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="original_price_display" className="text-zinc-400">Original Price <span className="text-[10px]">(Optional)</span></Label>
                            <Input id="original_price_display" name="original_price_display" defaultValue={course.original_price_display || ''} className="bg-zinc-900 border-zinc-800 text-zinc-400 line-through decoration-zinc-500" />
                            <p className="text-[10px] text-zinc-500">For discounts.</p>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <Label>Course Image</Label>
                        <ImageUpload name="thumbnail_image" defaultValue={course.thumbnail_url || undefined} />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <input type="checkbox" id="published" name="published" value="true" defaultChecked={course.published} className="rounded border-zinc-800 bg-zinc-900" />
                        <Label htmlFor="published">Published</Label>
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
