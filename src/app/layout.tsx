import { Outfit } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/navbar'
import NextTopLoader from 'nextjs-toploader'

const outfit = Outfit({ subsets: ['latin'] })

export const metadata = {
  title: 'AI Creator Academy',
  description: 'Learn to build AI like a pro. A modern learning platform for young creators.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${outfit.className} min-h-screen bg-background text-foreground antialiased selection:bg-indigo-500/30 selection:text-white`} suppressHydrationWarning>
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
      </body>
    </html>
  )
}
