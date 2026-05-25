import Link from 'next/link'
import { CakeGenieReview } from '@/lib/database.types'
import ReviewsDisplay from '@/components/ReviewsDisplay'

type HomepageAeoSectionsProps = {
  reviews: CakeGenieReview[]
}

const sectionCardClass =
  'rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8'

export default function HomepageAeoSections({ reviews }: HomepageAeoSectionsProps) {
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
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
