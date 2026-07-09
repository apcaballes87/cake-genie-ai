import { buildMarketingPageMetadata } from '@/lib/utils/metadata'
import SupplierSignupClient from './SupplierSignupClient'

export const metadata = buildMarketingPageMetadata({
  title: 'Supplier Signup for Cebu Event Businesses',
  description: 'Apply to join Genie.ph as an event supplier. Cakes, catering, photo and video, hosting, coordinators, stylists, rentals, and other celebration services are welcome.',
  canonicalPath: 'https://genie.ph/suppliers/signup',
})

function SupplierSignupSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': 'https://genie.ph/suppliers/signup#webpage',
    name: 'Supplier Signup for Cebu Event Businesses',
    description: 'Application form for local event suppliers who want to join the Genie.ph celebration marketplace.',
    url: 'https://genie.ph/suppliers/signup',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Genie.ph',
      url: 'https://genie.ph',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  )
}

export default function SupplierSignupPage() {
  return (
    <>
      <SupplierSignupSchema />
      <SupplierSignupClient />
    </>
  )
}
