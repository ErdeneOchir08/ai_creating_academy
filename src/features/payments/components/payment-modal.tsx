'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UploadCloud, CheckCircle2, Sparkles, Ticket, Lock } from 'lucide-react'
import { submitPaymentRequest } from '@/features/payments/actions/payment-actions'
import { redeemXpForDiscount } from '@/features/dashboard/actions/reward-actions'

/**
 * Note: In a real app, this file upload input would upload the file to Supabase Storage Bucket ('receipts') 
 * first, get the URL, and then call submitPaymentRequest with that URL.
 * 
 * For simplicity in this structure demo, we'll simulate the upload and pass a dummy URL.
 */

export function PaymentModal({
    courseId,
    coursePrice = "$19.99",
    discountPercentage = 0,
    discountId = null,
    totalXP = 0
}: {
    courseId: string,
    coursePrice?: string,
    discountPercentage?: number,
    discountId?: string | null,
    totalXP?: number
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [rewardError, setRewardError] = useState('')
    const [redeemingAmount, setRedeemingAmount] = useState<number | null>(null)

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setErrorMsg('')
        setLoading(true)

        const form = e.currentTarget
        const formData = new FormData(form)

        if (discountId) {
            formData.append('discountId', discountId)
        }

        // Calling our server action to actually upload the file
        const res = await submitPaymentRequest(courseId, formData)

        if (res.success) {
            setSuccess(true)
        } else {
            setErrorMsg(res.error || 'Something went wrong')
        }
        setLoading(false)
    }

    // Calculate discounted price
    const numericPrice = parseFloat(coursePrice.replace(/[^0-9.]/g, '')) || 0
    let finalPrice = coursePrice
    let savings = 0
    if (discountPercentage > 0 && numericPrice > 0) {
        savings = numericPrice * (discountPercentage / 100)
        finalPrice = `$${(numericPrice - savings).toFixed(2)}`
    }

    const availableTiers = [
        { cost: 1000, discount: 10 },
        { cost: 2000, discount: 20 },
        { cost: 3000, discount: 30 },
    ]

    const handleRedeemDiscount = async (cost: number, discount: number) => {
        setRedeemingAmount(cost)
        setRewardError('')

        const result = await redeemXpForDiscount(cost, discount)

        if (result.error) {
            setRewardError(result.error)
        }
        setRedeemingAmount(null)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex flex-col items-center justify-center h-auto py-3">
                    <span className="text-lg">Enroll Now - {finalPrice}</span>
                    {discountPercentage > 0 && (
                        <span className="text-xs text-indigo-200 mt-1 line-through opacity-70">
                            Original: {coursePrice}
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-white">
                {!success ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl">Manual Payment Instructions</DialogTitle>
                            <DialogDescription className="text-zinc-400 mt-2">
                                {discountPercentage > 0 && (
                                    <span className="block mb-2 text-indigo-400 font-medium">
                                        ✨ {discountPercentage}% XP Reward Applied! You save ${savings.toFixed(2)}.
                                    </span>
                                )}
                                To enroll, please scan the QR code below or transfer <strong className="text-white">{finalPrice}</strong> to the following bank account:
                            </DialogDescription>
                        </DialogHeader>

                        {discountPercentage === 0 && totalXP !== undefined && totalXP >= 1000 && (
                            <div className="bg-zinc-900/50 p-4 rounded-xl border border-indigo-500/20 mt-4 space-y-3">
                                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" /> Apply XP Discount
                                </h3>
                                <p className="text-xs text-zinc-400">You have {totalXP?.toLocaleString()} XP available. Instantly apply a discount to this purchase.</p>

                                {rewardError && <p className="text-xs text-red-500 font-medium">{rewardError}</p>}

                                <div className="grid grid-cols-3 gap-2">
                                    {availableTiers.map((tier) => {
                                        const canAfford = (totalXP || 0) >= tier.cost
                                        const isRedeeming = redeemingAmount === tier.cost

                                        return (
                                            <Button
                                                key={tier.discount}
                                                type="button"
                                                variant="outline"
                                                onClick={() => handleRedeemDiscount(tier.cost, tier.discount)}
                                                disabled={!canAfford || isRedeeming || redeemingAmount !== null}
                                                className={`h-auto py-2 flex flex-col gap-1 items-center border ${canAfford ? 'border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300' : 'border-zinc-800 opacity-50 bg-zinc-900'}`}
                                            >
                                                {canAfford ? <Ticket className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                                <span className="font-bold text-sm">{tier.discount}% Off</span>
                                                <span className="text-[10px] text-zinc-500">{tier.cost} XP</span>
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="bg-zinc-900 p-4 rounded-md border border-zinc-800 text-center space-y-2 mt-4">
                            <p className="font-mono text-indigo-400">BANK: CHASE</p>
                            <p className="font-mono text-indigo-400">ACCOUNT: 1234-5678-9000-0000</p>
                            <p className="font-mono text-indigo-400">NAME: AI Creator Academy</p>
                        </div>

                        <form onSubmit={handleUpload} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="receipt">Upload Payment Receipt / Screenshot</Label>
                                <div className="flex items-center gap-2">
                                    <Input id="receipt" name="receipt" type="file" required accept="image/*" className="bg-zinc-800 border-zinc-700 file:text-indigo-400" />
                                </div>
                            </div>
                            {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 h-10" disabled={loading}>
                                {loading ? "Uploading..." : "Submit Proof of Payment"}
                            </Button>
                        </form>
                    </>
                ) : (
                    <div className="py-8 text-center flex flex-col items-center">
                        <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
                        <DialogTitle className="text-2xl mb-2">Receipt Submitted!</DialogTitle>
                        <p className="text-zinc-400 mb-6">
                            Our admin team will review your payment shortly. Once approved, the course will automatically appear in your Dashboard.
                        </p>
                        <Button onClick={() => setOpen(false)} variant="outline" className="border-zinc-700 bg-transparent text-white hover:bg-zinc-800">
                            Got it
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
