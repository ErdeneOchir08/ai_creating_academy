'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram/notifications'
import { isSmtpConfigured, sendSmtpTestEmail } from '@/lib/email/smtp-test'
import {
    contractIssuerProfileFromFormData,
    contractIssuerProfileSchema,
    type ContractIssuerProfile,
} from '@/features/admin/domain/contract-issuer'

export type PaymentConfiguration = {
    instructions: string
    isTestMode: boolean
}

export type AcademyProfile = {
    displayName: string
    shortDescription: string
    publicEmail: string
    phone: string
    address: string
    businessHours: string
    facebookUrl: string
    instagramUrl: string
    websiteUrl: string
}

const defaultConfiguration: PaymentConfiguration = {
    instructions: '',
    isTestMode: false,
}

const defaultAcademyProfile: AcademyProfile = {
    displayName: 'Mind Academy',
    shortDescription: '',
    publicEmail: '',
    phone: '',
    address: '',
    businessHours: '',
    facebookUrl: 'https://www.facebook.com/mmindcodeacademy',
    instagramUrl: 'https://www.instagram.com/mindcode_academy/',
    websiteUrl: '',
}

// Compatibility exports for the unused legacy landing-page customizer.
export async function getAppSettings(): Promise<Record<string, string>> {
    return {}
}

export async function updateAppSetting(_id: string, _value: string) {
    void _id
    void _value
    return { success: false, error: 'Global settings are not available in this launch version.' }
}

export async function getAcademyProfile(): Promise<AcademyProfile> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('academy_profile')
        .select('display_name, short_description, public_email, phone, address, business_hours, facebook_url, instagram_url, website_url')
        .eq('id', true)
        .maybeSingle()

    if (error || !data) {
        if (error) console.error('Unable to load academy profile:', error.message)
        return defaultAcademyProfile
    }

    return {
        displayName: data.display_name,
        shortDescription: data.short_description,
        publicEmail: data.public_email,
        phone: data.phone,
        address: data.address,
        businessHours: data.business_hours,
        facebookUrl: data.facebook_url,
        instagramUrl: data.instagram_url,
        websiteUrl: data.website_url,
    }
}

function readText(formData: FormData, name: string, maximumLength: number) {
    const value = String(formData.get(name) ?? '').trim()
    if (value.length > maximumLength) throw new Error(`${name} is too long`)
    return value
}

function readOptionalHttpsUrl(formData: FormData, name: string) {
    const value = readText(formData, name, 2_000)
    if (!value) return ''

    try {
        const url = new URL(value)
        if (url.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed')
        return url.toString()
    } catch {
        throw new Error(`${name} must be a valid HTTPS URL`)
    }
}

export async function updateAcademyProfile(formData: FormData) {
    const supabase = await requireAdmin()

    try {
        const displayName = readText(formData, 'display_name', 120)
        const shortDescription = readText(formData, 'short_description', 600)
        const publicEmail = readText(formData, 'public_email', 320)
        const phone = readText(formData, 'phone', 50)
        const address = readText(formData, 'address', 500)
        const businessHours = readText(formData, 'business_hours', 200)
        const facebookUrl = readOptionalHttpsUrl(formData, 'facebook_url')
        const instagramUrl = readOptionalHttpsUrl(formData, 'instagram_url')
        const websiteUrl = readOptionalHttpsUrl(formData, 'website_url')

        if (!displayName) return { error: 'Академийн нэрийг оруулна уу.' }
        if (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail)) {
            return { error: 'Нийтийн и-мэйл хаяг буруу байна.' }
        }

        const { error } = await supabase
            .from('academy_profile')
            .update({
                display_name: displayName,
                short_description: shortDescription,
                public_email: publicEmail,
                phone,
                address,
                business_hours: businessHours,
                facebook_url: facebookUrl,
                instagram_url: instagramUrl,
                website_url: websiteUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', true)

        if (error) {
            console.error('Unable to update academy profile:', error.message)
            return { error: 'Академийн мэдээллийг хадгалж чадсангүй. Дахин оролдоно уу.' }
        }
    } catch {
        return { error: 'Холбоосын мэдээллээ шалгана уу. Зөвхөн хүчинтэй HTTPS холбоос хадгална.' }
    }

    revalidatePath('/', 'layout')
    revalidatePath('/admin/settings')
    return { success: 'Академийн мэдээлэл шинэчлэгдлээ.' }
}

export async function getContractIssuerProfile(): Promise<ContractIssuerProfile> {
    const supabase = await requireAdmin()
    const { data, error } = await supabase
        .from('contract_issuer_profile')
        .select('legal_name, representative_name, phone, address, bank_name, bank_account_number, bank_account_holder')
        .eq('id', true)
        .single()

    if (error || !data) {
        console.error('Unable to load contract issuer profile:', error?.message)
        throw new Error('Гэрээ байгуулагчийн мэдээллийг ачаалж чадсангүй.')
    }

    return contractIssuerProfileSchema.parse({
        legalName: data.legal_name,
        representativeName: data.representative_name,
        phone: data.phone,
        address: data.address,
        bankName: data.bank_name,
        bankAccountNumber: data.bank_account_number,
        bankAccountHolder: data.bank_account_holder,
    })
}

export async function updateContractIssuerProfile(formData: FormData) {
    const supabase = await requireAdmin()

    try {
        const profile = contractIssuerProfileFromFormData(formData)
        const { error } = await supabase
            .from('contract_issuer_profile')
            .update({
                legal_name: profile.legalName,
                representative_name: profile.representativeName,
                phone: profile.phone,
                address: profile.address,
                bank_name: profile.bankName,
                bank_account_number: profile.bankAccountNumber,
                bank_account_holder: profile.bankAccountHolder,
                updated_at: new Date().toISOString(),
            })
            .eq('id', true)

        if (error) {
            console.error('Unable to update contract issuer profile:', error.message)
            return { error: 'Гэрээ байгуулагчийн мэдээллийг хадгалж чадсангүй. Дахин оролдоно уу.' }
        }
    } catch {
        return { error: 'Гэрээ байгуулагчийн бүх талбарыг зөв, бүрэн бөглөнө үү.' }
    }

    revalidatePath('/admin/settings')
    return { success: 'Гэрээ байгуулагчийн мэдээлэл шинэчлэгдлээ.' }
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

    if (role?.role !== 'admin') throw new Error('Not authorized')
    return supabase
}

export async function getPaymentConfiguration(): Promise<PaymentConfiguration> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('payment_configuration')
        .select('instructions, is_test_mode')
        .eq('id', true)
        .maybeSingle()

    if (error || !data) {
        if (error) console.error('Unable to load payment configuration:', error.message)
        return defaultConfiguration
    }

    return {
        instructions: data.instructions,
        isTestMode: data.is_test_mode,
    }
}

export async function updatePaymentConfiguration(formData: FormData) {
    const supabase = await requireAdmin()
    const instructions = String(formData.get('instructions') ?? '').trim()
    const isTestMode = formData.get('is_test_mode') === 'on'

    if (!instructions) {
        return { error: 'Төлбөрийн зааврыг оруулна уу.' }
    }
    if (instructions.length > 2_000) {
        return { error: 'Төлбөрийн заавар 2,000 тэмдэгтээс урт байж болохгүй.' }
    }

    const { error } = await supabase
        .from('payment_configuration')
        .update({ instructions, is_test_mode: isTestMode, updated_at: new Date().toISOString() })
        .eq('id', true)

    if (error) {
        console.error('Unable to update payment configuration:', error.message)
        return { error: 'Төлбөрийн тохиргоог хадгалж чадсангүй. Дахин оролдоно уу.' }
    }

    revalidatePath('/admin/settings')
    revalidatePath('/course/[id]', 'page')
    revalidatePath('/courses/[id]', 'page')
    return { success: 'Төлбөрийн тохиргоо хадгалагдлаа.' }
}

export async function getTelegramNotificationStatus() {
    await requireAdmin()
    return { configured: isTelegramConfigured() }
}

export async function sendTelegramTestAlert() {
    await requireAdmin()
    const result = await sendTelegramMessage('✅ Mind Academy Telegram мэдэгдлийн туршилт амжилттай илгээгдлээ.')
    if (!result.sent) return { error: 'Telegram туршилтын мэдэгдэл илгээгдсэнгүй. Тохиргоог шалгана уу.' }
    return { success: 'Telegram туршилтын мэдэгдэл илгээгдлээ.' }
}

export async function getSmtpNotificationStatus() {
    await requireAdmin()
    return { configured: isSmtpConfigured() }
}

export async function sendSmtpTestAlert(formData: FormData) {
    await requireAdmin()
    const recipient = String(formData.get('recipient') ?? '').trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 320) {
        return { error: 'Хүлээн авах и-мэйл хаягаа зөв оруулна уу.' }
    }

    const result = await sendSmtpTestEmail(recipient)
    if (!result.sent) return { error: result.error }
    return { success: 'Туршилтын и-мэйл амжилттай илгээгдлээ.' }
}
