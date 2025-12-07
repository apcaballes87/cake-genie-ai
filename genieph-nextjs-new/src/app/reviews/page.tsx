import { Metadata } from 'next'
import ReviewsClient from './ReviewsClient'

export const metadata: Metadata = {
    title: 'Reviews | Genie.ph',
    description: 'Read reviews and testimonials from our happy customers.',
}

export default function ReviewsPage() {
    return <ReviewsClient />
}
