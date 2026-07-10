import ContactClient from './ContactClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'
import { buildGenieLocalBusinessSchema, genieBusinessProfile } from '@/lib/seo/genieBusinessProfile'

export const metadata = buildMarketingPageMetadata({
    title: 'Contact Us for Cebu Custom Cake Orders',
    description: 'Get in touch with Genie.ph for custom cake orders in Cebu. Visit us at Unit 3, Treehouse Building, R. Aboitiz St. Camputhaw, Cebu City, Cebu or call +63-908-940-8747.',
    canonicalPath: 'https://genie.ph/contact',
})

function ContactPageSchema() {
    const schema = buildGenieLocalBusinessSchema()
    const contactPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        '@id': `${genieBusinessProfile.siteUrl}/contact#page`,
        name: 'Contact Genie.ph',
        url: `${genieBusinessProfile.siteUrl}/contact`,
        mainEntity: {
            '@id': `${genieBusinessProfile.siteUrl}/contact#localbusiness`,
        },
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageSchema) }}
            />
        </>
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
