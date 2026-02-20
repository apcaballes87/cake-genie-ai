import { Metadata } from 'next'
import ReviewsClient from './ReviewsClient'

export const metadata: Metadata = {
    title: 'Customer Reviews | Genie.ph',
    description: 'Read reviews and testimonials from our happy customers who ordered custom cakes through Genie.ph in Cebu.',
    // Noindex: page is thin "coming soon" content — no ranking value yet.
    // Re-enable once real review content is live.
    robots: {
        index: false,
        follow: true,
    },
}

export default function ReviewsPage() {
    return <ReviewsClient />
}
