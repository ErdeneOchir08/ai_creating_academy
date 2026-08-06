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
    const [errorMessage, setErrorMessage] = useState('')

    async function onSubmit(formData: FormData) {
        setErrorMessage('')
        setIsLoading(true)

        try {
            await createCourse(formData)
            setOpen(false)
        } catch (error: unknown) {
            console.error(error)
            setErrorMessage(error instanceof Error ? error.message : 'Хичээл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Шинэ хичээл үүсгэх
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[500px] border-zinc-800 bg-zinc-950 text-white">
                <DialogHeader>
                    <DialogTitle>Шинэ хичээл үүсгэх</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Эхлээд хичээлийн үндсэн мэдээллийг оруулна. Дараа нь хичээлүүдийг нэмэх боломжтой.
                    </DialogDescription>
                </DialogHeader>

                <form action={onSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Хичээлийн гарчиг <span className="text-red-500">*</span></Label>
                        <Input id="title" name="title" required placeholder="Жишээ: Gemini AI-ийн үндэс" className="border-zinc-800 bg-zinc-900" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Тайлбар <span className="text-red-500">*</span></Label>
                        <Textarea id="description" name="description" required placeholder="Сурагч юу сурахыг тайлбарлана уу" className="min-h-[100px] border-zinc-800 bg-zinc-900" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="price_display" className="text-emerald-400">Одоогийн үнэ (₮)</Label>
                            <Input id="price_display" name="price_display" inputMode="numeric" placeholder="Жишээ: 100000" className="border-emerald-900/50 bg-zinc-900" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="original_price_display">Үндсэн үнэ (₮)</Label>
                            <Input id="original_price_display" name="original_price_display" inputMode="numeric" placeholder="Жишээ: 150000" className="border-zinc-800 bg-zinc-900" />
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <Label>Хичээлийн зураг</Label>
                        <ImageUpload name="thumbnail_image" />
                    </div>

                    <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                        Шинэ хичээл ноорог төлөвтэй үүснэ. Дор хаяж нэг видео агуулга нэмсний дараа нийтэлнэ үү.
                    </p>

                    {errorMessage && (
                        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            {errorMessage}
                        </p>
                    )}

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">Болих</Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 text-white hover:bg-indigo-700">
                            {isLoading ? 'Үүсгэж байна…' : 'Хичээл үүсгэх'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
