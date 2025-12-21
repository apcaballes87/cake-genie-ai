import { Metadata } from 'next';
import { MerchantPageClient } from '../MerchantPageClient';
import { getMerchantBySlug } from '@/services/supabaseService';

interface MerchantPageProps {
    params: Promise<{ slug: string }>;
}

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({ params }: MerchantPageProps): Promise<Metadata> {
    const { slug } = await params;
    const { data: merchant } = await getMerchantBySlug(slug);

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

export default async function MerchantPage({ params }: MerchantPageProps) {
    const { slug } = await params;
    return <MerchantPageClient slug={slug} />;
}
