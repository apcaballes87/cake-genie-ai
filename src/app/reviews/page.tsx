import ReviewsClient from './ReviewsClient'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'
import { createClient } from '@/lib/supabase/server'
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
    .select(`
      *,
      cakegenie_merchants(business_name),
      cakegenie_users(first_name, last_name),
      cakegenie_order_items!order_item_id(cake_type, cake_size, customized_image_url, customization_details)
    `)
    .eq('is_visible', true)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(20);

  return { reviews: data || [], error };
}

export default async function ReviewsPage() {
  const { reviews, error } = await getReviews();
  
  return <ReviewsClient initialReviews={reviews} error={error?.message || null} />
}
