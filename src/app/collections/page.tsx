import { Metadata } from 'next'
import { getDesignCategories, getAllRecentDesigns } from '@/services/supabaseService'
import CollectionsClient from './CollectionsClient'

export const revalidate = 3600; // ISR: revalidate every hour

export const metadata: Metadata = {
    title: 'Browse Custom Cake Designs by Category | Genie.ph',
    description: 'Explore thousands of custom cake designs in Cebu — birthday cakes, bento cakes, wedding cakes and more. Find a design you love and get an instant AI price.',
    alternates: {
        canonical: 'https://genie.ph/collections',
    },
    openGraph: {
        title: 'Browse Custom Cake Designs by Category | Genie.ph',
        description: 'Thousands of custom cake designs from Cebu bakers. Find your perfect design and get an instant price.',
        url: 'https://genie.ph/collections',
        type: 'website',
        siteName: 'Genie.ph',
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
