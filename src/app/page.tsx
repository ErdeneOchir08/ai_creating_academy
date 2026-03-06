import { getPublishedCourses } from '@/features/courses/actions/course-actions'
import { CourseCard } from '@/features/courses/components/course-card'
import { Button } from '@/components/ui/button'
import { Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { AboutSection } from '@/components/about-section'
import { createClient } from '@/lib/supabase/server'
import { ProjectShowcaseSlider } from '@/components/project-showcase-slider'

export const metadata = {
  title: 'AI Creator Academy',
  description: 'Master AI content creation with our premium courses.',
}

export default async function LandingPage() {
  const courses = await getPublishedCourses()
  const supabase = await createClient()

  // Fetch showcase projects
  const { data: projects } = await supabase
    .from('student_projects')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#09090b] selection:bg-indigo-500/30">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/5 pt-32 pb-40">
        {/* Animated Background Gradients & Noise */}
        <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80 select-none pointer-events-none">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-500/40 to-purple-500/40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem] animate-pulse" style={{ animationDuration: '6s' }}></div>
          <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[15deg] bg-gradient-to-tr from-pink-500/30 to-indigo-500/30 sm:left-[calc(50%+15rem)] sm:w-[72.1875rem] animate-pulse" style={{ animationDuration: '8s' }}></div>
        </div>

        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center">
          <div className="max-w-4xl mx-auto text-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300 mb-8 backdrop-blur-md shadow-lg shadow-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-default">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-3 animate-ping absolute"></span>
              <span className="flex h-2 w-2 rounded-full bg-indigo-400 mr-3 relative"></span>
              Empowering the next generation of AI Builders
            </div>

            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-8 leading-[1.1] drop-shadow-2xl">
              Build your own <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
                AI Applications
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
              Join AI Creator Academy. Learn to code, prompt, and deploy real generative AI apps in a meticulously designed, immersive learning environment.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="relative group w-full sm:w-auto">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-500 group-hover:duration-200" />
                <Link href="/#courses" className="relative block">
                  <Button size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-100 w-full sm:w-auto rounded-full font-bold shadow-2xl transition-all duration-300 transform group-hover:scale-105">
                    Start Learning Now
                  </Button>
                </Link>
              </div>
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:text-white text-zinc-300 w-full rounded-full font-bold backdrop-blur-md transition-all duration-300">
                  Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <AboutSection />

      {/* Netflix-style Course Grid */}
      <section id="courses" className="py-20 container mx-auto px-4">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">Featured Masterclasses</h2>
          <p className="text-zinc-400">Complete paths from beginner to AI expert.</p>
        </div>

        {courses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-12 text-center flex flex-col items-center">
            <Sparkles className="h-12 w-12 text-zinc-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No courses available yet</h3>
            <p className="text-zinc-500 max-w-md mx-auto">
              You haven't added any courses to the database yet. You can add them through the Supabase Dashboard!
            </p>
          </div>
        )}
      </section>

      {/* Dynamic Student Showcase Section (Moved to Bottom) */}
      <ProjectShowcaseSlider projects={projects || []} />
    </div>
  )
}
