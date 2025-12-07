import { Metadata } from 'next'
import AboutClient from './AboutClient'

export const metadata: Metadata = {
    title: 'About Us | Genie.ph',
    description: 'Genie.ph is an AI-powered custom cake ordering platform in Cebu. We connect customers with artisans for instant pricing and design visualization.',
}

export default function AboutPage() {
    return <AboutClient />
}
