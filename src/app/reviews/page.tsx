import ReviewsClient from './ReviewsClient'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'
import { createClient } from '@/lib/supabase/server'
import { normalizePublicReviews, REVIEW_SELECT } from '@/lib/reviews'
import { SupabaseClient } from '@supabase/supabase-js'

export const metadata = buildNoIndexPageMetadata({
    title: 'Customer Reviews and Testimonials',
    description: 'Read reviews and testimonials from customers who ordered custom cakes through Genie.ph.',
    follow: true,
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
  
  return <ReviewsClient initialReviews={reviews} error={error?.message || null} />
}
