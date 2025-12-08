import { Metadata } from 'next'
import { Suspense } from 'react'
import ForgotPasswordClient from './ForgotPasswordClient'
import { Loader2 } from '@/components/icons'

export const metadata: Metadata = {
    title: 'Forgot Password | Genie.ph',
    description: 'Reset your Cake Genie account password. Enter your email to receive a password reset link.',
}

function ForgotPasswordFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
    )
}

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={<ForgotPasswordFallback />}>
            <ForgotPasswordClient />
        </Suspense>
    )
}
