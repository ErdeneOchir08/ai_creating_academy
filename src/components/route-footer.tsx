'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function RouteFooter({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const isWorkspaceRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard')

    return isWorkspaceRoute ? null : children
}
