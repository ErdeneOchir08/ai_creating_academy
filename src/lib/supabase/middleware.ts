import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSafeReturnPath } from '@/lib/auth/return-path'

export async function updateSession(request: NextRequest) {
    const recoveryCode = request.nextUrl.pathname === '/auth/reset-password'
        ? request.nextUrl.searchParams.get('code')
        : null

    if (recoveryCode) {
        const recoveryUrl = request.nextUrl.clone()
        recoveryUrl.search = ''
        recoveryUrl.searchParams.set('recovery', '1')

        const recoveryResponse = NextResponse.redirect(recoveryUrl)
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_ACADEMY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_ACADEMY_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            recoveryResponse.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(recoveryCode)
        if (error) {
            const failedUrl = request.nextUrl.clone()
            failedUrl.pathname = '/forgot-password'
            failedUrl.search = 'reset=expired'
            return NextResponse.redirect(failedUrl)
        }

        return recoveryResponse
    }

    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_ACADEMY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_ACADEMY_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // refreshing the auth token
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Define protected routes
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/admin')
    const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')

    if (isProtectedRoute && !user) {
        const url = request.nextUrl.clone()
        const returnPath = getSafeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`)
        url.pathname = '/login'
        url.search = ''
        if (returnPath) url.searchParams.set('next', returnPath)
        return NextResponse.redirect(url)
    }

    if (isAuthRoute && user) {
        const { data: roleRecord } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle()
        const returnPath = getSafeReturnPath(request.nextUrl.searchParams.get('next'))
        const fallbackPath = roleRecord?.role === 'admin' ? '/admin' : '/dashboard'
        return NextResponse.redirect(new URL(returnPath ?? fallbackPath, request.url))
    }

    return supabaseResponse
}
