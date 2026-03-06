import { Outfit } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/navbar'

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
        <Navbar />
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
