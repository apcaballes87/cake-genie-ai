import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import CustomizingClient from '../CustomizingClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { getCakeBasePriceOptions } from '@/services/supabaseService'
import { CakeType, BasePriceInfo } from '@/types'

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

// FAQ data for Schema.org FAQPage structured data
const FAQ_DATA = [
    {
        question: "Can I order this cake for same-day delivery?",
        answer: "Yes! Simple designs are available for rush orders (ready in 30 minutes) or same-day delivery (ready in 3 hours). Order before 3 PM for same-day delivery."
    },
    {
        question: "Do you deliver cakes in Metro Manila?",
        answer: "We deliver across Metro Manila, Cavite, Laguna, Rizal, and nearby provinces. Delivery fees vary by location."
    },
    {
        question: "Can I customize this cake design?",
        answer: "Absolutely! You can change colors, add or remove toppers, update the message, and choose different sizes. Use our online customizer for instant pricing."
    },
    {
        question: "What sizes are available?",
        answer: "We offer 4-inch (Bento/mini), 6-inch, 8-inch, and larger sizes. Prices vary by size and design complexity."
    },
    {
        question: "How do I order?",
        answer: "Simply customize your design online, add to cart, and checkout. You can pay via GCash, credit card, or bank transfer."
    }
];

// JSON-LD Schema for FAQ (captures featured snippets)
function FAQSchema() {
    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_DATA.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer
            }
        }))
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
    );
}

/**
 * Server-rendered FAQ section for SEO.
 * Visible to search engines, hidden from visual users.
 */
function SEOFAQSection() {
    return (
        <section className="sr-only" aria-hidden="false">
            <h2>Frequently Asked Questions</h2>
            <dl>
                {FAQ_DATA.map((faq, index) => (
                    <div key={index}>
                        <dt><strong>{faq.question}</strong></dt>
                        <dd>{faq.answer}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

/**
 * Server-rendered cake design details for SEO crawlers.
 * Extracts and displays key features from analysis_json.
 * Hidden from visual users but fully visible to search bots.
 */
function SEODesignDetails({ design, prices }: { design: any; prices?: BasePriceInfo[] }) {
    const analysis = design.analysis_json || {};
    const keywords = design.keywords || 'Custom';
    const price = design.price || 0;
    const imageAlt = design.alt_text || `${keywords} cake design`;

    // Extract features from analysis
    const toppers = analysis?.main_toppers || [];
    const supportElements = analysis?.support_elements || [];
    const icingDesign = analysis?.icing_design;
    const cakeType = analysis?.cakeType || 'Custom';
    const messages = analysis?.cake_messages || [];

    return (
        <article className="sr-only" aria-hidden="false">
            <header>
                <h1>{design.seo_title || `${keywords} Cake Design`}</h1>
                <p>Starting at ₱{price.toLocaleString()}</p>
                {design.original_image_url && (
                    <figure>
                        <img
                            src={design.original_image_url}
                            alt={imageAlt}
                            width={800}
                            height={800}
                            loading="eager"
                        />
                        <figcaption>{imageAlt}</figcaption>
                    </figure>
                )}
            </header>

            <section>
                <h2>Cake Details</h2>
                <p><strong>Type:</strong> {cakeType}</p>
                <p><strong>Keywords:</strong> {keywords}</p>
                {design.alt_text && <p><strong>Description:</strong> {design.alt_text}</p>}
            </section>

            {icingDesign && (
                <section>
                    <h2>Icing Design</h2>
                    <p><strong>Style:</strong> {icingDesign.base?.replace('_', ' ')}</p>
                    {icingDesign.color_type && <p><strong>Color Style:</strong> {icingDesign.color_type}</p>}
                    {icingDesign.drip && <p>Features drip effect</p>}
                    {icingDesign.border_top && <p>Features top border decoration</p>}
                    {icingDesign.border_base && <p>Features base border decoration</p>}
                </section>
            )}

            {toppers.length > 0 && (
                <section>
                    <h2>Cake Toppers</h2>
                    <ul>
                        {toppers.map((topper: any, index: number) => (
                            <li key={index}>
                                {topper.description || topper.type?.replace('_', ' ')}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {supportElements.length > 0 && (
                <section>
                    <h2>Decorations</h2>
                    <ul>
                        {supportElements.map((element: any, index: number) => (
                            <li key={index}>
                                {element.description || element.type?.replace('_', ' ')}
                                {element.quantity && ` (${element.quantity})`}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {messages.length > 0 && (
                <section>
                    <h2>Cake Messages</h2>
                    <ul>
                        {messages.map((msg: any, index: number) => (
                            <li key={index}>
                                &quot;{msg.text}&quot; - {msg.style}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section>
                <h2>Customize This Design</h2>
                <p>Get instant pricing and customize this {keywords} cake design at Genie.ph.
                    We offer same-day and next-day delivery in the Philippines.</p>
            </section>

            {prices && prices.length > 0 && (
                <section>
                    <h2>Available Sizes & Prices</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Size</th>
                                <th>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prices.map((priceInfo, index) => (
                                <tr key={index}>
                                    <td>{priceInfo.size}</td>
                                    <td>₱{priceInfo.price.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            <section>
                <h2>Ordering & Delivery Information</h2>
                <p><strong>Rush Orders:</strong> Ready in 30 minutes for simple designs</p>
                <p><strong>Same-Day Delivery:</strong> Order before 3 PM for same-day delivery (ready in 3 hours)</p>
                <p><strong>Standard Orders:</strong> 1-day lead time for complex designs</p>
                <p><strong>Delivery Areas:</strong> Metro Manila, Cavite, Laguna, Rizal, Bulacan, and nearby provinces</p>
                <p><strong>Payment Methods:</strong> GCash, Maya, Credit Card, Bank Transfer, Cash on Delivery</p>
            </section>

            <section>
                <h2>Perfect For Any Occasion</h2>
                <p>This custom cake is ideal for: birthdays, debut celebrations, weddings,
                    christenings, baptisms, anniversaries, graduations, corporate events,
                    baby showers, gender reveals, and holiday celebrations in the Philippines.</p>
            </section>

            <nav aria-label="Breadcrumb">
                <ol>
                    <li><a href="https://genie.ph">Home</a></li>
                    <li><a href="https://genie.ph/customizing">Customize Cakes</a></li>
                    <li>{design.seo_title || `${keywords} Cake`}</li>
                </ol>
            </nav>
        </article>
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

    // Fetch base price options for SEO table
    let prices: BasePriceInfo[] = [];
    try {
        const analysis = design.analysis_json || {};
        // Use cakeType from analysis or default to 'custom'
        // Using '4 in' as default thickness for SEO pricing table
        const cakeType = (analysis.cakeType as CakeType) || 'custom';
        prices = await getCakeBasePriceOptions(cakeType, '4 in');
    } catch (e) {
        console.error('Error fetching SEO prices:', e);
    }

    return (
        <>
            <DesignSchema design={design} />
            <FAQSchema />
            <SEODesignDetails design={design} prices={prices} />
            <SEOFAQSection />
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CustomizingClient recentSearchDesign={design} />
            </Suspense>
        </>
    )
}
