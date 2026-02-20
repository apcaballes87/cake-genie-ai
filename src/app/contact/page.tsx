import { Metadata } from 'next'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
    title: 'Contact Genie.ph | Custom Cake Marketplace in Cebu',
    description: 'Get in touch with Genie.ph for custom cake enquiries in Cebu. Call +63-908-940-8747, chat live, or visit us at Skyview Park, Nivel Hills, Cebu City.',
    alternates: {
        canonical: 'https://genie.ph/contact',
    },
    openGraph: {
        title: 'Contact Genie.ph | Custom Cakes in Cebu',
        description: 'Call, chat, or visit our Cebu office. We help with custom cake orders, baker partnerships, and general enquiries.',
        url: 'https://genie.ph/contact',
        type: 'website',
        siteName: 'Genie.ph',
    },
}

function ContactPageSchema() {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        '@id': 'https://genie.ph/#localbusiness',
        name: 'Genie.ph',
        description: 'AI-powered marketplace for custom cakes in the Philippines. Based in Cebu.',
        url: 'https://genie.ph',
        logo: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20favicon.webp',
        image: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/meta%20GENIE.jpg',
        telephone: '+63-908-940-8747',
        email: 'hello@genie.ph',
        address: {
            '@type': 'PostalAddress',
            streetAddress: 'Skyview Park, Nivel Hills',
            addressLocality: 'Cebu City',
            addressRegion: 'Cebu',
            addressCountry: 'PH'
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: 10.3157,
            longitude: 123.8854
        },
        areaServed: {
            '@type': 'AdministrativeArea',
            name: 'Cebu'
        },
        sameAs: [
            'https://web.facebook.com/geniephilippines',
            'https://www.instagram.com/genie.ph/',
            'http://tiktok.com/@genie.ph',
            'https://www.youtube.com/@genieph'
        ],
        contactPoint: {
            '@type': 'ContactPoint',
            telephone: '+63-908-940-8747',
            contactType: 'customer service',
            areaServed: 'PH',
            availableLanguage: ['English', 'Filipino']
        },
        priceRange: '₱₱'
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export default function ContactPage() {
    return (
        <>
            <ContactPageSchema />
            <ContactClient />
        </>
    )
}
