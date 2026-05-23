import ReviewsClient from './ReviewsClient'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'
import { createClient } from '@/lib/supabase/server'
import { normalizePublicReviews, REVIEW_SELECT } from '@/lib/reviews'
import { SupabaseClient } from '@supabase/supabase-js'
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile'

export const metadata = buildMarketingPageMetadata({
    title: 'Customer Reviews and Testimonials',
    description: 'Read reviews and testimonials from customers who ordered custom cakes through Genie.ph.',
    canonicalPath: 'https://genie.ph/reviews',
})

async function getReviews() {
  const supabase: SupabaseClient = await createClient();
  
  const { data, error } = await supabase
    .from('cakegenie_reviews')
    .select(REVIEW_SELECT)
    .eq('is_visible', true)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(20);

  return { reviews: normalizePublicReviews(data), error };
}

export default async function ReviewsPage() {
  const { reviews, error } = await getReviews();
  const reviewSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${genieBusinessProfile.siteUrl}/reviews#page`,
    name: 'Genie.ph customer reviews',
    url: `${genieBusinessProfile.siteUrl}/reviews`,
    description: 'Verified customer reviews and testimonials for Genie.ph cake orders.',
    isPartOf: {
      '@id': genieBusinessProfile.websiteId,
    },
    about: {
      '@id': genieBusinessProfile.organizationId,
    },
  }
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }}
      />
      <ReviewsClient initialReviews={reviews} error={error?.message || null} />
    </>
  )
}
