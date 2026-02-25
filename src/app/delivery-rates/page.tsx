import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Truck, MapPin, Search as SearchIcon, AlertCircle } from 'lucide-react';
import { CITIES_AND_BARANGAYS, getDeliveryFeeByCity } from '@/constants';

export const metadata: Metadata = {
    title: 'Delivery Rates & Covered Areas | Cake Genie Cebu',
    description: 'Find out the delivery fees and serviceable areas for Cake Genie in Cebu. We deliver fresh, custom cakes to Cebu City, Mandaue, Lapu-Lapu, Talisay, Consolacion, Cordova, and Liloan.',
    alternates: {
        canonical: 'https://www.genie.ph/delivery-rates',
    },
};

const SEO_CONTENT = {
    title: "Delivery Rates & Serviceable Areas",
    description: "At Cake Genie, we strive to make receiving your dream cake as seamless and affordable as possible. Our delivery fees are calculated based on your city within Metro Cebu. Check our rates and covered barangays below.",
    faqs: [
        {
            question: "How much is the delivery fee?",
            answer: "Delivery fees vary by city, starting at ₱100 for Cebu City up to ₱400 for Liloan. The exact fee is automatically calculated during checkout when you pin your location on our Google Maps modal."
        },
        {
            question: "How is the delivery fee calculated?",
            answer: "During checkout, you will be asked to pin your exact delivery location using our Google Maps integration. Our system automatically detects your city from the pin and applies the corresponding flat rate."
        },
        {
            question: "Do you deliver outside of Metro Cebu?",
            answer: "Currently, our standard service areas include Cebu City, Mandaue, Lapu-Lapu, Talisay, Consolacion, Cordova, and Liloan. If you are outside these areas, please contact our support team to see if special arrangements can be made."
        },
        {
            question: "Can I pick up my cake instead?",
            answer: "The availability of pick-up depends on the specific partner bakeshop fulfilling your order. Please check the checkout options or contact support for more details."
        }
    ]
};

const DELIVERY_RATES = [
    { city: 'Cebu City', rate: getDeliveryFeeByCity('Cebu City') },
    { city: 'Mandaue City', rate: getDeliveryFeeByCity('Mandaue City') },
    { city: 'Lapu-Lapu City', rate: getDeliveryFeeByCity('Lapu-Lapu City') },
    { city: 'Talisay City', rate: getDeliveryFeeByCity('Talisay City') },
    { city: 'Consolacion', rate: getDeliveryFeeByCity('Consolacion') },
    { city: 'Cordova', rate: getDeliveryFeeByCity('Cordova') },
    { city: 'Liloan', rate: 400 }, // Hardcoded here as an example if it's not strictly in constants but known, else get from constant if available. The constant returns 0 for Liloan if not defined, but the implementation plan says Liloan is ₱400. In constants.ts, getDeliveryFeeByCity('Liloan') actually returns 400.
];

export default function DeliveryRatesPage() {
    return (
        <>
            <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">

                    {/* Header Section */}
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center p-3 bg-pink-100 rounded-full mb-4">
                            <Truck className="w-8 h-8 text-pink-600" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4 font-serif">
                            {SEO_CONTENT.title}
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            {SEO_CONTENT.description}
                        </p>
                    </div>

                    {/* How it Works Section */}
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 mb-12">
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="shrink-0 bg-blue-50 p-4 rounded-full">
                                <MapPin className="w-10 h-10 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Automatic Calculation at Checkout</h2>
                                <p className="text-slate-600">
                                    You don't need to guess! When you check out, simply pin your location on our <strong>interactive Google Map</strong>.
                                    Our system will instantly detect your city and automatically apply the correct flat delivery rate to your order total.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Rates Grid */}
                    <section className="mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">Flat Rate Delivery Fees</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {DELIVERY_RATES.map((item) => (
                                <div key={item.city} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between hover:border-pink-300 hover:shadow-md transition-all">
                                    <span className="font-semibold text-slate-700">{item.city}</span>
                                    <span className="text-lg font-bold text-pink-600">₱{item.rate}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Covered Areas Breakdown */}
                    <section className="mb-16">
                        <div className="flex items-center gap-3 mb-8 justify-center">
                            <SearchIcon className="w-6 h-6 text-slate-500" />
                            <h2 className="text-3xl font-bold text-slate-900 text-center">Detailed Serviceable Areas</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {Object.entries(CITIES_AND_BARANGAYS).map(([city, barangays]) => (
                                <div key={city} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                                        <h3 className="text-xl font-bold text-slate-800">{city}</h3>
                                        <span className="text-sm font-medium text-pink-600 bg-pink-50 px-3 py-1 rounded-full">
                                            ₱{getDeliveryFeeByCity(city)}
                                        </span>
                                    </div>
                                    <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {barangays.map(barangay => (
                                            <li key={barangay} className="text-sm text-slate-600 flex items-start gap-2">
                                                <span className="text-pink-400 mt-1 text-xs">•</span>
                                                {barangay}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 bg-amber-50 rounded-xl p-4 flex gap-3 border border-amber-200">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">
                                <strong>Note:</strong> While we strive to cover all listed barangays, extremely remote or hard-to-reach areas within these cities might be subject to limitations. Safety of our delivery riders and the cake is our top priority.
                            </p>
                        </div>
                    </section>

                    {/* FAQs */}
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6 font-serif text-center">Frequently Asked Questions</h2>
                        <div className="space-y-6">
                            {SEO_CONTENT.faqs.map((faq, index) => (
                                <div key={index} className="border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">{faq.question}</h3>
                                    <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Call to Action */}
                    <div className="mt-12 text-center">
                        <Link
                            href="/customizing"
                            className="inline-flex items-center justify-center bg-pink-600 hover:bg-pink-700 text-white px-8 py-4 rounded-full text-lg font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                        >
                            Start Your Custom Order
                        </Link>
                    </div>

                </div>
            </main>
        </>
    );
}
