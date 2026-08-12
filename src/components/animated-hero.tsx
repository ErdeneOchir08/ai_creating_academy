'use client'

import { motion, Variants } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

type HeroSettings = Partial<{
  landing_badge: string
  landing_title_main: string
  landing_title_highlight: string
  landing_subtitle: string
  landing_cta_primary: string
  landing_cta_secondary: string
}>

export function AnimatedHero({ settings }: { settings: HeroSettings }) {
  // Stagger variants for the container
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  // Fade up variant for each child with Apple-style blur
  const item: Variants = {
    hidden: { opacity: 0, y: 50, scale: 0.95, filter: 'blur(10px)' },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: { type: 'spring', stiffness: 50, damping: 15 }
    },
  }

  // Pop variant for the pill badge
  const badgeItem: Variants = {
    hidden: { opacity: 0, scale: 0.5, y: -30, filter: 'blur(10px)' },
    show: {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { type: 'spring', stiffness: 100, damping: 10, delay: 0.1 }
    },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-4xl mx-auto text-center relative z-10"
    >
      {/* Pill Badge */}
      <motion.div variants={badgeItem} className="mb-8 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300 backdrop-blur-md shadow-lg shadow-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-default">
          <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-3 animate-ping absolute"></span>
          <span className="flex h-2 w-2 rounded-full bg-indigo-400 mr-3 relative"></span>
          {settings.landing_badge || 'AI бүтээгчдийн дараагийн үеийг бэлтгэнэ'}
        </div>
      </motion.div>

      {/* Main Title */}
      <motion.h1 variants={item} className="mb-8 text-5xl font-black leading-[1.1] tracking-tighter text-white drop-shadow-2xl min-[380px]:text-6xl md:text-8xl">
        {settings.landing_title_main || 'Өөрийн'} <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 hover:from-purple-400 hover:to-indigo-400 transition-all duration-700">
          {settings.landing_title_highlight || 'AI аппликейшн бүтээ'}
        </span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p variants={item} className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-3xl mx-auto leading-relaxed font-light whitespace-pre-wrap">
        {settings.landing_subtitle || 'Mind Academy-д нэгд. Бодит AI аппликейшн кодлох, промпт бичих, хөгжүүлэх арга барилд суралц.'}
      </motion.p>

      {/* Call to Actions */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <div className="relative group w-full sm:w-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-500 group-hover:duration-200" />
          <Link href="/#courses" className="relative block">
            <Button size="lg" className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-100 w-full sm:w-auto rounded-full font-bold shadow-2xl transition-all duration-300 transform group-hover:scale-105">
              {settings.landing_cta_primary || 'Одоо суралцаж эхлэх'}
            </Button>
          </Link>
        </div>
        <Link href="/register" className="w-full sm:w-auto">
          <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:text-white text-zinc-300 w-full rounded-full font-bold backdrop-blur-md transition-all duration-300">
            {settings.landing_cta_secondary || 'Үнэгүй бүртгүүлэх'} <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  )
}
