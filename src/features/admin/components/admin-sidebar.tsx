'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, BookOpen, CreditCard, LogOut, Settings, MessageSquareText, Tags, FileSignature, CalendarRange, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const adminLinks = [
    { name: 'Тойм', href: '/admin', icon: LayoutDashboard },
    { name: 'Сургалтууд', href: '/admin/programs', icon: CalendarRange },
    { name: 'Хичээлийн контент', href: '/admin/courses', icon: BookOpen },
    { name: 'Ангиллууд', href: '/admin/categories', icon: Tags },
    { name: 'Элсэлтийн хүсэлтүүд', href: '/admin/applications', icon: ClipboardList },
    { name: 'Төлбөрүүд', href: '/admin/payments', icon: CreditCard },
    { name: 'Гэрээнүүд', href: '/admin/contracts', icon: FileSignature },
    { name: 'Хэрэглэгчид', href: '/admin/users', icon: Users },
    { name: 'Асуулт, хариулт', href: '/admin/qa', icon: MessageSquareText },
    { name: 'Тохиргоо', href: '/admin/settings', icon: Settings },
]

export function AdminSidebar({ isMobile = false }: { isMobile?: boolean }) {
    const pathname = usePathname()

    return (
        <aside className={cn(
            'flex h-full flex-col border-white/5 bg-zinc-950/50 shadow-2xl backdrop-blur-2xl',
            isMobile ? 'w-full border-r-0' : 'sticky top-0 h-[calc(100vh-64px)] w-64 border-r',
        )}>
            <div className="border-b border-zinc-800 p-6">
                <Link href="/admin" className="flex origin-left flex-col gap-1 transition-transform hover:scale-105 active:scale-95">
                    <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-xl font-bold text-transparent">Админ портал</span>
                    <span className="text-xs font-medium text-zinc-500">Mind Academy</span>
                </Link>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
                {adminLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/admin')

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                'flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive
                                    ? 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400 shadow-inner'
                                    : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {link.name}
                        </Link>
                    )
                })}
            </div>

            <div className="border-t border-white/5 p-4">
                <Button variant="ghost" className="w-full justify-start font-medium text-zinc-400 transition-all hover:bg-white/10 hover:text-white" asChild>
                    <Link href="/dashboard">
                        <LogOut className="mr-2 h-4 w-4" />
                        Админаас гарах
                    </Link>
                </Button>
            </div>
        </aside>
    )
}
