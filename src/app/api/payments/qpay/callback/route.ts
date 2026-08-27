import { z } from 'zod'
import { reconcileCourseOfferingQpayPayment } from '@/features/checkout/server/qpay-reconciliation'

const callbackSchema = z.object({
    attempt: z.string().uuid(),
    token: z.string().min(20).max(200),
})

async function handleCallback(request: Request) {
    const url = new URL(request.url)
    const parsed = callbackSchema.safeParse({
        attempt: url.searchParams.get('attempt'),
        token: url.searchParams.get('token'),
    })
    if (!parsed.success) return Response.json({ received: false }, { status: 400 })

    try {
        const result = await reconcileCourseOfferingQpayPayment(parsed.data.attempt, {
            callbackToken: parsed.data.token,
        })
        return Response.json({ received: true, payment_status: result.status }, {
            status: result.status === 'paid' ? 200 : 202,
            headers: { 'Cache-Control': 'no-store' },
        })
    } catch (error) {
        console.error('QPay callback processing failed:', error instanceof Error ? error.message : 'unknown error')
        const unauthorized = error instanceof Error && error.message.includes('token')
        return Response.json({ received: false }, { status: unauthorized ? 401 : 500 })
    }
}

export const GET = handleCallback
export const POST = handleCallback
