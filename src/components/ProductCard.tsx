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
        return t.trim().toLowerCase().endsWith('cake') ? t : `${t} Cake`;
    })();

    // Core Card Content inside the clickable area
    const CardContent = (
        <>
            <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <LazyImage
                    src={original_image_url}
                    alt={title}
                    title={title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    priority={priority}
                    fill
                />

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                {/* Availability Badge */}
                <span className={`absolute bottom-3 left-3 backdrop-blur-md text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shadow-sm z-10 flex items-center gap-1 ${availConfig.className}`}>
                    {availConfig.icon} {availConfig.label}
                </span>
            </div>

            <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <LazyImage
                    src={original_image_url}
                    alt={title}
                    title={title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    priority={priority}
                    fill
                />

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                {/* Availability Badge */}
                <span className={`absolute bottom-3 left-3 backdrop-blur-md text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shadow-sm z-10 flex items-center gap-1 ${availConfig.className}`}>
                    {availConfig.icon} {availConfig.label}
                </span>
            </div>

            <div className="px-1 flex flex-col grow justify-between">
                <div>
                    <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                        {title}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-0">
                        <Cake size={12} /> {analysis_json?.cakeType || 'Custom Design'}
                    </p>
                </div>
                <div className="flex justify-between items-end border-t border-gray-50 pt-2 mt-auto">
                    <span className={`font-black text-gray-900 ${price ? 'text-base md:text-lg' : 'text-[10px] leading-tight uppercase'}`}>
                        {price ? `₱${price.toLocaleString()}` : 'Price on Request'}
                    </span>
                    <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                        <Star size={12} fill="currentColor" /> 5.0
                    </div>
                </div>
            </div>
        </>
    );

    const containerClasses = "bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-pink-300 border border-gray-100 transition-all duration-300 group h-full flex flex-col relative";

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
                className={`save-heart-button absolute top-6 right-6 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-all z-20 ${isDesignSaved(p_hash)
                    ? 'bg-red-500 text-white'
                    : 'bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500'
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
