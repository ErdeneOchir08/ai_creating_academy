'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSafeReturnPath, withReturnPath } from '@/lib/auth/return-path'
import { createClient } from '@/lib/supabase/server'

async function getAuthRedirectUrl(
    path: '/auth/confirm' | '/auth/reset-password',
    returnPath?: string | null,
) {
    const requestHeaders = await headers()
    const origin = requestHeaders.get('origin')
    const redirectPath = withReturnPath(path, returnPath)

    if (origin) {
        try {
            return new URL(redirectPath, origin).toString()
        } catch {
            return undefined
        }
    }

    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
    if (!host) return undefined

    const protocol = requestHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${protocol}://${host}${redirectPath}`
}

function authErrorMessage(message: string) {
    if (message.includes('Invalid login credentials')) return 'И-мэйл хаяг эсвэл нууц үг буруу байна.'
    if (message.includes('Email not confirmed')) return 'И-мэйл хаягаа баталгаажуулна уу.'
    if (message.includes('User already registered')) return 'Энэ и-мэйл хаяг аль хэдийн бүртгэлтэй байна.'
    if (message.includes('Password should be')) return 'Нууц үг шаардлагыг хангахгүй байна.'
    return 'Үйлдлийг гүйцэтгэж чадсангүй. Дахин оролдоно уу.'
}

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const returnPath = getSafeReturnPath(formData.get('next'))
    if (!email || !password) return { error: 'И-мэйл хаяг болон нууц үгээ оруулна уу.' }

    const data = {
        email,
        password,
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        return { error: authErrorMessage(error.message) }
    }

    // Determine redirect based on role
    let redirectUrl = '/dashboard'
    if (authData?.user) {
        const { data: roleRecord } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', authData.user.id)
            .single()

        if (roleRecord?.role === 'admin') {
            redirectUrl = '/admin'
        }
    }

    revalidatePath('/', 'layout')
    redirect(returnPath ?? redirectUrl)
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const fullName = String(formData.get('full_name') ?? '').trim()
    const returnPath = getSafeReturnPath(formData.get('next'))
    if (!email || !password || !fullName) return { error: 'Нэр, и-мэйл хаяг, нууц үгээ бүрэн оруулна уу.' }
    if (password.length < 8) return { error: 'Нууц үг дор хаяж 8 тэмдэгттэй байх ёстой.' }

    const emailRedirectTo = await getAuthRedirectUrl('/auth/confirm', returnPath)
    const data = {
        email,
        password,
        options: {
            ...(emailRedirectTo ? { emailRedirectTo } : {}),
            data: {
                full_name: fullName,
            }
        }
    }

    const { data: signUpData, error } = await supabase.auth.signUp(data)

    if (error) {
        return { error: authErrorMessage(error.message) }
    }

    if (!signUpData.session) {
        return { success: 'И-мэйл хаяг руу илгээсэн холбоосоор бүртгэлээ баталгаажуулаад нэвтэрнэ үү.' }
    }

    revalidatePath('/', 'layout')
    redirect(returnPath ?? '/dashboard')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}

export async function updateProfileName(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Та нэвтрээгүй байна.' }
    }

    const full_name = String(formData.get('full_name') ?? '').trim()

    if (!full_name) {
        return { error: 'Овог нэрээ оруулна уу.' }
    }

    const { error } = await supabase
        .from('profiles')
        .update({ display_name: full_name })
        .eq('id', user.id)

    if (error) {
        return { error: 'Профайлыг шинэчилж чадсангүй. Дахин оролдоно уу.' }
    }

    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard', 'layout')

    return { success: 'Профайл амжилттай шинэчлэгдлээ.' }
}

export async function updatePassword(formData: FormData) {
    const supabase = await createClient()
    const password = formData.get('password') as string

    if (!password || password.length < 8) {
        return { error: 'Нууц үг дор хаяж 8 тэмдэгттэй байх ёстой.' }
    }

    const { error } = await supabase.auth.updateUser({
        password: password
    })

    if (error) {
        return { error: authErrorMessage(error.message) }
    }

    revalidatePath('/dashboard/settings')

    return { success: 'Нууц үг амжилттай шинэчлэгдлээ.' }
}

export async function requestPasswordReset(formData: FormData) {
    const supabase = await createClient()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    if (!email) return { error: 'И-мэйл хаягаа оруулна уу.' }

    const redirectTo = await getAuthRedirectUrl('/auth/reset-password')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        ...(redirectTo ? { redirectTo } : {}),
    })

    if (error) {
        console.error('Password reset request failed:', error.message)
        return { error: 'Нууц үг сэргээх и-мэйл илгээж чадсангүй. Дахин оролдоно уу.' }
    }

    return { success: 'Энэ хаяг бүртгэлтэй бол нууц үг сэргээх холбоос и-мэйлээр илгээгдэнэ.' }
}

export async function completePasswordRecovery(password: string) {
    if (!password || password.length < 8) {
        return { error: 'Нууц үг дор хаяж 8 тэмдэгттэй байх ёстой.' }
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        return { error: 'Нууц үг сэргээх холбоосын хугацаа дууссан байна. Шинэ холбоос хүснэ үү.' }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
        console.error('Password recovery update failed:', error.message)

        if (error.message.includes('Password should be')) {
            return { error: 'Нууц үг шаардлагыг хангахгүй байна. Илүү урт, өмнө нь ашиглаагүй нууц үг сонгоно уу.' }
        }

        if (error.message.includes('different from the old password')) {
            return { error: 'Шинэ нууц үг нь өмнөх нууц үгээс өөр байх ёстой.' }
        }

        return { error: 'Нууц үгийг шинэчилж чадсангүй. Шинэ сэргээх холбоос хүсээд дахин оролдоно уу.' }
    }

    await supabase.auth.signOut()
    return { success: true }
}
