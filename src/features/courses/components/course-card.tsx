import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

// Basic course type representation
type Course = {
    id: string
    title: string
    description: string
    thumbnail_url: string
    price_display: string
    original_price_display?: string | null
    payment_status?: 'none' | 'pending' | 'enrolled'
}

export function CourseCard({ course }: { course: Course }) {
    // If no thumbnail, use a beautiful gradient placeholder
    const hasThumbnail = course.thumbnail_url && course.thumbnail_url.trim() !== ''

    return (
        <div className="relative group/card cursor-pointer">
            {/* Glow effect behind the card on hover */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-0 group-hover/card:opacity-30 transition duration-500" />

            <Card className="relative h-full flex flex-col overflow-hidden border border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm transition-all duration-500 transform group-hover/card:-translate-y-1 rounded-2xl">
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-900 border-b border-zinc-800/50">
                    {hasThumbnail ? (
                        <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                        />
                    ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 flex flex-col items-center justify-center">
                            <Play className="h-12 w-12 text-indigo-500/40 mb-2 transition-transform duration-500 group-hover/card:scale-110" />
                            <span className="text-zinc-500 text-sm font-medium tracking-wide uppercase">Video Course</span>
                        </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center duration-300 backdrop-blur-[2px]">
                        <Link href={course.payment_status === 'enrolled' ? `/courses/${course.id}` : `/course/${course.id}`}>
                            <Button className="rounded-full bg-white text-black hover:bg-zinc-200 shadow-xl transition-transform duration-300 transform scale-95 group-hover/card:scale-100 font-bold">
                                <Play className="mr-2 h-4 w-4 fill-current" /> {course.payment_status === 'enrolled' ? 'Resume Course' : 'Preview Course'}
                            </Button>
                        </Link>
                    </div>
                </div>

                <CardContent className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-xl line-clamp-1 text-white group-hover/card:text-indigo-400 transition-colors duration-300">
                            {course.title}
                        </h3>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-2 mb-6 flex-1 font-light leading-relaxed">
                        {course.description || "Learn to build amazing AI tools and dive deep into AI engineering with this comprehensive masterclass."}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-800/50 min-h-[56px]">
                        {course.payment_status === 'enrolled' ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-400 text-sm">
                                Enrolled
                            </span>
                        ) : course.payment_status === 'pending' ? (
                            <span className="inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 font-semibold text-yellow-500 text-sm">
                                Pending Approval
                            </span>
                        ) : (
                            <div className="flex flex-col">
                                {course.original_price_display && (
                                    <span className="text-zinc-500 line-through decoration-zinc-600 text-xs font-medium mb-0.5">
                                        {course.original_price_display}
                                    </span>
                                )}
                                <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 text-lg drop-shadow-sm leading-none">
                                    {course.price_display}
                                </span>
                            </div>
                        )}
                        <Link href={course.payment_status === 'enrolled' ? `/courses/${course.id}` : `/course/${course.id}`}>
                            <Button variant="secondary" size="sm" className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 rounded-lg whitespace-nowrap">
                                {course.payment_status === 'enrolled' ? 'Resume Course' : course.payment_status === 'pending' ? 'View Status' : 'View Course'}
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
