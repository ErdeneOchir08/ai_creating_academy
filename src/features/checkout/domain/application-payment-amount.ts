// Never fall back to the current catalogue price for an existing application.
export function applicationPaymentAmount(application: { tuition_amount_mnt_snapshot?: number }) {
    const amount = application.tuition_amount_mnt_snapshot
    if (amount === undefined || !Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error('Хүсэлтийн төлбөрийн дүнг баталгаажуулж чадсангүй. Дахин ачаална уу.')
    }
    return amount
}
