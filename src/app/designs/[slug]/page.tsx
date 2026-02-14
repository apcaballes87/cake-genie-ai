import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import LazyImage from '@/components/LazyImage'
import { createClient } from '@/lib/supabase/server'
import SharedDesignClient, { SharedDesign } from './SharedDesignClient'
import { SharedDesignBackButton, SharedDesignCopyButton } from './SharedDesignComponents'
import { Calendar, MapPin, User as UserIcon } from 'lucide-react'
import { AvailabilityType } from '@/lib/utils/availability'

type Props = {
    params: Promise<{ slug: string }>
}

// Availability Info Constant
const AVAILABILITY_INFO: Record<AvailabilityType | string, { label: string; time: string; icon: string; bgColor: string; textColor: string }> = {
    rush: { label: 'Rush Order', time: 'Ready in 30 minutes', icon: '⚡', bgColor: 'bg-green-100', textColor: 'text-green-800' },
    'same-day': { label: 'Same-Day', time: 'Ready in 3 hours', icon: '🕐', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
    normal: { label: 'Standard Order', time: '1-day lead time', icon: '📅', bgColor: 'bg-slate-100', textColor: 'text-slate-800' },
};

export async function generateMetadata(
    { params }: Props,
    _parent: ResolvingMetadata
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
function DesignSchema({ design }: { design: SharedDesign }) {
    // Sanitize string to prevent script injection in JSON-LD
    const sanitize = (str: string) => str ? str.replace(/<\/script/g, '<\\/script') : '';

    const imageUrl = design.customized_image_url;
    const pageUrl = `https://genie.ph/designs/${design.url_slug || ''}`;

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

    const availability = AVAILABILITY_INFO[design.availability_type] || AVAILABILITY_INFO.normal;

    return (
        <>
            <DesignSchema design={design} />

            <div className="flex items-center gap-4 text-center mb-6 justify-center">
                <Image
                    src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20face%20logo.webp"
                    alt="Genie Logo"
                    width={64}
                    height={64}
                    className="w-16 h-16 object-contain"
                    unoptimized
                />
                <div>
                    <h1 className="text-5xl font-extrabold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
                        Genie
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Your Cake Wish, Granted.</p>
                </div>
            </div>

            <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
                <div className="flex items-center gap-4 mb-6">
                    <SharedDesignBackButton />
                    <h1 className="text-2xl sm:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text truncate">
                        {design.title}
                    </h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left: Image */}
                    <div className="relative w-full aspect-square">
                        <LazyImage
                            src={design.customized_image_url}
                            alt={design.alt_text || design.title || 'Custom cake design'}
                            priority={true}
                            fill
                            className="rounded-xl shadow-lg border border-slate-200"
                            imageClassName="object-cover"
                        />
                        <div className="absolute top-3 right-3 flex gap-2 z-10">
                            <SharedDesignCopyButton />
                        </div>
                    </div>

                    {/* Right: Details */}
                    <div className="flex flex-col grow">
                        <p className="text-slate-600 leading-relaxed">{design.description}</p>

                        {design.bill_sharing_enabled && design.event_date ? (
                            <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-3">
                                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-purple-600" />
                                    Delivery Details
                                </h3>
                                <div className="space-y-1 text-sm text-slate-700 pl-6">
                                    <p className="flex items-center"><UserIcon className="w-3.5 h-3.5 mr-2 text-slate-500" /><strong>For:</strong>&nbsp;{design.recipient_name}</p>
                                    <p className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-2 text-slate-500" /><strong>On:</strong>&nbsp;{new Date(design.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {design.event_time}</p>
                                    <p className="flex items-start"><MapPin className="w-3.5 h-3.5 mr-2 text-slate-500 mt-0.5" /><strong>To:</strong>&nbsp;{design.delivery_address}, {design.delivery_city}</p>
                                </div>
                            </div>
                        ) : (
                            <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${availability.bgColor} border border-transparent`}>
                                <span className="text-2xl">{availability.icon}</span>
                                <div>
                                    <p className={`font-bold text-sm ${availability.textColor}`}>{availability.label}</p>
                                    <p className={`text-xs ${availability.textColor.replace('800', '700')}`}>{availability.time}</p>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Type:</span>
                                <span className="text-slate-800 font-semibold">{design.cake_type}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Size:</span>
                                <span className="text-slate-800 font-semibold">{design.cake_size}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Flavor:</span>
                                <span className="text-slate-800 font-semibold">{design.cake_flavor}</span>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-slate-500 font-medium">Price:</span>
                                <span className="text-3xl font-bold text-pink-600">₱{design.final_price?.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Interactive Client Component */}
                        <SharedDesignClient design={design as SharedDesign} />
                    </div>
                </div>
            </div>
            <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
        </>
    )
}
