import { Suspense } from 'react'
import OrdersClient from './OrdersClient'
import { Loader2 } from '@/components/icons'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildNoIndexPageMetadata({
    title: 'My Orders',
    description: 'View and manage your cake orders, track delivery status, and upload payment proofs.',
})

function OrdersFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center genie-page-bg">
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
