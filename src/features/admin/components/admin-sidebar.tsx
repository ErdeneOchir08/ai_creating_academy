'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, BookOpen, CreditCard, LogOut, MessageSquare, Settings, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const adminLinks = [
    {
        name: 'Overview',
        href: '/admin',
        icon: LayoutDashboard,
    },
    {
        name: 'Users',
        href: '/admin/users',
        icon: Users,
    },
    {
        name: 'Courses',
        href: '/admin/courses',
        icon: BookOpen,
    },
    {
        name: 'Showcase',
        href: '/admin/projects',
        icon: Star,
    },
    {
        name: 'Payments',
        href: '/admin/payments',
        icon: CreditCard,
    },
    {
        name: 'Q&A Inbox',
        href: '/admin/qa',
        icon: MessageSquare,
    },
    {
        name: 'Settings',
        href: '/admin/settings',
        icon: Settings,
    },
]

export function AdminSidebar({ isMobile = false }: { isMobile?: boolean }) {
    const pathname = usePathname()

    return (
        <aside className={cn(
            "bg-zinc-950/50 backdrop-blur-2xl border-white/5 flex flex-col h-full shadow-2xl",
            isMobile ? "w-full border-r-0" : "w-64 border-r sticky top-0"
        )}>
            <div className="p-6 border-b border-zinc-800">
                <Link href="/admin" className="flex flex-col gap-1 transition-transform hover:scale-105 active:scale-95 origin-left">
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Admin Portal</span>
                    <span className="text-xs text-zinc-500 font-medium">AI Creator Academy</span>
                </Link>
            </div>

            <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                {adminLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/admin')

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner"
                                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-transparent"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {link.name}
                        </Link>
                    )
                })}
            </div>

            <div className="p-4 border-t border-white/5">
                <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/10 transition-all font-medium" asChild>
                    <Link href="/dashboard">
                        <LogOut className="h-4 w-4 mr-2" />
                        Exit Admin
                    </Link>
                </Button>
            </div>
        </aside>
    )
}
