'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { updateAppSetting } from '@/features/admin/actions/settings-actions.admin'
import { Loader2, CheckCircle2, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SettingsMap = {
    [key: string]: string
}

export function BrandSettingsForm({ initialSettings }: { initialSettings: SettingsMap }) {
    const [logoUrl, setLogoUrl] = useState(initialSettings?.app_logo_url || '')
    const [landingBadge, setLandingBadge] = useState(initialSettings?.landing_badge || 'Empowering the next generation of AI Builders')
    const [landingTitleMain, setLandingTitleMain] = useState(initialSettings?.landing_title_main || 'Build your own')
    const [landingTitleHighlight, setLandingTitleHighlight] = useState(initialSettings?.landing_title_highlight || 'AI Applications')
    const [landingSubtitle, setLandingSubtitle] = useState(initialSettings?.landing_subtitle || 'Join AI Creator Academy. Learn to code, prompt, and deploy real generative AI apps in a meticulously designed, immersive learning environment.')

    // CTAs & Courses
    const [landingCtaPrimary, setLandingCtaPrimary] = useState(initialSettings?.landing_cta_primary || 'Start Learning Now')
    const [landingCtaSecondary, setLandingCtaSecondary] = useState(initialSettings?.landing_cta_secondary || 'Create Free Account')
    const [landingCourseTitle, setLandingCourseTitle] = useState(initialSettings?.landing_course_title || 'Featured Masterclasses')
    const [landingCourseSubtitle, setLandingCourseSubtitle] = useState(initialSettings?.landing_course_subtitle || 'Complete paths from beginner to AI expert.')
    const [landingEmptyTitle, setLandingEmptyTitle] = useState(initialSettings?.landing_empty_title || 'No courses available yet')
    const [landingEmptySubtitle, setLandingEmptySubtitle] = useState(initialSettings?.landing_empty_subtitle || 'You haven\'t added any courses to the database yet. You can add them through the Supabase Dashboard!')

    // About Section
    const [aboutTitleMain, setAboutTitleMain] = useState(initialSettings?.about_title_main || 'About')
    const [aboutTitleHighlight, setAboutTitleHighlight] = useState(initialSettings?.about_title_highlight || 'AI Creator Academy')
    const [aboutSubtitle, setAboutSubtitle] = useState(initialSettings?.about_subtitle || 'We are on a mission to democratize artificial intelligence education. Our platform bridges the gap between complex AI concepts and real-world application building.')
    const [aboutGoalTitle, setAboutGoalTitle] = useState(initialSettings?.about_goal_title || 'Our Goal')
    const [aboutGoalDesc, setAboutGoalDesc] = useState(initialSettings?.about_goal_desc || 'To equip 10,000 students worldwide with the practical skills needed to build robust, scalable AI applications from scratch. We focus on hands-on learning rather than purely theoretical concepts.')
    const [aboutVisionTitle, setAboutVisionTitle] = useState(initialSettings?.about_vision_title || 'Our Vision')
    const [aboutVisionDesc, setAboutVisionDesc] = useState(initialSettings?.about_vision_desc || 'A future where anyone, regardless of their background, can harness the power of AI to solve meaningful problems and create innovative software solutions.')
    const [aboutStatsStudents, setAboutStatsStudents] = useState(initialSettings?.about_stats_students || '2,500+')
    const [aboutStatsExperience, setAboutStatsExperience] = useState(initialSettings?.about_stats_experience || '10+')
    const [aboutStatsFounded, setAboutStatsFounded] = useState(initialSettings?.about_stats_founded || 'Founded 2024')

    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setErrorMsg('')
        setSuccessMsg('')

        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const fileName = `logo_${Date.now()}.${fileExt}`
            const filePath = `brand/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('course-images')
                .upload(filePath, file)

            if (uploadError) throw new Error(uploadError.message)

            const { data: { publicUrl } } = supabase.storage
                .from('course-images')
                .getPublicUrl(filePath)

            setLogoUrl(publicUrl)
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'Лого хуулахад алдаа гарлаа')
        } finally {
            setIsUploading(false)
            if (e.target) e.target.value = '' // reset input
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setSuccessMsg('')
        setErrorMsg('')

        try {
            const updates = [
                updateAppSetting('app_logo_url', logoUrl),
                updateAppSetting('landing_badge', landingBadge),
                updateAppSetting('landing_title_main', landingTitleMain),
                updateAppSetting('landing_title_highlight', landingTitleHighlight),
                updateAppSetting('landing_subtitle', landingSubtitle),
                updateAppSetting('landing_cta_primary', landingCtaPrimary),
                updateAppSetting('landing_cta_secondary', landingCtaSecondary),
                updateAppSetting('landing_course_title', landingCourseTitle),
                updateAppSetting('landing_course_subtitle', landingCourseSubtitle),
                updateAppSetting('landing_empty_title', landingEmptyTitle),
                updateAppSetting('landing_empty_subtitle', landingEmptySubtitle),
                updateAppSetting('about_title_main', aboutTitleMain),
                updateAppSetting('about_title_highlight', aboutTitleHighlight),
                updateAppSetting('about_subtitle', aboutSubtitle),
                updateAppSetting('about_goal_title', aboutGoalTitle),
                updateAppSetting('about_goal_desc', aboutGoalDesc),
                updateAppSetting('about_vision_title', aboutVisionTitle),
                updateAppSetting('about_vision_desc', aboutVisionDesc),
                updateAppSetting('about_stats_students', aboutStatsStudents),
                updateAppSetting('about_stats_experience', aboutStatsExperience),
                updateAppSetting('about_stats_founded', aboutStatsFounded)
            ]

            const results = await Promise.all(updates)

            const failures = results.filter(r => !r.success)
            if (failures.length > 0) {
                throw new Error(failures[0].error || 'Failed to update one or more settings')
            }

            setSuccessMsg('Брэндийн тохиргоо амжилттай хадгалагдлаа!')
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'Брэндийн тохиргоо хадгалахад алдаа гарлаа')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                    Брэнд & Нүүр хуудас
                </CardTitle>
                <CardDescription className="text-zinc-400">
                    Платформын лого болон нүүр хуудсан дээрх үндсэн бичвэрийг өөрчлөх.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSave} className="space-y-6">
                    {successMsg && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            <p className="text-emerald-400 font-medium text-sm">{successMsg}</p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            <p className="text-red-400 font-medium text-sm">{errorMsg}</p>
                        </div>
                    )}

                    {/* Logo Section */}
                    <div className="space-y-3 pb-6 border-b border-zinc-800">
                        <Label className="text-zinc-300">Цэсийн лого</Label>
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                {logoUrl ? (
                                    // Dynamic Supabase Storage URL used for the admin preview.
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={logoUrl} alt="App Logo" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <ImageIcon className="h-8 w-8 text-zinc-700" />
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white">
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                    Шинэ лого хуулах
                                </Label>
                                <Input
                                    id="logo-upload"
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                    disabled={isUploading || isLoading}
                                />
                                <p className="text-xs text-zinc-500">Зөвлөмж: Дөрвөлжин эсвэл хэвтээ PNG/SVG, тунгалаг дэвсгэртэй.</p>
                            </div>
                        </div>
                    </div>

                    {/* Landing Page Copy */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="landingBadge" className="text-zinc-300">Толгой хэсгийн танилцуулга</Label>
                            <Input
                                id="landingBadge"
                                value={landingBadge}
                                onChange={(e) => setLandingBadge(e.target.value)}
                                placeholder="ж.нь: Шинэ үеийн..."
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="landingTitleMain" className="text-zinc-300">Үндсэн гарчиг (Цагаан бичвэр)</Label>
                                <Input
                                    id="landingTitleMain"
                                    value={landingTitleMain}
                                    onChange={(e) => setLandingTitleMain(e.target.value)}
                                    placeholder="ж.нь: Өөрийн..."
                                    className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="landingTitleHighlight" className="text-zinc-300">Онцлох гарчиг (Ууссан өнгөтэй)</Label>
                                <Input
                                    id="landingTitleHighlight"
                                    value={landingTitleHighlight}
                                    onChange={(e) => setLandingTitleHighlight(e.target.value)}
                                    placeholder="ж.нь: AI аппликейшн"
                                    className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="landingSubtitle" className="text-zinc-300">Толгой хэсгийн дэд гарчиг</Label>
                            <Textarea
                                id="landingSubtitle"
                                value={landingSubtitle}
                                onChange={(e) => setLandingSubtitle(e.target.value)}
                                placeholder="Академиа дүрсэлнэ үү..."
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700 min-h-[100px]"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="landingCtaPrimary" className="text-zinc-300">Үндсэн үйлдэл (Товч)</Label>
                            <Input
                                id="landingCtaPrimary"
                                value={landingCtaPrimary}
                                onChange={(e) => setLandingCtaPrimary(e.target.value)}
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="landingCtaSecondary" className="text-zinc-300">Хоёрдогч үйлдэл (Товч)</Label>
                            <Input
                                id="landingCtaSecondary"
                                value={landingCtaSecondary}
                                onChange={(e) => setLandingCtaSecondary(e.target.value)}
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                            />
                        </div>
                    </div>

                    {/* About Section */}
                    <div className="space-y-4 pt-6 border-t border-zinc-800">
                        <Label className="text-zinc-300 text-lg font-semibold block">Бидний тухай хэсгийн бичвэр</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="aboutTitleMain" className="text-zinc-300">Хэсгийн гарчиг (Цагаан)</Label>
                                <Input
                                    id="aboutTitleMain"
                                    value={aboutTitleMain}
                                    onChange={(e) => setAboutTitleMain(e.target.value)}
                                    className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="aboutTitleHighlight" className="text-zinc-300">Хэсгийн гарчиг (Ууссан өнгө)</Label>
                                <Input
                                    id="aboutTitleHighlight"
                                    value={aboutTitleHighlight}
                                    onChange={(e) => setAboutTitleHighlight(e.target.value)}
                                    className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="aboutSubtitle" className="text-zinc-300">Бидний тухай дэд гарчиг</Label>
                            <Textarea
                                id="aboutSubtitle"
                                value={aboutSubtitle}
                                onChange={(e) => setAboutSubtitle(e.target.value)}
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700 min-h-[80px]"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="aboutGoalTitle" className="text-zinc-300">Зорилгын гарчиг</Label>
                                <Input id="aboutGoalTitle" value={aboutGoalTitle} onChange={(e) => setAboutGoalTitle(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                                <Textarea id="aboutGoalDesc" value={aboutGoalDesc} onChange={(e) => setAboutGoalDesc(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white mt-2 min-h-[80px]" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="aboutVisionTitle" className="text-zinc-300">Алсын харааны гарчиг</Label>
                                <Input id="aboutVisionTitle" value={aboutVisionTitle} onChange={(e) => setAboutVisionTitle(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                                <Textarea id="aboutVisionDesc" value={aboutVisionDesc} onChange={(e) => setAboutVisionDesc(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white mt-2 min-h-[80px]" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 border-t border-zinc-800 pt-4 mt-6">
                            <div className="space-y-2">
                                <Label htmlFor="aboutStatsStudents" className="text-zinc-300">Үзүүлэлт 1 (Оюутнууд)</Label>
                                <Input id="aboutStatsStudents" value={aboutStatsStudents} onChange={(e) => setAboutStatsStudents(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="aboutStatsExperience" className="text-zinc-300">Үзүүлэлт 2 (Туршлага)</Label>
                                <Input id="aboutStatsExperience" value={aboutStatsExperience} onChange={(e) => setAboutStatsExperience(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="aboutStatsFounded" className="text-zinc-300">Үзүүлэлт 3 (Байгуулагдсан)</Label>
                                <Input id="aboutStatsFounded" value={aboutStatsFounded} onChange={(e) => setAboutStatsFounded(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Courses Copy */}
                    <div className="space-y-4 pt-6 border-t border-zinc-800">
                        <Label className="text-zinc-300 text-lg font-semibold block">Хичээлийн жагсаалтын бичвэр</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="landingCourseTitle" className="text-zinc-300">Хичээлийн хэсгийн гарчиг</Label>
                                <Input id="landingCourseTitle" value={landingCourseTitle} onChange={(e) => setLandingCourseTitle(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="landingCourseSubtitle" className="text-zinc-300">Хичээлийн хэсгийн дэд гарчиг</Label>
                                <Input id="landingCourseSubtitle" value={landingCourseSubtitle} onChange={(e) => setLandingCourseSubtitle(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="landingEmptyTitle" className="text-zinc-300">Хичээлгүй үеийн гарчиг</Label>
                                <Input id="landingEmptyTitle" value={landingEmptyTitle} onChange={(e) => setLandingEmptyTitle(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="landingEmptySubtitle" className="text-zinc-300">Хичээлгүй үеийн дэд гарчиг</Label>
                                <Input id="landingEmptySubtitle" value={landingEmptySubtitle} onChange={(e) => setLandingEmptySubtitle(e.target.value)} className="bg-zinc-950/50 border-zinc-800 text-white" />
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading || isUploading}
                        className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Хадгалж байна...
                            </>
                        ) : (
                            'Брэндийн тохиргоог хадгалах'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card >
    )
}
