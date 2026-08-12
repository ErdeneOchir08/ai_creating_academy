import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Facebook, Instagram, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/features/auth/actions/auth-actions'
import { getAcademyProfile } from '@/features/admin/actions/settings-actions.admin'
import { PublicMobileNavigation } from '@/components/public-mobile-navigation'

export async function Navbar() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const profile = await getAcademyProfile()
    const { data: roleRecord } = user
        ? await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
        : { data: null }
    const isAdmin = roleRecord?.role === 'admin'

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                        {profile.displayName}
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-4">
                    <div className="flex items-center gap-1 border-r border-zinc-800 pr-3">
                        {profile.facebookUrl && <a href={profile.facebookUrl} target="_blank" rel="noreferrer" aria-label={`${profile.displayName} Facebook`} className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"><Facebook className="h-4 w-4" /></a>}
                        {profile.instagramUrl && <a href={profile.instagramUrl} target="_blank" rel="noreferrer" aria-label={`${profile.displayName} Instagram`} className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"><Instagram className="h-4 w-4" /></a>}
                    </div>
                    <Link href="/programs" className="text-sm font-medium hover:text-primary transition-colors">
                        Сургалтууд
                    </Link>
                    {user ? (
                        <>
                            <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                                Миний хичээлүүд
                            </Link>
                            {isAdmin && (
                                <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors text-indigo-400">
                                    Админ самбар
                                </Link>
                            )}
                            <form action={logout}>
                                <Button variant="ghost" size="sm">Гарах</Button>
                            </form>
                        </>
                    ) : (
                        <>
                            <Link href="/login">
                                <Button variant="ghost" size="sm">Нэвтрэх</Button>
                            </Link>
                            <Link href="/register">
                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Бүртгүүлэх</Button>
                            </Link>
                        </>
                    )}
                </nav>

                {/* Mobile Navigation */}
                <PublicMobileNavigation>
                <div className="md:hidden flex items-center">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 p-0">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Гар утасны цэс</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[80vw] sm:w-[350px] bg-zinc-950 border-zinc-800 text-white flex flex-col p-6">
                            <SheetTitle className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent mb-8">
                                {profile.displayName}
                            </SheetTitle>

                            <div className="flex flex-col gap-6 w-full">
                                {user ? (
                                    <>
                                        <div className="flex flex-col gap-4">
                                            <p className="text-sm text-zinc-400 border-b border-zinc-800 pb-2">Үндсэн цэс</p>
                                            <Link href="/programs" className="text-lg font-medium hover:text-indigo-400 transition-colors w-full">
                                                Сургалтууд
                                            </Link>
                                            <Link href="/dashboard" className="text-lg font-medium hover:text-indigo-400 transition-colors w-full">
                                                Миний хичээлүүд
                                            </Link>
                                            {isAdmin && (
                                                <Link href="/admin" className="text-lg font-medium hover:text-indigo-400 transition-colors w-full">
                                                    Админ самбар
                                                </Link>
                                            )}
                                        </div>
                                        <div className="mt-auto pt-8 border-t border-zinc-800 w-full">
                                            <form action={logout} className="w-full">
                                                <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800">
                                                    Гарах
                                                </Button>
                                            </form>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-4 mt-4 w-full">
                                        <Link href="/programs" className="w-full">
                                            <Button variant="ghost" className="w-full justify-start">Сургалтууд</Button>
                                        </Link>
                                        <Link href="/login" className="w-full">
                                            <Button variant="outline" className="w-full border-zinc-800 text-foreground hover:bg-zinc-900 hover:text-white">
                                                Нэвтрэх
                                            </Button>
                                        </Link>
                                        <Link href="/register" className="w-full">
                                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                                Бүртгүүлэх
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                                {(profile.facebookUrl || profile.instagramUrl) && (
                                    <div className="flex items-center gap-3 border-t border-zinc-800 pt-6">
                                        {profile.facebookUrl && <a href={profile.facebookUrl} target="_blank" rel="noreferrer" aria-label={`${profile.displayName} Facebook`} className="rounded-md border border-zinc-800 p-2 text-zinc-300"><Facebook className="h-4 w-4" /></a>}
                                        {profile.instagramUrl && <a href={profile.instagramUrl} target="_blank" rel="noreferrer" aria-label={`${profile.displayName} Instagram`} className="rounded-md border border-zinc-800 p-2 text-zinc-300"><Instagram className="h-4 w-4" /></a>}
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
                </PublicMobileNavigation>
            </div>
        </header>
    )
}
