import { Metadata } from 'next'
import HowToOrderClient from './HowToOrderClient'

export const metadata: Metadata = {
    title: 'How to Order | Genie.ph',
    description: 'Learn how to order custom cakes with Genie.ph. 3 simple steps: Search/Upload, Customize with AI, and Order.',
}

export default function HowToOrderPage() {
    return <HowToOrderClient />
}
