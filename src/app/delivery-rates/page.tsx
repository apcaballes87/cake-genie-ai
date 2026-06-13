import React from 'react';
import Link from 'next/link';
import { Truck, MapPin, Search as SearchIcon, AlertCircle } from 'lucide-react';
import { CITIES_AND_BARANGAYS } from '@/constants';
import {
    getDeliveryFeeByCity,
    getDeliveryRateCards,
    getDeliveryRateSummary,
} from '@/lib/commerce/deliveryRates';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

const DELIVERY_RATE_CARDS = getDeliveryRateCards();
const {
    minFee: lowestDeliveryFee,
    maxFee: highestDeliveryFee,
    lowestRateCity,
    highestRateCity,
} = getDeliveryRateSummary();

const deliveryFeeRangeCopy = lowestDeliveryFee === 0
    ? `Delivery fees vary by city, from free delivery in ${lowestRateCity} up to ₱${highestDeliveryFee} for ${highestRateCity}.`
    : `Delivery fees vary by city, starting at ₱${lowestDeliveryFee} in ${lowestRateCity} up to ₱${highestDeliveryFee} for ${highestRateCity}.`;

const SERVICE_CITY_COUNT = DELIVERY_RATE_CARDS.length;
const topLevelDescription = `${deliveryFeeRangeCopy} Check rates and covered barangays before checkout.`;

export const metadata = buildMarketingPageMetadata({
    title: 'Delivery Rates and Covered Areas in Cebu',
    description: topLevelDescription,
    canonicalPath: 'https://genie.ph/delivery-rates',
});

const SEO_CONTENT = {
    title: "Delivery Rates & Serviceable Areas",
    description: "At Cake Genie, we use the same city-based delivery fee table on this page that powers checkout. Review the current range, then check your covered barangay below.",
    faqs: [
        {
            question: "How much is the delivery fee?",
            answer: `${deliveryFeeRangeCopy} The exact fee is automatically calculated during checkout when you pin your location on our Google Maps modal.`
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

function formatDeliveryFee(rate: number): string {
    return rate === 0 ? 'Free' : `₱${rate}`;
}

export default function DeliveryRatesPage() {
    return (
        <>
            <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">

                    {/* Header Section */}
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center p-3 bg-purple-100 rounded-full mb-4">
                            <Truck className="w-8 h-8 text-purple-600" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4 font-serif">
                            {SEO_CONTENT.title}
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            {SEO_CONTENT.description}
                        </p>
                        <p className="mt-3 text-base font-medium text-slate-700">
                            {deliveryFeeRangeCopy}
                        </p>
                    </div>

                    <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Coverage</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{SERVICE_CITY_COUNT} cities</div>
                            <div className="mt-1 text-sm text-slate-600">Metro Cebu service areas listed below</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Lowest Rate</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{formatDeliveryFee(lowestDeliveryFee)}</div>
                            <div className="mt-1 text-sm text-slate-600">Currently in {lowestRateCity}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Highest Rate</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{formatDeliveryFee(highestDeliveryFee)}</div>
                            <div className="mt-1 text-sm text-slate-600">Currently in {highestRateCity}</div>
                        </div>
                    </section>

                    {/* How it Works Section */}
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 mb-12">
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="shrink-0 bg-blue-50 p-4 rounded-full">
                                <MapPin className="w-10 h-10 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Automatic Calculation at Checkout</h2>
                                <p className="text-slate-600">
                                    You don&apos;t need to guess! When you check out, simply pin your location on our <strong>interactive Google Map</strong>.
                                    Our system will instantly detect your city and automatically apply the correct flat delivery rate to your order total.
                                </p>
                                <p className="mt-3 text-sm text-slate-500">
                                    The numbers shown on this page are pulled from the same delivery fee table used at checkout.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Rates Grid */}
                    <section className="mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">Flat Rate Delivery Fees</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {DELIVERY_RATE_CARDS.map((item) => (
                                <div key={item.city} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between hover:border-purple-300 hover:shadow-md transition-all">
                                    <span className="font-semibold text-slate-700">{item.city}</span>
                                    <span className="text-lg font-bold text-purple-600">{formatDeliveryFee(item.rate)}</span>
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
                                        <span className="text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                                            {formatDeliveryFee(getDeliveryFeeByCity(city))}
                                        </span>
                                    </div>
                                    <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {barangays.map(barangay => (
                                            <li key={barangay} className="text-sm text-slate-600 flex items-start gap-2">
                                                <span className="text-purple-400 mt-1 text-xs">•</span>
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
                            className="inline-flex items-center justify-center genie-btn-primary px-8 py-4 rounded-full text-lg font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]"
                        >
                            Start Your Custom Order
                        </Link>
                    </div>

                </div>
            </main>
        </>
    );
}
