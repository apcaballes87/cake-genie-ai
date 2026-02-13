
import React from 'react';
import Link from 'next/link';

export const IntroContent = () => {
    return (
        <section className="bg-white py-12 md:py-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                    What is <span className="text-purple-600">Genie.ph</span>?
                </h2>
                <div className="prose prose-lg mx-auto text-gray-600 space-y-6 leading-relaxed">
                    <p>
                        <strong>Genie.ph is the premier online marketplace for custom cakes in Cebu, Philippines.</strong> We connect customers directly with the most talented local bakeshops and home bakers in the region. Whether you need a stunning wedding cake, a playful birthday cake, or a chic minimalist design, Genie.ph provides instant AI pricing and a secure way to order custom cakes online.
                    </p>

                    <h3 className="text-2xl font-bold text-gray-800 mt-8 mb-4">Why Order Your Cake with Genie.ph?</h3>
                    <ul className="text-left space-y-4 list-none pl-0">
                        <li className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-1">✨</span>
                            <span><strong>Instant AI Pricing:</strong> Say goodbye to long waiting times for price quotes. With our innovative AI technology, you can simply upload a photo of your desired cake design, and we will provide you with an instant price estimate. It's fast, easy, and transparent.</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-1">🏆</span>
                            <span><strong>Trusted Local Bakers:</strong> We carefully curate our network of partners to ensure you get only the best. Our platform features top-rated cake artists from Cebu City, Mandaue, Lapu-Lapu, and Talisay, known for their craftsmanship and delicious flavors.</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-1">🎨</span>
                            <span><strong>Endless Customization:</strong> Your imagination is the only limit. Choose from a wide array of flavors, icing types, and sizes. From trendy bento cakes and vintage heart cakes to classic fondant masterpieces, we help you create a cake that is uniquely yours.</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-1">🚚</span>
                            <span><strong>Hassle-Free Delivery:</strong> We understand that handling cakes requires care. Our reliable delivery service ensures that your custom cake arrives safely at your venue or doorstep, fresh and ready to impress.</span>
                        </li>
                    </ul>

                    <h3 className="text-2xl font-bold text-gray-800 mt-8 mb-4">Celebrate Every Occasion</h3>
                    <p>
                        No celebration is complete without a cake. At Genie.ph, we cater to all occasions:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-semibold text-purple-700 mt-4">
                        <Link href="/search?q=birthday+cakes" className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition">Birthday Cakes</Link>
                        <Link href="/search?q=wedding+cakes" className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition">Wedding Cakes</Link>
                        <Link href="/search?q=anniversary+cakes" className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition">Anniversary Cakes</Link>
                        <Link href="/search?q=christening+cakes" className="bg-purple-50 py-2 px-4 rounded-lg hover:bg-purple-100 transition">Christening Cakes</Link>
                    </div>

                    <p className="mt-8">
                        Experience the convenience of ordering custom cakes online. Browse our designs or upload your own today and let Genie.ph make your celebration unforgettable.
                    </p>
                </div>
            </div>
        </section>
    );
};
