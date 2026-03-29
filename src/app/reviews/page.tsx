import ReviewsClient from './ReviewsClient'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'
import { createClient } from '@/lib/supabase/server'

export const metadata = buildNoIndexPageMetadata({
    title: 'Customer Reviews and Testimonials',
    description: 'Read reviews and testimonials from customers who ordered custom cakes through Genie.ph.',
    follow: true,
})

async function getReviews() {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('cakegenie_reviews')
    .select(`
      *,
      cakegenie_merchants(business_name)
    `)
    .eq('is_published', true)
    .eq('is_verified', true)
    .order('created_at', { ascending: false })
    .limit(20);

  return { reviews: data || [], error };
}

export default async function ReviewsPage() {
  const { reviews, error } = await getReviews();
  
  return <ReviewsClient initialReviews={reviews} error={error?.message || null} />
}
