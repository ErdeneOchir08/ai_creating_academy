import { describe, expect, it } from 'vitest'
import { contractIssuerProfileFromFormData, contractIssuerProfileSchema } from './contract-issuer'

const validProfile = {
    legalName: 'Майнд Аженси Эл И ХХК',
    representativeName: 'Ж.Эрдэнэчимэг',
    phone: '+976 8045 6060',
    address: 'Улаанбаатар хот',
    bankName: 'Хаан банк',
    bankAccountNumber: 'MN560005005475336658',
    bankAccountHolder: 'Майнд Аженси Эл И',
}

describe('contract issuer profile', () => {
    it('accepts a complete issuer profile', () => {
        expect(contractIssuerProfileSchema.parse(validProfile)).toEqual(validProfile)
    })

    it('trims values read from the admin form', () => {
        const formData = new FormData()
        formData.set('legal_name', `  ${validProfile.legalName}  `)
        formData.set('representative_name', validProfile.representativeName)
        formData.set('contract_phone', validProfile.phone)
        formData.set('contract_address', validProfile.address)
        formData.set('bank_name', validProfile.bankName)
        formData.set('bank_account_number', validProfile.bankAccountNumber)
        formData.set('bank_account_holder', validProfile.bankAccountHolder)

        expect(contractIssuerProfileFromFormData(formData).legalName).toBe(validProfile.legalName)
    })

    it('rejects an incomplete legal profile before it reaches the database', () => {
        expect(() => contractIssuerProfileSchema.parse({ ...validProfile, representativeName: '' })).toThrow()
    })
})
