import AboutClient from './AboutClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile'

export const metadata = buildMarketingPageMetadata({
    title: 'About the Marketplace and Team',
    description: 'Learn about Genie.ph, the AI-powered custom cake marketplace in Cebu, our mission, and how we connect customers with local cake artisans.',
    canonicalPath: 'https://genie.ph/about',
})

export default function AboutPage() {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About Genie.ph',
        description: 'Genie.ph is an AI-powered custom cake ordering platform connecting customers with local bakers.',
        url: `${genieBusinessProfile.siteUrl}/about`,
        mainEntity: {
            '@id': genieBusinessProfile.organizationId,
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
