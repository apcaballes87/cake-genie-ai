import ReviewsClient from './ReviewsClient'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildNoIndexPageMetadata({
    title: 'Customer Reviews and Testimonials',
    description: 'Read reviews and testimonials from customers who ordered custom cakes through Genie.ph.',
    follow: true,
})

export default function ReviewsPage() {
    return <ReviewsClient />
}
