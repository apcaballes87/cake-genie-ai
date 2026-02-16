'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Cake, Tag, CreditCard, Facebook, Instagram, MessageCircle, Youtube, Star, Check, Mail, Phone, ChevronUp } from 'lucide-react';

export const Footer = () => {
    const router = useRouter();

    // Helper for scrolling to top
    const scrollToTop = () => {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <footer className="bg-purple-50 text-gray-900 pt-16 pb-24 md:pb-8 border-t border-purple-100">
            {/* Top Section: Features */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                    {/* Feature 1 */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
                            <Camera size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Instantly get the price</h3>
                        <p className="text-gray-600 text-sm mb-4">Upload your cake design and we will instantly give you the price in 30 seconds.</p>
                        <button onClick={() => router.push('/customizing')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                            Upload here
                        </button>
                    </div>

                    {/* Feature 2 */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-600">
                            <Cake size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-pink-600 font-serif italic">Fresh cakes delivered to you</h3>
                        <p className="text-gray-600 text-sm mb-4">Homemade delicious cakes freshly baked just in time for your special day</p>
                        <button onClick={() => router.push('/about')} className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                            About Us
                        </button>
                    </div>

                    {/* Feature 3 */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
                            <Tag size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Affordable yummy cakes</h3>
                        <p className="text-gray-600 text-sm mb-4">All prices of our cake designs are always updated and affordable</p>
                        <button onClick={() => router.push('/how-to-order')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                            How to order
                        </button>
                    </div>

                    {/* Feature 4 */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-600">
                            <CreditCard size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-pink-600 font-serif italic">Secure payment options</h3>
                        <p className="text-gray-600 text-sm mb-4">E-wallets, over-the-counter and bank payments for your convenience</p>
                        <button className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                            Payments
                        </button>
                    </div>
                </div>
            </div>

            {/* Middle Section: Social & Ratings */}
            <div className="border-t border-purple-200 bg-purple-100/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        {/* Social Icons */}
                        <div className="flex items-center gap-4">
                            <a href="https://web.facebook.com/geniephilippines" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-purple-600 hover:text-white transition text-purple-600 shadow-sm">
                                <Facebook size={20} />
                            </a>
                            <a href="https://www.instagram.com/genie.ph/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-purple-600 hover:text-white transition text-purple-600 shadow-sm">
                                <Instagram size={20} />
                            </a>
                            <a href="http://tiktok.com/genie.ph" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-pink-600 hover:text-white transition text-pink-500 shadow-sm">
                                {/* Custom TikTok Icon SVG */}
                                <svg viewBox="0 0 24 24" fill="currentColor" height="20" width="20">
                                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                                </svg>
                            </a>
                            <a href="https://www.youtube.com/@genieph" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-red-600 hover:text-white transition text-red-500 shadow-sm">
                                <Youtube size={20} />
                            </a>
                            <a href="https://m.me/genieph" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-blue-600 hover:text-white transition text-blue-500 shadow-sm">
                                <MessageCircle size={20} />
                            </a>
                        </div>

                        {/* Ratings */}
                        <div className="flex items-center gap-3 text-sm md:text-base bg-white px-4 py-2 rounded-full shadow-sm border border-purple-100">
                            <span className="font-bold text-2xl text-gray-800">4.8</span>
                            <div className="flex text-yellow-400">
                                <Star size={16} fill="currentColor" />
                                <Star size={16} fill="currentColor" />
                                <Star size={16} fill="currentColor" />
                                <Star size={16} fill="currentColor" />
                                <Star size={16} fill="currentColor" />
                            </div>
                            <span className="hidden md:inline text-gray-300">|</span>
                            <span className="text-gray-600">Customers rate us 4.8/5 based on 40 reviews.</span>
                            <span className="hidden md:inline text-gray-300">|</span>
                            <span className="flex items-center gap-1 text-green-500 font-bold">
                                Verified <Check size={14} />
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Company Info */}
            <div className="border-t border-purple-200 pt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start gap-8">
                    {/* Brand Info */}
                    <div className="max-w-md md:max-w-4xl flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <img
                                src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20logo%20long2.webp"
                                alt="Genie Logo"
                                width={150}
                                height={40}
                                className="h-10 w-auto object-contain"
                            />
                        </div>
                        <div className="text-gray-600 text-sm leading-relaxed mb-6 space-y-4">
                            <p>
                                Genie.ph is the premier online marketplace for custom cakes in Cebu, Philippines.
                                By leveraging advanced AI design analysis, customers can upload any cake photo and receive
                                instant price estimations from over 50 local artisan bakers and bakeshops.
                                The platform streamlines the traditionally slow ordering process by automating complexity analysis
                                and providing direct baker connections for personalized celebrations.
                            </p>
                            <p>
                                Our delivery network covers the entire Metro Cebu area, including Cebu City, Mandaue City,
                                Lapu-Lapu City, and Talisay City. We specialize in custom birthday cakes, minimalist wedding cakes,
                                personalized bento cakes, and edible photo prints. Genie.ph ensures secure online payments
                                via Maya and GCash, making it the most reliable destination for online cake delivery in Cebu.
                            </p>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-3">
                                <Mail size={16} className="text-purple-500" />
                                <span>support@genie.ph</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Phone size={16} className="text-pink-500" />
                                <span>+63 908 940 8747</span>
                            </div>
                        </div>

                        {/* Footer Link Groups */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 mt-6 text-sm">
                            {/* Explore */}
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Explore</h4>
                                <div className="flex flex-col gap-1.5 text-gray-500">
                                    <Link href="/shop" className="hover:text-purple-600 transition-colors">Shop</Link>
                                    <Link href="/collections" className="hover:text-purple-600 transition-colors">Collections</Link>
                                    <Link href="/customizing" className="hover:text-purple-600 transition-colors">Customize a Cake</Link>
                                    <Link href="/blog" className="hover:text-purple-600 transition-colors">Blog</Link>
                                </div>
                            </div>

                            {/* Help */}
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Help</h4>
                                <div className="flex flex-col gap-1.5 text-gray-500">
                                    <Link href="/how-to-order" className="hover:text-purple-600 transition-colors">How to Order</Link>
                                    <Link href="/faq" className="hover:text-purple-600 transition-colors">FAQ</Link>
                                    <Link href="/cake-price-calculator" className="hover:text-purple-600 transition-colors">Cake Price Calculator</Link>
                                    <Link href="/compare" className="hover:text-purple-600 transition-colors">Compare Options</Link>
                                    <Link href="/contact" className="hover:text-purple-600 transition-colors">Contact Us</Link>
                                </div>
                            </div>

                            {/* Legal */}
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Legal</h4>
                                <div className="flex flex-col gap-1.5 text-gray-500">
                                    <Link href="/about" className="hover:text-purple-600 transition-colors">About Us</Link>
                                    <Link href="/terms" className="hover:text-purple-600 transition-colors">Terms of Service</Link>
                                    <Link href="/privacy" className="hover:text-purple-600 transition-colors">Privacy Policy</Link>
                                    <Link href="/return-policy" className="hover:text-purple-600 transition-colors">Return Policy</Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Back to Top */}
                    <button
                        onClick={scrollToTop}
                        className="bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 transition shadow-lg self-end md:self-auto"
                        aria-label="Back to top"
                    >
                        <ChevronUp size={24} />
                    </button>
                </div>
            </div>
        </footer>
    );
};
