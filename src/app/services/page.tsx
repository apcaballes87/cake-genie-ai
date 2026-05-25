import Link from 'next/link'
import type { Metadata } from 'next'
import {
  genieBusinessProfile,
  GENIE_BASE_URL,
} from '@/lib/seo/genieBusinessProfile'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'

export const metadata: Metadata = buildMarketingPageMetadata({
  title: 'Custom Cake Services in Cebu',
  description:
    'Explore Genie.ph custom cake services in Cebu including AI price estimates, cake customization, rush delivery, bento cakes, wedding cakes, and edible photo cakes.',
  canonicalPath: `${GENIE_BASE_URL}/services`,
})

export default function ServicesPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${GENIE_BASE_URL}/services#service`,
    name: 'Genie.ph custom cake services in Cebu',
    description:
      'Custom cake ordering, instant AI price estimates, and Metro Cebu cake delivery through Genie.ph.',
    provider: {
      '@id': genieBusinessProfile.organizationId,
    },
    areaServed: genieBusinessProfile.serviceAreas.map((area) => ({
      '@type': 'City',
      name: area,
    })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Genie.ph services',
      itemListElement: genieBusinessProfile.services.map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.name,
          description: service.description,
        },
      })),
    },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: GENIE_BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${GENIE_BASE_URL}/services` },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(233,213,255,0.45),_transparent_35%),linear-gradient(180deg,_#fffdf8,_#f8fafc_35%,_#ffffff)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <section className="overflow-hidden rounded-[2.25rem] border border-purple-100 bg-purple-50/30 p-8 text-slate-900 shadow-[0_15px_40px_-20px_rgba(168,85,247,0.15)] md:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600">Genie.ph Services</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl text-slate-900">
              Custom cake services in <span className="text-purple-600">Cebu</span>, from instant pricing to final delivery.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Genie.ph helps Metro Cebu customers discover a cake design, estimate the price, customize the details, and place an order with vetted local bakers in one flow.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/customizing" className="genie-btn-primary px-6 py-3 rounded-full text-sm font-bold shadow-md hover:scale-[1.02] transition-transform">
                Upload a cake design
              </Link>
              <Link href="/collections" className="genie-btn-secondary border border-purple-200 px-6 py-3 rounded-full text-sm font-bold shadow-xs hover:scale-[1.02] transition-transform">
                Browse cake collections
              </Link>
              <Link href="/reviews" className="genie-btn-secondary border border-purple-200 px-6 py-3 rounded-full text-sm font-bold shadow-xs hover:scale-[1.02] transition-transform">
                Read customer reviews
              </Link>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {genieBusinessProfile.services.map((service) => (
              <article key={service.slug} className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-600">Service</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{service.name}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{service.description}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Location and Service Area</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Metro Cebu fulfillment, clear customer support</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Genie.ph is based in Cebu City and primarily serves Metro Cebu customers who need custom cakes for birthdays, gifts, weddings, and themed events.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {genieBusinessProfile.serviceAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-purple-100 bg-purple-50/20 p-6 text-slate-900 shadow-sm md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600">Need help?</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Talk to Genie.ph</h2>
              <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                <p>{genieBusinessProfile.addressLine}</p>
                <p>{genieBusinessProfile.hoursDisplay}</p>
                <a href={genieBusinessProfile.phoneHref} className="block hover:text-purple-600 transition-colors font-medium">
                  {genieBusinessProfile.phoneDisplay}
                </a>
                <a href={`mailto:${genieBusinessProfile.supportEmail}`} className="block hover:text-purple-600 transition-colors font-medium">
                  {genieBusinessProfile.supportEmail}
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/contact" className="genie-btn-primary px-5 py-2.5 rounded-full text-sm font-bold shadow-md hover:scale-[1.02] transition-transform">
                  Contact us
                </Link>
                <a
                  href={genieBusinessProfile.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="genie-btn-secondary border border-purple-200 px-5 py-2.5 rounded-full text-sm font-bold shadow-xs hover:scale-[1.02] transition-transform"
                >
                  View map
                </a>
              </div>
            </aside>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Helpful next steps</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/how-to-order" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                How to order
              </Link>
              <Link href="/delivery-rates" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Delivery rates
              </Link>
              <Link href="/collections" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Browse collections
              </Link>
              <Link href="/cake-delivery-cebu" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Cake delivery Cebu
              </Link>
              <Link href="/bento-cake-cebu" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Bento cakes Cebu
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
