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
    'genie-ph-vs-goldilocks': {
        title: 'Genie.ph vs Goldilocks: Custom Cakes vs Chain Bakery in Cebu',
        metaTitle: 'Genie.ph vs Goldilocks: Which is Better for Custom Cakes in Cebu?',
        metaDescription: 'Goldilocks vs Genie.ph — compare pricing, design options, and delivery for custom cakes in Cebu. See why local artisan bakers beat chain bakeries for personalized celebrations.',
        intro: 'Goldilocks is a Filipino institution — everyone has had a Goldilocks cake at some point. But when you want something more personal than a shelf cake with piped letters, how does ordering through Genie.ph compare? This guide breaks it down honestly for Cebu shoppers deciding between the familiar chain and a custom local baker.',
        geniePros: [
            'Fully custom designs — upload any reference photo or idea',
            'AI-powered instant pricing before you commit',
            'Order from 20+ verified local Cebu bakers in one place',
            'Bento cakes starting at ₱350 — Goldilocks doesn\'t offer them',
            'Personal messages, specific colors, and themed decorations',
            'Same-day or next-day ordering available with advance notice',
        ],
        alternativeName: 'Goldilocks',
        alternativePros: [
            'Walk-in availability — no advance order needed for standard cakes',
            'Consistent and familiar flavors Filipinos trust',
            'Multiple branches across Cebu for easy pickup',
            'Loyalty rewards program (Goldilocks Club)',
            'Great for last-minute celebrations and pasalubong',
            'Ready-made cakes with fast turnaround',
        ],
        features: [
            { feature: 'Custom Design', genie: 'Fully personalized — any theme, style, or concept', alternative: 'Limited to in-store designs and standard decorations' },
            { feature: 'Bento Cakes', genie: 'Yes — starting at ₱350', alternative: 'Not available' },
            { feature: 'Pricing Transparency', genie: 'AI instant estimate before ordering', alternative: 'Fixed price list in-store' },
            { feature: 'Price Range', genie: 'Bento ₱350–₱650 / Round from ₱800', alternative: 'Round cakes from ₱500–₱2,500+' },
            { feature: 'Ordering Method', genie: 'Online, 24/7', alternative: 'In-store or Goldilocks website/app' },
            { feature: 'Delivery', genie: 'Metro Cebu delivery via partner bakers', alternative: 'Delivery via Goldilocks website/Grab' },
            { feature: 'Lead Time', genie: '2–5 days for custom, same-day for some', alternative: 'Walk-in for ready cakes, 2–3 days for custom' },
            { feature: 'Baker Options', genie: '20+ local verified bakers to compare', alternative: 'One brand, standardized recipes' },
            { feature: 'Flavor Customization', genie: 'Choose from each baker\'s flavor list', alternative: 'Fixed menu of Goldilocks flavors' },
        ],
        verdict: 'Goldilocks is unbeatable for convenience — walk in, grab a cake, and go. For last-minute needs or classic Filipino flavors, it is a safe and trusted choice. But if you want a cake that actually matches your party theme, has a specific message, or is a trending bento style — Genie.ph\'s local Cebu bakers give you unlimited options at often better prices. For special occasions that deserve a special cake, go custom.',
        ctaText: 'Upload a reference photo and see instant pricing from local Cebu bakers',
    },
    'genie-ph-vs-red-ribbon': {
        title: 'Genie.ph vs Red Ribbon: Custom Cakes vs Chain Bakery in Cebu',
        metaTitle: 'Genie.ph vs Red Ribbon Cakes: Custom vs Chain in Cebu 2026',
        metaDescription: 'Comparing Genie.ph and Red Ribbon for custom cakes in Cebu. See design options, pricing, bento availability, and delivery — and find out which is right for your celebration.',
        intro: 'Red Ribbon\'s Black Forest and Dedication Cake are legendary. But when your celebration calls for something more — a Korean-style bento, a fondant character cake, or a minimalist design that matches your aesthetic — how does Red Ribbon stack up against ordering from a local Cebu baker on Genie.ph? Here\'s the honest comparison.',
        geniePros: [
            'Unlimited custom designs — minimalist, fondant, character, bento, floral',
            'Bento cakes available from ₱350 — a Red Ribbon gap',
            'Compare quotes from multiple local Cebu bakers',
            'AI pricing tool gives instant estimates from your reference photo',
            'Personal color palettes, custom toppers, and themed decorations',
            'Online ordering, 24/7 — no branch visits required',
        ],
        alternativeName: 'Red Ribbon',
        alternativePros: [
            'Iconic Black Forest and Dedication Cake flavors Filipinos love',
            'Branch walk-ins across Cebu for easy last-minute pickup',
            'Seasonal specialty cakes (mango, ube) and holiday editions',
            'Birthday packages with matching cupcakes and pastries',
            'Established trust and quality consistency across branches',
            'Delivery via Red Ribbon website or GrabFood',
        ],
        features: [
            { feature: 'Custom Design Flexibility', genie: 'Fully personalized — any theme or style', alternative: 'Limited to signature Red Ribbon designs' },
            { feature: 'Bento Cakes', genie: 'Yes — from ₱350', alternative: 'Not available' },
            { feature: 'Korean / Minimalist Style', genie: 'Yes — top trending styles available', alternative: 'Not available' },
            { feature: 'Pricing Transparency', genie: 'AI instant estimate upfront', alternative: 'Fixed price list, published online' },
            { feature: 'Price Range (Round)', genie: '₱800–₱2,500 depending on size/design', alternative: '₱500–₱3,500 depending on size/tier' },
            { feature: 'Ordering Method', genie: 'Online platform, 24/7', alternative: 'Website, GrabFood, or branch walk-in' },
            { feature: 'Lead Time', genie: '2–5 days for custom designs', alternative: 'Walk-in for ready cakes, 2–3 days for custom' },
            { feature: 'Custom Message / Text', genie: 'Any text, font-style guidance to baker', alternative: 'Standard dedication message on cake' },
            { feature: 'Number of Baker Options', genie: '20+ local Cebu bakers', alternative: 'One brand, standardized product' },
        ],
        verdict: 'Red Ribbon\'s signature cakes — especially the Black Forest and their holiday specials — are genuinely hard to beat for classic Filipino celebrations. They are reliable, accessible, and well-loved. But for anyone who wants their cake to look like the Pinterest or TikTok vision in their head, Genie.ph\'s local baker network is the right call. Custom is not always more expensive, and it is always more personal.',
        ctaText: 'See custom cake designs from Cebu bakers — starting at ₱350',
    },
    'genie-ph-vs-contis': {
        title: 'Genie.ph vs Contis: Custom Cakes vs the Moist Chocolate Cake in Cebu',
        metaTitle: 'Genie.ph vs Contis Cake in Cebu: Custom vs Chain Bakery Comparison',
        metaDescription: 'Contis vs Genie.ph for custom cakes in Cebu. Compare Contis\' iconic Moist Chocolate Cake against ordering a personalized cake from a local Cebu baker — design, price, and delivery.',
        intro: 'Contis\' Moist Chocolate Cake is one of those things Cebuanos travel to the mall specifically for. It is that good. But Contis and Genie.ph serve very different occasions — and knowing which to choose for your next celebration can save you time, money, and cake regret. Here is how they compare.',
        geniePros: [
            'Fully custom designs — any concept, theme, or style',
            'Bento cakes from ₱350 (Contis doesn\'t offer bento format)',
            'Local Cebu homebakers with artisan-quality flavors',
            'AI pricing from uploaded reference photos',
            'Home delivery across Metro Cebu from your chosen baker',
            'Choose your baker, compare prices, and customize freely',
        ],
        alternativeName: 'Contis',
        alternativePros: [
            'Iconic Moist Chocolate Cake — arguably the best in Cebu',
            'Full restaurant dining experience (not just cakes)',
            'Consistent quality across all branches and visits',
            'SM Seaside and other Cebu mall locations for easy access',
            'Packaged cakes great for pasalubong and office celebrations',
            'Reliable for parties — just pick up and serve',
        ],
        features: [
            { feature: 'Signature Flavor', genie: 'Baker-dependent — many chocolate specialists', alternative: 'Legendary Moist Chocolate Cake' },
            { feature: 'Custom Design', genie: 'Fully personalized for any occasion', alternative: 'Standard designs with limited customization' },
            { feature: 'Bento Cakes', genie: 'Yes — popular format, from ₱350', alternative: 'Not available' },
            { feature: 'Dine-in Option', genie: 'No — delivery and pickup only', alternative: 'Yes — full restaurant and bakeshop' },
            { feature: 'Price Range', genie: 'Bento ₱350–₱650 / Round from ₱800', alternative: 'Whole cakes ₱700–₱2,800+' },
            { feature: 'Ordering Method', genie: 'Online, 24/7', alternative: 'In-store, Contis website, or GrabFood' },
            { feature: 'Delivery in Cebu', genie: 'Metro Cebu via baker', alternative: 'Available via GrabFood and own delivery' },
            { feature: 'Customization Level', genie: 'Unlimited — colors, text, toppers, style', alternative: 'Limited to standard piped designs' },
            { feature: 'Lead Time', genie: '2–5 days for custom orders', alternative: 'Same-day for ready cakes, 1–3 days advance for custom' },
        ],
        verdict: 'If you want Contis\' Moist Chocolate Cake specifically, there is nothing like it — order from Contis and enjoy every bite. But if you want a cake that has a specific design, theme, message, or trend (bento, Korean, minimalist, fondant), Genie.ph\'s local Cebu bakers are the smarter choice. The two serve different needs — and for personalized celebrations, local custom wins every time.',
        ctaText: 'Order a custom cake from a local Cebu baker — any design, any occasion',
    },
    'genie-ph-vs-caramia': {
        title: 'Genie.ph vs Caramia Cakes: Custom vs Gelato Cakes in Cebu',
        metaTitle: 'Genie.ph vs Caramia Cakes in Cebu: Which to Choose for Your Celebration?',
        metaDescription: 'Caramia vs Genie.ph — compare gelato cakes vs custom local bakery options in Cebu. See design, pricing, delivery, and occasion suitability to choose the right cake.',
        intro: 'Caramia Cakes and Gelato is one of Cebu\'s most beloved premium dessert destinations. Their gelato-infused cakes and elegant presentation make them a go-to for upscale occasions. But if your celebration calls for a personalized design — a bento cake, a fondant character, or a themed creation — how does Caramia compare to ordering through Genie.ph? Here is the breakdown.',
        geniePros: [
            'Fully personalized designs — any theme, style, or concept',
            'Bento cakes from ₱350 — Caramia\'s niche is gelato, not bento',
            'Access to 20+ verified Cebu bakers with diverse styles',
            'AI instant pricing from any reference photo',
            'Korean, minimalist, floral, fondant — trending styles available',
            'Competitive pricing through baker comparison',
        ],
        alternativeName: 'Caramia',
        alternativePros: [
            'Unique gelato-infused cakes and desserts not found elsewhere',
            'Premium upscale presentation perfect for formal occasions',
            'Dine-in gelato experience alongside cake',
            'Established Cebu brand with loyal following',
            'Beautiful packaging and ready-to-gift presentation',
            'Consistent quality and signature flavors',
        ],
        features: [
            { feature: 'Gelato Cakes', genie: 'Not available', alternative: 'Signature offering — unique to Caramia' },
            { feature: 'Custom Cake Designs', genie: 'Unlimited — any theme, style, colors', alternative: 'Limited to Caramia\'s signature designs' },
            { feature: 'Bento Cakes', genie: 'Yes — starting at ₱350', alternative: 'Not a core offering' },
            { feature: 'Korean / Minimalist Style', genie: 'Yes — top requested styles available', alternative: 'Not a specialty' },
            { feature: 'Price Range', genie: 'Bento ₱350–₱650 / Round from ₱800', alternative: 'Premium pricing — cakes from ₱1,200+' },
            { feature: 'Ordering Method', genie: 'Online platform, 24/7', alternative: 'In-store, website, or GrabFood' },
            { feature: 'Dine-in Experience', genie: 'No', alternative: 'Yes — gelato parlor and café experience' },
            { feature: 'Baker Variety', genie: '20+ local Cebu bakers', alternative: 'Single brand, consistent recipes' },
            { feature: 'Personalization Level', genie: 'Full — colors, toppers, text, style', alternative: 'Limited to Caramia\'s catalog designs' },
        ],
        verdict: 'Caramia is genuinely one-of-a-kind in Cebu — their gelato cakes are unlike anything you can order through a custom baker, and their premium experience is worth it for the right occasion. If you need a gelato cake or want the Caramia dine-in experience, go to Caramia. But for a personalized celebration cake with a specific design, theme, or trending style (bento, Korean, fondant), Genie.ph\'s local baker network gives you far more options at more accessible price points.',
        ctaText: 'Browse custom cake designs from Cebu\'s best local bakers',
    },
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
        return { title: { absolute: 'Comparison Not Found | Genie.ph' } }
    }

    const pageTitle = data.metaTitle.includes('Genie.ph')
        ? data.metaTitle
        : `${data.metaTitle} | Genie.ph`

    return {
        title: { absolute: pageTitle },
        description: data.metaDescription,
        alternates: {
            canonical: `https://genie.ph/compare/${slug}`,
        },
        openGraph: {
            title: pageTitle,
            description: data.metaDescription,
            url: `https://genie.ph/compare/${slug}`,
            siteName: 'Genie.ph',
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: pageTitle,
            description: data.metaDescription,
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
