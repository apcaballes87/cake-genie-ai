'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { LandingFooter } from '@/components/landing/LandingFooter';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useCart } from '@/contexts/CartContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';

interface Category {
    slug: string;
    keyword: string; // The backend maps name -> keyword for compatibility, but let's use name if available
    name?: string;
    description?: string;
    sample_image: string;
    count: number;
}

interface CollectionsClientProps {
    categories: Category[];
}

const CollectionsClient: React.FC<CollectionsClientProps> = ({
    categories
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
    const [isScrolled, setIsScrolled] = useState(false);

    React.useEffect(() => {
        setMounted(true);
        const updateScrollState = () => {
            setIsScrolled(window.scrollY > 12);
        };
        updateScrollState();
        window.addEventListener('scroll', updateScrollState, { passive: true });
        return () => window.removeEventListener('scroll', updateScrollState);
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
            {/* Standard Sticky Header */}
            <div className={`fixed top-0 left-0 right-0 z-80 border-b transition-all duration-200 ${isScrolled ? 'border-purple-100 bg-white/90 shadow-sm backdrop-blur-lg' : 'border-transparent bg-white'}`}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="w-full flex items-center gap-2 md:gap-4 py-[11px] md:py-[14px]">
                        <Link href="/" className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label="Go back">
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
                                inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-purple-100 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>
                        <button
                            onClick={() => router.push('/cart')}
                            className="relative p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                            aria-label={`View cart with ${mounted ? itemCount : 0} items`}
                        >
                            <ShoppingBag size={24} />
                            {mounted && itemCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-[10px] font-bold">
                                    {itemCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Header Spacer */}
            <div className="h-[66px] md:h-[74px]"></div>

            <div className="w-full max-w-7xl mx-auto px-4">
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
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                {categories.map((cat) => (
                                    <Link
                                        key={cat.slug}
                                        href={`/collections/${cat.slug}`}
                                        className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col"
                                    >
                                        <div className="relative aspect-4/3 bg-gray-100">
                                            <Image
                                                src={cat.sample_image}
                                                alt={`${cat.keyword || cat.name} cake designs`}
                                                fill
                                                sizes="(max-width: 768px) 33vw, 16vw"
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
                                            <div className="absolute bottom-0 left-0 right-0 p-2">
                                                <p className="text-white text-[11px] font-bold leading-tight capitalize drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                                                    {cat.keyword || cat.name}
                                                </p>
                                                {cat.count > 0 && (
                                                    <p className="text-white/90 text-[9px] font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] mt-0.5">
                                                        {cat.count} designs
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

            </div>

            <LandingFooter />

            <MobileBottomNav />
        </div>
    );
};

export default CollectionsClient;
