import { Metadata } from 'next';
import { ShopClient } from './ShopClient';
import { getMerchants } from '@/services/supabaseService';
import { CakeGenieMerchant } from '@/lib/database.types';

// Static metadata for SEO
export const metadata: Metadata = {
    title: 'Shop Cakes from Partner Bakeshops | Genie.ph',
    description: 'Discover amazing bakeshops and order custom cakes from verified partners across the Philippines. Find the perfect cake for any occasion.',
    keywords: 'cake shop, bakery, custom cakes, Philippines bakeshops, order cakes online, Genie.ph',
    openGraph: {
        title: 'Discover Partner Bakeshops | Genie.ph',
        description: 'Find the perfect cake from our partner bakeries across the Philippines',
        type: 'website',
        siteName: 'Genie.ph',
        url: 'https://genie.ph/shop',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Discover Partner Bakeshops | Genie.ph',
        description: 'Find the perfect cake from our partner bakeries across the Philippines',
    },
};

// JSON-LD Schema for ItemList (Collection of Bakeries)
function ShopSchema({ merchants }: { merchants: CakeGenieMerchant[] }) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Partner Bakeshops',
        description: 'Discover amazing bakeshops and order custom cakes from verified partners across the Philippines.',
        numberOfItems: merchants.length,
        itemListElement: merchants.slice(0, 10).map((merchant, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
                '@type': 'Bakery',
                name: merchant.business_name,
                description: merchant.description,
                image: merchant.profile_image_url || merchant.cover_image_url,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: merchant.city,
                    addressCountry: 'PH',
                },
                url: `https://genie.ph/shop/${merchant.slug}`,
                ...(merchant.rating && {
                    aggregateRating: {
                        '@type': 'AggregateRating',
                        ratingValue: merchant.rating,
                        reviewCount: merchant.review_count,
                    },
                }),
            },
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export default async function ShopPage() {
    const { data: merchants, error } = await getMerchants();

    if (error || !merchants) {
        console.error('Error fetching merchants:', error);
        return <ShopClient merchants={[]} />;
    }

    return (
        <>
            <ShopSchema merchants={merchants} />
            <ShopClient merchants={merchants} />
        </>
    );
}
