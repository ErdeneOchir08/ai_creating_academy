'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Ticket, Lock, Sparkles, Plus } from 'lucide-react'
import { redeemXpForDiscount } from '../actions/reward-actions'

type RewardRedemptionStoreProps = {
    totalXP: number
}

const REWARD_TIERS = [
    { cost: 1000, discount: 10, title: '10% Discount Code' },
    { cost: 2000, discount: 20, title: '20% Discount Code' },
    { cost: 3000, discount: 30, title: '30% Discount Code' },
]

export function RewardRedemptionStore({ totalXP }: RewardRedemptionStoreProps) {
    const [loadingTier, setLoadingTier] = useState<number | null>(null)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    const handleRedeem = async (cost: number, discount: number) => {
        setLoadingTier(cost)
        setMessage(null)

        const result = await redeemXpForDiscount(cost, discount)

        if (result.error) {
            setMessage({ text: result.error, type: 'error' })
        } else if (result.success) {
            setMessage({ text: result.success, type: 'success' })
        }

        setLoadingTier(null)
    }

    return (
        <Card className="bg-zinc-950/80 border-indigo-500/20 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full" />

            <CardHeader>
                <CardTitle className="text-2xl font-bold flex items-center gap-2 text-white">
                    <Sparkles className="h-6 w-6 text-indigo-400" /> XP Rewards Store
                </CardTitle>
                <CardDescription className="text-zinc-400 text-base">
                    Cash in your hard-earned XP for discounts on your next course enrollment.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {message && (
                    <div className={`p-4 rounded-xl mb-6 font-medium ${message.type === 'success' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {REWARD_TIERS.map((tier) => {
                        const canAfford = totalXP >= tier.cost
                        const isRedeeming = loadingTier === tier.cost

                        return (
                            <div key={tier.discount} className={`relative p-6 rounded-2xl border ${canAfford ? 'bg-gradient-to-br from-indigo-950/40 to-black border-indigo-500/30' : 'bg-zinc-900/50 border-zinc-800'} flex flex-col items-center text-center transition-all ${canAfford ? 'hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-500/10' : 'opacity-80'}`}>
                                <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${canAfford ? 'bg-indigo-500/20 text-indigo-400 shadow-inner' : 'bg-zinc-800 text-zinc-500'}`}>
                                    {canAfford ? <Ticket className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
                                </div>
                                <h4 className="text-xl font-bold text-white mb-2">{tier.discount}% Off</h4>
                                <p className={`text-sm font-semibold mb-6 ${canAfford ? 'text-indigo-300' : 'text-zinc-500'}`}>
                                    Cost: {tier.cost.toLocaleString()} XP
                                </p>

                                <Button
                                    onClick={() => handleRedeem(tier.cost, tier.discount)}
                                    disabled={!canAfford || isRedeeming}
                                    className={`w-full mt-auto rounded-xl font-bold transition-all ${canAfford ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-800 cursor-not-allowed'}`}
                                >
                                    {isRedeeming ? 'Redeeming...' : canAfford ? 'Unlock Reward' : 'Not enough XP'}
                                </Button>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
