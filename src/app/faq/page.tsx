import Link from 'next/link'
import { buildMarketingPageMetadata } from '@/lib/utils/metadata'
import { buildFAQPageSchema } from '@/lib/seo/schema'

export const metadata = buildMarketingPageMetadata({
    title: 'Frequently Asked Questions',
    description: 'Find answers to common questions about ordering custom cakes on Genie.ph, including pricing, delivery, customization options, and marketplace policies.',
    canonicalPath: 'https://genie.ph/faq',
})

const faqs = [
    {
        category: 'Ordering & Pricing',
        questions: [
            {
                q: 'How does Genie.ph pricing work?',
                a: 'Genie.ph prices custom cakes using AI-powered image analysis that evaluates complexity, size, decorations, and icing style to generate instant quotes from partner bakeries in Cebu. Bento cakes start at ₱350, standard 1-tier cakes from ₱800, and multi-tier cakes from ₱1,500. Upload a photo to the Cake Price Calculator for a free estimate with no commitment required.'
            },
            {
                q: 'What payment methods do you accept?',
                a: 'Genie.ph accepts GCash, Maya (formerly PayMaya), bank transfers (BDO, BPI, Metrobank), and all major credit/debit cards processed securely via Xendit. All transactions are PCI-DSS compliant and encrypted end-to-end. Choose your preferred method at checkout.'
            },
            {
                q: 'Can I get a price estimate before placing an order?',
                a: 'Yes — upload any cake design photo to the Cake Price Calculator and receive an instant AI-generated price estimate in under 10 seconds. No account or commitment required. After estimating, you can customize the design and compare quotes from multiple bakeries before ordering.'
            },
            {
                q: 'Is there a minimum order amount?',
                a: 'Minimum order amounts vary by merchant. Bento cakes typically start at ₱350 (serves 1–2), standard round cakes from ₱800 (serves 4–6), and multi-tier event cakes from ₱1,500. Each bakery sets its own minimums based on design complexity and ingredients.'
            },
        ]
    },
    {
        category: 'Customization',
        questions: [
            {
                q: 'What can I customize on my cake?',
                a: 'Genie.ph lets you customize icing colors and style, cake flavors (chocolate, ube, vanilla, mocha), sizes from bento to multi-tier, toppers and decorations, cake messages, fondant or buttercream finish, drip effects, and edible photo prints. Use the AI-powered visual editor to modify any element and see price updates in real time.'
            },
            {
                q: 'Can I upload my own design?',
                a: 'Yes — upload any cake photo or inspiration image and the AI analyzes it into customizable components: icing, toppers, colors, and messages. You can then modify each element individually, swap decorations, change colors, and add personalized text to create your perfect cake.'
            },
            {
                q: 'What cake sizes are available?',
                a: 'Genie.ph offers bento cakes (4 inches, serves 1–2, from ₱350), round cakes (6–12 inches, serves 4–20+), square cakes, rectangle cakes, and multi-tier cakes (2–3 tiers for weddings and large events). Cupcake sets of 12 pieces start at ₱499. Each baker may have slightly different size offerings.'
            },
        ]
    },
    {
        category: 'Delivery & Availability',
        questions: [
            {
                q: 'Where does Genie.ph deliver?',
                a: 'Genie.ph delivers throughout Metro Cebu: Cebu City, Mandaue City, Lapu-Lapu City (Mactan), Talisay City, and select areas in Liloan, Consolacion, and Minglanilla. Free delivery is available within Cebu City proper. Delivery coverage depends on the specific baker — check the delivery rates page for exact zones and fees.'
            },
            {
                q: 'How long does delivery take?',
                a: 'Custom cakes require 1–3 days lead time for the baker to craft your design, plus same-day or next-day delivery within Metro Cebu. Order by 3 PM for next-day delivery slots. Rush orders may be available from select merchants for an additional fee — contact the baker directly through the platform.'
            },
            {
                q: 'Can I pick up my order instead?',
                a: 'Yes — many partner bakeries offer pickup options. During checkout, select delivery or pickup from the baker\'s location. Pickup availability and hours vary by merchant, typically 9 AM to 6 PM daily. Pickup eliminates delivery fees entirely.'
            },
        ]
    },
    {
        category: 'About Genie.ph',
        questions: [
            {
                q: 'What is Genie.ph?',
                a: 'Genie.ph is the Philippines\' first AI-powered marketplace for custom cakes, founded in 2024 in Cebu City. Genie.ph connects customers with vetted local bakers, provides instant AI pricing from cake photos, and offers a visual customization tool. Genie.ph has served thousands of custom cake orders across Metro Cebu with a 4.9/5 average customer rating.'
            },
            {
                q: 'How is Genie.ph different from ordering directly from a bakery?',
                a: 'Genie.ph offers instant AI pricing from uploaded photos, quotes from multiple bakers for comparison, a visual customization tool with real-time price updates, secure online payments via Xendit, and access to a curated network of vetted artisan bakers — all on one platform. Customers save an average of 30 minutes per order versus contacting bakeries individually.'
            },
            {
                q: 'Are the bakers on Genie.ph verified?',
                a: 'Yes — all baker partners undergo a verification process that reviews portfolio quality, food safety practices, and customer feedback before onboarding. Genie.ph continuously monitors ratings and quality metrics, and only bakers maintaining a 4.5+ average rating remain on the platform.'
            },
        ]
    },
    {
        category: 'Refunds & Issues',
        questions: [
            {
                q: 'What is your refund policy?',
                a: 'Custom cakes are perishable, made-to-order products and are generally non-returnable. If there is a significant quality issue or the cake does not match the agreed-upon design, contact customer service at +63-908-940-8747 within 24 hours of receiving your order with photos. Genie.ph coordinates with the baker to resolve issues via replacement or partial refund.'
            },
            {
                q: 'What if my cake arrives damaged?',
                a: 'If your cake arrives damaged, take photos immediately and contact Genie.ph through live chat or call +63-908-940-8747. Genie.ph coordinates with the baker and delivery team to resolve the issue — typically via a replacement cake or partial refund within 48 hours. Damage claims filed within 24 hours receive priority processing.'
            },
            {
                q: 'How do I contact customer support?',
                a: 'Reach Genie.ph customer support via live chat on the website (available during business hours), phone at +63-908-940-8747, email at support@genie.ph, or visit the office at Park Tower One, Cebu Business Park, Cebu City. Support is available in English and Filipino with average response times under 2 hours.'
            },
        ]
    },
]

const flatFaqs = faqs.flatMap((section) =>
    section.questions.map((faq) => ({ question: faq.q, answer: faq.a }))
)

const faqSchema = buildFAQPageSchema(flatFaqs, 'https://genie.ph')

export default function FAQPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-50/50 via-slate-50 to-purple-50/30">
            {faqSchema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
                />
            )}
            <div className="container mx-auto px-4 py-12 max-w-4xl">
                <header className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Everything you need to know about ordering custom cakes on Genie.ph. Can&apos;t find your answer? <Link href="/contact" className="text-purple-600 hover:text-purple-700 underline font-semibold">Contact us</Link> and we&apos;ll be happy to help.
                    </p>
                </header>

                <div className="space-y-10">
                    {faqs.map((section, sectionIdx) => (
                        <section key={sectionIdx} aria-label={section.category}>
                            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                {section.category}
                            </h2>
                            <div className="space-y-3">
                                {section.questions.map((faq, faqIdx) => (
                                    <details
                                        key={faqIdx}
                                        className="group bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <summary className="cursor-pointer px-5 py-4 font-medium text-slate-800 hover:text-purple-600 transition-colors list-none flex items-center justify-between">
                                            <span>{faq.q}</span>
                                            <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </summary>
                                        <div className="px-5 pb-4 text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                                            <p>{faq.a}</p>
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                {/* Internal links for SEO */}
                <nav className="mt-12 pt-8 border-t border-slate-200" aria-label="Related pages">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Helpful Resources</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link href="/how-to-order" className="flex items-center gap-3 p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-purple-300 transition-colors group">
                            <span className="text-2xl">📋</span>
                            <div>
                                <p className="font-medium text-slate-800 group-hover:text-purple-600 transition-colors">How to Order</p>
                                <p className="text-sm text-slate-500">Step-by-step ordering guide</p>
                            </div>
                        </Link>
                        <Link href="/cake-price-calculator" className="flex items-center gap-3 p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-purple-300 transition-colors group">
                            <span className="text-2xl">🎂</span>
                            <div>
                                <p className="font-medium text-slate-800 group-hover:text-purple-600 transition-colors">Cake Price Calculator</p>
                                <p className="text-sm text-slate-500">Get instant AI pricing</p>
                            </div>
                        </Link>
                        <Link href="/contact" className="flex items-center gap-3 p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-purple-300 transition-colors group">
                            <span className="text-2xl">📞</span>
                            <div>
                                <p className="font-medium text-slate-800 group-hover:text-purple-600 transition-colors">Contact Us</p>
                                <p className="text-sm text-slate-500">Get help from our team</p>
                            </div>
                        </Link>
                        <Link href="/blog" className="flex items-center gap-3 p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-purple-300 transition-colors group">
                            <span className="text-2xl">📝</span>
                            <div>
                                <p className="font-medium text-slate-800 group-hover:text-purple-600 transition-colors">Cake Blog</p>
                                <p className="text-sm text-slate-500">Tips, trends, and inspiration</p>
                            </div>
                        </Link>
                    </div>
                </nav>
            </div>
        </main>
    )
}
