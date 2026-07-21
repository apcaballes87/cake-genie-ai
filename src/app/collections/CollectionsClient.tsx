'use client';

import React, { useState, useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShoppingBag, Search, User } from 'lucide-react';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { LandingFooter } from '@/components/landing/LandingFooter';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useCart } from '@/contexts/CartContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { COMMON_ASSETS } from '@/constants';
import { CollectionDirectoryPagination } from './CollectionDirectoryPagination';

interface Category {
    slug: string;
    keyword: string; // The backend maps name -> keyword for compatibility, but let's use name if available
    name?: string;
    description?: string;
    sample_image: string;
    count: number;
    collection_type?: string;
    trend_score?: number | null;
}

interface CollectionsClientProps {
    categories: Category[];
    trendingCategories: Category[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    startIndex: number;
    featuredCollections?: ReactNode;
}

const CollectionsClient: React.FC<CollectionsClientProps> = ({
    categories,
    trendingCategories,
    currentPage,
    totalPages,
    totalCount,
    startIndex,
    featuredCollections,
}) => {
    const router = useRouter();
    const { isAuthenticated, user } = useAuth();
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

    const [searchQuery, setSearchQuery] = useState('');
    const [isFetchingWebImage, setIsFetchingWebImage] = useState(false);
    const isMounted = useSyncExternalStore(
        () => () => undefined,
        () => true,
        () => false,
    );
    const [isScrolled, setIsScrolled] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
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
            {/* ========== HEADER ========== */}
            <nav className={`sticky top-0 z-80 w-full border-b transition-all duration-200 ${(isScrolled || isSearchFocused) ? 'border-purple-100 bg-white/90 shadow-sm backdrop-blur-lg' : 'border-transparent bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="w-full flex items-center gap-2 md:gap-4 py-2.5 md:py-[14px]">
                        <Link href="/" className="p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label="Go back">
                            <ArrowLeft size={24} />
                        </Link>

                        <div className="relative grow flex items-center gap-2 md:gap-4">
                            {/* Logo - visible when not scrolled on mobile, always visible on desktop */}
                            <Link
                                href="/"
                                className={`shrink-0 transition-all duration-300 ${(isScrolled || isSearchFocused) ? 'opacity-0 pointer-events-none absolute -translate-x-4 md:opacity-0 md:pointer-events-none' : 'opacity-100 translate-x-0'}`}
                            >
                                <img
                                    src={COMMON_ASSETS.logo}
                                    alt="Genie Logo"
                                    width={135}
                                    height={43}
                                    className="h-[27px] md:h-[41px] w-auto object-contain"
                                />
                            </Link>

                            {/* Search Bar - visible when scrolled on mobile, always visible on desktop */}
                            <div className={`flex-1 transition-all duration-300 ${(isScrolled || isSearchFocused) ? 'opacity-100 translate-x-0' : 'hidden md:block md:opacity-100 md:translate-x-0 opacity-0 translate-x-4 pointer-events-none'}`}>
                                <SearchAutocomplete
                                    inputRef={searchInputRef}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setIsSearchFocused(false)}
                                    onSearch={handleSearch}
                                    onUploadClick={() => router.push('/customizing')}
                                    placeholder="Search for other designs..."
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    showUploadButton={false}
                                    inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-purple-100 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                                />
                            </div>
                        </div>

                        {/* Right Side: Actions & Cart */}
                        <div className="flex items-center gap-1 md:gap-2 shrink-0">
                            {/* Mobile Search Icon - visible only when NOT scrolled and NOT focused */}
                            {!(isScrolled || isSearchFocused) && (
                                <button
                                    onClick={() => {
                                        setIsSearchFocused(true);
                                        window.scrollTo({ top: 50, behavior: 'smooth' });
                                        setTimeout(() => {
                                            searchInputRef.current?.focus();
                                        }, 50);
                                    }}
                                    className="md:hidden p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors"
                                    aria-label="Search"
                                >
                                    <Search size={20} />
                                </button>
                            )}

                            {/* Account Button - visible on desktop when not scrolled */}
                            <button
                                onClick={() => {
                                    if (isAuthenticated && !user?.is_anonymous) {
                                        router.push('/account');
                                    } else {
                                        router.push('/login');
                                    }
                                }}
                                className={`hidden md:flex p-1.5 genie-icon-button rounded-full transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none absolute translate-x-4' : 'opacity-100 translate-x-0'}`}
                                aria-label="Account"
                            >
                                <User className="h-[19px] w-[19px] md:h-[22px] md:w-[22px]" />
                            </button>

                            {/* Cart Button */}
                            <button
                                onClick={() => router.push('/cart')}
                                className="relative p-2 genie-icon-button rounded-full text-slate-600 hover:text-purple-700 transition-colors shrink-0"
                                aria-label={`View cart with ${isMounted ? itemCount : 0} items`}
                            >
                                <ShoppingBag className="h-5 w-5 md:h-6 md:w-6" />
                                {isMounted && itemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white text-[9px] md:text-[10px] font-bold">
                                        {itemCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Header Spacer */}
            <div className="h-[56px] md:h-[74px]"></div>

            <div className="w-full max-w-7xl mx-auto px-4">
                {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="grow">
                             <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                                 Browse Cake <span className="text-purple-400">Collections</span>
                             </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Explore our organized library of custom cake designs. Filter by category or browse the newest arrivals from the Genie.ph community.
                            </p>
                        </div>
                    </div>

                    {featuredCollections}

                    {trendingCategories.length > 0 && (
                        <section className="mb-10">
                            <h2 className="text-lg font-bold text-slate-800 mb-1">Trending Cake Themes</h2>
                            <p className="text-sm text-slate-500 mb-4">Fresh themes with enough real cake designs to browse and customize.</p>
                            <div className="flex flex-wrap gap-2">
                                {trendingCategories.map((cat) => (
                                    <Link
                                        key={`trending-${cat.slug}`}
                                        href={`/collections/${cat.slug}`}
                                        className="rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                                    >
                                        {cat.keyword || cat.name}
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Categories Grid */}
                    {categories.length > 0 && (
                        <section id="categories-section" className="mb-10 scroll-mt-24">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Popular Categories</h2>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                {categories.map((cat) => (
                                    <Link
                                        key={cat.slug}
                                        href={`/collections/${cat.slug}`}
                                        className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col"
                                    >
                                        <div className="relative aspect-4/5 bg-gray-100">
                                            <Image
                                                src={cat.sample_image}
                                                alt={`${cat.keyword || cat.name} cake designs`}
                                                fill
                                                sizes="(max-width: 768px) 33vw, 16vw"
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
                                            <div className="absolute bottom-0 left-0 right-0 p-2">
                                                <p className="text-white text-[11px] max-md:text-[9px] font-bold leading-tight capitalize drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                                                    {cat.keyword || cat.name}
                                                </p>
                                                {cat.count > 0 && (
                                                    <p className="text-white/90 text-[9px] max-md:text-[8px] font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] mt-0.5">
                                                        {cat.count} designs
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Crawlable pagination controls */}
                            {totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-100">
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium">
                                        Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
                                        <span className="font-bold text-slate-800">
                                            {Math.min(startIndex + categories.length, totalCount)}
                                        </span>{' '}
                                        of <span className="font-bold text-slate-800">{totalCount}</span> categories
                                    </p>
                                    <CollectionDirectoryPagination currentPage={currentPage} totalPages={totalPages} />
                                </div>
                            )}
                        </section>
                    )}

            </div>

            <LandingFooter />

            <MobileBottomNav />
        </div>
    );
};

export default CollectionsClient;
