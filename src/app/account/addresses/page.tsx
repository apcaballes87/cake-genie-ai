import { Suspense } from 'react'
import AddressesClient from './AddressesClient'
import { Loader2 } from '@/components/icons'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildNoIndexPageMetadata({
    title: 'My Addresses',
    description: 'Manage your saved delivery addresses for faster checkout.',
})

function AddressesFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-pink-50 via-purple-50 to-indigo-50">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
    )
}

export default function AddressesPage() {
    return (
        <Suspense fallback={<AddressesFallback />}>
            <AddressesClient />
        </Suspense>
    )
}
