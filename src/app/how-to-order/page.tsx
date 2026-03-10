import HowToOrderClient from './HowToOrderClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildMarketingPageMetadata({
    title: 'How to Order Custom Cakes Online in Cebu',
    description: 'Learn how to order custom cakes with Genie.ph in three simple steps: search or upload a design, customize it with AI, and place your order online.',
    canonicalPath: 'https://genie.ph/how-to-order',
})

export default function HowToOrderPage() {
    return <HowToOrderClient />
}
