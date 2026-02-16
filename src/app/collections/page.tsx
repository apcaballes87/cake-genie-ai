import { Metadata } from 'next'
import { getDesignCategories, getAllRecentDesigns } from '@/services/supabaseService'
import CollectionsClient from './CollectionsClient'

export const revalidate = 3600; // ISR: revalidate every hour

export const metadata: Metadata = {
    title: 'Cake Design Collections | Genie.ph',
    description: 'Browse thousands of custom cake designs organized by category. From birthday cakes to weddings, find the perfect design and get instant AI pricing.',
    alternates: {
        canonical: 'https://genie.ph/collections',
    },
}

export default async function CollectionsPage() {
    const [categoriesRes, recentRes] = await Promise.all([
        getDesignCategories().catch(() => ({ data: [], error: null })),
        getAllRecentDesigns(24).catch(() => ({ data: [], error: null })),
    ]);

    const categories = categoriesRes.data || [];
    const recentDesigns = recentRes.data || [];

    return <CollectionsClient categories={categories} recentDesigns={recentDesigns} />
}
