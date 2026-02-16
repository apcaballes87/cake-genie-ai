'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useCart } from '@/contexts/CartContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';

interface Category {
    slug: string;
    keyword: string;
    sample_image: string;
    count: number;
}

interface Design {
    slug: string;
    p_hash: string;
    original_image_url: string;
    price: number | null;
    keywords: string | string[];
    availability?: string | null;
    analysis_json?: {
        cakeType?: string;
        icing_design?: string;
        [key: string]: unknown;
    };
}

interface CollectionsClientProps {
    categories: Category[];
    recentDesigns: Design[];
}

const CollectionsClient: React.FC<CollectionsClientProps> = ({
    categories,
    recentDesigns
}) => {
    const router = useRouter();
    const { itemCount } = useCart();
    const {
        handleImageUpload: hookImageUpload,
        clearImages,
        originalImageData,
        setError: setImageError
    } = useImageManagement();
    const {
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        initializeDefaultState,
        clearCustomization
    } = useCakeCustomization();

    const [searchInput, setSearchInput] = useState('');
    const [isFetchingWebImage, setIsFetchingWebImage] = useState(false);
    const [mounted, setMounted] = useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleSearch = useCallback((query: string) => {
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }
    }, [router]);

    const handleImageUpload = useCallback(async (file: File, imageUrl?: string) => {
        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        router.push('/customizing?from=search');

        return new Promise<void>((resolve, reject) => {
            hookImageUpload(
                file,
                (result) => {
                    setPendingAnalysisData(result);
                    setIsAnalyzing(false);
                    resolve();
                },
                (error) => {
                    setAnalysisError(error.message);
                    setIsAnalyzing(false);
                    reject(error);
                },
                { imageUrl }
            );
        });
    }, [clearImages, clearCustomization, setIsAnalyzing, setAnalysisError, initializeDefaultState, router, hookImageUpload, setPendingAnalysisData]);

    return (
        <div className="min-h-screen pb-24 md:pb-0">
            {/* Search Header */}
            <div className="w-full max-w-7xl mx-auto px-4">
                <div className="w-full flex items-center gap-2 md:gap-4 mb-4 pt-6">
                    <Link href="/" className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors shrink-0" aria-label="Go back">
                        <ArrowLeft />
                    </Link>
                    <div className="relative grow">
                        <SearchAutocomplete
                            value={searchInput}
                            onChange={setSearchInput}
                            onSearch={handleSearch}
                            onUploadClick={() => router.push('/customizing')}
                            showUploadButton={true}
                            placeholder="Search cake designs..."
                            inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                        />
                    </div>
                    <button
                        onClick={() => router.push('/cart')}
                        className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                        aria-label={`View cart with ${mounted ? itemCount : 0} items`}
                    >
                        <ShoppingBag size={24} />
                        {mounted && itemCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                                {itemCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <div className="w-full max-w-7xl mx-auto px-4">
                <div className="bg-white/80 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="grow">
                            <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
                                Browse Cake Collections
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Explore our organized library of custom cake designs. Filter by category or browse the newest arrivals from the Genie.ph community.
                            </p>
                        </div>
                    </div>

                    {/* Categories Grid */}
                    {categories.length > 0 && (
                        <section className="mb-10">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Popular Categories</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {categories.map((cat) => (
                                    <Link
                                        key={cat.slug}
                                        href={`/collections/${cat.slug}`}
                                        className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                                    >
                                        <div className="relative aspect-4/3 bg-gray-100">
                                            <Image
                                                src={cat.sample_image}
                                                alt={`${cat.keyword} cake designs`}
                                                fill
                                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                                                <p className="text-white text-sm font-bold leading-tight capitalize">{cat.keyword}</p>
                                                <p className="text-white/80 text-xs">{cat.count} designs</p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Recent Price Quotes */}
                    {recentDesigns.length > 0 && (
                        <section className="pt-6 border-t border-slate-200">
                            <div className="mb-4">
                                <h2 className="text-lg font-bold text-slate-800">Recent Price Quotes</h2>
                                <p className="text-slate-500 text-sm mt-1">
                                    Browse designs that other users have recently requested pricing for.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                                {recentDesigns.map((design) => (
                                    <ProductCard
                                        key={design.slug}
                                        p_hash={design.p_hash}
                                        original_image_url={design.original_image_url}
                                        price={design.price}
                                        keywords={Array.isArray(design.keywords) ? design.keywords.join(', ') : design.keywords}
                                        slug={design.slug}
                                        availability={design.availability ?? undefined}
                                        analysis_json={design.analysis_json}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            <MobileBottomNav />
        </div>
    );
};

export default CollectionsClient;
