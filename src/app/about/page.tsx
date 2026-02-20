import { Metadata } from 'next'
import AboutClient from './AboutClient'

export const metadata: Metadata = {
    title: "About Genie.ph | The Philippines' First AI Custom Cake Marketplace",
    description: "Genie.ph is the Philippines' first AI-powered marketplace for custom cakes, based in Cebu. We connect customers with top local bakers for instant pricing and visual customisation.",
    alternates: {
        canonical: 'https://genie.ph/about',
    },
    openGraph: {
        title: "About Genie.ph | AI-Powered Custom Cake Marketplace in Cebu",
        description: "The Philippines' first AI marketplace for custom cakes. Based in Cebu — connecting customers with vetted local bakers.",
        url: 'https://genie.ph/about',
        type: 'website',
        siteName: 'Genie.ph',
    },
}

export default function AboutPage() {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About Genie.ph',
        description: 'Genie.ph is an AI-powered custom cake ordering platform connecting customers with local bakers.',
        mainEntity: {
            '@type': 'Organization',
            name: 'Genie.ph',
            url: 'https://genie.ph',
            logo: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
            sameAs: [
                'https://web.facebook.com/geniephilippines',
                'https://www.instagram.com/genie.ph/',
                'http://tiktok.com/@genie.ph',
                'https://www.youtube.com/@genieph'
            ]
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <AboutClient />
        </>
    )
}
