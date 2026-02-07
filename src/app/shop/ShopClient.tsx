'use client';

import React, { useState, useMemo } from 'react';
import LazyImage from '@/components/LazyImage';
import Link from 'next/link';
import { Search, MapPin, Star, BadgeCheck, Store } from 'lucide-react';
import { CakeGenieMerchant } from '@/lib/database.types';

interface ShopClientProps {
    merchants: CakeGenieMerchant[];
}

export function ShopClient({ merchants }: ShopClientProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter merchants based on search query
    const filteredMerchants = useMemo(() => {
        if (!searchQuery.trim()) return merchants;

        const query = searchQuery.toLowerCase();
        return merchants.filter(
            (merchant) =>
                merchant.business_name.toLowerCase().includes(query) ||
                (merchant.city && merchant.city.toLowerCase().includes(query)) ||
                (merchant.description && merchant.description.toLowerCase().includes(query))
        );
    }, [merchants, searchQuery]);

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Hero Section */}
            <div className="bg-linear-to-br from-purple-600 via-purple-700 to-pink-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
                    <div className="text-center">
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                            Discover Amazing Bakeshops
                        </h1>
                        <p className="text-purple-100 text-lg md:text-xl max-w-2xl mx-auto mb-8">
                            Find the perfect cake from our partner bakeries across the Philippines
                        </p>

                        {/* Search Bar */}
                        <div className="max-w-xl mx-auto relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by bakeshop name or city..."
                                className="w-full pl-12 pr-4 py-4 bg-white text-slate-900 rounded-2xl shadow-lg focus:ring-4 focus:ring-purple-300 focus:outline-none transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Merchants Grid */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {/* Results Count */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Store className="w-6 h-6 text-purple-600" />
                        Partner Bakeshops
                        <span className="text-sm font-normal text-slate-500">
                            ({filteredMerchants.length} {filteredMerchants.length === 1 ? 'shop' : 'shops'})
                        </span>
                    </h2>
                </div>

                {filteredMerchants.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                        <Store className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No bakeshops found</h3>
                        <p className="text-slate-500">
                            {searchQuery ? 'Try a different search term' : 'Check back soon for new partners!'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredMerchants.map((merchant) => (
                            <Link
                                key={merchant.merchant_id}
                                href={`/shop/${merchant.slug}`}
                                className="group bg-white rounded-2xl shadow-sm hover:shadow-xl border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                            >
                                {/* Cover Image */}
                                <div className="relative h-32 bg-linear-to-br from-purple-100 to-pink-100 overflow-hidden">
                                    {merchant.cover_image_url ? (
                                        <LazyImage
                                            src={merchant.cover_image_url}
                                            alt={`${merchant.business_name} cover`}
                                            fill
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                            imageClassName="object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Store className="w-12 h-12 text-purple-300" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent" />

                                    {/* Profile Image */}
                                    <div className="absolute -bottom-8 left-4">
                                        <div className="w-16 h-16 rounded-full border-4 border-white shadow-md overflow-hidden bg-white">
                                            {merchant.profile_image_url ? (
                                                <LazyImage
                                                    src={merchant.profile_image_url}
                                                    alt={merchant.business_name}
                                                    width={64}
                                                    height={64}
                                                    imageClassName="object-cover w-full h-full"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-purple-100">
                                                    <Store className="w-8 h-8 text-purple-400" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="pt-10 pb-4 px-4">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h3 className="font-bold text-slate-900 text-base leading-tight group-hover:text-purple-600 transition-colors line-clamp-1">
                                            {merchant.business_name}
                                        </h3>
                                        {merchant.is_verified && (
                                            <BadgeCheck className="w-5 h-5 text-blue-500 shrink-0" />
                                        )}
                                    </div>

                                    {merchant.city && (
                                        <p className="text-sm text-slate-500 flex items-center gap-1 mb-2">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {merchant.city}
                                        </p>
                                    )}

                                    {merchant.description && (
                                        <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                                            {merchant.description}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-1 text-sm">
                                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                            <span className="font-semibold text-slate-900">{merchant.rating}</span>
                                            <span className="text-slate-400">({merchant.review_count})</span>
                                        </div>
                                        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                                            View Shop
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
