import { StudentSidebar } from '@/features/dashboard/components/student-sidebar'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden relative bg-[#09090b]">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden blur-[100px] opacity-20 pointer-events-none select-none z-0">
                <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-indigo-600/30 mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
                <div className="absolute bottom-0 right-0 w-1/2 h-1/2 rounded-full bg-purple-600/20 mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
            </div>

            {/* Mobile Header / Sidebar Toggle */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md relative z-10">
                <span className="font-bold text-white">Student Dashboard</span>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64 border-zinc-800 bg-zinc-950">
                        <VisuallyHidden.Root>
                            <SheetTitle>Student Navigation</SheetTitle>
                            <SheetDescription>Navigation links for the student dashboard.</SheetDescription>
                        </VisuallyHidden.Root>
                        <StudentSidebar isMobile={true} />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:block relative z-10">
                <StudentSidebar />
            </div>

            <main className="flex-1 overflow-y-auto w-full relative z-10">
                {children}
            </main>
        </div>
    )
}
