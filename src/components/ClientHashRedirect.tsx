'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ClientHashRedirect() {
    const router = useRouter()

    useEffect(() => {
        // Only run on client side
        if (typeof window === 'undefined') return

        const hash = window.location.hash
        if (!hash || hash === '#') return

        const path = hash.substring(1) // Remove the #
        if (!path.startsWith('/')) return

        console.log(`[HashRedirect] Redirecting: ${hash} → ${path}`)

        // Design routes
        const designMatch = path.match(/^\/designs?\/([a-z0-9-]+)\/?$/i)
        if (designMatch) {
            router.replace(`/designs/${designMatch[1]}`)
            return
        }

        // Contribute routes
        const contributeMatch = path.match(/^\/contribute\/([a-z0-9-]+)\/?$/i)
        if (contributeMatch) {
            router.replace(`/contribute/${contributeMatch[1]}`)
            return
        }

        // Static routes
        const staticRoutes = ['/about', '/contact', '/how-to-order', '/cart', '/customizing', '/login', '/signup']
        for (const route of staticRoutes) {
            if (path === route || path.startsWith(route + '/')) {
                router.replace(path)
                return
            }
        }

        // Discount codes (alphanumeric at root like /#/FRIEND100)
        const discountMatch = path.match(/^\/([A-Za-z0-9]{3,20})\/?$/i)
        if (discountMatch) {
            router.replace(`/?discount=${discountMatch[1].toUpperCase()}`)
            return
        }
    }, [router])

    return null
}
