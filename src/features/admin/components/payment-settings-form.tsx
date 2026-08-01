'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updatePaymentConfiguration, type PaymentConfiguration } from '@/features/admin/actions/settings-actions.admin'

function SaveButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {pending ? 'Хадгалж байна...' : 'Хадгалах'}
        </Button>
    )
}

export function PaymentSettingsForm({ configuration }: { configuration: PaymentConfiguration }) {
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    async function action(formData: FormData) {
        setMessage(null)
        const result = await updatePaymentConfiguration(formData)
        if (result.error) setMessage({ type: 'error', text: result.error })
        if (result.success) setMessage({ type: 'success', text: result.success })
    }

    return (
        <form action={action} className="space-y-5">
            <div className="space-y-2">
                <Label htmlFor="instructions">Төлбөрийн заавар</Label>
                <Textarea
                    id="instructions"
                    name="instructions"
                    required
                    maxLength={2000}
                    defaultValue={configuration.instructions}
                    className="min-h-44 border-zinc-700 bg-zinc-900 text-white"
                />
                <p className="text-sm text-zinc-400">Банк, данс эзэмшигч, дансны дугаар, гүйлгээний утга эсвэл QR заавраа бичнэ үү.</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <input name="is_test_mode" type="checkbox" defaultChecked={configuration.isTestMode} className="mt-0.5 h-4 w-4 accent-amber-500" />
                <span>
                    <strong className="block">Туршилтын горим</strong>
                    Идэвхтэй үед суралцагчид бодит шилжүүлэг хийхгүй байх анхааруулгыг харна. Бодит мэдээллээ оруулсны дараа үүнийг унтраана уу.
                </span>
            </label>

            {message && (
                <p className={message.type === 'error' ? 'text-sm font-medium text-red-400' : 'text-sm font-medium text-emerald-400'}>{message.text}</p>
            )}

            <SaveButton />
        </form>
    )
}
