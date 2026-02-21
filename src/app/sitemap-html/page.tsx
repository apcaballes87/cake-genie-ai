import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
    title: 'HTML Sitemap - Genie.ph',
    description: 'Browse all custom cake designs, blog posts, and important links on our sitemap to quickly navigate the Genie.ph marketplace.',
}

export const revalidate = 86400; // Cache for 24 hours

export default async function SitemapHtmlPage() {
    const supabase = await createClient();

    // Fetch up to 500 latest designs for the HTML sitemap
    const { data: recentSearches } = await supabase
        .from('cakegenie_analysis_cache')
        .select('slug, keywords')
        .not('slug', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

    return (
        <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-12 bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200">
                <div className="border-b border-slate-200 pb-6 border-dashed">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">HTML Sitemap</h1>
                    <p className="text-slate-600">Navigate the Genie.ph marketplace easily using this directory of our most important pages and popular designs.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Main Platform Links */}
                    <section>
                        <h2 className="text-xl font-semibold text-purple-700 mb-4 flex items-center gap-2">
                            Platform Navigation
                        </h2>
                        <ul className="space-y-3 pl-4 border-l-2 border-purple-100">
                            <li><Link href="/" className="text-slate-600 hover:text-purple-600 font-medium">Home</Link></li>
                            <li><Link href="/shop" className="text-slate-600 hover:text-purple-600 font-medium">Merchants & Shop</Link></li>
                            <li><Link href="/customizing" className="text-slate-600 hover:text-purple-600 font-medium">Custom Cake Designs</Link></li>
                            <li><Link href="/collections" className="text-slate-600 hover:text-purple-600 font-medium">Collections</Link></li>
                            <li><Link href="/blog" className="text-slate-600 hover:text-purple-600 font-medium">Blog</Link></li>
                        </ul>
                    </section>

                    {/* Support & Legal */}
                    <section>
                        <h2 className="text-xl font-semibold text-pink-600 mb-4 flex items-center gap-2">
                            Company & Support
                        </h2>
                        <ul className="space-y-3 pl-4 border-l-2 border-pink-100">
                            <li><Link href="/about" className="text-slate-600 hover:text-pink-600 font-medium">About Us</Link></li>
                            <li><Link href="/contact" className="text-slate-600 hover:text-pink-600 font-medium">Contact Us</Link></li>
                            <li><Link href="/how-to-order" className="text-slate-600 hover:text-pink-600 font-medium">How to Order</Link></li>
                            <li><Link href="/faq" className="text-slate-600 hover:text-pink-600 font-medium">FAQ</Link></li>
                            <li><Link href="/cake-price-calculator" className="text-slate-600 hover:text-pink-600 font-medium">AI Price Calculator</Link></li>
                        </ul>
                    </section>

                    {/* Legal Pages */}
                    <section>
                        <h2 className="text-xl font-semibold text-indigo-600 mb-4 flex items-center gap-2">
                            Legal Resources
                        </h2>
                        <ul className="space-y-3 pl-4 border-l-2 border-indigo-100">
                            <li><Link href="/terms" className="text-slate-600 hover:text-indigo-600 font-medium">Terms of Service</Link></li>
                            <li><Link href="/privacy" className="text-slate-600 hover:text-indigo-600 font-medium">Privacy Policy</Link></li>
                            <li><Link href="/return-policy" className="text-slate-600 hover:text-indigo-600 font-medium">Return Policy</Link></li>
                        </ul>
                    </section>
                </div>

                {/* Latest Designs */}
                <section className="pt-8 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">Popular Cake Designs</h2>
                        <Link href="/customizing" className="text-sm font-semibold text-purple-600 hover:text-purple-800">
                            View All →
                        </Link>
                    </div>
                    {recentSearches && recentSearches.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {recentSearches.map((design) => (
                                <li key={design.slug}>
                                    <Link
                                        href={`/customizing/${design.slug}`}
                                        className="text-sm text-slate-600 hover:text-pink-600 transition-colors line-clamp-1 p-2 bg-slate-50 rounded-lg hover:bg-pink-50 border border-slate-100 hover:border-pink-200"
                                    >
                                        {design.keywords || 'Custom Cake Design'}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-500 italic">Explore our customizing page to see thousands of uploaded reference designs.</p>
                    )}
                </section>
            </div>
        </main>
    )
}
