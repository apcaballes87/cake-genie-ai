import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Compare Cake Ordering Options in Cebu | Genie.ph',
    description: 'Compare Genie.ph with traditional bakeries and other cake ordering options in Cebu. See how AI-powered pricing, customization, and delivery options stack up.',
    alternates: {
        canonical: 'https://genie.ph/compare',
    },
}

const comparisons = [
    {
        slug: 'genie-ph-vs-traditional-bakeries',
        title: 'Genie.ph vs Traditional Bakeries',
        description: 'Compare the AI-powered marketplace experience with visiting traditional bakeshops in Cebu.',
        highlight: 'Most Popular',
    },
    {
        slug: 'genie-ph-vs-social-media-ordering',
        title: 'Genie.ph vs Social Media Ordering',
        description: 'See how ordering through Genie.ph compares to ordering custom cakes via Facebook or Instagram.',
        highlight: null,
    },
    {
        slug: 'custom-cake-pricing-cebu',
        title: 'Custom Cake Pricing Guide: Cebu 2025',
        description: 'A comprehensive comparison of custom cake prices across different ordering methods in Cebu City.',
        highlight: 'Price Guide',
    },
]

export default function ComparePage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100">
            <div className="container mx-auto px-4 py-12 max-w-4xl">
                <header className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        Compare Cake Ordering Options
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Find the best way to order custom cakes in Cebu. Compare Genie.ph with traditional methods to see which option works best for your celebration.
                    </p>
                </header>

                <div className="grid gap-6">
                    {comparisons.map((item) => (
                        <Link
                            key={item.slug}
                            href={`/compare/${item.slug}`}
                            className="group block bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 p-6 hover:border-pink-300 hover:shadow-lg transition-all"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-800 group-hover:text-pink-700 transition-colors mb-2">
                                        {item.title}
                                    </h2>
                                    <p className="text-slate-600">{item.description}</p>
                                </div>
                                {item.highlight && (
                                    <span className="flex-shrink-0 ml-4 px-3 py-1 bg-pink-100 text-pink-700 text-xs font-semibold rounded-full">
                                        {item.highlight}
                                    </span>
                                )}
                            </div>
                            <div className="mt-4 text-pink-600 text-sm font-medium group-hover:underline">
                                Read comparison &rarr;
                            </div>
                        </Link>
                    ))}
                </div>

                <nav className="mt-12 pt-8 border-t border-slate-200" aria-label="Related pages">
                    <p className="text-slate-600">
                        Ready to order? <Link href="/cake-price-calculator" className="text-pink-600 hover:text-pink-700 underline font-medium">Try our AI Cake Price Calculator</Link> to get instant pricing, or <Link href="/shop" className="text-pink-600 hover:text-pink-700 underline font-medium">browse our cake shop</Link> for designs available today.
                    </p>
                </nav>
            </div>
        </main>
    )
}
