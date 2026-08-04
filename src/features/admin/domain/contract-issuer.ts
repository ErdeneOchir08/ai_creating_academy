import { z } from 'zod'

export const contractIssuerProfileSchema = z.object({
    legalName: z.string().trim().min(1).max(240),
    representativeName: z.string().trim().min(1).max(240),
    phone: z.string().trim().min(1).max(50),
    address: z.string().trim().min(1).max(500),
    bankName: z.string().trim().min(1).max(120),
    bankAccountNumber: z.string().trim().min(1).max(80),
    bankAccountHolder: z.string().trim().min(1).max(240),
})

export type ContractIssuerProfile = z.infer<typeof contractIssuerProfileSchema>

export function contractIssuerProfileFromFormData(formData: FormData) {
    return contractIssuerProfileSchema.parse({
        legalName: formData.get('legal_name'),
        representativeName: formData.get('representative_name'),
        phone: formData.get('contract_phone'),
        address: formData.get('contract_address'),
        bankName: formData.get('bank_name'),
        bankAccountNumber: formData.get('bank_account_number'),
        bankAccountHolder: formData.get('bank_account_holder'),
    })
}
