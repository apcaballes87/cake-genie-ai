'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import MobileBottomNav from '@/components/MobileBottomNav';
import { DesignGridWithLoadMore } from '@/components/collections/DesignGridWithLoadMore';
import { useCart } from '@/contexts/CartContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';

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

interface CategoryClientProps {
    designs: Design[];
    keyword: string;
    readableTitle: string;
    category: string;
}

const CategoryClient: React.FC<CategoryClientProps> = ({
    designs,
    keyword,
    readableTitle,
    category
}) => {
    const router = useRouter();
    const { itemCount } = useCart();
    const {
        handleImageUpload: hookImageUpload,
        clearImages,
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
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSearch = useCallback((query: string) => {
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }
    }, [router]);

    return (
        <div className="min-h-screen pb-24 md:pb-0">
            {/* Search Header */}
            <div className="w-full max-w-7xl mx-auto px-4">
                <div className="w-full flex items-center gap-2 md:gap-4 mb-4 pt-6">
                    <Link href="/collections" className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors shrink-0" aria-label="Go back">
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
                    {/* Breadcrumb */}
                    <nav className="mb-6" aria-label="Breadcrumb">
                        <ol className="flex items-center text-sm text-slate-500 space-x-2">
                            <li><Link href="/" className="hover:text-purple-600 transition-colors">Home</Link></li>
                            <li>/</li>
                            <li><Link href="/collections" className="hover:text-purple-600 transition-colors">Collections</Link></li>
                            <li>/</li>
                            <li className="text-slate-800 font-medium capitalize">{readableTitle}</li>
                        </ol>
                    </nav>

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="grow">
                            <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text capitalize">
                                {readableTitle} Designs
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Found {designs.length} {readableTitle} ideas. Click any design to customize it and get a price.
                            </p>
                        </div>
                    </div>

                    {/* Designs Grid with Load More & Google Search */}
                    <DesignGridWithLoadMore initialDesigns={designs} keyword={keyword} />
                </div>
            </div>

            <MobileBottomNav />
        </div>
    );
};

export default CategoryClient;
