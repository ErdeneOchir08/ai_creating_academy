'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createLesson } from '@/features/admin/actions/course-actions.admin'
import { Plus } from 'lucide-react'

export function CreateLessonDialog({ courseId, nextOrderIndex }: { courseId: string; nextOrderIndex: number }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [videoProvider, setVideoProvider] = useState<'youtube' | 'cloudflare'>('youtube')

    async function onSubmit(formData: FormData) {
        setErrorMessage('')
        setIsLoading(true)
        try {
            await createLesson(formData)
            setOpen(false)
        } catch (error: unknown) {
            console.error(error)
            setErrorMessage(error instanceof Error ? error.message : 'Хичээл нэмэхэд алдаа гарлаа.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Хичээл нэмэх
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-zinc-800 bg-zinc-950 text-white">
                <DialogHeader>
                    <DialogTitle>Шинэ хичээл нэмэх</DialogTitle>
                    <DialogDescription className="text-zinc-400">Видео холбоосыг дараа нь засах боломжтой.</DialogDescription>
                </DialogHeader>
                <form action={onSubmit} className="space-y-4 py-4">
                    <input type="hidden" name="course_id" value={courseId} />
                    <div className="space-y-2">
                        <Label htmlFor="title">Гарчиг <span className="text-red-500">*</span></Label>
                        <Input id="title" name="title" required placeholder="Жишээ: Gemini-ийн үндсэн ойлголт" className="border-zinc-800 bg-zinc-900" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="video_url">Видео холбоос</Label>
                        <select id="video_provider" name="video_provider" value={videoProvider} onChange={(event) => setVideoProvider(event.target.value as 'youtube' | 'cloudflare')} className="mb-2 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-white">
                            <option value="youtube">YouTube холбоос</option>
                            <option value="cloudflare">Cloudflare Stream video ID</option>
                        </select>
                        <Input id="video_source" name="video_source" type={videoProvider === 'youtube' ? 'url' : 'text'} placeholder={videoProvider === 'youtube' ? 'https://youtube.com/watch?v=...' : 'Cloudflare Stream video ID'} className="border-zinc-800 bg-zinc-900" />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                        <input id="is_preview" name="is_preview" type="checkbox" value="true" className="mt-1 h-4 w-4 accent-indigo-500" />
                        <span>
                            <span className="block text-sm font-medium text-white">Үнэгүй урьдчилж үзэх</span>
                            <span className="block text-xs leading-5 text-zinc-400">Нэвтрэхгүй хэрэглэгчид энэ хичээлийн видеог үзэж болно. Видео холбоос заавал шаардлагатай.</span>
                        </span>
                    </label>
                    <div className="space-y-2">
                        <Label htmlFor="order_index">Дараалал <span className="text-red-500">*</span></Label>
                        <Input id="order_index" name="order_index" type="number" min="1" required defaultValue={nextOrderIndex} className="border-zinc-800 bg-zinc-900" />
                    </div>
                    {errorMessage && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>}
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">Болих</Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 text-white hover:bg-indigo-700">{isLoading ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
