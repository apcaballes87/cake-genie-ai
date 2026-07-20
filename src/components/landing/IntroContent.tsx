
import React from 'react';
import Link from 'next/link';

export const IntroContent = () => {
    return (
        <section className="py-4 md:py-6">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 className="text-[22px] md:text-[28px] font-bold text-gray-900 mb-4">
                    Spontaneous Celebrations deserve more than a grocery cake.
                </h2>
                <div className="prose prose-base md:prose-lg mx-auto text-gray-600 space-y-4 md:space-y-6 leading-relaxed">
                    <p>
                        <strong>Genie.ph is where you order a custom cake the same way you order food — fast, certain, and exactly the way you want it.</strong> Upload a design, see your price in 10 seconds, and get it delivered today across Metro Cebu. No DMs. No back-and-forth. No surprises.
                    </p>

                    <ul className="text-left space-y-3 list-none pl-0">
                        <li className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-1">✨</span>
                            <span><strong>See your cake priced in 10 seconds</strong> — upload any photo and know the cost instantly</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-1">🎨</span>
                            <span><strong>Change anything, watch the price update</strong> — colors, toppers, messages. What you see is what you pay.</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-1">🚀</span>
                            <span><strong>Order it today</strong> — same-day delivery across Metro Cebu City, Mandaue, Lapu-Lapu, and Talisay</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-1">🤝</span>
                            <span><strong>Trusted local bakers</strong> — every order goes to a vetted Cebu baker, not a grocery shelf</span>
                        </li>
                    </ul>

                    <h3 className="text-[18px] md:text-[21px] font-bold text-gray-800 mt-6 mb-2">Celebrate Every Occasion</h3>
                    <p>
                        No celebration is complete without a cake. At Genie.ph, we cater to all occasions:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-semibold text-purple-700 mt-4">
                        <Link href="/birthday-cake-delivery-cebu-city" className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition">Birthday Cakes</Link>
                        <Link href="/collections/wedding-cake" className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition">Wedding Cakes</Link>
                        <Link href="/collections/anniversary-cake" className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition">Anniversary Cakes</Link>
                        <Link href="/collections" className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition">Christening Cakes</Link>
                    </div>

                    <p className="mt-5">
                        Your cake wish, granted. Browse our designs or upload your own today.
                    </p>
                </div>
            </div>
        </section>
    );
};
