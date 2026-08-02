import { getPublishedCourses } from '@/features/courses/actions/course-actions'
import { CourseCatalog } from '@/features/courses/components/course-catalog'
import { Sparkles } from 'lucide-react'
import { AnimatedHero } from '@/components/animated-hero'
import { AboutSection } from '@/components/about-section'
import { ProjectShowcaseSlider } from '@/components/project-showcase-slider'
import { MorphingBlobs } from '@/components/morphing-blobs'
import { ScrollSVG } from '@/components/scroll-svg'
import { getAppSettings } from '@/features/admin/actions/settings-actions.admin'

export const metadata = {
  title: 'Mind Academy',
  description: 'AI болон кодчиллын онлайн сургалтын платформ.',
}

export default async function LandingPage() {
  const courses = await getPublishedCourses()
  const settings = await getAppSettings() || {}

  return (
    <div className="min-h-screen bg-[#09090b] selection:bg-indigo-500/30 relative">
      <ScrollSVG />
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/5 pt-32 pb-40">
        {/* Animated Background Gradients & Noise */}
        <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        <MorphingBlobs />

        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center">
          <AnimatedHero settings={settings} />
        </div>
      </section>

      {/* About Us Section */}
      <AboutSection courseCount={courses.length} />

      {/* Netflix-style Course Grid */}
      <section id="courses" className="py-20 container mx-auto px-4">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">{settings.landing_course_title || 'Онцлох хичээлүүд'}</h2>
          <p className="text-zinc-400">{settings.landing_course_subtitle || 'Анхан шатнаас AI мэргэжилтэн хүртэлх цогц хөтөлбөр.'}</p>
        </div>

        {courses.length > 0 ? (
          <CourseCatalog courses={courses} />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-12 text-center flex flex-col items-center">
            <Sparkles className="h-12 w-12 text-zinc-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{settings.landing_empty_title || 'Одоогоор хичээл ороогүй байна'}</h3>
            <p className="text-zinc-500 max-w-md mx-auto whitespace-pre-wrap">
              {settings.landing_empty_subtitle || "Мэдээллийн санд хичээл нэмэгдээгүй байна. Админ эрхээр нэвтэрч хичээл нэмнэ үү!"}
            </p>
          </div>
        )}
      </section>

      {/* Dynamic Student Showcase Section (Moved to Bottom) */}
      <ProjectShowcaseSlider projects={[]} />
    </div>
  )
}
