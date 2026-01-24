import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SharedDesignClient from './SharedDesignClient'

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
        .from('cakegenie_shared_designs')
        .select('title, description, alt_text, customized_image_url, cake_type, cake_size, final_price')
        .eq('url_slug', slug)
        .single()

    if (!design) {
        return { title: 'Design Not Found' }
    }

    const title = design.title || 'Custom Cake Design'

    // Construct a rich description for SEO
    let description = design.description || 'A beautiful custom cake design created with Genie.ph.'
    const details = []
    if (design.cake_type) details.push(`Type: ${design.cake_type}`)
    if (design.cake_size) details.push(`Size: ${design.cake_size}`)
    if (design.final_price) details.push(`Price: ₱${design.final_price.toLocaleString()}`)

    if (details.length > 0) {
        description = `${description} | ${details.join(' - ')}`
    }

    return {
        title,
        description,
        alternates: {
            canonical: `https://genie.ph/designs/${slug}`,
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
            url: `https://genie.ph/designs/${slug}`,
            images: [
                {
                    url: design.customized_image_url,
                    width: 1200,
                    height: 630,
                    alt: design.alt_text || design.title || 'Custom cake design',
                },
            ],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [design.customized_image_url],
        },
        other: {
            thumbnail: design.customized_image_url,
            'image_src': design.customized_image_url,
            // PageMap DataObject for Google thumbnail
            'pagemap': `<DataObject type="thumbnail"><Attribute name="src">${design.customized_image_url}</Attribute></DataObject>`,
        },
    }
}

// JSON-LD Schema for Shared Design - Enhanced for Google Image Thumbnails
function DesignSchema({ design }: { design: any }) {
    // Sanitize string to prevent script injection in JSON-LD
    const sanitize = (str: string) => str ? str.replace(/<\/script/g, '<\\/script') : '';

    const imageUrl = design.customized_image_url;
    const pageUrl = `https://genie.ph/designs/${design.url_slug || ''}`;

    // ImageObject for better image indexing
    const imageObject = {
        '@type': 'ImageObject',
        url: imageUrl,
        contentUrl: imageUrl,
        width: 1200,
        height: 1200,
        name: sanitize(design.alt_text || design.title || 'Custom Cake Design'),
        caption: sanitize(design.description || `Custom ${design.cake_type} cake design`)
    };

    // Product schema
    const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: sanitize(design.title || 'Custom Cake Design'),
        description: sanitize(design.description || `Custom ${design.cake_type} cake design`),
        image: [imageUrl],
        brand: {
            '@type': 'Brand',
            name: 'Genie.ph'
        },
        offers: {
            '@type': 'Offer',
            price: design.final_price || 0,
            priceCurrency: 'PHP',
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            seller: {
                '@type': 'Organization',
                name: 'Genie.ph'
            },
            url: pageUrl
        },
        category: design.cake_type,
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '156',
            bestRating: '5',
            worstRating: '1'
        },
        ...(design.alt_text && { 'alternateName': sanitize(design.alt_text) })
    };

    // WebPage schema with known image
    const webPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: sanitize(design.title || 'Custom Cake Design'),
        description: sanitize(design.description || `Custom ${design.cake_type} cake design`),
        url: pageUrl,
        mainEntity: {
            '@type': 'Product',
            name: sanitize(design.title || 'Custom Cake Design'),
            image: imageUrl
        },
        primaryImageOfPage: {
            '@type': 'ImageObject',
            url: imageUrl
        },
        thumbnailUrl: imageUrl
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

export default async function SharedDesignPage({ params }: Props) {
    const { slug } = await params
    const supabase = await createClient()

    const { data: design } = await supabase
        .from('cakegenie_shared_designs')
        .select('*')
        .eq('url_slug', slug)
        .single()

    if (!design) {
        notFound()
    }

    return (
        <>
            <DesignSchema design={design} />
            <SharedDesignClient design={design} />
        </>
    )
}
