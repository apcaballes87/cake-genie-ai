'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LazyImage from '@/components/LazyImage';
import { Heart, Cake, Star, Zap, Clock, CalendarDays } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedItemsActions } from '@/contexts/SavedItemsContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { showLoading, showError } from '@/lib/utils/toast';
import { toast } from 'react-hot-toast';
import { HybridAnalysisResult } from '@/types';
import { CustomizationDetails } from '@/lib/database.types';

export interface ProductCardProps {
    p_hash: string;
    original_image_url: string;
    price?: number | null;
    keywords?: string;
    slug?: string;
    availability?: string;
    analysis_json?: {
        cakeType?: string;
        icing_design?: string;
        [key: string]: unknown;
    };
    priority?: boolean;
}

export const ProductCard = ({
    p_hash,
    original_image_url,
    price,
    keywords,
    slug,
    availability,
    analysis_json,
    priority = false
}: ProductCardProps) => {
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

    const handleProductClick = async (e: React.MouseEvent | React.TouchEvent) => {
        // Prevent if we clicked the heart button
        if ((e.target as HTMLElement).closest('button.save-heart-button')) {
            return;
        }

        if (!original_image_url) return;

        // If item has a slug, navigate directly to the SEO-friendly URL
        if (slug) {
            router.push(`/customizing/${slug}`);
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
            const response = await fetch(original_image_url);
            const blob = await response.blob();
            const file = new File([blob], "design.jpg", { type: blob.type });

            const isValidAnalysis = analysis_json &&
                typeof analysis_json === 'object' &&
                'cakeType' in analysis_json &&
                'icing_design' in analysis_json;

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
                    if (error instanceof Error && error.message.startsWith('AI_REJECTION:')) {
                        showError(error.message.replace('AI_REJECTION: ', ''));
                    } else {
                        showError("Failed to load design");
                    }
                },
                {
                    imageUrl: original_image_url,
                    precomputedAnalysis: isValidAnalysis ? (analysis_json as unknown as HybridAnalysisResult) : undefined
                }
            );
        } catch (error) {
            toast.dismiss(toastId);
            console.error("Error fetching image:", error);
            showError("Failed to load design");
        }
    };

    const handleSaveClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (!isAuthenticated || user?.is_anonymous) {
            toast('Please log in to save items', { icon: '💜' });
            router.push('/login');
            return;
        }

        await toggleSaveDesign({
            analysisPHash: p_hash,
            customizationSnapshot: (analysis_json as unknown as CustomizationDetails) || {
                flavors: [],
                mainToppers: [],
                supportElements: [],
                cakeMessages: [],
                icingDesign: { drip: false, gumpasteBaseBoard: false, colors: {} },
                additionalInstructions: ''
            },
            customizedImageUrl: original_image_url
        });

        const wasSaved = isDesignSaved(p_hash);
        toast.success(wasSaved ? 'Removed from saved' : 'Saved!');
    };

    // Availability Badge Logic
    const avail = availability || 'normal';
    const availConfig = avail === 'rush'
        ? { label: 'Rush Order', icon: <Zap size={10} />, className: 'bg-emerald-500/90 text-white' }
        : avail === 'same-day'
            ? { label: 'Same Day', icon: <Clock size={10} />, className: 'bg-blue-500/90 text-white' }
            : { label: 'Pre-order', icon: <CalendarDays size={10} />, className: 'bg-purple-500/90 text-white' };

    // Title Logic
    const title = (() => {
        const t = keywords ? keywords.split(',')[0] : 'Custom Cake';
        const formatted = t.trim().toLowerCase().endsWith('cake') ? t.trim() : `${t.trim()} Cake`;
        return formatted
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    })();

    // Core Card Content inside the clickable area
    const CardContent = (
        <>
            <div className="relative mb-1.5 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                <LazyImage
                    src={original_image_url}
                    alt={title}
                    title={title}
                    width={0}
                    height={0}
                    style={{ width: '100%', height: 'auto' }}
                    className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-500"
                    priority={priority}
                />

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                {/* Availability Badge at Top Left */}
                <div className="absolute top-2.5 left-2.5 z-10">
                    <span className={`backdrop-blur-sm text-[10px] md:text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap ${avail === 'rush'
                            ? 'bg-green-100/95 text-green-800'
                            : avail === 'same-day'
                                ? 'bg-blue-100/95 text-blue-800'
                                : 'bg-white/95 text-gray-800'
                        }`}>
                        {avail === 'same-day' ? 'Same Day' : avail === 'rush' ? 'Rush' : 'Pre-order'}
                    </span>
                </div>

                {/* Price and Rating Overlays at Bottom */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between items-end z-10 pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-sm text-gray-900 font-extrabold text-[11px] md:text-sm px-2.5 py-1 rounded-full shadow-sm pointer-events-auto">
                        {price ? `₱${price.toLocaleString()}` : 'Req. Price'}
                    </div>
                    <div className="bg-white/95 backdrop-blur-sm flex items-center gap-1 font-bold text-gray-900 text-xs md:text-sm px-2.5 py-1 rounded-full shadow-sm pointer-events-auto">
                        <Star size={12} className="text-orange-500" fill="currentColor" />
                        <span>4.9</span>
                    </div>
                </div>
            </div>

            <div className="px-1 pb-1 pt-0.5 flex flex-col flex-1">
                <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                    {title}
                </h3>
                <p className="text-xs text-gray-500 mb-1">
                    {analysis_json?.cakeType || 'Custom Design'}
                </p>
            </div>
        </>
    );

    const containerClasses = "group cursor-pointer flex flex-col h-full relative break-inside-avoid";

    return (
        <div className={containerClasses}>
            {slug ? (
                <Link href={`/customizing/${slug}`} className="cursor-pointer flex flex-col h-full w-full" title={`${title} Design Details`}>
                    {CardContent}
                </Link>
            ) : (
                <div onClick={handleProductClick} className="cursor-pointer flex flex-col h-full w-full" title={`Customize this ${title}`}>
                    {CardContent}
                </div>
            )}

            {/* Absolute positioning of the save button outside of the Link/div to keep HTML valid */}
            <button
                onClick={handleSaveClick}
                className={`save-heart-button absolute top-2.5 right-2.5 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm z-20 transition-colors ${isDesignSaved(p_hash)
                    ? 'bg-red-500 text-white'
                    : 'bg-white/90 text-gray-400 hover:text-red-500'
                    }`}
                aria-label={isDesignSaved(p_hash) ? 'Remove from saved' : 'Save design'}
                tabIndex={0}
            >
                <Heart
                    size={16}
                    fill={isDesignSaved(p_hash) ? 'currentColor' : 'none'}
                    className={isDesignSaved(p_hash) ? 'text-white' : ''}
                />
            </button>
        </div>
    );
};
