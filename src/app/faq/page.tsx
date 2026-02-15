import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Frequently Asked Questions | Genie.ph',
    description: 'Find answers to common questions about ordering custom cakes on Genie.ph. Learn about pricing, delivery, customization options, and our AI-powered cake marketplace in Cebu.',
    alternates: {
        canonical: 'https://genie.ph/faq',
    },
}

const faqs = [
    {
        category: 'Ordering & Pricing',
        questions: [
            {
                q: 'How does Genie.ph pricing work?',
                a: 'Genie.ph uses AI-powered image analysis to provide instant price estimates for custom cake designs. Simply upload a photo of any cake design, and our AI engine analyzes the complexity, size, decorations, and icing style to generate accurate pricing from our partner bakeries in Cebu. Prices start as low as \u20B1350 for bento cakes and vary based on size, complexity, and customization options.'
            },
            {
                q: 'What payment methods do you accept?',
                a: 'We accept GCash, Maya (formerly PayMaya), and secure credit/debit card payments through our local payment gateways. All transactions are encrypted and processed securely.'
            },
            {
                q: 'Can I get a price estimate before placing an order?',
                a: 'Yes! That is one of our core features. Upload any cake design photo to our Cake Price Calculator and receive an instant AI-generated price estimate with no commitment required. You can then customize the design and compare quotes from multiple bakeries.'
            },
            {
                q: 'Is there a minimum order amount?',
                a: 'Minimum order amounts vary by merchant. Most of our partner bakeries have a minimum starting price based on the cake type. Bento cakes typically start around \u20B1350, while standard tiered cakes start from \u20B1800 and up depending on size and design complexity.'
            },
        ]
    },
    {
        category: 'Customization',
        questions: [
            {
                q: 'What can I customize on my cake?',
                a: 'You can customize virtually every aspect of your cake including: icing colors and style, cake flavors, size (from bento to multi-tier), toppers and decorations, cake messages and text, fondant or buttercream finish, and special elements like drip effects or edible prints. Our AI-powered editor makes customization easy and visual.'
            },
            {
                q: 'Can I upload my own design?',
                a: 'Absolutely! You can upload any cake photo or design inspiration. Our AI analyzes the image and breaks it down into customizable components like icing, toppers, colors, and messages. You can then modify each element to create your perfect cake.'
            },
            {
                q: 'What cake sizes are available?',
                a: 'We offer a wide range of sizes: Bento cakes (4 inches, perfect for 1-2 people), Round cakes from 6 to 12 inches, Square cakes, and Multi-tier cakes for weddings and large events. Each baker may have slightly different size offerings.'
            },
        ]
    },
    {
        category: 'Delivery & Availability',
        questions: [
            {
                q: 'Where does Genie.ph deliver?',
                a: 'We currently deliver throughout Metro Cebu including Cebu City, Mandaue City, Lapu-Lapu City (Mactan), Talisay City, and select areas in Liloan, Consolacion, and Minglanilla. Delivery coverage depends on the specific baker you order from. We are also expanding to Cavite and other areas in the Philippines.'
            },
            {
                q: 'How long does delivery take?',
                a: 'Custom cakes typically require 3-7 days handling time for the baker to craft your design, plus 1-2 days for delivery depending on your location within Cebu. Rush orders may be available from select merchants for an additional fee.'
            },
            {
                q: 'Can I pick up my order instead?',
                a: 'Yes! Many of our partner bakeries offer pickup options. During checkout, you can choose between delivery or pickup from the baker\'s location. Pickup availability and hours vary by merchant.'
            },
        ]
    },
    {
        category: 'About Genie.ph',
        questions: [
            {
                q: 'What is Genie.ph?',
                a: 'Genie.ph is the Philippines\' first AI-powered marketplace for custom cakes. We connect customers with talented local bakers and cakeshops in Cebu, making it easy to design, price, and order custom cakes online. Our AI technology analyzes cake designs to provide instant, accurate pricing.'
            },
            {
                q: 'How is Genie.ph different from ordering directly from a bakery?',
                a: 'Genie.ph offers several advantages: instant AI pricing so you know the cost upfront, the ability to compare quotes from multiple bakers, an easy visual customization tool, secure online payments, and access to a curated network of vetted local artisan bakers all in one platform.'
            },
            {
                q: 'Are the bakers on Genie.ph verified?',
                a: 'Yes, all baker partners on Genie.ph go through a verification process. We review their portfolio, food safety practices, and customer feedback before onboarding them onto our platform. We continuously monitor quality to ensure you receive the best custom cakes in Cebu.'
            },
        ]
    },
    {
        category: 'Refunds & Issues',
        questions: [
            {
                q: 'What is your refund policy?',
                a: 'Since custom cakes are perishable, made-to-order products, we generally do not accept returns. However, if there is a significant quality issue or the cake does not match the agreed-upon design, please contact our customer service at +63-908-940-8747 within 24 hours of receiving your order. We will work with the baker to resolve any issues.'
            },
            {
                q: 'What if my cake arrives damaged?',
                a: 'If your cake arrives damaged during delivery, please take photos immediately and contact us through our live chat or call +63-908-940-8747. We will coordinate with the baker and delivery team to find the best resolution, which may include a replacement or partial refund.'
            },
            {
                q: 'How do I contact customer support?',
                a: 'You can reach our customer support team through: live chat on our website (available during business hours), phone at +63-908-940-8747, or visit our office at Skyview Park, Nivel Hills, Cebu City. We are available in both English and Filipino.'
            },
        ]
    },
]

export default function FAQPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100">
            <div className="container mx-auto px-4 py-12 max-w-4xl">
                <header className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Everything you need to know about ordering custom cakes on Genie.ph. Can&apos;t find your answer? <Link href="/contact" className="text-pink-600 hover:text-pink-700 underline">Contact us</Link> and we&apos;ll be happy to help.
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
                                        <summary className="cursor-pointer px-5 py-4 font-medium text-slate-800 hover:text-pink-700 transition-colors list-none flex items-center justify-between">
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
                        <Link href="/how-to-order" className="flex items-center gap-3 p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-pink-300 transition-colors group">
                            <span className="text-2xl">📋</span>
                            <div>
                                <p className="font-medium text-slate-800 group-hover:text-pink-700 transition-colors">How to Order</p>
                                <p className="text-sm text-slate-500">Step-by-step ordering guide</p>
                            </div>
                        </Link>
                        <Link href="/cake-price-calculator" className="flex items-center gap-3 p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-pink-300 transition-colors group">
                            <span className="text-2xl">🎂</span>
                            <div>
                                <p className="font-medium text-slate-800 group-hover:text-pink-700 transition-colors">Cake Price Calculator</p>
                                <p className="text-sm text-slate-500">Get instant AI pricing</p>
                            </div>
                        </Link>
                        <Link href="/contact" className="flex items-center gap-3 p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-pink-300 transition-colors group">
                            <span className="text-2xl">📞</span>
                            <div>
                                <p className="font-medium text-slate-800 group-hover:text-pink-700 transition-colors">Contact Us</p>
                                <p className="text-sm text-slate-500">Get help from our team</p>
                            </div>
                        </Link>
                        <Link href="/blog" className="flex items-center gap-3 p-4 bg-white/70 rounded-xl border border-slate-200 hover:border-pink-300 transition-colors group">
                            <span className="text-2xl">📝</span>
                            <div>
                                <p className="font-medium text-slate-800 group-hover:text-pink-700 transition-colors">Cake Blog</p>
                                <p className="text-sm text-slate-500">Tips, trends, and inspiration</p>
                            </div>
                        </Link>
                    </div>
                </nav>
            </div>
        </main>
    )
}
