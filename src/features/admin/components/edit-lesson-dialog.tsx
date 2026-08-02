'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { updateLesson } from '@/features/admin/actions/course-actions.admin'
import { Edit2 } from 'lucide-react'

type Lesson = { id: string; title: string; video_url: string | null; video_provider: 'youtube' | 'cloudflare' | null; provider_video_id: string | null; order_index: number; is_preview: boolean }

export function EditLessonDialog({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [videoProvider, setVideoProvider] = useState<'youtube' | 'cloudflare'>(lesson.video_provider === 'cloudflare' ? 'cloudflare' : 'youtube')
    const [videoSource, setVideoSource] = useState(lesson.video_provider === 'cloudflare' ? lesson.provider_video_id || '' : lesson.video_url || '')

    async function onSubmit(formData: FormData) {
        setErrorMessage('')
        setIsLoading(true)
        try {
            await updateLesson(lesson.id, courseId, formData)
            setOpen(false)
        } catch (error: unknown) {
            console.error(error)
            setErrorMessage(error instanceof Error ? error.message : 'Хичээлийг засахад алдаа гарлаа.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:bg-zinc-800 hover:text-white"><Edit2 className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-zinc-800 bg-zinc-950 text-white">
                <DialogHeader>
                    <DialogTitle>Хичээл засах</DialogTitle>
                    <DialogDescription className="text-zinc-400">Хоосон видео холбоос хадгалбал одоогийн видеог салгана.</DialogDescription>
                </DialogHeader>
                <form action={onSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Гарчиг <span className="text-red-500">*</span></Label>
                        <Input id="title" name="title" required defaultValue={lesson.title} className="border-zinc-800 bg-zinc-900" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="video_url">Видео холбоос</Label>
                        <select id="video_provider" name="video_provider" value={videoProvider} onChange={(event) => {
                            setVideoProvider(event.target.value as 'youtube' | 'cloudflare')
                            setVideoSource('')
                        }} className="mb-2 h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-white">
                            <option value="youtube">YouTube холбоос</option>
                            <option value="cloudflare">Cloudflare Stream video ID</option>
                        </select>
                        <Input id="video_source" name="video_source" type={videoProvider === 'youtube' ? 'url' : 'text'} placeholder={videoProvider === 'youtube' ? 'https://youtube.com/...' : 'Cloudflare Stream video ID'} value={videoSource} onChange={(event) => setVideoSource(event.target.value)} className="border-zinc-800 bg-zinc-900" />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                        <input id="is_preview" name="is_preview" type="checkbox" value="true" defaultChecked={lesson.is_preview} className="mt-1 h-4 w-4 accent-indigo-500" />
                        <span>
                            <span className="block text-sm font-medium text-white">Үнэгүй урьдчилж үзэх</span>
                            <span className="block text-xs leading-5 text-zinc-400">Нэвтрэхгүй хэрэглэгчид энэ хичээлийн видеог үзэж болно. Видео холбоос заавал шаардлагатай.</span>
                        </span>
                    </label>
                    <div className="space-y-2">
                        <Label htmlFor="order_index">Дараалал <span className="text-red-500">*</span></Label>
                        <Input id="order_index" name="order_index" type="number" min="1" required defaultValue={lesson.order_index} className="w-24 border-zinc-800 bg-zinc-900" />
                    </div>
                    {errorMessage && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">Болих</Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 text-white hover:bg-indigo-700">{isLoading ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
