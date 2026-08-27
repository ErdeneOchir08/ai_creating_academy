import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.string().uuid()

export async function GET(request: Request) {
    const applicationId = querySchema.safeParse(new URL(request.url).searchParams.get('applicationId'))
    if (!applicationId.success) return Response.json({ error: 'Invalid application.' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 })

    const { data, error } = await supabase
        .from('course_offering_payments')
        .select('id, status, amount_mnt, sender_invoice_no, qpay_invoice_id, qpay_short_url, qpay_qr_text, qpay_qr_image, qpay_urls, expires_at, provider_paid_at')
        .eq('application_id', applicationId.data)
        .eq('provider', 'qpay')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (error) return Response.json({ error: 'Unable to load payment status.' }, { status: 500 })

    return Response.json({ payment: data }, {
        headers: { 'Cache-Control': 'private, no-store' },
    })
}
