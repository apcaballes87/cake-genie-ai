import { Metadata } from 'next'
import HowToOrderClient from './HowToOrderClient'

export const metadata: Metadata = {
    title: 'How to Order Custom Cakes Online in Cebu | Genie.ph',
    description: 'Order a custom cake in 4 easy steps: upload any design, get an instant AI price estimate, customise colours & size, then check out. Delivery across Metro Cebu.',
    alternates: {
        canonical: 'https://genie.ph/how-to-order',
    },
    openGraph: {
        title: 'How to Order Custom Cakes Online | Genie.ph',
        description: 'Upload a design, get an instant AI price, customise, and order. Delivery across Metro Cebu.',
        url: 'https://genie.ph/how-to-order',
        type: 'website',
        siteName: 'Genie.ph',
    },
}

export default function HowToOrderPage() {
    return <HowToOrderClient />
}
