import './globals.css'
import { Navbar } from '@/components/navbar'
import { AcademyFooter } from '@/components/academy-footer'
import { RouteFooter } from '@/components/route-footer'
import NextTopLoader from 'nextjs-toploader'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { getConfiguredSiteUrl } from '@/lib/site-url'

const siteUrl = getConfiguredSiteUrl()

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: 'Mind Academy',
    template: '%s | Mind Academy',
  },
  description: 'AI болон кодчиллын онлайн сургалтын платформ.',
  robots: siteUrl ? { index: true, follow: true } : { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="mn" className="dark scroll-smooth">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-indigo-500/30 selection:text-white" suppressHydrationWarning>
        <NextTopLoader
          color="#6366f1"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #6366f1,0 0 5px #6366f1"
        />
        <Navbar />
        <main>
          {children}
        </main>
        <RouteFooter>
          <AcademyFooter />
        </RouteFooter>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
