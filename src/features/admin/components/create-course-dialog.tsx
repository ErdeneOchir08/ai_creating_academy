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
import { createCourse } from '@/features/admin/actions/course-actions.admin'
import { Plus } from 'lucide-react'
import { ImageUpload } from '@/components/ui/image-upload'

export function CreateCourseDialog() {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function onSubmit(formData: FormData) {
        setIsLoading(true)
        try {
            await createCourse(formData)
            setOpen(false) // Close modal on success
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
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Шинэ хичээл үүсгэх
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Хичээл үүсгэх</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Платформд шинэ хичээл нэмэх. Та дараа нь хичээлүүд нэмэх боломжтой.
                    </DialogDescription>
                </DialogHeader>

                <form action={onSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Хичээлийн гарчиг <span className="text-red-500">*</span></Label>
                        <Input id="title" name="title" required placeholder="ж.нь: Flowise AI-ийн танилцуулга" className="bg-zinc-900 border-zinc-800" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Тайлбар <span className="text-red-500">*</span></Label>
                        <Textarea id="description" name="description" required placeholder="Тэд юу сурах вэ?" className="bg-zinc-900 border-zinc-800 min-h-[100px]" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price_display" className="text-emerald-400">Одоогийн үнэ</Label>
                            <Input id="price_display" name="price_display" placeholder="ж.нь: 50,000₮" className="bg-zinc-900 border-emerald-900/50 focus-visible:ring-emerald-500/50" />
                            <p className="text-[10px] text-zinc-500">Оюутнуудын төлөх үнэ.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="original_price_display" className="text-zinc-400">Үндсэн үнэ <span className="text-[10px]">(Заавал биш)</span></Label>
                            <Input id="original_price_display" name="original_price_display" placeholder="ж.нь: 100,000₮" className="bg-zinc-900 border-zinc-800 text-zinc-400 line-through decoration-zinc-500" />
                            <p className="text-[10px] text-zinc-500">Хямдралыг харуулахад ашиглагдана.</p>
                        </div>
                    </div>
                    <div className="space-y-2 pt-2">
                        <Label>Хичээлийн зураг</Label>
                        <ImageUpload name="thumbnail_image" />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <input type="checkbox" id="published" name="published" value="true" defaultChecked className="rounded border-zinc-800 bg-zinc-900" />
                        <Label htmlFor="published">Шууд нийтлэх</Label>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
                            Болих
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isLoading ? 'Үүсгэж байна...' : 'Хичээл үүсгэх'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
