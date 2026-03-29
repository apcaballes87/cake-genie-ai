import ReviewsManagementClient from './ReviewsManagementClient'
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata'

export const metadata = buildNoIndexPageMetadata({
    title: 'Manage Reviews - Merchant Dashboard',
    description: 'Manage and respond to customer reviews for your shop.',
})

export default function MerchantReviewsPage() {
    return <ReviewsManagementClient />
}