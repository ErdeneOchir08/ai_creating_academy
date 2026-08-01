'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

export function ScrollSVG() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  })

  const pathLength = useTransform(scrollYProgress, [0, 0.8], [0, 1])

  return (
    <div ref={ref} className="absolute left-4 md:left-20 top-40 h-[1500px] w-12 hidden lg:block overflow-hidden pointer-events-none z-0 opacity-40">
      <svg viewBox="0 0 100 1500" preserveAspectRatio="none" className="w-full h-full stroke-indigo-500 drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]">
        <motion.path
          d="M 50 0 C 100 200 0 400 50 600 C 100 800 0 1000 50 1200 C 100 1400 50 1500 50 1500"
          fill="transparent"
          strokeWidth="4"
          style={{ pathLength }}
        />
        <motion.path
          d="M 50 0 C 100 200 0 400 50 600 C 100 800 0 1000 50 1200 C 100 1400 50 1500 50 1500"
          fill="transparent"
          strokeWidth="10"
          className="stroke-indigo-500/20 blur-sm"
          style={{ pathLength }}
        />
      </svg>
    </div>
  )
}
