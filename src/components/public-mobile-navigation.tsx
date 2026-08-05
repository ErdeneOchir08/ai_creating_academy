'use client'

import { usePathname } from 'next/navigation'
import { useSyncExternalStore, type ReactNode } from 'react'

const subscribeToHydration = () => () => undefined

export function PublicMobileNavigation({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false)
    const isWorkspaceRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard')

    // The server cannot reliably know the client pathname when middleware or a
    // browser navigation changes the route. Keep the first client render equal
    // to the server render, then reveal the public mobile menu when appropriate.
    return !mounted || isWorkspaceRoute ? null : children
}
