import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export async function removeFailedPaymentReceipt(receiptPath: string) {
    try {
        const admin = createAdminClient()
        const { error } = await admin.storage.from('payment-receipts').remove([receiptPath])
        if (error) console.error('Payment receipt cleanup failed:', error.message)
    } catch (error) {
        console.error('Payment receipt cleanup could not start:', error instanceof Error ? error.message : error)
    }
}
