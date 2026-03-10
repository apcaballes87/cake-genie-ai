import { Suspense } from 'react'
import SignupClient from './SignupClient'
import { Loader2 } from '@/components/icons'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildNoIndexPageMetadata({
    title: 'Sign Up',
    description: 'Create your Cake Genie account to start ordering custom cakes, save addresses, and earn loyalty points.',
})

function SignupFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
    )
}

export default function SignupPage() {
    return (
        <Suspense fallback={<SignupFallback />}>
            <SignupClient />
        </Suspense>
    )
}
