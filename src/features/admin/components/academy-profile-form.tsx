'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateAcademyProfile, type AcademyProfile } from '@/features/admin/actions/settings-actions.admin'

function SaveButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {pending ? 'Хадгалж байна...' : 'Академийн мэдээлэл хадгалах'}
        </Button>
    )
}

export function AcademyProfileForm({ profile }: { profile: AcademyProfile }) {
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    async function action(formData: FormData) {
        setMessage(null)
        const result = await updateAcademyProfile(formData)
        if (result.error) setMessage({ type: 'error', text: result.error })
        if (result.success) setMessage({ type: 'success', text: result.success })
    }

    return (
        <form action={action} className="space-y-5">
            <div className="space-y-2">
                <Label htmlFor="display_name">Академийн нийтэд харагдах нэр</Label>
                <Input id="display_name" name="display_name" required maxLength={120} defaultValue={profile.displayName} className="border-zinc-700 bg-zinc-900 text-white" />
            </div>

            <div className="space-y-2">
                <Label htmlFor="short_description">Товч танилцуулга</Label>
                <Textarea id="short_description" name="short_description" maxLength={600} defaultValue={profile.shortDescription} className="min-h-24 border-zinc-700 bg-zinc-900 text-white" />
                <p className="text-sm text-zinc-400">Footer болон дараагийн холбоо барих хэсэгт харагдана.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="public_email">Нийтийн и-мэйл</Label>
                    <Input id="public_email" name="public_email" type="email" maxLength={320} defaultValue={profile.publicEmail} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Утас</Label>
                    <Input id="phone" name="phone" type="tel" maxLength={50} defaultValue={profile.phone} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="address">Хаяг</Label>
                    <Textarea id="address" name="address" maxLength={500} defaultValue={profile.address} className="min-h-24 border-zinc-700 bg-zinc-900 text-white" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="business_hours">Ажлын цаг</Label>
                    <Textarea id="business_hours" name="business_hours" maxLength={200} defaultValue={profile.businessHours} className="min-h-24 border-zinc-700 bg-zinc-900 text-white" />
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="facebook_url">Facebook холбоос</Label>
                    <Input id="facebook_url" name="facebook_url" type="url" inputMode="url" defaultValue={profile.facebookUrl} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="instagram_url">Instagram холбоос</Label>
                    <Input id="instagram_url" name="instagram_url" type="url" inputMode="url" defaultValue={profile.instagramUrl} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="website_url">Албан ёсны вебсайт / домэйн</Label>
                <Input id="website_url" name="website_url" type="url" inputMode="url" defaultValue={profile.websiteUrl} className="border-zinc-700 bg-zinc-900 text-white" />
                <p className="text-sm text-zinc-400">Баталгаатай HTTPS холбоос оруулна. Нууц үг, токен, банкны нууц мэдээлэл оруулахгүй.</p>
            </div>

            {message && (
                <p className={message.type === 'error' ? 'text-sm font-medium text-red-400' : 'text-sm font-medium text-emerald-400'}>{message.text}</p>
            )}

            <SaveButton />
        </form>
    )
}
