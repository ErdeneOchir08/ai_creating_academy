import { RegisterForm } from '@/features/auth/components/register-form'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
    return (
        <div className="flex min-h-screen bg-[#09090b]">
            {/* Left Side: Art / Branding (Hidden on mobile) */}
            <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden bg-zinc-950 items-center justify-center p-12 border-r border-white/5">
                {/* Abstract Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden blur-3xl opacity-30 select-none pointer-events-none">
                    <div className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full bg-gradient-to-br from-indigo-600/60 to-purple-600/60 mix-blend-screen mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }}></div>
                    <div className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full bg-gradient-to-tl from-pink-600/60 to-indigo-600/60 mix-blend-screen mix-blend-multiply animate-pulse" style={{ animationDuration: '10s' }}></div>
                </div>

                <div className="relative z-10 w-full max-w-md">
                    <Link href="/" className="inline-flex items-center gap-2 mb-8 group">
                        <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 group-hover:bg-indigo-500/30 transition-colors">
                            <Sparkles className="h-6 w-6 text-indigo-400" />
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            AI Creator Academy
                        </span>
                    </Link>

                    <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
                        Start your journey as an <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                            AI Engineer
                        </span>
                    </h1>

                    <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
                        Create an account to enroll in masterclasses, track your progress, and get direct feedback from experts.
                    </p>

                    <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
                                💡
                            </div>
                            <div>
                                <h4 className="text-white font-semibold">Learn by doing</h4>
                                <p className="text-zinc-400 text-sm">Build real, working AI apps from Day 1.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Form Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 relative">
                {/* Mobile-only background glow */}
                <div className="absolute inset-0 block lg:hidden w-full h-full overflow-hidden blur-3xl opacity-20 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded-full bg-indigo-600/50 mix-blend-screen" />
                </div>

                <div className="w-full max-w-[420px] relative z-10">
                    {/* Mobile Branding */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-indigo-400" />
                            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                Academy
                            </span>
                        </Link>
                    </div>

                    <RegisterForm />
                </div>
            </div>
        </div>
    )
}
