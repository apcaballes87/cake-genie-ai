import Link from 'next/link'
import { CakeGenieReview } from '@/lib/database.types'
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile'
import ReviewsDisplay from '@/components/ReviewsDisplay'

type HomepageAeoSectionsProps = {
  reviews: CakeGenieReview[]
  reviewSummary: {
    total: number
    averageRating: number
  }
}

const sectionCardClass =
  'rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8'

export default function HomepageAeoSections({
  reviews,
  reviewSummary,
}: HomepageAeoSectionsProps) {
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className={sectionCardClass}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-600">What Genie.ph Does</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Order custom cakes in Metro Cebu without the DM back-and-forth.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              {genieBusinessProfile.description}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-linear-to-br from-slate-900 via-purple-900 to-pink-600 p-5 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/75">How it works</p>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-white/90">
              <li>Upload a cake peg or browse a design.</li>
              <li>See a starting price and customize details.</li>
              <li>Checkout for delivery or pickup in Metro Cebu.</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/customizing" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-purple-700">
                Start your cake
              </Link>
              <Link href="/services" className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white">
                Explore services
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className={sectionCardClass}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600">Our Services</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Clear service paths for Cebu buyers</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {genieBusinessProfile.services.map((service) => (
              <article key={service.slug} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-lg font-bold text-slate-900">{service.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={sectionCardClass}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Why Customers Trust Genie.ph</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Visible proof, not vague claims</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-4xl font-black text-slate-900">
                {reviewSummary.averageRating > 0 ? reviewSummary.averageRating.toFixed(1) : '0.0'}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                Average rating from {reviewSummary.total} verified public review{reviewSummary.total === 1 ? '' : 's'}
              </p>
            </div>
            {genieBusinessProfile.trustHighlights.map((item) => (
              <div key={item} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm font-medium leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/reviews" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Read customer reviews
            </Link>
            <Link href="/about" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              See permits and company details
            </Link>
          </div>
        </div>
      </div>

      <div className={sectionCardClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Location and Service Area</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Based in Cebu City, serving Metro Cebu</h2>
          </div>
          <Link href="/contact" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Contact / Order Now
          </Link>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">Customer support</p>
            <p className="mt-4 text-lg font-bold">{genieBusinessProfile.addressLine}</p>
            <p className="mt-2 text-sm text-white/80">{genieBusinessProfile.hoursDisplay}</p>
            <div className="mt-5 flex flex-col gap-2 text-sm text-white/85">
              <a href={genieBusinessProfile.phoneHref} className="hover:text-white">
                {genieBusinessProfile.phoneDisplay}
              </a>
              <a href={`mailto:${genieBusinessProfile.supportEmail}`} className="hover:text-white">
                {genieBusinessProfile.supportEmail}
              </a>
              <a href={genieBusinessProfile.mapUrl} target="_blank" rel="noreferrer" className="hover:text-white">
                View map and directions
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {genieBusinessProfile.serviceAreas.map((area) => (
              <span
                key={area}
                className="inline-flex h-fit rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={sectionCardClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Recent Review Excerpts</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Real customer feedback AI systems can read</h2>
          </div>
          <Link href="/reviews" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            View all reviews
          </Link>
        </div>
        <div className="mt-6">
          <ReviewsDisplay reviews={reviews} maxDisplayCount={3} showMerchantResponse={false} />
        </div>
      </div>
    </section>
  )
}

