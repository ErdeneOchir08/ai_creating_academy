'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EmailConfirmationPage() {
    const router = useRouter()
    const [message, setMessage] = useState('И-мэйл баталгаажуулж байна...')

    useEffect(() => {
        const confirmAndRedirect = async () => {
            const supabase = createClient()
            const { data: { user }, error } = await supabase.auth.getUser()

            if (error || !user) {
                router.replace('/login?confirmed=1')
                return
            }

            const { data: roleRecord } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .maybeSingle()

            setMessage('Баталгаажлаа. Нэвтрүүлж байна...')
            router.replace(roleRecord?.role === 'admin' ? '/admin' : '/dashboard')
        }

        void confirmAndRedirect()
    }, [router])

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-white">
            <p className="text-center text-zinc-300">{message}</p>
        </main>
    )
}
