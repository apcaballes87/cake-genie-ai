'use strict';
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { ImageUploader } from '@/components/ImageUploader';
import { ProductCard } from '@/components/ProductCard';
import { MapPin, Phone, Star, ShoppingBag } from 'lucide-react';

// Mock Data
const MOCK_MERCHANT = {
    name: "Sweet Creations by Anna",
    coverImage: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=2000&auto=format&fit=crop",
    profileImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=400&auto=format&fit=crop",
    address: "123 Baker Street, Quezon City, Metro Manila",
    phone: "+63 912 345 6789",
    rating: 4.8,
    reviewCount: 156,
};

const MOCK_PRODUCTS = [
    { id: 1, name: "Minimalist Birthday Cake", price: 850, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=800&auto=format&fit=crop", rating: 4.9, cakeType: "Minimalist", tag: "Best Seller" },
    { id: 2, name: "Chocolate Drip Cake", price: 1200, image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?q=80&w=800&auto=format&fit=crop", rating: 5.0, cakeType: "Choco Drip", tag: null },
    { id: 3, name: "Rainbow Layer Cake", price: 1500, image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?q=80&w=800&auto=format&fit=crop", rating: 4.7, cakeType: "Layered", tag: "New" },
    { id: 4, name: "Strawberry Shortcake", price: 950, image: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=800&auto=format&fit=crop", rating: 4.8, cakeType: "Classic", tag: "Trending" },
    { id: 5, name: "Custom Character Cake", price: 2000, image: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?q=80&w=800&auto=format&fit=crop", rating: 5.0, cakeType: "Custom", tag: null },
    { id: 6, name: "Wedding Tier Cake", price: 5000, image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?q=80&w=800&auto=format&fit=crop", rating: 5.0, cakeType: "Wedding", tag: "Premium" },
];

export function MerchantPageClient() {
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (query: string) => {
        console.log('Searching for:', query);
        // Implement search logic here or redirect
    };

    const handleImageSelect = (file: File) => {
        console.log('Image selected:', file);
        // Handle image upload logic, e.g., redirect to customizing page
        setIsUploadOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Hero / Profile Section */}
            <div className="relative bg-white shadow-sm mb-6">
                {/* Cover Photo */}
                <div className="h-48 md:h-64 w-full relative overflow-hidden bg-slate-200">
                    <Image
                        src={MOCK_MERCHANT.coverImage}
                        alt="Cover Photo"
                        fill
                        sizes="100vw"
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
                </div>

                {/* Profile Info Container */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative -mt-16 pb-6 flex flex-col md:flex-row md:items-end gap-6">
                    {/* Profile Picture */}
                    <div className="relative shrink-0 mx-auto md:mx-0">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-white">
                            <Image
                                src={MOCK_MERCHANT.profileImage}
                                alt={MOCK_MERCHANT.name}
                                fill
                                sizes="128px"
                                className="object-cover"
                            />
                        </div>
                    </div>

                    {/* Text Info */}
                    <div className="flex-1 text-center md:text-left pt-2 md:pt-0 pb-2">
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">{MOCK_MERCHANT.name}</h1>

                        <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-6 text-sm text-slate-600 mb-3">
                            <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(MOCK_MERCHANT.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
                            >
                                <MapPin className="w-4 h-4 text-purple-500" />
                                {MOCK_MERCHANT.address}
                            </a>
                            <a
                                href={`tel:${MOCK_MERCHANT.phone}`}
                                className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
                            >
                                <Phone className="w-4 h-4 text-purple-500" />
                                {MOCK_MERCHANT.phone}
                            </a>
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400" />
                                <span className="font-medium text-slate-900">{MOCK_MERCHANT.rating}</span>
                                <span className="text-slate-400">({MOCK_MERCHANT.reviewCount} reviews)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Container */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">

                {/* Search and Actions Bar */}
                <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                    <div className="w-full md:flex-1">
                        <SearchAutocomplete
                            value={searchQuery}
                            onChange={setSearchQuery}
                            onSearch={handleSearch}
                            placeholder={`Search ${MOCK_MERCHANT.name}...`}
                            showUploadButton={false} // We have a separate big button
                            inputClassName="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:outline-none transition-all"
                        />
                    </div>
                    <div className="w-full md:w-auto shrink-0">
                        <button
                            onClick={() => setIsUploadOpen(true)}
                            className="w-full md:w-auto px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            Get Price for Design
                        </button>
                    </div>
                </section>

                {/* Products Grid */}
                <section>
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ShoppingBag className="w-6 h-6 text-purple-600" />
                        Available Cakes
                    </h2>

                    <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6">
                        {MOCK_PRODUCTS.map((product) => (
                            <ProductCard key={product.id} {...product} />
                        ))}
                    </div>
                </section>

            </main>

            {/* Image Uploader Modal */}
            <ImageUploader
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onImageSelect={handleImageSelect}
            />
        </div >
    );
}
