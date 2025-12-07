import { Metadata } from 'next'
import { Suspense } from 'react'
import OrdersClient from './OrdersClient'
import { Loader2 } from '@/components/icons'

export const metadata: Metadata = {
    title: 'My Orders | Genie.ph',
    description: 'View and manage your cake orders, track delivery status, and upload payment proofs.',
}

function OrdersFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
    )
}

export default function OrdersPage() {
    return (
        <Suspense fallback={<OrdersFallback />}>
            <OrdersClient />
        </Suspense>
    )
}
