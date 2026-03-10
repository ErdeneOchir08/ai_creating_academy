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
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to upload logo')
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
                updateAppSetting('landing_subtitle', landingSubtitle)
            ]

            const results = await Promise.all(updates)

            const failures = results.filter(r => !r.success)
            if (failures.length > 0) {
                throw new Error(failures[0].error || 'Failed to update one or more settings')
            }

            setSuccessMsg('Brand settings saved successfully!')
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to save brand settings')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                    Brand & Landing Page
                </CardTitle>
                <CardDescription className="text-zinc-400">
                    Customize your platform's logo and the primary copy displayed on the landing page hero section.
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
                        <Label className="text-zinc-300">Global Navbar Logo</Label>
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="App Logo" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <ImageIcon className="h-8 w-8 text-zinc-700" />
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white">
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                    Upload New Logo
                                </Label>
                                <Input
                                    id="logo-upload"
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                    disabled={isUploading || isLoading}
                                />
                                <p className="text-xs text-zinc-500">Recommended: Square or horizontal PNG/SVG with transparent background.</p>
                            </div>
                        </div>
                    </div>

                    {/* Landing Page Copy */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="landingBadge" className="text-zinc-300">Hero Pill Badge</Label>
                            <Input
                                id="landingBadge"
                                value={landingBadge}
                                onChange={(e) => setLandingBadge(e.target.value)}
                                placeholder="e.g. Empowering the next generation..."
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="landingTitleMain" className="text-zinc-300">Main Title (White Text)</Label>
                                <Input
                                    id="landingTitleMain"
                                    value={landingTitleMain}
                                    onChange={(e) => setLandingTitleMain(e.target.value)}
                                    placeholder="e.g. Build your own"
                                    className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="landingTitleHighlight" className="text-zinc-300">Highlighted Title (Gradient)</Label>
                                <Input
                                    id="landingTitleHighlight"
                                    value={landingTitleHighlight}
                                    onChange={(e) => setLandingTitleHighlight(e.target.value)}
                                    placeholder="e.g. AI Applications"
                                    className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="landingSubtitle" className="text-zinc-300">Hero Subtitle</Label>
                            <Textarea
                                id="landingSubtitle"
                                value={landingSubtitle}
                                onChange={(e) => setLandingSubtitle(e.target.value)}
                                placeholder="Describe your academy..."
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700 min-h-[100px]"
                            />
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
                                Saving...
                            </>
                        ) : (
                            'Save Brand Settings'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
