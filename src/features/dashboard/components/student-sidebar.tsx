'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, PieChart, LogOut, Compass, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const studentLinks = [
    {
        name: 'My Courses',
        href: '/dashboard/courses',
        icon: BookOpen,
    },
    {
        name: 'My Progress',
        href: '/dashboard/progress',
        icon: PieChart,
    },
    {
        name: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
    }
]

export function StudentSidebar({ isMobile = false }: { isMobile?: boolean }) {
    const pathname = usePathname()

    return (
        <aside className={cn(
            "bg-zinc-950/50 backdrop-blur-2xl border-white/5 flex flex-col h-full shadow-2xl",
            isMobile ? "w-full border-r-0" : "w-64 border-r sticky top-0"
        )}>
            <div className="p-6 border-b border-zinc-800">
                <Link href="/dashboard" className="flex flex-col gap-1 transition-transform hover:scale-105 active:scale-95 origin-left">
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Student Portal</span>
                    <span className="text-xs text-zinc-500 font-medium">AI Creator Academy</span>
                </Link>
            </div>

            <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                {studentLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)

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

            <div className="p-4 border-t border-white/5 space-y-3">
                <Button variant="outline" className="w-full justify-start border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-all" asChild>
                    <Link href="/">
                        <Compass className="h-4 w-4 mr-2" />
                        Browse Courses
                    </Link>
                </Button>
                <form action="/api/auth/signout" method="post">
                    <Button type="submit" variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-red-950/30 hover:text-red-400">
                        <LogOut className="h-4 w-4 mr-2" />
                        Log Out
                    </Button>
                </form>
            </div>
        </aside>
    )
}
