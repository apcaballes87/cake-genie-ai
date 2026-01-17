import { Metadata } from 'next'
import { Suspense } from 'react'
import LoginClient from './LoginClient'
import { Loader2 } from '@/components/icons'

export const metadata: Metadata = {
    title: 'Login | Genie.ph',
    description: 'Sign in to your Cake Genie account to access your orders, saved addresses, and loyalty points.',
    robots: {
        index: false,
        follow: false,
    },
}

function LoginFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <LoginClient />
        </Suspense>
    )
}
