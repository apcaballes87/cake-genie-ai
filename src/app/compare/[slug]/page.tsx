import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type ComparisonData = {
    title: string
    metaTitle: string
    metaDescription: string
    intro: string
    geniePros: string[]
    alternativeName: string
    alternativePros: string[]
    features: { feature: string; genie: string; alternative: string }[]
    verdict: string
    ctaText: string
}

const comparisons: Record<string, ComparisonData> = {
    'genie-ph-vs-traditional-bakeries': {
        title: 'Genie.ph vs Traditional Bakeries in Cebu',
        metaTitle: 'Genie.ph vs Traditional Bakeries: Custom Cake Ordering in Cebu',
        metaDescription: 'Compare ordering custom cakes through Genie.ph AI marketplace vs visiting traditional bakeshops in Cebu. See pricing, convenience, and quality differences.',
        intro: 'Choosing between ordering a custom cake online through Genie.ph or visiting a traditional bakery in Cebu? Both options have their strengths. This comparison helps you decide which approach works best for your next celebration, whether it is a birthday party in Cebu City or a wedding reception in Mandaue.',
        geniePros: [
            'Instant AI-powered price estimates from uploaded photos',
            'Compare quotes from multiple bakers in one place',
            'Visual customization tool for colors, sizes, and toppers',
            'Secure online payments via GCash, Maya, and cards',
            '24/7 availability to browse and place orders',
            'Access to a curated network of verified artisan bakers',
        ],
        alternativeName: 'Traditional Bakeries',
        alternativePros: [
            'In-person cake tasting before ordering',
            'Face-to-face consultation with the baker',
            'Immediate availability for walk-in purchases',
            'No delivery wait time with direct pickup',
            'Established reputation in local community',
            'Ability to see sample cakes in the display',
        ],
        features: [
            { feature: 'Price Transparency', genie: 'Instant AI estimates upfront', alternative: 'Often requires in-person consultation' },
            { feature: 'Design Customization', genie: 'Visual editor with real-time preview', alternative: 'Verbal description or reference photos' },
            { feature: 'Price Comparison', genie: 'Compare multiple bakers instantly', alternative: 'Visit each shop individually' },
            { feature: 'Ordering Hours', genie: '24/7 online ordering', alternative: 'Limited to shop hours' },
            { feature: 'Payment Options', genie: 'GCash, Maya, credit cards', alternative: 'Cash or bank transfer' },
            { feature: 'Delivery', genie: 'Scheduled delivery across Metro Cebu', alternative: 'Usually pickup only' },
            { feature: 'Lead Time', genie: '3-7 days for custom orders', alternative: '3-14 days depending on baker' },
            { feature: 'Cake Tasting', genie: 'Not available (photos and reviews)', alternative: 'Available at most shops' },
            { feature: 'Starting Price', genie: 'Bento from \u20B1350, Round from \u20B1800', alternative: 'Varies widely, typically \u20B1500+' },
        ],
        verdict: 'Genie.ph excels in convenience, price transparency, and the ability to compare multiple bakers from home. Traditional bakeries win when you want in-person tasting and face-to-face consultations. For busy professionals and those who value convenience, Genie.ph offers a modern alternative. For those who prefer the traditional experience and live near their favorite bakeshop, visiting in person remains a great option.',
        ctaText: 'Try uploading a cake design to see instant pricing',
    },
    'genie-ph-vs-social-media-ordering': {
        title: 'Genie.ph vs Ordering Custom Cakes on Social Media',
        metaTitle: 'Genie.ph vs Facebook/Instagram Cake Ordering: Which Is Better?',
        metaDescription: 'Compare ordering custom cakes on Genie.ph vs through Facebook or Instagram pages in Cebu. Learn about pricing transparency, payment security, and convenience.',
        intro: 'Many Filipinos order custom cakes through Facebook pages and Instagram shops. While social media ordering is popular, it comes with limitations. Here is how the Genie.ph marketplace compares to ordering through social media platforms in Cebu.',
        geniePros: [
            'Transparent upfront pricing via AI analysis',
            'Secure payment processing (no bank transfer scams)',
            'Structured customization with visual preview tools',
            'Verified baker profiles with real portfolio images',
            'Order tracking and customer support',
            'Compare quotes from multiple bakers at once',
        ],
        alternativeName: 'Social Media Ordering',
        alternativePros: [
            'Direct communication with the baker',
            'See latest creations and real customer photos',
            'Flexible negotiation on price and terms',
            'Broader reach including home-based bakers',
            'Easy to share and get recommendations from friends',
            'No need to create a new account',
        ],
        features: [
            { feature: 'Price Transparency', genie: 'Instant AI-generated estimates', alternative: 'DM to inquire, often delayed replies' },
            { feature: 'Payment Security', genie: 'Encrypted payments via GCash/Maya', alternative: 'Direct bank transfer (scam risk)' },
            { feature: 'Baker Verification', genie: 'All bakers vetted and verified', alternative: 'No verification, buyer beware' },
            { feature: 'Design Preview', genie: 'Interactive visual customization', alternative: 'Description via chat messages' },
            { feature: 'Response Time', genie: 'Instant pricing, 24/7', alternative: 'Depends on baker availability' },
            { feature: 'Dispute Resolution', genie: 'Customer support team assists', alternative: 'Direct negotiation with baker' },
            { feature: 'Order History', genie: 'Full order tracking dashboard', alternative: 'Chat history only' },
            { feature: 'Baker Comparison', genie: 'Side-by-side quotes', alternative: 'Message each baker individually' },
        ],
        verdict: 'Genie.ph provides a more secure, transparent, and efficient ordering experience compared to social media. The key advantages are instant pricing, verified bakers, and secure payments. Social media ordering works well when you have a trusted baker you already know, but carries risks with unknown sellers. For first-time orders or when exploring options, Genie.ph offers significant advantages in safety and convenience.',
        ctaText: 'Get instant pricing from verified bakers',
    },
    'custom-cake-pricing-cebu': {
        title: 'Custom Cake Pricing Guide: Cebu 2025',
        metaTitle: 'Custom Cake Prices in Cebu 2025: Complete Pricing Guide',
        metaDescription: 'How much do custom cakes cost in Cebu in 2025? Compare prices for birthday, wedding, and bento cakes across different ordering platforms in Metro Cebu.',
        intro: 'Planning a celebration in Cebu and wondering how much a custom cake will cost? This pricing guide compares current cake prices across different ordering methods in Metro Cebu for 2025. Prices are based on data from Genie.ph partner bakeries and market research across Cebu City, Mandaue, and Lapu-Lapu.',
        geniePros: [
            'AI-powered pricing for any design you upload',
            'Transparent price breakdown by component',
            'Compare prices from 20+ verified bakers',
            'No price markup surprises at checkout',
            'Size and flavor pricing calculators',
            'Weekly price monitoring for market rates',
        ],
        alternativeName: 'Market Average',
        alternativePros: [
            'Widely available at many bakeshops',
            'Opportunity for bulk discounts at some shops',
            'Loyalty programs at established bakeries',
            'Seasonal promotions and holiday specials',
            'Gift bundles with extras like cupcakes',
            'Walk-in availability for last-minute needs',
        ],
        features: [
            { feature: 'Bento Cake (4")', genie: '\u20B1350 - \u20B1650', alternative: '\u20B1400 - \u20B1800' },
            { feature: 'Round 6" (6-8 pax)', genie: '\u20B1800 - \u20B11,500', alternative: '\u20B1800 - \u20B12,000' },
            { feature: 'Round 8" (12-16 pax)', genie: '\u20B11,200 - \u20B12,500', alternative: '\u20B11,500 - \u20B13,000' },
            { feature: 'Round 10" (20-25 pax)', genie: '\u20B11,800 - \u20B13,500', alternative: '\u20B12,000 - \u20B14,500' },
            { feature: '2-Tier Wedding Cake', genie: '\u20B13,500 - \u20B18,000', alternative: '\u20B14,000 - \u20B112,000' },
            { feature: '3-Tier Wedding Cake', genie: '\u20B16,000 - \u20B115,000', alternative: '\u20B18,000 - \u20B120,000+' },
            { feature: 'Character Cake (Fondant)', genie: '\u20B11,500 - \u20B14,000', alternative: '\u20B12,000 - \u20B15,000' },
            { feature: 'Minimalist / Korean Style', genie: '\u20B1800 - \u20B12,000', alternative: '\u20B11,000 - \u20B12,500' },
            { feature: 'Delivery Fee', genie: 'Varies by location (\u20B150-200)', alternative: 'Pickup or \u20B1100-300' },
        ],
        verdict: 'Genie.ph generally offers competitive pricing because you can compare quotes from multiple bakers, driving prices down. Traditional bakeries and social media bakers may charge premiums, especially for elaborate designs where pricing is opaque. The biggest advantage of using Genie.ph for pricing is transparency. You know exactly what you are paying for before you commit.',
        ctaText: 'Upload a design to see exact pricing',
    },
}

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
    return Object.keys(comparisons).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const data = comparisons[slug]

    if (!data) {
        return { title: 'Comparison Not Found' }
    }

    return {
        title: data.metaTitle,
        description: data.metaDescription,
        alternates: {
            canonical: `https://genie.ph/compare/${slug}`,
        },
        openGraph: {
            title: data.metaTitle,
            description: data.metaDescription,
            url: `https://genie.ph/compare/${slug}`,
            siteName: 'Genie.ph',
            type: 'article',
        },
    }
}

export default async function ComparisonPage({ params }: Props) {
    const { slug } = await params
    const data = comparisons[slug]

    if (!data) {
        notFound()
    }

    const pageUrl = `https://genie.ph/compare/${slug}`

    // WebPage schema for comparison pages
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: data.title,
        description: data.metaDescription,
        url: pageUrl,
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://genie.ph' },
                { '@type': 'ListItem', position: 2, name: 'Compare', item: 'https://genie.ph/compare' },
                { '@type': 'ListItem', position: 3, name: data.title, item: pageUrl },
            ],
        },
        about: {
            '@type': 'Thing',
            name: 'Custom Cake Ordering Comparison',
            description: data.metaDescription,
        },
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <main className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100">
                <article className="container mx-auto px-4 py-12 max-w-4xl">
                    {/* Breadcrumb */}
                    <nav className="text-sm text-slate-500 mb-6" aria-label="Breadcrumb">
                        <ol className="flex items-center gap-2">
                            <li><Link href="/" className="hover:text-pink-600">Home</Link></li>
                            <li>/</li>
                            <li><Link href="/compare" className="hover:text-pink-600">Compare</Link></li>
                            <li>/</li>
                            <li className="text-slate-800 font-medium">{data.title}</li>
                        </ol>
                    </nav>

                    {/* Header */}
                    <header className="mb-10">
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                            {data.title}
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            {data.intro}
                        </p>
                    </header>

                    {/* Comparison Table */}
                    <section className="mb-10" aria-label="Feature comparison">
                        <h2 className="text-2xl font-semibold text-slate-800 mb-6">Feature Comparison</h2>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">Feature</th>
                                        <th className="px-4 py-3 text-left font-semibold text-pink-700 border-b border-slate-200 bg-pink-50">Genie.ph</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">{data.alternativeName}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {data.features.map((row, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                            <td className="px-4 py-3 font-medium text-slate-800 border-b border-slate-100">{row.feature}</td>
                                            <td className="px-4 py-3 text-slate-700 border-b border-slate-100 bg-pink-50/30">{row.genie}</td>
                                            <td className="px-4 py-3 text-slate-700 border-b border-slate-100">{row.alternative}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Pros Sections */}
                    <div className="grid md:grid-cols-2 gap-6 mb-10">
                        <section className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-200 p-6" aria-label="Genie.ph advantages">
                            <h2 className="text-lg font-semibold text-pink-700 mb-4">Genie.ph Advantages</h2>
                            <ul className="space-y-2">
                                {data.geniePros.map((pro, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-slate-700">
                                        <span className="text-green-500 mt-0.5 flex-shrink-0">&#10003;</span>
                                        <span>{pro}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                        <section className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-6" aria-label={`${data.alternativeName} advantages`}>
                            <h2 className="text-lg font-semibold text-slate-700 mb-4">{data.alternativeName} Advantages</h2>
                            <ul className="space-y-2">
                                {data.alternativePros.map((pro, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-slate-700">
                                        <span className="text-blue-500 mt-0.5 flex-shrink-0">&#10003;</span>
                                        <span>{pro}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    {/* Verdict */}
                    <section className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-6 mb-10" aria-label="Our verdict">
                        <h2 className="text-2xl font-semibold text-slate-800 mb-4">Our Verdict</h2>
                        <p className="text-slate-700 leading-relaxed">{data.verdict}</p>
                    </section>

                    {/* CTA */}
                    <section className="text-center bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-8 text-white" aria-label="Get started">
                        <h2 className="text-2xl font-bold mb-3">Ready to Try Genie.ph?</h2>
                        <p className="text-pink-100 mb-6">{data.ctaText}</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/cake-price-calculator"
                                className="inline-flex items-center justify-center px-6 py-3 bg-white text-pink-600 font-semibold rounded-lg hover:bg-pink-50 transition-colors"
                            >
                                Try AI Pricing Free
                            </Link>
                            <Link
                                href="/shop"
                                className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
                            >
                                Browse Cake Shop
                            </Link>
                        </div>
                    </section>

                    {/* Related comparisons */}
                    <nav className="mt-10 pt-8 border-t border-slate-200" aria-label="More comparisons">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">More Comparisons</h2>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(comparisons)
                                .filter(([key]) => key !== slug)
                                .map(([key, comp]) => (
                                    <Link
                                        key={key}
                                        href={`/compare/${key}`}
                                        className="px-4 py-2 bg-white/70 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:border-pink-300 hover:text-pink-700 transition-colors"
                                    >
                                        {comp.title}
                                    </Link>
                                ))}
                        </div>
                    </nav>
                </article>
            </main>
        </>
    )
}
