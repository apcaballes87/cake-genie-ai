'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Cake, Tag, CreditCard, Facebook, Instagram, MessageCircle, Youtube, Star, Check, Mail, Phone, ChevronUp, ShieldCheck, Lock } from 'lucide-react';

export const Footer = () => {
    const router = useRouter();

    const scrollToTop = () => {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <footer className="bg-purple-50 text-gray-900 pt-16 pb-24 md:pb-8 border-t border-purple-100">

            {/* Top Section: Feature Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                    <article className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
                            <Camera size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Instantly get the price</h3>
                        <p className="text-gray-600 text-sm mb-4">Upload your cake design and we will instantly give you the price in 30 seconds.</p>
                        <button onClick={() => router.push('/customizing')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                            Upload here
                        </button>
                    </article>

                    <article className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-600">
                            <Cake size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-pink-600 font-serif italic">Fresh cakes delivered to you</h3>
                        <p className="text-gray-600 text-sm mb-4">Homemade delicious cakes freshly baked just in time for your special day</p>
                        <button onClick={() => router.push('/about')} className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                            About Us
                        </button>
                    </article>

                    <article className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600">
                            <Tag size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-purple-700 font-serif italic">Affordable yummy cakes</h3>
                        <p className="text-gray-600 text-sm mb-4">All prices of our cake designs are always updated and affordable</p>
                        <button onClick={() => router.push('/how-to-order')} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                            How to order
                        </button>
                    </article>

                    <article className="bg-white p-4 md:p-6 rounded-2xl text-center hover:shadow-lg transition duration-300 border border-purple-100">
                        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-pink-600">
                            <CreditCard size={24} />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-pink-600 font-serif italic">Secure payment options</h3>
                        <p className="text-gray-600 text-sm mb-4">E-wallets, over-the-counter and bank payments for your convenience</p>
                        <button className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-full text-sm font-bold transition shadow-sm">
                            Payments
                        </button>
                    </article>
                </div>
            </div>

            {/* Middle Section: Ratings & Social */}
            <div className="border-t border-purple-200 bg-purple-100/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        {/* Social Icons */}
                        <div className="flex items-center gap-3">
                            <a href="https://web.facebook.com/geniephilippines" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-purple-600 hover:text-white transition text-purple-600 shadow-sm">
                                <Facebook size={18} />
                            </a>
                            <a href="https://www.instagram.com/genie.ph/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-purple-600 hover:text-white transition text-purple-600 shadow-sm">
                                <Instagram size={18} />
                            </a>
                            <a href="http://tiktok.com/genie.ph" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-pink-600 hover:text-white transition text-pink-500 shadow-sm">
                                <svg viewBox="0 0 24 24" fill="currentColor" height="18" width="18">
                                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                                </svg>
                            </a>
                            <a href="https://www.youtube.com/@genieph" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-red-600 hover:text-white transition text-red-500 shadow-sm">
                                <Youtube size={18} />
                            </a>
                            <a href="https://m.me/genieph" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-blue-600 hover:text-white transition text-blue-500 shadow-sm">
                                <MessageCircle size={18} />
                            </a>
                        </div>

                        {/* Ratings */}
                        <div className="flex items-center gap-3 text-sm bg-white px-4 py-2 rounded-full shadow-sm border border-purple-100">
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

            {/* Main Footer Columns */}
            <div className="border-t border-purple-200 pt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">

                        {/* Col 1: Brand */}
                        <div className="md:col-span-2">
                            <img
                                src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20logo%20long2.webp"
                                alt="Genie Logo"
                                width={150}
                                height={40}
                                className="h-10 w-auto object-contain mb-4"
                            />
                            <div className="text-gray-600 text-sm leading-relaxed mb-4 space-y-3">
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
                            <div className="space-y-2 text-sm text-gray-600 mb-4">
                                <div className="flex items-center gap-2">
                                    <Mail size={15} className="text-purple-500 shrink-0" />
                                    <span>support@genie.ph</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone size={15} className="text-pink-500 shrink-0" />
                                    <span>+63 908 940 8747</span>
                                </div>
                            </div>
                            {/* Trust Badges */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="px-3 py-1.5 bg-purple-50 rounded-md text-xs font-semibold text-purple-700 flex items-center gap-1.5 border border-purple-100" aria-label="DTI Registered">
                                    <ShieldCheck size={14} />
                                    DTI Registered
                                </div>
                                <div className="px-3 py-1.5 bg-green-50 rounded-md text-xs font-semibold text-green-700 flex items-center gap-1.5 border border-green-100" aria-label="Secure Checkout">
                                    <Lock size={14} />
                                    Secure Checkout
                                </div>
                            </div>
                        </div>

                        {/* Col 2: Explore */}
                        <nav aria-label="Explore links">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Explore</h4>
                            <ul className="space-y-2.5 text-sm text-gray-600">
                                <li><Link href="/customizing" className="hover:text-purple-600 transition-colors">Customize a Cake</Link></li>
                                <li><Link href="/shop" className="hover:text-purple-600 transition-colors">Shop</Link></li>
                                <li><Link href="/collections" className="hover:text-purple-600 transition-colors">Collections</Link></li>
                                <li><Link href="/blog" className="hover:text-purple-600 transition-colors">Blog</Link></li>
                                <li><Link href="/about" className="hover:text-purple-600 transition-colors">About Us</Link></li>
                                <li><Link href="/compare" className="hover:text-purple-600 transition-colors">Compare</Link></li>
                                <li><Link href="/sitemap-html" className="hover:text-purple-600 transition-colors">HTML Sitemap</Link></li>
                            </ul>
                        </nav>

                        {/* Col 3: Help */}
                        <nav aria-label="Help links">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Help</h4>
                            <ul className="space-y-2.5 text-sm text-gray-600">
                                <li><Link href="/contact" className="hover:text-purple-600 transition-colors">Contact Us</Link></li>
                                <li><Link href="/faq" className="hover:text-purple-600 transition-colors">FAQ</Link></li>
                                <li><Link href="/how-to-order" className="hover:text-purple-600 transition-colors">How to Order</Link></li>
                                <li><Link href="/delivery-rates" className="hover:text-purple-600 transition-colors">Delivery Rates</Link></li>
                                <li><Link href="/terms" className="hover:text-purple-600 transition-colors">Terms of Service</Link></li>
                                <li><Link href="/privacy" className="hover:text-purple-600 transition-colors">Privacy Policy</Link></li>
                                <li><Link href="/return-policy" className="hover:text-purple-600 transition-colors">Return Policy</Link></li>
                            </ul>
                        </nav>

                    </div>

                    {/* Bottom Bar */}
                    <div className="mt-12 pt-6 border-t border-purple-200 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-gray-400">
                            © {new Date().getFullYear()} Genie.ph. All rights reserved.
                        </p>
                        <button
                            onClick={scrollToTop}
                            className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-700 transition shadow-md"
                            aria-label="Back to top"
                        >
                            <ChevronUp size={20} />
                        </button>
                    </div>
                </div>
            </div>

        </footer>
    );
};
