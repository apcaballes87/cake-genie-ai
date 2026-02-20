import { Metadata } from 'next'
import ReviewsClient from './ReviewsClient'

export const metadata: Metadata = {
    title: 'Customer Reviews — Cebu Cakes | Genie.ph',
    description: 'Read reviews and testimonials from our happy customers.',
    robots: {
        index: false,
        follow: true,
    },
    alternates: {
        canonical: 'https://genie.ph/reviews',
    },
}

export default function ReviewsPage() {
    return <ReviewsClient />
}
