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
        .select('seo_title, seo_description, alt_text, original_image_url, price, keywords, analysis_json')
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

    // Richer Fallback Description Logic
    let description = design.seo_description

    if (!description && design.analysis_json) {
        // Construct description from analysis features for legacy records
        const analysis = design.analysis_json
        const features = []

        // Colors
        if (analysis.icing_design?.colors) {
            const colors = Object.values(analysis.icing_design.colors)
                .filter(c => typeof c === 'string')
                .join(', ')
            if (colors) features.push(`${analysis.icing_design.base.replace('_', ' ')}: ${colors}`)
        }

        // Toppers
        if (analysis.main_toppers?.length > 0) {
            const topNames = analysis.main_toppers.slice(0, 3).map((t: any) => t.description || t.type).join(', ')
            features.push(`Toppers: ${topNames}`)
        }

        description = `Customize this ${design.keywords || 'custom'} cake design. ${features.join('. ')}. Starting at ₱${design.price?.toLocaleString() || '0'}.`
    } else if (!description) {
        description = `Get instant pricing for this ${design.keywords || 'custom'} cake design. Starting at ₱${design.price?.toLocaleString() || '0'}.`
    }

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
            'image_src': design.original_image_url || '',
            // PageMap DataObject for Google thumbnail
            'pagemap': design.original_image_url ? `<DataObject type="thumbnail"><Attribute name="src">${design.original_image_url}</Attribute></DataObject>` : '',
        },
    }
}

// JSON-LD Schema for SEO - Enhanced for Google Image Thumbnails
function DesignSchema({ design }: { design: any }) {
    const sanitize = (str: string | null | undefined) => str ? str.replace(/<\/script/g, '<\\/script') : '';

    const keywords = design.keywords || 'Custom';
    const title = design.seo_title || `${keywords} Cake`;
    const imageUrl = design.original_image_url;
    const pageUrl = `https://genie.ph/customizing/${design.slug || ''}`;

    // ImageObject for better image indexing
    const imageObject = imageUrl ? {
        '@type': 'ImageObject',
        url: imageUrl,
        contentUrl: imageUrl,
        width: 1200,
        height: 1200,
        name: sanitize(design.alt_text || title || 'Custom Cake Design'),
        caption: sanitize(design.seo_description || `Custom ${keywords} cake design`)
    } : null;

    // Product schema
    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: sanitize(title),
        description: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        image: imageObject || imageUrl,
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
            url: pageUrl
        },
        category: 'Custom Cakes',
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '156',
            bestRating: '5',
            worstRating: '1'
        },
        ...(design.alt_text && { 'alternateName': sanitize(design.alt_text) })
    };

    // WebPage schema with primaryImageOfPage - explicit signal for Google image thumbnails
    const webPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: sanitize(title),
        description: sanitize(design.seo_description || `Custom ${keywords} cake design`),
        url: pageUrl,
        mainEntity: {
            '@type': 'Product',
            name: sanitize(title)
        },
        ...(imageObject && { primaryImageOfPage: imageObject }),
        ...(imageUrl && { thumbnailUrl: imageUrl })
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
            />
        </>
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
