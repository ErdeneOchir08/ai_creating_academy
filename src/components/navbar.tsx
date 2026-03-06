import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/features/auth/actions/auth-actions'

export async function Navbar() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                        AI Creator Academy
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-4">
                    {user ? (
                        <>
                            <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                                My Courses
                            </Link>
                            {user.role === 'admin' && (
                                <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors text-indigo-400">
                                    Admin Dashboard
                                </Link>
                            )}
                            <form action={logout}>
                                <Button variant="ghost" size="sm">Log out</Button>
                            </form>
                        </>
                    ) : (
                        <>
                            <Link href="/login">
                                <Button variant="ghost" size="sm">Log in</Button>
                            </Link>
                            <Link href="/register">
                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">Sign up</Button>
                            </Link>
                        </>
                    )}
                </nav>

                {/* Mobile Navigation */}
                <div className="md:hidden flex items-center">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 p-0">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle mobile menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[80vw] sm:w-[350px] bg-zinc-950 border-zinc-800 text-white flex flex-col p-6">
                            <SheetTitle className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent mb-8">
                                AI Creator Academy
                            </SheetTitle>

                            <div className="flex flex-col gap-6 w-full">
                                {user ? (
                                    <>
                                        <div className="flex flex-col gap-4">
                                            <p className="text-sm text-zinc-400 border-b border-zinc-800 pb-2">Navigation</p>
                                            <Link href="/dashboard" className="text-lg font-medium hover:text-indigo-400 transition-colors w-full">
                                                My Courses
                                            </Link>
                                            {user?.role === 'admin' && (
                                                <Link href="/admin" className="text-lg font-medium hover:text-indigo-400 transition-colors w-full">
                                                    Admin Dashboard
                                                </Link>
                                            )}
                                        </div>
                                        <div className="mt-auto pt-8 border-t border-zinc-800 w-full">
                                            <form action={logout} className="w-full">
                                                <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800">
                                                    Log out
                                                </Button>
                                            </form>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col gap-4 mt-4 w-full">
                                        <Link href="/login" className="w-full">
                                            <Button variant="outline" className="w-full border-zinc-800 text-foreground hover:bg-zinc-900 hover:text-white">
                                                Log in
                                            </Button>
                                        </Link>
                                        <Link href="/register" className="w-full">
                                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                                Sign up
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}
