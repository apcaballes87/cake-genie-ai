import Link from 'next/link'
import { CakeGenieReview } from '@/lib/database.types'
import ReviewsDisplay from '@/components/ReviewsDisplay'

type HomepageAeoSectionsProps = {
  reviews: CakeGenieReview[]
}

export default function HomepageAeoSections({ reviews }: HomepageAeoSectionsProps) {
  return (
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
  )
}
