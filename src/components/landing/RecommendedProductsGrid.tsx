'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LazyImage from '@/components/LazyImage';
import { Heart, Cake, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedItemsActions } from '@/contexts/SavedItemsContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { getRecommendedProducts } from '@/services/supabaseService';
import { showLoading, showError } from '@/lib/utils/toast';
import { toast } from 'react-hot-toast';
import { HybridAnalysisResult } from '@/types';
import { CustomizationDetails } from '@/lib/database.types';

interface RecommendedProduct {
    p_hash: string;
    original_image_url: string;
    price: number;
    keywords?: string;
    slug?: string;
    analysis_json?: {
        cakeType?: string;
        icing_design?: string;
        [key: string]: unknown;
    };
}

interface RecommendedProductsGridProps {
    initialProducts: RecommendedProduct[];
}

export const RecommendedProductsGrid = ({ initialProducts }: RecommendedProductsGridProps) => {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const { toggleSaveDesign, isDesignSaved } = useSavedItemsActions();
    const { handleImageUpload: hookImageUpload, clearImages } = useImageManagement();
    const {
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        initializeDefaultState,
        clearCustomization
    } = useCakeCustomization();

    const [products, setProducts] = useState<RecommendedProduct[]>(initialProducts);
    const [offset, setOffset] = useState(initialProducts.length);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchMoreProducts = useCallback(async (currentOffset: number) => {
        try {
            const { data, error } = await getRecommendedProducts(8, currentOffset);

            if (data) {
                setProducts(prev => [...prev, ...data]);
                if (data.length < 8) {
                    setHasMore(false);
                }
            } else {
                console.error("Failed to load more products:", error);
            }
        } catch (err) {
            console.error("Error loading more products:", err);
        } finally {
            setIsLoadingMore(false);
        }
    }, []);

    const handleLoadMore = () => {
        const nextOffset = offset + 8;
        setOffset(nextOffset);
        setIsLoadingMore(true);
        fetchMoreProducts(nextOffset);
    };

    const handleProductClick = async (e: React.MouseEvent | React.TouchEvent, item: RecommendedProduct) => {
        // Prevent if we clicked the heart button
        if ((e.target as HTMLElement).closest('button.save-heart-button')) {
            return;
        }

        if (!item.original_image_url) return;

        // If item has a slug, navigate directly to the SEO-friendly URL
        if (item.slug) {
            router.push(`/customizing/${item.slug}`);
            return;
        }

        // Fallback for items without slug
        const toastId = showLoading('Loading design...');

        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        try {
            const response = await fetch(item.original_image_url);
            const blob = await response.blob();
            const file = new File([blob], "design.jpg", { type: blob.type });

            const isValidAnalysis = item.analysis_json &&
                typeof item.analysis_json === 'object' &&
                'cakeType' in item.analysis_json &&
                'icing_design' in item.analysis_json;

            await hookImageUpload(
                file,
                (result) => {
                    toast.dismiss(toastId);
                    setPendingAnalysisData(result);
                    setIsAnalyzing(false);
                    router.push('/customizing');
                },
                (error) => {
                    toast.dismiss(toastId);
                    console.error("Error processing image:", error);
                    showError("Failed to load design");
                },
                {
                    imageUrl: item.original_image_url,
                    precomputedAnalysis: isValidAnalysis ? (item.analysis_json as unknown as HybridAnalysisResult) : undefined
                }
            );
        } catch (error) {
            toast.dismiss(toastId);
            console.error("Error fetching image:", error);
            showError("Failed to load design");
        }
    };

    const handleSaveClick = async (e: React.MouseEvent, item: RecommendedProduct) => {
        e.stopPropagation();
        e.preventDefault();

        if (!isAuthenticated || user?.is_anonymous) {
            toast('Please log in to save items', { icon: '💜' });
            router.push('/login');
            return;
        }

        const pHash = item.p_hash;
        await toggleSaveDesign({
            analysisPHash: pHash,
            customizationSnapshot: (item.analysis_json as unknown as CustomizationDetails) || {
                flavors: [],
                mainToppers: [],
                supportElements: [],
                cakeMessages: [],
                icingDesign: { drip: false, gumpasteBaseBoard: false, colors: {} },
                additionalInstructions: ''
            },
            customizedImageUrl: item.original_image_url
        });

        const wasSaved = isDesignSaved(pHash);
        toast.success(wasSaved ? 'Removed from saved' : 'Saved!');
    };

    return (
        <>
            {/* Section Header */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">Recent searches by users</h2>
                    <p className="text-gray-500 text-sm md:text-base">Get the price in 15 seconds!</p>
                </div>
                <button className="text-purple-600 text-sm font-bold hover:underline hidden md:block">View All</button>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 min-[490px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6 mb-12">
                {products.length > 0 ? (
                    <>
                        {products.map((item, index) => (
                            <div
                                key={`${item.p_hash}-${index}`}
                                onClick={(e) => handleProductClick(e, item)}
                                className="bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 transition-all duration-300 group cursor-pointer"
                            >
                                <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100">
                                    <LazyImage
                                        src={item.original_image_url}
                                        alt={item.keywords || 'Cake Design'}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        priority={index < 4}
                                        fill
                                    />

                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                                    <button
                                        onClick={(e) => handleSaveClick(e, item)}
                                        className={`save-heart-button absolute top-3 right-3 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-all z-10 ${isDesignSaved(item.p_hash)
                                            ? 'bg-red-500 text-white'
                                            : 'bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500'
                                            }`}
                                        aria-label={isDesignSaved(item.p_hash) ? 'Remove from saved' : 'Save design'}
                                        tabIndex={0}
                                    >
                                        <Heart
                                            size={16}
                                            fill={isDesignSaved(item.p_hash) ? 'currentColor' : 'none'}
                                            className={isDesignSaved(item.p_hash) ? 'text-white' : ''}
                                        />
                                    </button>

                                    {item.price < 1000 && (
                                        <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shadow-sm">
                                            Affordable
                                        </span>
                                    )}
                                </div>
                                <div className="px-1">
                                    <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                        {(() => {
                                            const title = item.keywords ? item.keywords.split(',')[0] : 'Custom Cake';
                                            return title.trim().toLowerCase().endsWith('cake') ? title : `${title} Cake`;
                                        })()}
                                    </h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <Cake size={12} /> {item.analysis_json?.cakeType || 'Custom Design'}
                                    </p>
                                    <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                                        <span className="font-black text-gray-900 text-base md:text-lg">₱{item.price.toLocaleString()}</span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                                            <Star size={12} fill="currentColor" /> 5.0
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* Loading More Skeleton */}
                        {isLoadingMore && (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={`loading-more-${i}`} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                                    <div className="aspect-square mb-3 rounded-xl bg-gray-200"></div>
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                                    <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                                        <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                                        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </>
                ) : (
                    <div className="col-span-full text-center py-10 text-gray-500">
                        No recommended cakes found at the moment.
                    </div>
                )}
            </div>

            {/* Load More Button */}
            <div className="text-center pb-10">
                {hasMore ? (
                    <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="border border-gray-300 bg-white px-8 py-3 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                ) : (
                    <div className="text-gray-400 text-xs">End of results</div>
                )}
            </div>
        </>
    );
};

export default RecommendedProductsGrid;
