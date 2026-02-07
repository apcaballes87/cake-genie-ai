'use client';

import React, { useState, useEffect } from 'react';

import { useParams, useRouter } from 'next/navigation';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { ImageUploader } from '@/components/ImageUploader';
import { MapPin, Phone, Star, ShoppingBag, BadgeCheck, Loader2, Heart, Cake } from 'lucide-react';
import { getMerchantBySlug, getMerchantProductsWithCache } from '@/services/supabaseService';
import { CakeGenieMerchant, CakeGenieMerchantProduct } from '@/lib/database.types';
import { HybridAnalysisResult } from '@/types';
import LazyImage from '@/components/LazyImage';

interface MerchantPageClientProps {
    slug?: string;
}

export function MerchantPageClient({ slug }: MerchantPageClientProps) {
    const params = useParams();
    const router = useRouter();
    const merchantSlug = slug || (params?.merchantSlug as string) || 'sweet-delights';

    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [merchant, setMerchant] = useState<CakeGenieMerchant | null>(null);
    const [products, setProducts] = useState<(CakeGenieMerchantProduct & { analysis_json?: HybridAnalysisResult })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);


    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);

            // Fetch merchant
            const { data: merchantData, error: merchantError } = await getMerchantBySlug(merchantSlug);

            if (merchantError || !merchantData) {
                setError('Merchant not found');
                setIsLoading(false);
                return;
            }

            setMerchant(merchantData);

            // Fetch products with cache data for precomputed analysis
            const { data: productsData } = await getMerchantProductsWithCache(merchantSlug);
            if (productsData) {
                setProducts(productsData);
            }

            setIsLoading(false);
        };

        fetchData();
    }, [merchantSlug]);


    const handleSearch = (query: string) => {
        console.log('Searching for:', query);
        // Implement search logic here or redirect
    };

    const handleImageSelect = (file: File) => {
        console.log('Image selected:', file);
        // Handle image upload logic, e.g., redirect to customizing page
        setIsUploadOpen(false);
    };

    const getProductTag = (product: CakeGenieMerchantProduct): string | null => {
        if (product.is_featured) return 'Featured';
        if (product.availability === 'made_to_order') return 'Made to Order';
        return null;
    };

    // Handle product click - Navigate to SEO-friendly product page
    // The /shop/[merchantSlug]/[productSlug] route will handle loading via product/merchant props
    const handleProductClick = (product: CakeGenieMerchantProduct & { analysis_json?: HybridAnalysisResult }) => {
        if (!product.image_url || !product.slug) return;

        // Navigate directly to SEO-friendly route - no pre-loading needed
        // The product page server component fetches data and passes to CustomizingClient
        router.push(`/shop/${merchantSlug}/${product.slug}`);
    };




    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                    <p className="text-slate-600">Loading merchant...</p>
                </div>
            </div>
        );
    }

    if (error || !merchant) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Merchant Not Found</h1>
                    <p className="text-slate-600">The bakeshop you're looking for doesn't exist or is no longer active.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Hero / Profile Section */}
            <div className="relative bg-white shadow-sm mb-6">
                {/* Cover Photo */}
                <div className="h-48 md:h-64 w-full relative overflow-hidden bg-slate-200">
                    {merchant.cover_image_url && (
                        <LazyImage
                            src={merchant.cover_image_url}
                            alt="Cover Photo"
                            fill
                            sizes="100vw"
                            imageClassName="object-cover"
                            priority
                        />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
                </div>

                {/* Profile Info Container */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative -mt-16 pb-6 flex flex-col md:flex-row md:items-end gap-6">
                    {/* Profile Picture */}
                    <div className="relative shrink-0 mx-auto md:mx-0">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-white">
                            {merchant.profile_image_url && (
                                <LazyImage
                                    src={merchant.profile_image_url}
                                    alt={merchant.business_name}
                                    fill
                                    sizes="128px"
                                    imageClassName="object-cover"
                                />
                            )}
                        </div>
                    </div>

                    {/* Text Info */}
                    <div className="flex-1 text-center md:text-left pt-2 md:pt-0 pb-2">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{merchant.business_name}</h1>
                            {merchant.is_verified && (
                                <BadgeCheck className="w-6 h-6 text-blue-500" />
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-6 text-sm text-slate-600 mb-3">
                            {merchant.address && (
                                <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(merchant.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
                                >
                                    <MapPin className="w-4 h-4 text-purple-500" />
                                    {merchant.address}
                                </a>
                            )}
                            {merchant.phone && (
                                <a
                                    href={`tel:${merchant.phone}`}
                                    className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
                                >
                                    <Phone className="w-4 h-4 text-purple-500" />
                                    {merchant.phone}
                                </a>
                            )}
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400" />
                                <span className="font-medium text-slate-900">{merchant.rating}</span>
                                <span className="text-slate-400">({merchant.review_count} reviews)</span>
                            </div>
                        </div>

                        {merchant.description && (
                            <p className="text-sm text-slate-600 max-w-2xl">{merchant.description}</p>
                        )}
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
                            placeholder={`Search ${merchant.business_name}...`}
                            showUploadButton={false}
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
                        {products.length > 0 && (
                            <span className="text-sm font-normal text-slate-500">({products.length} items)</span>
                        )}
                    </h2>

                    {products.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-600">No products available yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6">
                            {products.map((product) => (
                                <div
                                    key={product.product_id}
                                    onClick={() => handleProductClick(product)}
                                    className="bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 transition-all duration-300 group cursor-pointer h-full flex flex-col"
                                >
                                    <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                        <LazyImage
                                            src={product.image_url || '/placeholder-cake.png'}
                                            alt={product.alt_text || product.title}
                                            fill
                                            className="group-hover:scale-110 transition-transform duration-500"
                                            imageClassName="object-cover"
                                            sizes="(max-width: 490px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                                        />

                                        {/* Overlay Gradient on Hover */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                                        {/* Save Button */}
                                        <button
                                            aria-label="Save this cake"
                                            className="absolute top-3 right-3 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-all z-10 bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500"
                                        >
                                            <Heart size={16} />
                                        </button>

                                        {/* Tag Badge */}
                                        {getProductTag(product) && (
                                            <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shadow-sm z-10">
                                                {getProductTag(product)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="px-1 flex flex-col flex-1">
                                        <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                            {product.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mb-auto">
                                            <Cake size={12} /> {product.cake_type || 'Custom Design'}
                                        </p>
                                        <div className="flex justify-between items-end border-t border-gray-50 pt-3 mt-3">
                                            <span className="font-black text-gray-900 text-base md:text-lg">
                                                ₱{(product.custom_price || 0).toLocaleString()}
                                            </span>
                                            <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                                                <Star size={12} fill="currentColor" /> 5.0
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
