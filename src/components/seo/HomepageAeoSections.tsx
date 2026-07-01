import Link from 'next/link'
import { CakeGenieReview } from '@/lib/database.types'
import ReviewsDisplay from '@/components/ReviewsDisplay'
import { PUBLIC_ORDER_FACTS, SUPPORT_PAGE_PATHS } from '@/lib/seo/publicOrderFacts'

type HomepageAeoSectionsProps = {
  reviews: CakeGenieReview[]
}

export default function HomepageAeoSections({ reviews }: HomepageAeoSectionsProps) {
  const answerFacts = [
    {
      label: 'Instant custom pricing',
      body: PUBLIC_ORDER_FACTS.pricingShortSummary,
    },
    {
      label: 'Metro Cebu delivery',
      body: PUBLIC_ORDER_FACTS.deliverySummary,
    },
    {
      label: 'Secure checkout',
      body: PUBLIC_ORDER_FACTS.paymentSummary,
    },
    {
      label: 'Trust proof',
      body: PUBLIC_ORDER_FACTS.trustSummary,
    },
  ]

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-500">Direct Answer</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">What is Genie.ph?</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Genie.ph is an AI-powered custom cake marketplace for Metro Cebu. Customers upload or choose a cake design, get an AI-assisted starting price, customize the cake details, and place an order with Cebu delivery or pickup support.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={SUPPORT_PAGE_PATHS.customizing} className="genie-btn-primary rounded-full px-5 py-2.5 text-sm font-semibold">
                Start a custom cake
              </Link>
              <Link href={SUPPORT_PAGE_PATHS.facts} className="genie-btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold">
                See pricing facts
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {answerFacts.map((fact) => (
              <div key={fact.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">{fact.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{fact.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Facts — structured data block for AI citation */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/50 via-white to-purple-50/50 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-500 mb-4">Key Facts</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-6">Genie.ph at a Glance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            <div>
              <p className="text-3xl font-extrabold text-purple-600">2025</p>
              <p className="text-sm text-slate-600 mt-1">Founded in Cebu</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-purple-600">4.9/5</p>
              <p className="text-sm text-slate-600 mt-1">Average customer rating</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-purple-600">₱499</p>
              <p className="text-sm text-slate-600 mt-1">Starting price bento</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-purple-600">1st</p>
              <p className="text-sm text-slate-600 mt-1">Startup Innovation Summit 2025</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-purple-600">Metro Cebu</p>
              <p className="text-sm text-slate-600 mt-1">Delivery coverage area</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-purple-600">3 Steps</p>
              <p className="text-sm text-slate-600 mt-1">Upload, customize, order</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-500">Customer Reviews</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">What Cebu customers say about ordering cakes through Genie.ph</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                Read real customer feedback on custom cake ordering, delivery, design accuracy, and overall experience in Metro Cebu.
              </p>
            </div>
            <Link href="/reviews" className="genie-btn-secondary rounded-full px-5 py-2.5 text-sm font-semibold">
              View all reviews
            </Link>
          </div>
          <div className="mt-6">
            <ReviewsDisplay reviews={reviews} maxDisplayCount={3} showMerchantResponse={false} />
          </div>
        </div>
      </section>
    </>
  )
}
