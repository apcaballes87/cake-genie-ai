import { Metadata } from 'next'
import { Suspense } from 'react'
import CakePriceCalculatorClient from './CakePriceCalculatorClient'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export const metadata: Metadata = {
    title: 'Cake Price Calculator | Instant Custom Cake Pricing',
    description: 'Upload your cake design and get an instant price quote. Our AI-powered calculator analyzes your design and provides accurate pricing for custom cakes in Cebu and Cavite.',
    keywords: 'cake price calculator, custom cake pricing, cake quote, Cebu cakes, Cavite cakes, instant cake price',
    openGraph: {
        title: 'Cake Price Calculator | Get Instant Custom Cake Quotes',
        description: 'Skip the back-and-forth! Upload a cake photo and see the price instantly. Available for delivery in Cebu City and Cavite.',
        type: 'website',
    },
}

export default function CakePriceCalculatorPage() {
    return (
        <>
            {/* JSON-LD Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "BreadcrumbList",
                                "itemListElement": [
                                    {
                                        "@type": "ListItem",
                                        "position": 1,
                                        "name": "Home",
                                        "item": "https://genie.ph/"
                                    },
                                    {
                                        "@type": "ListItem",
                                        "position": 2,
                                        "name": "Cake Price Calculator",
                                        "item": "https://genie.ph/cake-price-calculator"
                                    }
                                ]
                            },
                            {
                                "@type": "SoftwareApplication",
                                "name": "Genie.ph Cake Price Calculator",
                                "applicationCategory": "BusinessApplication",
                                "operatingSystem": "Web",
                                "offers": {
                                    "@type": "Offer",
                                    "price": "0",
                                    "priceCurrency": "PHP"
                                },
                                "description": "AI-powered tool to instantly calculate custom cake prices in Cebu and Cavite based on design, size, and flavor."
                            }
                        ]
                    })
                }}
            />
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                <CakePriceCalculatorClient />
            </Suspense>
        </>
    )
}
