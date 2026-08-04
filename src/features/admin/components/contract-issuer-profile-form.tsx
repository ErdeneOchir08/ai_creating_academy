'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateContractIssuerProfile } from '@/features/admin/actions/settings-actions.admin'
import type { ContractIssuerProfile } from '@/features/admin/domain/contract-issuer'

function SaveButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {pending ? 'Хадгалж байна...' : 'Гэрээний мэдээлэл хадгалах'}
        </Button>
    )
}

export function ContractIssuerProfileForm({ profile }: { profile: ContractIssuerProfile }) {
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    async function action(formData: FormData) {
        setMessage(null)
        const result = await updateContractIssuerProfile(formData)
        if (result.error) setMessage({ type: 'error', text: result.error })
        if (result.success) setMessage({ type: 'success', text: result.success })
    }

    return (
        <form action={action} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="legal_name">Гэрээ байгуулагч хуулийн этгээд</Label>
                    <Input id="legal_name" name="legal_name" required maxLength={240} defaultValue={profile.legalName} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="representative_name">Эрх бүхий төлөөлөгч</Label>
                    <Input id="representative_name" name="representative_name" required maxLength={240} defaultValue={profile.representativeName} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="contract_phone">Гэрээнд бичигдэх утас</Label>
                    <Input id="contract_phone" name="contract_phone" type="tel" required maxLength={50} defaultValue={profile.phone} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="contract_address">Гэрээнд бичигдэх албан ёсны хаяг</Label>
                    <Textarea id="contract_address" name="contract_address" required maxLength={500} defaultValue={profile.address} className="min-h-20 border-zinc-700 bg-zinc-900 text-white" />
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="bank_name">Банкны нэр</Label>
                    <Input id="bank_name" name="bank_name" required maxLength={120} defaultValue={profile.bankName} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bank_account_number">Дансны дугаар</Label>
                    <Input id="bank_account_number" name="bank_account_number" required maxLength={80} defaultValue={profile.bankAccountNumber} className="border-zinc-700 bg-zinc-900 text-white" />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="bank_account_holder">Данс эзэмшигч</Label>
                <Input id="bank_account_holder" name="bank_account_holder" required maxLength={240} defaultValue={profile.bankAccountHolder} className="border-zinc-700 bg-zinc-900 text-white" />
                <p className="text-sm leading-relaxed text-zinc-400">
                    Эдгээр утга гэрээ зөвшөөрөх мөчид өөрчлөгдөхгүй аудитын хуулбарт хадгалагдана. Банкны мэдээллийг зөвхөн эрх бүхий админ өөрчилнө.
                </p>
            </div>

            {message && (
                <p className={message.type === 'error' ? 'text-sm font-medium text-red-400' : 'text-sm font-medium text-emerald-400'}>{message.text}</p>
            )}

            <SaveButton />
        </form>
    )
}
