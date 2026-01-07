import { Metadata } from 'next';
import { MerchantPageClient } from '../MerchantPageClient';
import { getMerchantBySlug } from '@/services/supabaseService';

interface MerchantPageProps {
    params: Promise<{ merchantSlug: string }>;
}

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({ params }: MerchantPageProps): Promise<Metadata> {
    const { merchantSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);

    if (!merchant) {
        return {
            title: 'Bakeshop Not Found | CakeGenie',
            description: 'The requested bakeshop could not be found.',
        };
    }

    const title = `${merchant.business_name} | CakeGenie Partner Bakeshop`;
    const description = merchant.description || `Order custom cakes from ${merchant.business_name} in ${merchant.city || 'Philippines'}`;

    return {
        title,
        description,
        openGraph: {
            title: merchant.business_name,
            description,
            type: 'website',
            images: merchant.cover_image_url ? [
                {
                    url: merchant.cover_image_url,
                    alt: `${merchant.business_name} cover image`,
                    width: 1200,
                    height: 630,
                }
            ] : merchant.profile_image_url ? [
                {
                    url: merchant.profile_image_url,
                    alt: merchant.business_name,
                }
            ] : [],
            siteName: 'CakeGenie',
        },
        twitter: {
            card: 'summary_large_image',
            title: merchant.business_name,
            description,
            images: merchant.cover_image_url ? [merchant.cover_image_url] :
                merchant.profile_image_url ? [merchant.profile_image_url] : [],
        },
    };
}

// JSON-LD Schema for Local Business / Bakery
function MerchantSchema({ merchant }: { merchant: any }) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Bakery',
        name: merchant.business_name,
        description: merchant.description,
        image: merchant.cover_image_url || merchant.profile_image_url,
        telephone: merchant.phone,
        address: {
            '@type': 'PostalAddress',
            streetAddress: merchant.address,
            addressLocality: merchant.city,
            addressCountry: 'PH'
        },
        url: `https://genie.ph/shop/${merchant.slug}`,
        ...(merchant.rating && {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: merchant.rating,
                reviewCount: merchant.review_count
            }
        })
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export default async function MerchantPage({ params }: MerchantPageProps) {
    const { merchantSlug } = await params;
    const { data: merchant } = await getMerchantBySlug(merchantSlug);

    if (!merchant) {
        return <MerchantPageClient slug={merchantSlug} />;
    }

    return (
        <>
            <MerchantSchema merchant={merchant} />
            <MerchantPageClient slug={merchantSlug} />
        </>
    );
}
