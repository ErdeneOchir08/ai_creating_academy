import { Target, Lightbulb, Users, Trophy, Calendar, CheckCircle2 } from 'lucide-react'

export function AboutSection() {
    return (
        <section className="py-24 relative overflow-hidden bg-zinc-950">
            {/* Background elements */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
                        About <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">AI Creator Academy</span>
                    </h2>
                    <p className="text-xl text-zinc-400 leading-relaxed">
                        We are on a mission to democratize artificial intelligence education. Our platform bridges the gap between complex AI concepts and real-world application building.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12 lg:gap-20 mb-20">
                    {/* Mission & Vision */}
                    <div className="space-y-8">
                        <div className="bg-zinc-900/50 border border-zinc-800/80 p-8 rounded-3xl backdrop-blur-md relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
                            <div className="flex items-center gap-4 mb-6 relative">
                                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                                    <Target className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-white">Our Goal</h3>
                            </div>
                            <p className="text-zinc-300 leading-relaxed text-lg relative">
                                To equip 10,000 students worldwide with the practical skills needed to build robust, scalable AI applications from scratch. We focus on hands-on learning rather than purely theoretical concepts.
                            </p>
                        </div>

                        <div className="bg-zinc-900/50 border border-zinc-800/80 p-8 rounded-3xl backdrop-blur-md relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
                            <div className="flex items-center gap-4 mb-6 relative">
                                <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl">
                                    <Lightbulb className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-white">Our Vision</h3>
                            </div>
                            <p className="text-zinc-300 leading-relaxed text-lg relative">
                                A future where anyone, regardless of their background, can harness the power of AI to solve meaningful problems and create innovative software solutions.
                            </p>
                        </div>
                    </div>

                    {/* Stats & Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-fit">
                        <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 p-8 rounded-3xl flex flex-col items-center justify-center text-center">
                            <Users className="w-10 h-10 text-indigo-400 mb-4" />
                            <h4 className="text-4xl font-black text-white mb-2">2,500+</h4>
                            <p className="text-zinc-400 font-medium">Students Graduated</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 p-8 rounded-3xl flex flex-col items-center justify-center text-center">
                            <Trophy className="w-10 h-10 text-purple-400 mb-4" />
                            <h4 className="text-4xl font-black text-white mb-2">10+</h4>
                            <p className="text-zinc-400 font-medium">Years Experience</p>
                        </div>

                        <div className="bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20 p-8 rounded-3xl flex flex-col items-center justify-center text-center sm:col-span-2">
                            <Calendar className="w-10 h-10 text-pink-400 mb-4" />
                            <h4 className="text-4xl font-black text-white mb-2">Founded 2024</h4>
                            <p className="text-zinc-400 font-medium">Pioneering modern AI curriculum</p>
                        </div>
                    </div>
                </div>

                {/* Trust Indicators */}
                <div className="flex flex-wrap justify-center gap-8 md:gap-16 pt-10 border-t border-white/5 opacity-60">
                    {['Expert Mentorship', 'Project-Based Learning', 'Lifetime Access', 'Community Driven'].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-zinc-300 font-medium">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span>{item}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
