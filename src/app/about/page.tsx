import { Metadata } from 'next'
import AboutClient from './AboutClient'

export const metadata: Metadata = {
    title: 'About Us — Custom Cakes in Cebu | Genie.ph',
    description: 'Genie.ph is an AI-powered custom cake ordering platform in Cebu. We connect customers with artisans for instant pricing and design visualization.',
    alternates: {
        canonical: 'https://genie.ph/about',
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
