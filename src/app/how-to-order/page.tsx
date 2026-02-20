import { Metadata } from 'next'
import HowToOrderClient from './HowToOrderClient'

export const metadata: Metadata = {
    title: 'How to Order Custom Cakes Online in Cebu | Genie.ph',
    description: 'Learn how to order custom cakes with Genie.ph. 3 simple steps: Search/Upload, Customize with AI, and Order.',
    alternates: {
        canonical: 'https://genie.ph/how-to-order',
    },
}

export default function HowToOrderPage() {
    return <HowToOrderClient />
}
