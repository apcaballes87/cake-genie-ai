'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LazyImage from '@/components/LazyImage';
import { useAuth } from '@/contexts/AuthContext';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useSavedItemsActions } from '@/contexts/SavedItemsContext';
import { CustomizationDetails } from '@/lib/database.types';
import { showError, showLoading } from '@/lib/utils/toast';
import { formatStartingPrice } from '@/lib/utils/currency';
import { HybridAnalysisResult } from '@/types';

export interface ProductCardProps {
    p_hash: string;
    original_image_url: string;
    price?: number | null;
    keywords?: string | null;
    slug?: string | null;
    availability?: string | null;
    analysis_json?: {
        cakeType?: string;
        icing_design?: string;
        [key: string]: unknown;
    } | null;
    priority?: boolean;
    image_width?: number | null;
    image_height?: number | null;
}

type ProductCardContentProps = Pick<
    ProductCardProps,
    'original_image_url' | 'price' | 'availability' | 'priority' | 'image_width' | 'image_height'
> & {
    title: string;
};

type ProductCardShellProps = {
    children: React.ReactNode;
    isSaved: boolean;
    onSaveClick: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
};

const buildProductTitle = (keywords?: string | null) => {
    const firstKeyword = keywords ? keywords.split(',')[0] : 'Custom Cake';
    const baseTitle = firstKeyword.trim().toLowerCase().endsWith('cake')
        ? firstKeyword.trim()
        : `${firstKeyword.trim()} Cake`;

    return baseTitle
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const buildCustomizationSnapshot = (analysis_json?: ProductCardProps['analysis_json']) => (
    (analysis_json as unknown as CustomizationDetails) || {
        flavors: [],
        mainToppers: [],
        supportElements: [],
        cakeMessages: [],
        icingDesign: { drip: false, gumpasteBaseBoard: false, colors: {} },
        additionalInstructions: '',
    }
);

const isValidPrecomputedAnalysis = (analysis_json?: ProductCardProps['analysis_json']) => Boolean(
    analysis_json &&
    typeof analysis_json === 'object' &&
    'cakeType' in analysis_json &&
    'icing_design' in analysis_json
);

const ProductCardContent = ({
    original_image_url,
    price,
    availability,
    priority = false,
    image_width,
    image_height,
    title,
}: ProductCardContentProps) => {
    const avail = availability || 'normal';

    return (
        <>
            <div className="relative mb-1.5 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                <div
                    className={`relative w-full ${image_width && image_height ? '' : 'aspect-4/5'}`}
                    style={image_width && image_height ? { aspectRatio: `${image_width} / ${image_height}` } : undefined}
                >
                    <LazyImage
                        src={original_image_url}
                        alt={title}
                        title={title}
                        fill
                        sizes="(max-width: 490px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 17vw"
                        imageClassName="object-cover group-hover:scale-105 transition-transform duration-500 genie-internal-image"
                        priority={priority}
                        loading={priority ? 'eager' : 'lazy'}
                    />

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                    <div className="absolute top-2.5 left-2.5">
                        <span className={`backdrop-blur-sm text-[10px] md:text-xs font-extrabold px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap ${avail === 'rush'
                            ? 'bg-green-600/95 text-white'
                            : avail === 'same-day'
                                ? 'bg-blue-600/95 text-white'
                                : 'bg-white/95 text-gray-800'
                            }`}>
                            {avail === 'same-day' ? 'Same Day' : avail === 'rush' ? 'Rush' : 'Pre-order'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="px-0 pb-1 pt-0.5 flex flex-col flex-1">
                <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors">
                    {title}
                </h3>
                <p className="text-xs text-gray-500 mb-1">{formatStartingPrice(price)}</p>
            </div>
        </>
    );
};

const ProductCardShell = ({ children, isSaved, onSaveClick }: ProductCardShellProps) => (
    <div className="group cursor-pointer flex flex-col h-full relative break-inside-avoid">
        {children}
        <button
            onClick={onSaveClick}
            className={`save-heart-button absolute top-2.5 right-2.5 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition-colors ${isSaved
                ? 'bg-red-500 text-white'
                : 'bg-white/90 text-gray-400 hover:text-red-500'
                }`}
            aria-label={isSaved ? 'Remove from saved' : 'Save design'}
            tabIndex={0}
        >
            <Heart
                size={16}
                fill={isSaved ? 'currentColor' : 'none'}
                className={isSaved ? 'text-white' : ''}
            />
        </button>
    </div>
);

const useProductCardCommon = ({ p_hash, original_image_url, analysis_json }: ProductCardProps) => {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const { toggleSaveDesign, isDesignSaved } = useSavedItemsActions();
    const isSaved = isDesignSaved(p_hash);

    const handleSaveClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();

        if (!isAuthenticated || user?.is_anonymous) {
            toast('Please log in to save items', { icon: '💜' });
            router.push('/login');
            return;
        }

        await toggleSaveDesign({
            analysisPHash: p_hash,
            customizationSnapshot: buildCustomizationSnapshot(analysis_json),
            customizedImageUrl: original_image_url,
        });

        const wasSaved = isDesignSaved(p_hash);
        toast.success(wasSaved ? 'Removed from saved' : 'Saved!');
    };

    return { router, isSaved, handleSaveClick };
};

const LinkedProductCard = (props: ProductCardProps & { slug: string }) => {
    const title = buildProductTitle(props.keywords);
    const { isSaved, handleSaveClick } = useProductCardCommon(props);

    return (
        <ProductCardShell isSaved={isSaved} onSaveClick={handleSaveClick}>
            <Link href={`/customizing/${props.slug}`} className="cursor-pointer flex flex-col h-full w-full" title={`${title} Design Details`}>
                <ProductCardContent {...props} title={title} />
            </Link>
        </ProductCardShell>
    );
};

const InteractiveProductCard = (props: ProductCardProps) => {
    const title = buildProductTitle(props.keywords);
    const { router, isSaved, handleSaveClick } = useProductCardCommon(props);
    const { handleImageUpload: hookImageUpload, clearImages } = useImageManagement();
    const {
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        initializeDefaultState,
        clearCustomization,
    } = useCakeCustomization();

    const handleProductClick = async (e: React.MouseEvent | React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('button.save-heart-button')) {
            return;
        }

        if (!props.original_image_url) return;

        const toastId = showLoading('Loading design...');
        clearImages();
        clearCustomization();
        setIsAnalyzing(true);
        setAnalysisError(null);
        initializeDefaultState();

        try {
            const response = await fetch(props.original_image_url);
            const blob = await response.blob();
            const file = new File([blob], 'design.jpg', { type: blob.type });

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
                    console.error('Error processing image:', error);
                    if (error instanceof Error && error.message.startsWith('AI_REJECTION:')) {
                        showError(error.message.replace('AI_REJECTION: ', ''));
                    } else {
                        showError('Failed to load design');
                    }
                },
                {
                    imageUrl: props.original_image_url,
                    precomputedAnalysis: isValidPrecomputedAnalysis(props.analysis_json)
                        ? (props.analysis_json as unknown as HybridAnalysisResult)
                        : undefined,
                }
            );
        } catch (error) {
            toast.dismiss(toastId);
            console.error('Error fetching image:', error);
            showError('Failed to load design');
        }
    };

    return (
        <ProductCardShell isSaved={isSaved} onSaveClick={handleSaveClick}>
            <div onClick={handleProductClick} className="cursor-pointer flex flex-col h-full w-full" title={`Customize this ${title}`}>
                <ProductCardContent {...props} title={title} />
            </div>
        </ProductCardShell>
    );
};

const ProductCardComponent = (props: ProductCardProps) => {
    if (props.slug) {
        return <LinkedProductCard {...(props as ProductCardProps & { slug: string })} />;
    }

    return <InteractiveProductCard {...props} />;
};

export const ProductCard = React.memo(ProductCardComponent);
ProductCard.displayName = 'ProductCard';