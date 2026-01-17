import { Metadata } from 'next'
import { Suspense } from 'react'
import CustomizingClient from './CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export const metadata: Metadata = {
    title: 'Customize Your Cake | Genie.ph',
    description: 'Customize your cake design with AI-powered suggestions.',
    robots: {
        index: false,
        follow: false,
    },
}

export default function CustomizingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
            <CustomizingClient />
        </Suspense>
    )
}
