import { AdminSidebar } from '@/features/admin/components/admin-sidebar'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

    if (role?.role !== 'admin') redirect('/dashboard')

    return (
        <div className="relative flex min-h-[calc(100vh-64px)] flex-col overflow-x-hidden bg-[#09090b] md:flex-row">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden blur-[100px] opacity-20 pointer-events-none select-none z-0">
                <div className="absolute top-1/2 right-1/4 w-1/2 h-1/2 rounded-full bg-indigo-600/30 mix-blend-screen animate-pulse" style={{ animationDuration: '11s' }} />
                <div className="absolute -bottom-1/4 left-1/4 w-1/2 h-1/2 rounded-full bg-pink-600/20 mix-blend-screen animate-pulse" style={{ animationDuration: '9s' }} />
            </div>

            {/* Mobile Header / Sidebar Toggle */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md relative z-10">
                <span className="font-bold text-white">Админ Дашбоард</span>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400" aria-label="Админ цэсийг нээх">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64 border-zinc-800 bg-zinc-950">
                        <VisuallyHidden.Root>
                            <SheetTitle>Админ Цэс</SheetTitle>
                            <SheetDescription>Админ дашбоардын цэсийн холбоосууд.</SheetDescription>
                        </VisuallyHidden.Root>
                        <AdminSidebar isMobile={true} />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:block relative z-10">
                <AdminSidebar />
            </div>

            <main className="relative z-10 w-full min-w-0 flex-1">
                {children}
            </main>
        </div>
    )
}
