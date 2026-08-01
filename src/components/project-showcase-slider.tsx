'use client'

import { useEffect, useRef } from 'react'

type StudentProject = {
    id: string
    image_url: string
    project_title: string
    student_name: string
}

export function ProjectShowcaseSlider({ projects }: { projects: StudentProject[] }) {
    const scrollerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!scrollerRef.current) return

        // Clone the items to create the infinite scroll effect
        const scrollerContent = Array.from(scrollerRef.current.children)
        scrollerContent.forEach((item) => {
            const duplicatedItem = item.cloneNode(true)
            if (scrollerRef.current) {
                scrollerRef.current.appendChild(duplicatedItem)
            }
        })

    }, [])

    if (!projects || projects.length === 0) return null

    return (
        <section className="py-24 bg-zinc-950 overflow-hidden relative">
            {/* Gradient Masking */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-zinc-950 to-transparent z-10 hidden md:block" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-zinc-950 to-transparent z-10 hidden md:block" />

            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 mb-12 text-center relative z-20">
                <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-4">
                    Манай <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">суралцагчдын бүтээл</span>
                </h2>
                <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
                    Манай академид заасан арга барилыг ашиглан санаагаа бодит болгож чадсан олон зуун бүтээгчидтэй нэгдээрэй.
                </p>
            </div>

            <div className="flex w-full mt-10">
                <div
                    ref={scrollerRef}
                    className="flex min-w-full w-max shrink-0 flex-nowrap gap-6 py-4 animate-marquee"
                    style={{ animation: 'marquee 40s linear infinite' }}
                >
                    {projects.map((project, idx) => (
                        <div
                            key={`${project.id}-${idx}`}
                            className="w-[300px] md:w-[400px] shrink-0 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 group shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer relative"
                        >
                            <div className="aspect-[4/3] relative bg-zinc-950 overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={project.image_url}
                                    alt={project.project_title}
                                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                                />

                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

                                {/* Text Content */}
                                <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col justify-end">
                                    <h3 className="text-xl font-bold leading-tight text-white mb-1 group-hover:text-indigo-300 transition-colors">
                                        {project.project_title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
                                            <span className="text-indigo-400 font-bold text-[10px]">{project.student_name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <span className="text-sm font-medium">Бүтээсэн: {project.student_name}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Inline styles for the marquee keyframes because Tailwind custom config requires touching tailwind.config.ts */}
            <style jsx global>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee:hover {
                    animation-play-state: paused !important;
                }
            `}</style>
        </section>
    )
}
