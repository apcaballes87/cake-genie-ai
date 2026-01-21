import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import CustomizingClient from '../CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params
    const supabase = await createClient()

    const { data: design } = await supabase
        .from('cakegenie_analysis_cache')
        .select('seo_title, seo_description, alt_text, original_image_url, price, keywords')
        .eq('slug', slug)
        .single()

    if (!design) {
        return { title: 'Design Not Found' }
    }

    const priceDisplay = design.price ? ` | Php ${Math.round(design.price).toLocaleString()}` : ''
    // Strip existing "| Genie.ph" suffix to avoid duplication
    const baseSeoTitle = design.seo_title?.replace(/\s*\|\s*Genie\.ph\s*$/i, '') || ''
    const title = baseSeoTitle
        ? `${baseSeoTitle}${priceDisplay} | Genie.ph`
        : `${design.keywords || 'Custom'} Cake${priceDisplay} | Genie.ph`
    const description = design.seo_description || `Get instant pricing for this ${design.keywords || 'custom'} cake design. Starting at ₱${design.price?.toLocaleString() || '0'}.`

    return {
        title,
        description,
        alternates: {
            canonical: `https://genie.ph/customizing/${slug}`,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
        openGraph: {
            title,
            description,
            url: `https://genie.ph/customizing/${slug}`,
            images: design.original_image_url ? [
                {
                    url: design.original_image_url,
                    width: 1200,
                    height: 630,
                    alt: design.alt_text || design.keywords || 'Custom cake design',
                },
            ] : [],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: design.original_image_url ? [design.original_image_url] : [],
        },
        other: {
            thumbnail: design.original_image_url || '',
        },
    }
}

// JSON-LD Schema for SEO
function DesignSchema({ design }: { design: any }) {
    const sanitize = (str: string | null | undefined) => str ? str.replace(/<\/script/g, '<\\/script') : '';

    const keywords = design.keywords || 'Custom';
    const title = design.seo_title || `${keywords} Cake`;

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: sanitize(title),
        description: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        image: design.original_image_url,
        brand: {
            '@type': 'Brand',
            name: 'Genie.ph'
        },
        offers: {
            '@type': 'Offer',
            price: design.price || 0,
            priceCurrency: 'PHP',
            availability: 'https://schema.org/InStock',
            priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            seller: {
                '@type': 'Organization',
                name: 'Genie.ph'
            },
            url: `https://genie.ph/customizing/${design.slug || ''}`
        },
        category: 'Custom Cakes',
        ...(design.alt_text && { 'alternateName': sanitize(design.alt_text) })
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}

export default async function RecentSearchPage({ params }: Props) {
    const { slug } = await params
    const supabase = await createClient()

    const { data: design } = await supabase
        .from('cakegenie_analysis_cache')
        .select('*')
        .eq('slug', slug)
        .single()

    if (!design) {
        notFound()
    }

    return (
        <>
            <DesignSchema design={design} />
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient recentSearchDesign={design} />
            </Suspense>
        </>
    )
}
