'use client';

import React, { Dispatch, SetStateAction, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LazyImage from '@/components/LazyImage';
import { v4 as uuidv4 } from 'uuid';
import { findClosestColor } from '@/utils/colorUtils';
import { X, Wand2, Palette, MessageSquare, PartyPopper, Image as ImageIconLucide, Heart, Cake, Star } from 'lucide-react';
import { CakeBaseOptions } from '@/components/CakeBaseOptions';
import { CustomizationTabs } from '@/components/CustomizationTabs';
import { CustomizationBottomSheet } from '../../components/CustomizationBottomSheet';
import { SegmentationOverlay } from '../../components/SegmentationOverlay';
import { SegmentationBottomSheet } from '../../components/SegmentationBottomSheet';
import { BoundingBoxOverlay } from '../../components/BoundingBoxOverlay';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { CustomizationSkeleton, CustomizationTabsSkeleton, ChosenOptionsSkeleton } from '../../components/LoadingSkeletons';
import { MagicSparkleIcon, ErrorIcon, ImageIcon, ResetIcon, SaveIcon, BackIcon, ReportIcon, UserCircleIcon, LogOutIcon, Loader2, MapPinIcon, PackageIcon, SideIcingGuideIcon, TopIcingGuideIcon, TopBorderGuideIcon, BaseBorderGuideIcon, BaseBoardGuideIcon, TrashIcon } from '../../components/icons';
import { ShoppingBag } from 'lucide-react';
import { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, BasePriceInfo, CakeType, AvailabilitySettings, IcingColorDetails, AnalysisItem, ClusteredMarker, CartItem } from '../../types';
import { CakeGenieCartItem, CakeGenieMerchant, CakeGenieMerchantProduct } from '../../lib/database.types';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { AvailabilityType } from '../../lib/utils/availability';
import { FloatingResultPanel } from '../../components/FloatingResultPanel';
import { COLORS, CAKE_TYPE_THUMBNAILS, CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, FLAVOR_THUMBNAILS } from '@/constants';
import { ColorPalette } from '../../components/ColorPalette';
import { CakeMessagesOptions } from '../../components/CakeMessagesOptions';
import { CakeToppersOptions } from '../../components/CakeToppersOptions';
import { TopperCard } from '../../components/TopperCard';
import StickyAddToCartBar from '../../components/StickyAddToCartBar';
import { showSuccess, showError, showInfo } from '../../lib/utils/toast';
import { reportCustomization, uploadReportImage, getAnalysisByExactHash, getRelatedProductsByKeywords } from '../../services/supabaseService';
import ReportModal from '../../components/ReportModal';
import ShareModal from '../../components/ShareModal';
import { CartItemDetails } from '../../types';

// Hooks
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { useImageManagement } from '@/contexts/ImageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useSavedItemsActions, useSavedItemsData } from '@/contexts/SavedItemsContext';
import { usePricing } from '@/hooks/usePricing';
import { useDesignUpdate } from '@/hooks/useDesignUpdate';
import { useDesignSharing } from '@/hooks/useDesignSharing';
import { useAvailabilitySettings } from '@/hooks/useAvailabilitySettings';
import { useSearchEngine } from '@/hooks/useSearchEngine';
import { AppState } from '@/hooks/useAppNavigation';
import { toast } from 'react-hot-toast';

interface AvailabilityInfo {
    type: AvailabilityType;
    label: string;
    time: string;
    icon: string;
    description: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
}

const AVAILABILITY_MAP: Record<AvailabilityType, AvailabilityInfo> = {
    rush: {
        type: 'rush',
        label: 'Rush Order Available!',
        time: 'Ready in 30 minutes',
        icon: '⚡',
        description: 'Simple design - we can make this super fast!',
        bgColor: 'bg-green-50',
        textColor: 'text-green-800',
        borderColor: 'border-green-300'
    },
    'same-day': {
        type: 'same-day',
        label: 'Same-Day Order!',
        time: 'Ready in 3 hours',
        icon: '🕐',
        description: 'Quick turnaround - order now for today!',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-300'
    },
    normal: {
        type: 'normal',
        label: 'Standard Order',
        time: 'Requires 1 day lead time',
        icon: '📅',
        description: 'Order by 3 PM for next-day delivery slots. Complex designs need time for perfection!',
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-800',
        borderColor: 'border-slate-300'
    }
};


type ImageTab = 'original' | 'customized';

// --- Helper functions for icing images ---


type IcingImageType = 'top' | 'side' | 'drip' | 'borderTop' | 'borderBase' | 'gumpasteBaseBoard';

const getIcingImage = (icingDesign: IcingDesignUI, type: IcingImageType, isTopSpecific: boolean = false): string => {
    const baseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/';

    let color: string | undefined;
    let prefix = 'icing';
    let defaultFile = 'icing_white.webp';

    switch (type) {
        case 'top':
            color = icingDesign.colors?.top;
            if (isTopSpecific) {
                prefix = 'topicing';
                defaultFile = 'topicing_white.webp';
            }
            break;
        case 'side':
            color = icingDesign.colors?.side;
            break;
        case 'drip':
            color = icingDesign.colors?.drip;
            prefix = 'drip';
            defaultFile = 'drip_white.webp';
            break;
        case 'borderTop':
            color = icingDesign.colors?.borderTop;
            prefix = 'top';
            defaultFile = 'top_white.webp';
            break;
        case 'borderBase':
            color = icingDesign.colors?.borderBase;
            prefix = 'baseborder';
            defaultFile = 'baseborder_white.webp';
            break;
        case 'gumpasteBaseBoard':
            color = icingDesign.colors?.gumpasteBaseBoardColor;
            prefix = 'baseboard';
            defaultFile = 'baseboardwhite.webp';
            break;
    }

    if (!color) return baseUrl + defaultFile;

    const matchedColor = findClosestColor(color);
    const separator = (prefix === 'baseboard') ? '' : '_';
    return `${baseUrl}${prefix}${separator}${matchedColor}.webp`;
};

// Simple toggle switch component for icing features
const SimpleToggle: React.FC<{ label: string; isEnabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean; }> = ({ label, isEnabled, onChange, disabled = false }) => (
    <div className={`flex justify-between items-center p-1 ${disabled ? 'opacity-50' : ''}`}>
        <label className="text-xs font-medium text-slate-700">{label}</label>
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onChange(!isEnabled);
            }}
            disabled={disabled}
            className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-slate-400'}`}
            aria-pressed={isEnabled}
        >
            <span className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform shadow-sm ${isEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
    </div>
);

const IcingToolbar: React.FC<{ onSelectItem: (item: AnalysisItem) => void; icingDesign: IcingDesignUI | null; cakeType: CakeType | null; isVisible: boolean; showGuide: boolean; selectedItem: ClusteredMarker | null; mainToppers: MainTopperUI[] }> = ({ onSelectItem, icingDesign, cakeType, isVisible, showGuide, selectedItem, mainToppers }) => {
    const [activeGuideIndex, setActiveGuideIndex] = useState<number>(-1);
    const isBento = cakeType === 'Bento';
    const hasEdiblePhotoOnTop = mainToppers.some(t => t.isEnabled && t.type === 'edible_photo_top');

    // Use default values if analysis hasn't completed yet
    const defaultIcingDesign: IcingDesignUI = {
        base: 'soft_icing',
        color_type: 'single',
        drip: false,
        border_top: false,
        border_base: false,
        colors: { top: '#FFFFFF', side: '#FFFFFF' },
        gumpasteBaseBoard: false,
        dripPrice: 0,
        gumpasteBaseBoardPrice: 0
    };
    const effectiveIcingDesign = icingDesign || defaultIcingDesign;
    const effectiveCakeType: CakeType = cakeType || '1 Tier';



    // Type guard to check if effectiveIcingDesign has IcingColorDetails properties
    const hasIcingColorDetails = (design: any): design is IcingDesignUI => {
        return design && typeof design === 'object' && 'colors' in design;
    };

    const getColorForTool = (toolId: string): string | undefined => {
        if (!hasIcingColorDetails(effectiveIcingDesign)) return undefined;

        switch (toolId) {
            case 'drip': return effectiveIcingDesign.colors?.drip;
            case 'borderTop': return effectiveIcingDesign.colors?.borderTop;
            case 'borderBase': return effectiveIcingDesign.colors?.borderBase;
            case 'top': return effectiveIcingDesign.colors?.top;
            case 'side': return effectiveIcingDesign.colors?.side;
            case 'gumpasteBaseBoard': return effectiveIcingDesign.colors?.gumpasteBaseBoardColor;
            default: return undefined;
        }
    };

    // Check if top and side icing colors are the same
    const topColor = effectiveIcingDesign.colors?.top;
    const sideColor = effectiveIcingDesign.colors?.side;
    const icingColorsSame = topColor && sideColor && topColor.toUpperCase() === sideColor.toUpperCase();

    const tools = (icingColorsSame ? [
        { id: 'drip', description: 'Drip', label: 'Drip', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'drip')} alt="Drip effect" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.drip },
        { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'borderTop')} alt="Top border" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.border_top },
        { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'borderBase')} alt="Base border" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
        { id: 'icing', description: 'Body Icing', label: 'Body Icing', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'top', false)} alt="Icing color" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: !!(effectiveIcingDesign.colors?.top || effectiveIcingDesign.colors?.side) },
        { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'gumpasteBaseBoard')} alt="Gumpaste baseboard" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
    ] : [
        { id: 'drip', description: 'Drip', label: 'Drip', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'drip')} alt="Drip effect" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.drip },
        { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'borderTop')} alt="Top border" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.border_top },
        { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'borderBase')} alt="Base border" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
        { id: 'top', description: 'Top Icing', label: 'Top Icing', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'top', true)} alt="Top icing" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: !!effectiveIcingDesign.colors?.top },
        { id: 'side', description: 'Side Icing', label: 'Body Icing', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'side', false)} alt="Side icing" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: !!effectiveIcingDesign.colors?.side },
        { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <LazyImage src={getIcingImage(effectiveIcingDesign as IcingDesignUI, 'gumpasteBaseBoard')} alt="Gumpaste baseboard" width={48} height={48} imageClassName="w-full h-full object-contain" unoptimized />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
    ]).filter(tool => {
        // Hide Top Icing tool when there's an edible photo on top (top will be covered)
        if (tool.id === 'top' && hasEdiblePhotoOnTop) {
            return false;
        }
        return true;
    });

    useEffect(() => {
        if (!showGuide) return;

        let currentIndex = 0;
        const animateGuide = () => {
            if (currentIndex < tools.length) {
                setActiveGuideIndex(currentIndex);
                currentIndex++;
                setTimeout(animateGuide, 400); // Show each tool for 400ms
            } else {
                setActiveGuideIndex(-1); // Reset after animation completes
            }
        };

        // Start animation after a brief delay
        const startTimeout = setTimeout(animateGuide, 300);

        return () => {
            clearTimeout(startTimeout);
        };
    }, [showGuide, tools.length]);

    return (
        <div className={`flex flex-row flex-wrap gap-3 justify-center transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {tools.map((tool, index) => {
                const isGuideActive = activeGuideIndex === index;
                const isSelected = selectedItem && 'id' in selectedItem && selectedItem.id === `icing-edit-${tool.id}`;

                // Dynamic sizing based on number of tools and screen width
                // 6 tools: smaller at 465px breakpoint
                // 5 tools: smaller at 400px breakpoint
                const buttonSizeClasses = tools.length === 6
                    ? 'w-12 h-12 max-[465px]:w-10 max-[465px]:h-10'
                    : tools.length === 5
                        ? 'w-12 h-12 max-[400px]:w-10 max-[400px]:h-10'
                        : 'w-12 h-12';

                return (
                    <div key={tool.id} className="flex flex-col items-center gap-1 group">
                        <button
                            onClick={() => {
                                if (tool.disabled) return;
                                // Toggle selection: if already selected, deselect; otherwise select
                                if (isSelected) {
                                    onSelectItem(null as any);
                                } else {
                                    onSelectItem({ id: `icing-edit-${tool.id}`, itemCategory: 'icing', description: tool.description, cakeType: effectiveCakeType });
                                }
                            }}
                            className={`relative ${buttonSizeClasses} p-2 rounded-full hover:bg-purple-100 transition-all ${isSelected ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-white/80'} backdrop-blur-md ${tool.featureFlag ? 'border-2 border-purple-600' : 'border border-slate-200'} shadow-md ${tool.featureFlag ? '' : 'opacity-60'} ${isGuideActive ? 'ring-4 ring-pink-500 ring-offset-2 scale-110 shadow-xl' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
                            disabled={tool.disabled}
                        >
                            {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-full h-full object-contain' })}
                            {tool.disabled && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                                    <X className="w-6 h-6 text-white" />
                                </div>
                            )}
                        </button>
                        <span className={`text-[10px] font-medium transition-colors whitespace-nowrap ${isSelected ? 'text-purple-600' : 'text-slate-600 group-hover:text-purple-600'} ${tool.disabled ? 'opacity-40' : ''}`}>
                            {tool.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const MotifPanel: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    dominantMotif: { hex: string; name: string };
    onColorChange: (newHex: string) => void;
}> = ({ isOpen, onClose, dominantMotif, onColorChange }) => {
    if (!isOpen) return null;

    return (
        <div className={`fixed bottom-28 right-4 w-80 max-w-[90vw] bg-white/90 backdrop-blur-lg shadow-2xl border border-slate-200 z-50 flex flex-col transform rounded-xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'}`}>
            <div className="p-4 flex justify-between items-center border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800">Change Motif Color</h3>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
                    <X className="w-4 h-4 text-slate-500" />
                </button>
            </div>
            <div className="p-4 space-y-4">
                <p className="text-sm text-slate-600">
                    Change all <span className="font-bold" style={{ color: dominantMotif.hex, textShadow: '0 0 5px rgba(0,0,0,0.2)' }}>{dominantMotif.name}</span> items to a new color.
                </p>
                <ColorPalette
                    selectedColor={dominantMotif.hex} // This is just for initial highlight, it won't change
                    onColorChange={(newHex) => {
                        onColorChange(newHex);
                        onClose();
                    }}
                />
            </div>
        </div>
    );
};


// Props interface for optional product context (used by SEO-friendly routes)
interface RecentSearchDesignProp {
    p_hash: string;
    original_image_url: string | null;
    price: number | null;
    keywords: string | null;
    analysis_json: any;
    slug: string | null;
    alt_text: string | null;
    seo_title: string | null;
    seo_description: string | null;
    created_at: string;
}

interface CustomizingClientProps {
    product?: CakeGenieMerchantProduct;
    merchant?: CakeGenieMerchant;
    recentSearchDesign?: RecentSearchDesignProp;
    productDetails?: React.ReactNode;
    initialPrices?: BasePriceInfo[];
    relatedDesigns?: Array<{
        slug: string;
        original_image_url: string;
        keywords: string | null;
        alt_text: string | null;
        price: number | null;
    }>;
    currentKeywords?: string | null;
    currentSlug?: string | null;
}

const CustomizingClient: React.FC<CustomizingClientProps> = ({ product, merchant, recentSearchDesign, productDetails, initialPrices, relatedDesigns, currentKeywords, currentSlug }) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    // --- Context Hooks ---
    const { user, isAuthenticated, signOut } = useAuth();
    const { itemCount: supabaseItemCount, addToCartOptimistic, addToCartWithBackgroundUpload, removeItemOptimistic, authError, isLoading: isCartLoading } = useCart();
    const { settings: availabilitySettings, loading: isLoadingAvailabilitySettings } = useAvailabilitySettings();
    const { toggleSaveDesign, isDesignSaved } = useSavedItemsActions();
    const { savedDesignHashes } = useSavedItemsData();

    const {
        cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions,
        analysisResult, analysisId, isAnalyzing, analysisError, isCustomizationDirty, dirtyFields,
        setIsAnalyzing, setAnalysisError, setPendingAnalysisData, setIsCustomizationDirty,
        handleCakeInfoChange,
        updateMainTopper, removeMainTopper, onMainTopperChange,
        updateSupportElement, removeSupportElement, onSupportElementChange,
        updateCakeMessage, removeCakeMessage,
        onIcingDesignChange, onAdditionalInstructionsChange, handleTopperImageReplace,
        handleSupportElementImageReplace, clearCustomization, initializeDefaultState,
        availability: baseAvailability,
        onCakeMessageChange,
        syncAnalysisResultWithCurrentState,
    } = useCakeCustomization();

    const {
        originalImageData, sourceImageData, previousImageData, originalImagePreview, editedImage, threeTierReferenceImage,
        isLoading: isImageManagementLoading, error: imageManagementError,
        setEditedImage, setError: setImageManagementError, setOriginalImageData, setPreviousImageData,
        handleImageUpload: hookImageUpload, handleSave, uploadCartImages, clearImages,
        loadImageWithoutAnalysis, setCurrentSlug, currentSlug: persistedSlug,
    } = useImageManagement();

    // --- Local State ---
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const [pendingCartItems, setPendingCartItems] = useState<CartItem[]>([]);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [reportStatus, setReportStatus] = useState<'success' | 'error' | null>(null);
    const [isPreparingSharedDesign, setIsPreparingSharedDesign] = useState(false);
    const [previousAnalysisSnapshot, setPreviousAnalysisSnapshot] = useState<HybridAnalysisResult | null>(null);
    const [searchInput, setSearchInput] = useState('');

    // Related Designs Pagination State
    const [displayedRelatedDesigns, setDisplayedRelatedDesigns] = useState(relatedDesigns || []);
    const [isLoadingMoreDesigns, setIsLoadingMoreDesigns] = useState(false);
    const [hasMoreDesigns, setHasMoreDesigns] = useState(true);

    // --- Refs ---
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const mainImageContainerRef = useRef<HTMLDivElement>(null);
    const isLoadingDesignRef = useRef(false); // Guard against duplicate analysis calls

    // --- Hooks ---
    const { addOnPricing, itemPrices, basePriceOptions: hookBasePriceOptions, isFetchingBasePrice, basePriceError, basePrice, finalPrice } = usePricing({
        analysisResult, mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo, onCakeInfoCorrection: handleCakeInfoChange, analysisId, merchantId: merchant?.merchant_id
    });

    // Use initialPrices for SSR if hook data isn't ready yet
    const basePriceOptions = useMemo(() => {
        if (hookBasePriceOptions && hookBasePriceOptions.length > 0) return hookBasePriceOptions;
        return initialPrices || [];
    }, [hookBasePriceOptions, initialPrices]);

    const {
        isLoading: isUpdatingDesign, error: designUpdateError, lastGenerationInfoRef, handleUpdateDesign, setError: setDesignUpdateError, isSafetyFallback
    } = useDesignUpdate({
        originalImageData, analysisResult, cakeInfo, mainToppers, supportElements, cakeMessages,
        icingDesign, additionalInstructions, threeTierReferenceImage,
        onSuccess: (editedImageResult: string) => {
            setEditedImage(editedImageResult);
            setActiveTab('customized');
            if (originalImageData) setPreviousImageData(originalImageData);
            if (analysisResult) setPreviousAnalysisSnapshot(analysisResult);
            syncAnalysisResultWithCurrentState();

            const mimeMatch = editedImageResult.match(/^data:([^;]+);base64,(.+)$/);
            if (mimeMatch) {
                setOriginalImageData({
                    data: mimeMatch[2],
                    mimeType: mimeMatch[1]
                });
            }
        },
    });

    const HEX_TO_COLOR_NAME_MAP_SHARING = useMemo(() => {
        return COLORS.reduce((acc, color) => {
            acc[color.hex.toLowerCase()] = color.name;
            return acc;
        }, {} as Record<string, string>);
    }, []);

    const { isShareModalOpen, shareData, isSavingDesign, handleShare, createShareLink, closeShareModal } = useDesignSharing({
        editedImage, originalImagePreview, cakeInfo, basePrice, finalPrice, mainToppers,
        supportElements, icingDesign, analysisResult, HEX_TO_COLOR_NAME_MAP: HEX_TO_COLOR_NAME_MAP_SHARING,
        cakeMessages, additionalInstructions
    });

    // --- Derived State ---
    const isLoading = useMemo(() => isImageManagementLoading || isUpdatingDesign, [isImageManagementLoading, isUpdatingDesign]);
    const itemCount = useMemo(() => supabaseItemCount + pendingCartItems.length, [supabaseItemCount, pendingCartItems]);

    const calculatedAvailability = useMemo(() => {
        if (!availabilitySettings || !baseAvailability) return baseAvailability;
        if (availabilitySettings.rush_same_to_standard_enabled) {
            if (baseAvailability === 'rush' || baseAvailability === 'same-day') return 'normal';
        }
        if (availabilitySettings.rush_to_same_day_enabled) {
            if (baseAvailability === 'rush') return 'same-day';
        }
        return baseAvailability;
    }, [baseAvailability, availabilitySettings]);
    const availabilityWasOverridden = calculatedAvailability !== baseAvailability;
    const availabilityType = calculatedAvailability;

    // --- Handlers ---

    // Load more related designs with pagination
    const handleLoadMoreDesigns = async () => {
        if (isLoadingMoreDesigns || !hasMoreDesigns) return;

        setIsLoadingMoreDesigns(true);
        try {
            const effectiveKeywords = currentKeywords || recentSearchDesign?.keywords || null;
            const effectiveSlug = currentSlug || recentSearchDesign?.slug || null;
            const { data } = await getRelatedProductsByKeywords(
                effectiveKeywords,
                effectiveSlug,
                6,
                displayedRelatedDesigns.length
            );

            if (data && data.length > 0) {
                setDisplayedRelatedDesigns(prev => [...prev, ...data]);
                // If we got fewer than 6, there are no more
                if (data.length < 6) {
                    setHasMoreDesigns(false);
                }
            } else {
                setHasMoreDesigns(false);
            }
        } catch (error) {
            console.error('Error loading more designs:', error);
        } finally {
            setIsLoadingMoreDesigns(false);
        }
    };

    // Auto-load related designs when analysis is complete
    useEffect(() => {
        // Only run if we have analysis result with keywords
        if (!analysisResult || !analysisResult.keyword) return;

        const targetKeyword = analysisResult.keyword;

        // Don't auto-load if we already have items (prevent dupes or overriding props)
        if (displayedRelatedDesigns.length > 0) return;

        // Don't auto-load if we're currently loading
        if (isLoadingMoreDesigns) return;

        console.log('🤖 Analysis complete, fetching related designs for:', targetKeyword);

        const fetchRelated = async () => {
            setIsLoadingMoreDesigns(true);
            try {
                // Use the analysis keyword for the first batch
                const { data } = await getRelatedProductsByKeywords(
                    targetKeyword,
                    currentSlug || null,
                    6,
                    0
                );

                if (data && data.length > 0) {
                    setDisplayedRelatedDesigns(data);
                    if (data.length < 6) setHasMoreDesigns(false);
                } else {
                    setHasMoreDesigns(false);
                }
            } catch (error) {
                console.error('Error auto-loading related designs:', error);
            } finally {
                setIsLoadingMoreDesigns(false);
            }
        };

        fetchRelated();
    }, [analysisResult, currentSlug, displayedRelatedDesigns.length]);

    // --- Effects ---

    // Hide SSR content once client hydrates - enables progressive enhancement


    // Handle product prop loading (from SEO-friendly routes like /shop/[merchant]/[product]/customize)
    // AND recent search designs (from /customizing/[slug])
    useEffect(() => {
        // Unify the data source (Product Page vs Customizing Page)
        const targetSlug = product?.slug || recentSearchDesign?.slug || recentSearchDesign?.p_hash;
        const targetImageUrl = product?.image_url || recentSearchDesign?.original_image_url;
        const targetPHash = product?.p_hash || recentSearchDesign?.p_hash;
        const targetTitle = product?.title || recentSearchDesign?.seo_title || 'Design';

        // If no image URL to load, skip
        if (!targetImageUrl) {
            return;
        }

        // CRITICAL: Set the current slug FIRST - this will automatically clear stale images
        // if the slug changed from a previously persisted session
        setCurrentSlug(targetSlug || null);

        // Check if we need to load this content:
        // 1. If it's a different item than what we tracked locally (slug/hash mismatch)
        // 2. OR if we haven't tracked any item yet AND we don't have image data (initial load)
        // Use currentSlug from context (persisted) for comparison, not just the local ref
        const isNewItem = targetSlug !== persistedSlug;
        const hasLoadedImage = !!originalImageData;

        if (!isNewItem && hasLoadedImage) {
            return;
        }

        if (isLoadingDesignRef.current) {
            return;
        }

        isLoadingDesignRef.current = true;
        console.log(`🏪 Loading item from props: ${targetTitle}`);

        // Clear any existing stale data
        // 1. Reset Image Context (always needed as it persists across products if provider is higher up)
        clearImages();

        // 2. Check for SSR Data
        // Since CustomizationProvider is keyed by product ID/slug in the parent page, if analysisResult exists here,
        // it means it was initialized from SSR for THIS item.
        const hasSSRData = !!(analysisResult && targetPHash);

        if (!hasSSRData) {
            clearCustomization();
            setIsAnalyzing(true);
        } else {
            console.log("⚡ Reusing SSR Analysis Data");
        }

        if (targetPHash) {
            console.log("⚡ Fast Path: Using stored p_hash:", targetPHash);

            // Start image fetch in parallel with analysis fetch
            const imageFetchPromise = (async () => {
                let blob: Blob | null = null;
                try {
                    const response = await fetch(targetImageUrl);
                    if (response.ok) blob = await response.blob();
                } catch { /* ignore direct fetch error */ }

                if (!blob) {
                    // Use the correct proxy endpoint which handles Pinterest domains
                    const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(targetImageUrl)}`);
                    if (proxyResponse.ok) blob = await proxyResponse.blob();
                }
                if (!blob) throw new Error("Failed to fetch image");
                return new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' });
            })();

            // Reuse SSR result if available, otherwise fetch from DB
            const analysisFetchPromise = hasSSRData
                ? Promise.resolve(analysisResult!)
                : getAnalysisByExactHash(targetPHash);

            Promise.all([imageFetchPromise, analysisFetchPromise])
                .then(([file, analysisData]) => {
                    // Load the image into context
                    hookImageUpload(
                        file,
                        (result) => {
                            if (analysisData) {
                                console.log("✅ Image loaded (Analysis synced)");

                                // Only trigger 'setPendingAnalysisData' if we didn't start with SSR data.
                                // If hasSSRData is true, the context is already populated via initialData.
                                if (!hasSSRData) {
                                    setPendingAnalysisData(analysisData);
                                    showSuccess("Design loaded!");
                                }

                                setIsAnalyzing(false);
                                isLoadingDesignRef.current = false;
                            } else {
                                // Fallback: If DB lookup failed (shouldn't happen with valid FK), run analysis
                                console.warn("⚠️ Hash lookup returned null, falling back to full analysis");
                            }
                        },
                        (error) => {
                            console.error("Error processing product image:", error);
                            if (error instanceof Error && error.message.startsWith('AI_REJECTION:')) {
                                setAnalysisError(error.message);
                                showError(error.message.replace('AI_REJECTION: ', ''));
                            } else {
                                setAnalysisError("Failed to load product");
                                showError("Failed to load product");
                            }
                            setIsAnalyzing(false);
                            isLoadingDesignRef.current = false;
                        },
                        // Pass analysisData as precomputed if available to skip AI
                        analysisData ? { imageUrl: targetImageUrl, precomputedAnalysis: analysisData } : { imageUrl: targetImageUrl }
                    );
                })
                .catch(err => {
                    console.error("Fast path failed:", err);
                    // Fallback to old full flow if fast path crashes
                    isLoadingDesignRef.current = false; // Reset lock to allow retry or old flow
                    setIsAnalyzing(false);
                });

            return;
        }

        // OLD FLOW (Fallback): Load image and calculate hash client-side
        console.log("🐢 Slow Path: No p_hash, calculating client-side...");
        const fetchProductImage = async () => {
            try {
                let blob: Blob | null = null;

                // Try direct fetch first
                try {
                    const response = await fetch(targetImageUrl);
                    if (response.ok) {
                        blob = await response.blob();
                    }
                } catch {
                    console.log("Direct fetch failed, trying proxy...");
                }

                if (!blob) {
                    // Fallback to storage proxy
                    const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(targetImageUrl)}`);
                    if (proxyResponse.ok) {
                        blob = await proxyResponse.blob();
                    }
                }

                if (!blob) {
                    throw new Error('Failed to fetch product image');
                }

                const file = new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' });

                hookImageUpload(
                    file,
                    (result) => {
                        console.log("✅ Product loaded from props");
                        setPendingAnalysisData(result);
                        setIsAnalyzing(false);
                        showSuccess("Design loaded!");
                        isLoadingDesignRef.current = false;
                    },
                    (error) => {
                        console.error("Error processing product:", error);
                        if (error instanceof Error && error.message.startsWith('AI_REJECTION:')) {
                            setAnalysisError(error.message);
                            showError(error.message.replace('AI_REJECTION: ', ''));
                        } else {
                            setAnalysisError("Failed to load product");
                            showError("Failed to load product");
                        }
                        setIsAnalyzing(false);
                        isLoadingDesignRef.current = false;
                    },
                    { imageUrl: targetImageUrl! }
                );

            } catch (err) {
                console.error("Failed to load product:", err);
                showError("Failed to load product.");
                setIsAnalyzing(false);
                isLoadingDesignRef.current = false;
            }
        };

        fetchProductImage();
    }, [product, recentSearchDesign, originalImageData, isImageManagementLoading, hookImageUpload, setIsAnalyzing, clearImages, clearCustomization, analysisResult, analysisId, persistedSlug, setCurrentSlug, setPendingAnalysisData]);

    // Handle "Customize This Design" flow (loading from URL ref) - Shopify/external integrations
    useEffect(() => {
        const refUrl = searchParams.get('ref');
        const fromSaved = searchParams.get('fromSaved') === 'true';
        const fromMerchant = searchParams.get('fromMerchant') === 'true';

        // Guard against duplicate calls (e.g., from React strict mode or URL changes)

        if (isLoadingDesignRef.current) {
            console.log("⏸️ Design load already in progress, skipping duplicate call");
            return;
        }

        // If fromSaved or fromMerchant is true, we proceed even if originalImageData exists (to override stale persistence)
        if (refUrl && (!originalImageData || fromSaved || fromMerchant) && !isImageManagementLoading) {

            const decodedUrl = decodeURIComponent(refUrl);
            const pathname = window.location.pathname;


            // If coming from Saved page, try to restore state from localStorage without re-analysis
            if (fromSaved) {
                // Set loading guard FIRST before any side effects
                isLoadingDesignRef.current = true;

                console.log("🔄 Loading saved design, overriding any existing state...");


                // Clear any existing stale image/customization data first
                clearImages();

                clearCustomization();

                // Remove fromSaved param to prevent infinite loop (since we just cleared images)
                // We use replace to update URL without adding to history
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.delete('fromSaved');
                router.replace(`${pathname}?${newParams.toString()}`);

                try {
                    const savedData = localStorage.getItem('cakegenie_restore_saved');
                    if (savedData) {
                        const parsed = JSON.parse(savedData);
                        // Validate. Ideally we check URL match, but if user clicked "saved", 
                        // they want THAT saved item. The localStorage should have just been set by SavedClient.
                        // We trust it if it's recent.
                        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
                            if (parsed.imageUrl !== decodedUrl) {
                                console.warn("⚠️ Saved data URL mismatch, but proceeding with saved data intent.");
                            }

                            console.log("✅ Loading saved design with full analysis...");

                            // Show loading state
                            setIsAnalyzing(true);
                            showInfo("Loading your saved design...");

                            // Fetch the image and trigger full analysis (same as non-saved path)
                            const fetchSavedDesign = async () => {
                                try {
                                    // Try direct fetch first
                                    let blob: Blob | null = null;
                                    try {
                                        const response = await fetch(parsed.imageUrl);
                                        if (response.ok) {
                                            blob = await response.blob();
                                        }
                                    } catch {
                                        // Fall back to proxy
                                        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(parsed.imageUrl)}`;
                                        const response = await fetch(proxyUrl);
                                        if (response.ok) {
                                            blob = await response.blob();
                                        }
                                    }

                                    if (!blob) throw new Error("Failed to load image");

                                    const file = new File([blob], 'saved-design.webp', { type: blob.type || 'image/webp' });

                                    // Check if we have precomputed analysis from cache
                                    const hasPrecomputedAnalysis = parsed.cachedAnalysis != null;
                                    if (hasPrecomputedAnalysis) {
                                        console.log("🚀 Using precomputed analysis from cache - skipping AI call!");
                                    }

                                    // Use hookImageUpload with precomputedAnalysis if available
                                    await hookImageUpload(
                                        file,
                                        (result) => {
                                            console.log("✅ Design loaded for saved item");
                                            setPendingAnalysisData(result);
                                            setIsAnalyzing(false);
                                            // Keep guard TRUE - don't reset, to prevent normal path from running
                                            showSuccess("Design loaded!");
                                        },

                                        (err) => {
                                            console.error("Analysis failed:", err);
                                            if (err instanceof Error) {
                                                if (err.message.startsWith('AI_REJECTION:')) {
                                                    const message = err.message;
                                                    setAnalysisError(message);
                                                    showError(message.replace('AI_REJECTION: ', ''));
                                                    // Optional: Redirect or reset state if needed
                                                } else {
                                                    showError('Failed to analyze image. Please try again.');
                                                }
                                            } else {
                                                showError('Failed to analyze image. Please try again.');
                                            }
                                            console.error("Analysis error:", err);
                                            setIsAnalyzing(false);
                                            isLoadingDesignRef.current = false; // Reset guard
                                        },
                                        {
                                            imageUrl: parsed.imageUrl,
                                            precomputedAnalysis: parsed.cachedAnalysis || undefined
                                        }
                                    );

                                } catch (err) {
                                    console.error("Failed to load saved design:", err);
                                    showError("Failed to load saved design.");
                                    setIsAnalyzing(false);
                                    isLoadingDesignRef.current = false; // Reset guard
                                }
                            };


                            fetchSavedDesign();

                            // Clean up localStorage
                            localStorage.removeItem('cakegenie_restore_saved');

                            return; // Skip normal flow
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse saved design data:', e);
                    isLoadingDesignRef.current = false; // Reset guard on error
                }
                // Whether localStorage succeeded or failed, we should NOT fall through
                // to the normal loading path when fromSaved is true.
                // Clean up and return - the user can try again if it failed.
                localStorage.removeItem('cakegenie_restore_saved');
                return; // Always return for fromSaved to prevent duplicate loads
            }

            // Handle merchant product clicks
            if (fromMerchant) {
                // Set loading guard FIRST before any side effects
                isLoadingDesignRef.current = true;

                console.log("🏪 Loading merchant product...");

                // Clear any existing stale image/customization data first
                clearImages();
                clearCustomization();

                // Remove fromMerchant param to prevent infinite loop
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.delete('fromMerchant');
                router.replace(`${pathname}?${newParams.toString()}`);

                try {
                    const merchantData = localStorage.getItem('cakegenie_merchant_product');
                    if (merchantData) {
                        const parsed = JSON.parse(merchantData);
                        // Validate timestamp (5 minutes)
                        if (Date.now() - parsed.timestamp < 5 * 60 * 1000 && parsed.imageUrl) {
                            console.log("✅ Loading merchant product:", parsed.productName);

                            // Show loading state
                            setIsAnalyzing(true);
                            showInfo(`Loading ${parsed.productName || 'product'}...`);

                            // Fetch the image and trigger analysis
                            const fetchMerchantProduct = async () => {
                                try {
                                    let blob: Blob | null = null;
                                    try {
                                        const response = await fetch(parsed.imageUrl);
                                        if (response.ok) {
                                            blob = await response.blob();
                                        }
                                    } catch {
                                        console.log("Direct fetch failed, trying proxy...");
                                    }

                                    if (!blob) {
                                        // Fallback to storage proxy
                                        const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(parsed.imageUrl)}`);
                                        if (proxyResponse.ok) {
                                            blob = await proxyResponse.blob();
                                        }
                                    }

                                    if (!blob) {
                                        throw new Error('Failed to fetch product image');
                                    }

                                    const file = new File([blob], 'merchant-product.jpg', { type: blob.type || 'image/jpeg' });

                                    // Use hookImageUpload to trigger full analysis
                                    // If the product has a p_hash, we could fetch cached analysis, but for now let's do full analysis
                                    hookImageUpload(
                                        file,
                                        () => {
                                            console.log("✅ Merchant product loaded");
                                            setIsAnalyzing(false);
                                            showSuccess("Product loaded!");
                                            // Guard stays true to prevent normal path from running
                                        },

                                        (error) => {
                                            console.error("Error processing merchant product:", error);
                                            if (error instanceof Error && error.message.startsWith('AI_REJECTION:')) {
                                                setAnalysisError(error.message);
                                                showError(error.message.replace('AI_REJECTION: ', ''));
                                            } else {
                                                setAnalysisError("Failed to load product");
                                                showError("Failed to load product");
                                            }
                                            setIsAnalyzing(false);
                                            isLoadingDesignRef.current = false;
                                        },
                                        { imageUrl: parsed.imageUrl }
                                    );

                                } catch (err) {
                                    console.error("Failed to load merchant product:", err);
                                    showError("Failed to load product.");
                                    setIsAnalyzing(false);
                                    isLoadingDesignRef.current = false;
                                }
                            };

                            fetchMerchantProduct();
                            localStorage.removeItem('cakegenie_merchant_product');
                            return; // Skip normal flow
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse merchant product data:', e);
                    isLoadingDesignRef.current = false;
                }

                localStorage.removeItem('cakegenie_merchant_product');
                return; // Always return for fromMerchant to prevent duplicate loads
            }




            // Check if we already have a completed analysis for this exact image

            const savedAnalysis = localStorage.getItem('cakegenie_analysis');
            if (savedAnalysis) {
                try {
                    const parsed = JSON.parse(savedAnalysis);
                    // If we have a saved analysis for the same image ref, skip re-analysis
                    if (parsed.imageRef === decodedUrl && parsed.result && analysisResult) {
                        console.log("✅ Restoring completed analysis from previous session for:", decodedUrl);
                        showInfo("Welcome back! Your analysis is ready.");
                        return; // Skip fetching and re-analyzing - analysis already loaded from context persistence
                    }
                } catch (e) {
                    console.error('Failed to parse saved analysis:', e);
                }
            }

            console.log("Loading referenced design:", decodedUrl);

            // Show loading state immediately
            setIsAnalyzing(true);
            showInfo("Loading your cake design...");

            // Save the image ref we're about to analyze (so we can restore on return)
            const existingData = localStorage.getItem('cakegenie_analysis');
            try {
                const data = existingData ? JSON.parse(existingData) : {};
                data.imageRef = decodedUrl;
                localStorage.setItem('cakegenie_analysis', JSON.stringify(data));
            } catch (e) {
                // Create new entry if parsing fails
                localStorage.setItem('cakegenie_analysis', JSON.stringify({ imageRef: decodedUrl }));
            }

            // Helper for timeout
            const fetchWithTimeout = async (url: string, timeout = 10000) => {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeout);
                try {
                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(id);
                    return response;
                } catch (error) {
                    clearTimeout(id);
                    throw error;
                }
            };

            // Fetch and analyze the image
            const fetchAndAnalyze = async () => {
                try {
                    let blob: Blob | null = null;

                    // 1. Try Direct Fetch (Fastest & Best for CDN/Supabase)
                    // Many modern CDNs (Shopify, Supabase, Cloudinary) support CORS
                    try {
                        console.log("Attempting direct fetch...");
                        const response = await fetchWithTimeout(decodedUrl, 8000); // 8s timeout for direct
                        if (response.ok) {
                            blob = await response.blob();
                            console.log("Direct fetch succeeded");
                        } else {
                            console.warn(`Direct fetch failed with status: ${response.status}`);
                        }
                    } catch (err) {
                        console.warn("Direct fetch failed, will try proxy:", err);
                    }

                    // 2. Fallback to Proxy if Direct failed
                    if (!blob) {
                        console.log("Attempting proxy fetch...");
                        // Using corsproxy.io as fallback
                        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(decodedUrl)}`;
                        try {
                            const response = await fetchWithTimeout(proxyUrl, 15000); // 15s timeout for proxy
                            if (response.ok) {
                                blob = await response.blob();
                                console.log("Proxy fetch succeeded");
                            } else {
                                throw new Error(`Proxy fetch failed with status: ${response.status}`);
                            }
                        } catch (proxyErr) {
                            console.error("Proxy fetch failed:", proxyErr);
                            throw proxyErr; // Throw if both failed
                        }
                    }

                    if (!blob) throw new Error("Failed to load image from both sources.");

                    // Verify it is an image (skip strict check if type is empty due to proxy)
                    if (blob.type && !blob.type.startsWith('image/') && !blob.type.startsWith('application/octet-stream')) {
                        console.warn(`Fetched content might not be an image: ${blob.type}`);
                        // We continue anyway and let magic byte detection handle it
                    }

                    // helper to detect mime type from magic numbers
                    const detectMimeType = async (blob: Blob): Promise<string> => {
                        try {
                            const arr = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
                            // JPEG: FF D8
                            if (arr[0] === 0xFF && arr[1] === 0xD8) return 'image/jpeg';
                            // PNG: 89 50 4E 47
                            if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) return 'image/png';
                            // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP) at offset 8
                            if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46) return 'image/webp';
                            // GIF: 47 49 46 38
                            if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) return 'image/gif';

                            return blob.type || 'image/jpeg'; // fallback
                        } catch (e) {
                            return blob.type || 'image/jpeg';
                        }
                    };

                    const mimeType = await detectMimeType(blob);
                    console.log(`Detected MIME type: ${mimeType} (original: ${blob.type})`);

                    // Determine extension based on mime type
                    let extension = 'jpg';
                    if (mimeType === 'image/png') extension = 'png';
                    if (mimeType === 'image/webp') extension = 'webp';
                    if (mimeType === 'image/gif') extension = 'gif';

                    const file = new File([blob], `shared-design.${extension}`, { type: mimeType });

                    // Use hookImageUpload to trigger the full analysis flow
                    await hookImageUpload(
                        file,
                        (result) => {
                            console.log("Analysis complete for shared design");
                            // Update the customization context with the analysis result
                            setPendingAnalysisData(result);
                            setIsAnalyzing(false);
                        },
                        (err) => {
                            console.error("Analysis failed:", err);
                            if (err instanceof Error && err.message.startsWith('AI_REJECTION:')) {
                                setAnalysisError(err.message);
                                showError(err.message.replace('AI_REJECTION: ', ''));
                            } else {
                                showError("Failed to analyze the shared design.");
                            }
                            setIsAnalyzing(false);
                        },
                        { imageUrl: decodedUrl } // Pass original URL
                    );

                } catch (err) {
                    console.error("Failed to load referenced design:", err);
                    let msg = "Could not load the shared design.";
                    if (err instanceof Error && err.name === 'AbortError') {
                        msg = "Image loading timed out. Please try uploading directly.";
                    } else if (err instanceof Error) {
                        msg = `Could not load design: ${err.message}`;
                    }
                    showError(msg);
                    setIsAnalyzing(false);
                }
            };

            fetchAndAnalyze();
        }
    }, [searchParams, originalImageData, isImageManagementLoading, hookImageUpload, setIsAnalyzing, setPendingAnalysisData, analysisResult]);


    const onClose = () => {
        if (searchParams.get('from') === 'search') {
            router.back();
        } else if (sessionStorage.getItem('cakegenie_from_saved') === 'true') {
            // If came from saved page, go back to saved
            sessionStorage.removeItem('cakegenie_from_saved');
            router.push('/saved');
        } else {
            router.push('/');
        }
    };


    const onSignOut = () => signOut();
    const onOpenReportModal = () => setIsReportModalOpen(true);
    const onUpdateDesign = handleUpdateDesign;
    const onSave = handleSave;
    const isSaving = false;

    const onClearAll = () => {
        clearImages();
        clearCustomization();
        setActiveTab('original');
        router.push('/');
    };

    const onUndo = () => {
        if (previousImageData) {
            setOriginalImageData(previousImageData);
            setPreviousImageData(null);
        }
        if (previousAnalysisSnapshot) {
            setPendingAnalysisData(previousAnalysisSnapshot);
            setPreviousAnalysisSnapshot(null);
        }
        setEditedImage(null);
        setActiveTab('original');
    };

    const canUndo = !!previousImageData;
    const error = analysisError || imageManagementError || designUpdateError || basePriceError || authError || null;
    const isRejectionError = analysisError?.startsWith('AI_REJECTION:');
    const isSharing = isPreparingSharedDesign || isSavingDesign;

    const { warningMessage, warningDescription } = useMemo(() => {
        // Check for active toys/figurines (manual selection)
        const hasActiveToy = mainToppers.some(
            topper => topper.isEnabled && ['toy', 'figurine'].includes(topper.type)
        );

        if (hasActiveToy) {
            return {
                warningMessage: "Toy is subject for availability",
                warningDescription: "Please message our partner shop for the availability of the toy."
            };
        }

        // Check for auto-replaced toys (original was toy, now printout)
        const hasReplacedToy = mainToppers.some(
            topper => topper.isEnabled &&
                ['toy', 'figurine'].includes(topper.original_type) &&
                topper.type === 'printout'
        );

        if (hasReplacedToy) {
            return {
                warningMessage: "toy temporarily replaced with printout",
                warningDescription: "We changed the topper to printout for now due to availability."
            };
        }

        return { warningMessage: null, warningDescription: null };
    }, [mainToppers]);



    const buildCartItemDetails = useCallback((): CartItemDetails => {
        if (!cakeInfo || !icingDesign) throw new Error("Missing data for cart item.");
        const hexToName = (hex: string) => HEX_TO_COLOR_NAME_MAP_SHARING[hex.toLowerCase()] || hex;
        return {
            flavors: cakeInfo.flavors,
            mainToppers: mainToppers.filter((t: MainTopperUI) => t.isEnabled).map((t: MainTopperUI) => ({
                description: `${t.description} (${t.size})`,
                type: t.type,
                size: t.size,
            })),
            supportElements: supportElements.filter((s: SupportElementUI) => s.isEnabled).map((s: SupportElementUI) => ({
                description: `${s.description} (${s.size})`,
                type: s.type,
                size: s.size
            })),
            cakeMessages: cakeMessages.filter((m: CakeMessageUI) => m.isEnabled).map((m: CakeMessageUI) => ({ text: m.text, color: hexToName(m.color) })),
            icingDesign: {
                drip: icingDesign.drip, gumpasteBaseBoard: icingDesign.gumpasteBaseBoard,
                colors: Object.entries(icingDesign.colors).reduce((acc: Record<string, string>, [key, value]) => {
                    if (typeof value === 'string' && value) acc[key] = hexToName(value);
                    return acc;
                }, {} as Record<string, string>),
            },
            additionalInstructions: additionalInstructions.trim(),
        };
    }, [cakeInfo, icingDesign, mainToppers, supportElements, cakeMessages, additionalInstructions, HEX_TO_COLOR_NAME_MAP_SHARING]);

    const handleReport = useCallback(async (userFeedback: string) => {
        if (!editedImage || !lastGenerationInfoRef.current) {
            showError("Missing critical data for report.");
            return;
        }

        const originalToUpload = previousImageData || sourceImageData;
        if (!originalToUpload?.data) {
            showError("Missing original image for report.");
            return;
        }

        setIsReporting(true); setReportStatus(null);
        try {
            const { prompt, systemInstruction } = lastGenerationInfoRef.current;
            const fullPrompt = `--- SYSTEM PROMPT ---\n${systemInstruction}\n\n--- USER PROMPT ---\n${prompt}\n`;

            showInfo("Uploading images...");
            const [originalImageUrl, customizedImageUrl] = await Promise.all([
                uploadReportImage(originalToUpload.data, 'original'),
                uploadReportImage(editedImage, 'customized')
            ]);

            await reportCustomization({
                original_image: originalImageUrl,
                customized_image: customizedImageUrl,
                prompt_sent_gemini: fullPrompt.trim(),
                maintoppers: JSON.stringify(mainToppers.filter(t => t.isEnabled)),
                supportelements: JSON.stringify(supportElements.filter(s => s.isEnabled)),
                cakemessages: JSON.stringify(cakeMessages.filter(m => m.isEnabled)),
                icingdesign: JSON.stringify(icingDesign),
                addon_price: addOnPricing?.addOnPrice ?? 0,
                user_report: userFeedback.trim() || undefined,
            });
            setReportStatus('success'); showSuccess("Report submitted. Thank you!"); setIsReportModalOpen(false);
        } catch (err) {
            setReportStatus('error'); showError("Failed to submit report.");
        } finally {
            setIsReporting(false);
            setTimeout(() => setReportStatus(null), 5000);
        }
    }, [editedImage, previousImageData, sourceImageData, lastGenerationInfoRef, mainToppers, supportElements, cakeMessages, icingDesign, addOnPricing]);

    const onAddToCart = async () => {
        if (!finalPrice || !cakeInfo) return;
        setIsAddingToCart(true);
        try {
            // 1. Prepare Base64 placeholders for immediate optimistic display
            const optimisticOriginal = originalImagePreview || '';
            const optimisticCustomized = editedImage || '';

            // 2. Start Upload in Background (Do NOT await)
            const uploadPromise = uploadCartImages({
                editedImageDataUri: editedImage,
                userId: user?.id
            });

            const cartItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'> = {
                user_id: user?.id || null,
                session_id: user?.is_anonymous ? user.id : null,
                merchant_id: null, // Will be set when ordering from a specific merchant shop
                cake_type: cakeInfo.type,
                cake_thickness: cakeInfo.thickness,
                cake_size: cakeInfo.size,
                base_price: basePrice || 0,
                addon_price: (finalPrice || 0) - (basePrice || 0),
                final_price: finalPrice || 0,
                quantity: 1,
                original_image_url: optimisticOriginal, // Base64
                customized_image_url: optimisticCustomized, // Base64
                customization_details: {
                    flavors: cakeInfo.flavors,
                    mainToppers: mainToppers.filter(t => t.isEnabled).map(t => ({
                        description: t.description,
                        type: t.type,
                        size: t.size
                    })),
                    supportElements: supportElements.filter(e => e.isEnabled).map(e => ({
                        description: e.description,
                        type: e.type,
                        coverage: e.size
                    })),
                    cakeMessages: cakeMessages.filter(m => m.isEnabled).map(m => ({
                        text: m.text,
                        color: m.color
                    })),
                    icingDesign: {
                        drip: icingDesign?.drip || false,
                        gumpasteBaseBoard: icingDesign?.gumpasteBaseBoard || false,
                        colors: (icingDesign?.colors as unknown as Record<string, string>) || {}
                    },
                    additionalInstructions: additionalInstructions
                }
            };

            // 4. Update UI Optimistically & Hand off upload task
            // We await it only to catch immediate sync errors if we want, but checking 
            // implementation, it triggers background task. However, since the function allows passing promise,
            // we should NOT await the background task completion, but we CAN await the *invocation* which is fast.
            await addToCartWithBackgroundUpload(cartItem, uploadPromise);

            showSuccess('Added to cart!');
            router.push('/cart');
        } catch (err) {
            showError('Failed to add to cart: ' + (err instanceof Error ? err.message : 'Unknown error'));
            console.error(err);
        } finally {
            setIsAddingToCart(false);
        }
    };

    const onShare = () => {
        handleShare();
    };

    const onSearch = (query?: string) => {
        if (!query || !query.trim()) return;
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    };
    const setAppState = (state: any) => {
        if (state === 'landing') router.push('/');
        if (state === 'cart') router.push('/cart');
    };

    const onCakeInfoChange = handleCakeInfoChange;
    const onTopperImageReplace = handleTopperImageReplace;
    const onSupportElementImageReplace = handleSupportElementImageReplace;

    const availability = AVAILABILITY_MAP[availabilityType];
    // Temporary state backups for modals (to discard changes on cancel)
    const [tempCakeMessagesBackup, setTempCakeMessagesBackup] = useState<CakeMessageUI[] | null>(null);
    const [tempToppersBackup, setTempToppersBackup] = useState<{ mainToppers: MainTopperUI[], supportElements: SupportElementUI[] } | null>(null);
    const [tempEdiblePhotoBackup, setTempEdiblePhotoBackup] = useState<{ item: MainTopperUI | SupportElementUI, category: 'topper' | 'element' } | null>(null);
    const [areHelpersVisible, setAreHelpersVisible] = useState(true);
    const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);
    const [hoveredItem, setHoveredItem] = useState<ClusteredMarker | null>(null);
    const [selectedItem, setSelectedItem] = useState<ClusteredMarker | null>(null);
    const cakeBaseSectionRef = useRef<HTMLDivElement>(null);
    const cakeMessagesSectionRef = useRef<HTMLDivElement>(null);
    const markerContainerRef = useRef<HTMLDivElement>(null);
    const [containerDimensions, setContainerDimensions] = useState<{ width: number, height: number } | null>(null);
    const [isMotifPanelOpen, setIsMotifPanelOpen] = useState(false);
    const [dynamicLoadingMessage, setDynamicLoadingMessage] = useState<string>('');
    const [showIcingGuide, setShowIcingGuide] = useState(false);
    const [hasShownGuide, setHasShownGuide] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false); // Collapsible color picker state
    const [showMessagesPanel, setShowMessagesPanel] = useState(false); // Messages panel visibility
    const [wasUpdating, setWasUpdating] = useState(false);
    // --- UI State ---
    const [activeTab, setActiveTab] = useState<'original' | 'customized'>('customized');
    const [activeCustomization, setActiveCustomization] = useState<string | null>(null);





    // Calculate icing changes at the top level to avoid hook errors
    const hasIcingChanges = useMemo(() => {
        if (!analysisResult?.icing_design || !icingDesign) return false;
        return (
            JSON.stringify(icingDesign.colors) !== JSON.stringify(analysisResult.icing_design.colors) ||
            icingDesign.drip !== analysisResult.icing_design.drip ||
            icingDesign.border_top !== analysisResult.icing_design.border_top ||
            icingDesign.border_base !== analysisResult.icing_design.border_base ||
            icingDesign.gumpasteBaseBoard !== analysisResult.icing_design.gumpasteBaseBoard
        );
    }, [icingDesign, analysisResult]);

    // Check if cake messages have changed
    const hasMessageChanges = useMemo(() => {
        if (!analysisResult?.cake_messages) return false;

        // Check if number of messages changed
        if (cakeMessages.length !== analysisResult.cake_messages.length) return true;

        // Check if any message properties changed
        return cakeMessages.some(currentMsg => {
            const originalMsg = analysisResult.cake_messages?.find((m: any) => m.id === currentMsg.id);
            if (!originalMsg) return true; // New message

            return (
                currentMsg.text !== originalMsg.text ||
                currentMsg.color !== originalMsg.color ||
                currentMsg.isEnabled !== (originalMsg as any).isEnabled ||
                currentMsg.position !== originalMsg.position
            );
        });
    }, [cakeMessages, analysisResult]);

    const checkItemChanged = useCallback((item: MainTopperUI | SupportElementUI) => {
        // If it was originally detected but now disabled
        if (!item.isEnabled) return true;

        // Check type change
        if (item.type !== item.original_type) return true;

        // Check color change
        const color1 = item.color?.toLowerCase() || '';
        const color2 = item.original_color?.toLowerCase() || '';
        if (color1 !== color2) return true;

        // Check colors array change
        const colors1 = (item.colors || []).filter(c => c).map(c => c!.toLowerCase()).sort();
        const colors2 = (item.original_colors || []).filter(c => c).map(c => c!.toLowerCase()).sort();
        if (JSON.stringify(colors1) !== JSON.stringify(colors2)) return true;

        // Check replacement image
        if (item.replacementImage) return true;

        return false;
    }, []);

    const hasToppersChanges = useMemo(() => {
        if (!mainToppers || !supportElements) return false;
        return mainToppers.some(checkItemChanged) || supportElements.some(checkItemChanged);
    }, [mainToppers, supportElements, checkItemChanged]);

    const hasPhotoChanges = useMemo(() => {
        if (!mainToppers || !supportElements) return false;
        const photoToppers = mainToppers.filter(t => t.original_type === 'edible_photo_top');
        const photoSupport = supportElements.filter(s => s.original_type === 'edible_photo_side');
        return photoToppers.some(checkItemChanged) || photoSupport.some(checkItemChanged);
    }, [mainToppers, supportElements, checkItemChanged]);

    // Show icing guide when image preview is available (before analysis completes)
    useEffect(() => {
        if (originalImagePreview && !hasShownGuide) {
            // Start the guide 1 second after image appears
            const startTimeout = setTimeout(() => {
                setShowIcingGuide(true);
                setHasShownGuide(true);
                // Hide the guide after animation completes (6 tools × 400ms + buffer)
                const hideTimeout = setTimeout(() => {
                    setShowIcingGuide(false);
                }, 2700);
            }, 1000); // 1 second delay before starting

            return () => clearTimeout(startTimeout);
        }
    }, [originalImagePreview, hasShownGuide]);

    const HEX_TO_COLOR_NAME_MAP = useMemo(() => COLORS.reduce((acc, color) => {
        acc[color.hex.toLowerCase()] = color.name;
        return acc;
    }, {} as Record<string, string>), []);

    useEffect(() => {
        if (isUpdatingDesign) {
            const genericMessages = [
                'Working our magic...',
                'Baking your new design...',
                'Adding the finishing touches...',
                'Frosting your ideas into reality...',
                'Prepping the piping bags...',
            ];

            const specificMessages: string[] = [];
            const colorName = (hex?: string) => {
                if (!hex) return 'a new';
                const name = HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()];
                return name ? `a ${name}` : 'a custom';
            };
            const colorNameSimple = (hex?: string) => {
                if (!hex) return 'new';
                return HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || 'custom';
            };

            if (analysisResult && icingDesign && analysisResult.icing_design) {
                if (icingDesign.drip && !analysisResult.icing_design.drip) {
                    specificMessages.push(`Adding ${colorName(icingDesign.colors.drip)} drip effect...`);
                }
                if (analysisResult.icing_design.colors && icingDesign.colors.side !== analysisResult.icing_design.colors.side) {
                    specificMessages.push(`Painting the sides ${colorNameSimple(icingDesign.colors.side)}...`);
                }
                if (icingDesign.gumpasteBaseBoard && !analysisResult.icing_design.gumpasteBaseBoard) {
                    specificMessages.push(`Adding a covered base board...`);
                }

                cakeMessages.forEach(msg => {
                    if (msg.isEnabled && !msg.originalMessage) {
                        specificMessages.push(`Writing "${msg.text.substring(0, 15)}..." on the cake...`);
                    } else if (!msg.isEnabled && msg.originalMessage) {
                        specificMessages.push(`Erasing "${msg.originalMessage.text.substring(0, 15)}..."`);
                    }
                });

                mainToppers.forEach(topper => {
                    if (topper.isEnabled && !topper.original_type) {
                        specificMessages.push(`Adding the ${topper.description}...`);
                    } else if (!topper.isEnabled && topper.original_type) {
                        specificMessages.push(`Removing the ${topper.description}...`);
                    }
                });
            }

            const allMessages = [...new Set([...specificMessages, ...genericMessages])];
            let currentIndex = 0;

            setDynamicLoadingMessage(allMessages[currentIndex]);

            const interval = setInterval(() => {
                currentIndex = (currentIndex + 1) % allMessages.length;
                setDynamicLoadingMessage(allMessages[currentIndex]);
            }, 2000);

            return () => clearInterval(interval);
        }
    }, [isUpdatingDesign, analysisResult, cakeInfo, icingDesign, mainToppers, cakeMessages, HEX_TO_COLOR_NAME_MAP]);

    // Close the color picker panel after design update completes
    useEffect(() => {
        if (isUpdatingDesign) {
            // Track that we started updating
            setWasUpdating(true);
        } else if (wasUpdating && selectedItem && 'itemCategory' in selectedItem && selectedItem.itemCategory === 'icing') {
            // Update just completed, close the color picker
            setSelectedItem(null);
            setWasUpdating(false);
        }
    }, [isUpdatingDesign, selectedItem, wasUpdating]);

    // Prefetch icing images when an icing tool is selected to avoid delay on color change
    useEffect(() => {
        if (!selectedItem || !('itemCategory' in selectedItem) || selectedItem.itemCategory !== 'icing') return;

        const description = (selectedItem as any).description;
        let type: IcingImageType | null = null;
        let isTopSpecific = false;

        // Map tool description to IcingImageType
        switch (description) {
            case 'Drip':
                type = 'drip';
                break;
            case 'Top': // Top Border
                type = 'borderTop';
                break;
            case 'Bottom': // Base Border
                type = 'borderBase';
                break;
            case 'Board':
                type = 'gumpasteBaseBoard';
                break;
            case 'Top Icing':
                type = 'top';
                isTopSpecific = true;
                break;
            case 'Body Icing':
            case 'Side Icing':
                // Both use standard 'icing' prefix
                type = 'side';
                break;
        }

        if (!type) return;

        // Prefetch all available colors
        COLORS.forEach(color => {
            // Create a minimal design object for URL generation
            const colorKey = type === 'gumpasteBaseBoard' ? 'gumpasteBaseBoardColor' : type;
            const tempDesign = {
                colors: {
                    [colorKey]: color.hex
                }
            } as any as IcingDesignUI;

            const url = getIcingImage(tempDesign, type as IcingImageType, isTopSpecific);

            if (url) {
                const img = new Image();
                img.src = url;
            }
        });
    }, [selectedItem]);


    const dominantMotif = useMemo(() => {
        if (!analysisResult) return null;

        const allColors: string[] = [];
        const neutralColors = ['#ffffff', '#000000', '#64748b']; // White, Black, Gray

        // Safely access icing_design.colors
        if (analysisResult.icing_design?.colors) {
            Object.values(analysisResult.icing_design.colors).forEach(color => {
                if (color) allColors.push(color.toLowerCase());
            });
        }
        analysisResult.main_toppers?.forEach(item => {
            if (item.color) allColors.push(item.color.toLowerCase());
            if (item.colors) item.colors.forEach(c => c && allColors.push(c.toLowerCase()));
        });
        analysisResult.support_elements?.forEach(item => {
            if (item.color) allColors.push(item.color.toLowerCase());
            if (item.colors) item.colors.forEach(c => c && allColors.push(c.toLowerCase()));
        });
        analysisResult.cake_messages?.forEach(item => {
            if (item.color) allColors.push(item.color.toLowerCase());
        });

        const nonNeutralColors = allColors.filter(c => !neutralColors.includes(c));
        if (nonNeutralColors.length === 0) return null;

        const uniqueColors = [...new Set(nonNeutralColors)];

        if (uniqueColors.length === 1) {
            const dominantHex = uniqueColors[0];
            const dominantName = HEX_TO_COLOR_NAME_MAP[dominantHex] || 'Custom Color';
            return { hex: dominantHex, name: dominantName };
        }

        return null;
    }, [analysisResult, HEX_TO_COLOR_NAME_MAP]);

    const handleMotifColorChange = useCallback((newHex: string) => {
        if (!dominantMotif || !icingDesign) return;

        const oldHex = dominantMotif.hex.toLowerCase();

        const newIcingColors: IcingColorDetails = { ...icingDesign.colors };
        let icingChanged = false;
        (Object.keys(newIcingColors) as Array<keyof IcingColorDetails>).forEach(key => {
            if (newIcingColors[key]?.toLowerCase() === oldHex) {
                newIcingColors[key] = newHex;
                icingChanged = true;
            }
        });
        if (icingChanged) {
            onIcingDesignChange({ ...icingDesign, colors: newIcingColors });
        }

        mainToppers.forEach(topper => {
            const updates: Partial<MainTopperUI> = {};
            let hasUpdate = false;
            if (topper.color?.toLowerCase() === oldHex) {
                updates.color = newHex;
                hasUpdate = true;
            }
            if (topper.colors) {
                let colorsChanged = false;
                const newColors = topper.colors.map(c => {
                    if (c?.toLowerCase() === oldHex) {
                        colorsChanged = true;
                        return newHex;
                    }
                    return c;
                });
                if (colorsChanged) {
                    updates.colors = newColors;
                    hasUpdate = true;
                }
            }
            if (hasUpdate) {
                updateMainTopper(topper.id, updates);
            }
        });

        supportElements.forEach(element => {
            const updates: Partial<SupportElementUI> = {};
            let hasUpdate = false;
            if (element.color?.toLowerCase() === oldHex) {
                updates.color = newHex;
                hasUpdate = true;
            }
            if (element.colors) {
                let colorsChanged = false;
                const newColors = element.colors.map(c => {
                    if (c?.toLowerCase() === oldHex) {
                        colorsChanged = true;
                        return newHex;
                    }
                    return c;
                });
                if (colorsChanged) {
                    updates.colors = newColors;
                    hasUpdate = true;
                }
            }
            if (hasUpdate) {
                updateSupportElement(element.id, updates);
            }
        });

        const newCakeMessages = cakeMessages.map(message => {
            if (message.color?.toLowerCase() === oldHex) {
                return { ...message, color: newHex };
            }
            return message;
        });
        onCakeMessageChange(newCakeMessages);

        setIsMotifPanelOpen(false);
        const newColorName = HEX_TO_COLOR_NAME_MAP[newHex.toLowerCase()] || 'new color';
        showSuccess(`Changed motif from ${dominantMotif.name} to ${newColorName}`);
    }, [dominantMotif, icingDesign, mainToppers, supportElements, cakeMessages, onIcingDesignChange, updateMainTopper, updateSupportElement, onCakeMessageChange, HEX_TO_COLOR_NAME_MAP]);


    useEffect(() => {
        const element = markerContainerRef.current;
        if (!element) return;

        const resizeObserver = new ResizeObserver(() => {
            setContainerDimensions({
                width: element.clientWidth,
                height: element.clientHeight,
            });
        });

        resizeObserver.observe(element);
        return () => resizeObserver.disconnect();
    }, []);

    const handleListItemClick = useCallback((item: AnalysisItem) => {
        setSelectedItem(item);
        mainImageContainerRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    }, []);



    const isAdmin = useMemo(() => user?.email === 'apcaballes@gmail.com', [user]);

    const handleScrollToCakeBase = () => {
        cakeBaseSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    };

    const handleScrollToCakeMessages = () => {
        cakeMessagesSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    };

    // Handle undo with modal state cleanup
    const handleUndoWithModalCleanup = useCallback(() => {
        // Clear any pending modal changes
        setTempCakeMessagesBackup(null);
        setTempToppersBackup(null);
        setTempEdiblePhotoBackup(null);

        // Close any open modals
        setActiveCustomization(null);

        // Call the original undo handler
        onUndo();
    }, [onUndo]);

    const analysisItems = useMemo((): AnalysisItem[] => {
        const items: AnalysisItem[] = [];
        if (!analysisResult) return items;
        items.push(...mainToppers.map((t): AnalysisItem => ({ ...t, itemCategory: 'topper' })));
        items.push(...supportElements.map((e): AnalysisItem => ({ ...e, itemCategory: 'element' })));
        items.push(...cakeMessages.map((m): AnalysisItem => ({ ...m, itemCategory: 'message' })));
        return items;
    }, [analysisResult, mainToppers, supportElements, cakeMessages]);

    const rawMarkers = useMemo((): AnalysisItem[] => {
        const markers: AnalysisItem[] = analysisItems.filter(item => typeof item.x === 'number' && typeof item.y === 'number');

        return markers;
    }, [analysisItems]);

    const markerMap = useMemo(() => {
        const map = new Map<string, string>();
        rawMarkers.forEach((marker, index) => {
            map.set(marker.id, String.fromCharCode(65 + index));
        });
        return map;
    }, [rawMarkers]);

    const getMarkerPosition = useCallback((x: number, y: number) => {
        if (!originalImageDimensions || !containerDimensions) {
            return { top: '50%', left: '50%', topPx: 0, leftPx: 0 };
        }

        const { width: containerWidth, height: containerHeight } = containerDimensions;
        const { width: imageWidth, height: imageHeight } = originalImageDimensions;

        // Since we set the container's aspect-ratio CSS to match the image,
        // the container and image should have the same aspect ratio.
        // The image fills the container completely with object-contain.
        const renderedWidth = containerWidth;
        const renderedHeight = containerHeight;
        const offsetX = 0;
        const offsetY = 0;

        const markerXPercent = (x + imageWidth / 2) / imageWidth;
        const markerYPercent = (-y + imageHeight / 2) / imageHeight;

        let markerX = (markerXPercent * renderedWidth) + offsetX;
        let markerY = (markerYPercent * renderedHeight) + offsetY;

        // Apply a small upward correction to the y-coordinate in pixel space.
        // The AI seems to have a consistent downward offset in its y-coordinate reporting.
        // This empirically corrects for that observation with a 2% upward shift.
        const yCorrection = renderedHeight * 0.02;
        markerY -= yCorrection;

        // Constrain markers to avoid overlapping with UI elements
        // No need to avoid left side anymore since toolbar is below image
        const minLeft = 10;
        // Avoid area near bottom buttons (40px for button height + some padding)
        const minBottom = 45;

        // Apply constraints only to markers that would overlap UI elements
        markerX = Math.max(minLeft, Math.min(markerX, renderedWidth + offsetX - 12));
        markerY = Math.max(offsetY + 12, Math.min(markerY, renderedHeight + offsetY - minBottom));

        return { left: `${markerX}px`, top: `${markerY}px`, leftPx: markerX, topPx: markerY };
    }, [originalImageDimensions, containerDimensions]);

    const clusteredMarkers = useMemo((): ClusteredMarker[] => {
        const MIN_DISTANCE = 15; // Minimum pixel distance between markers

        // Don't return early with empty array - let clustering work even if dimensions haven't loaded yet.
        // The rendering condition checks for dimensions, so this prevents markers from disappearing.
        if (rawMarkers.length === 0) {
            return [];
        }

        // If dimensions aren't available yet, return unclustered markers so they render once dimensions load
        if (!containerDimensions || !originalImageDimensions) {
            return rawMarkers.map(marker => ({ ...marker, isCluster: false }));
        }

        const markers = rawMarkers;
        const markerPositions = markers.map(m => getMarkerPosition(m.x!, m.y!));
        const clustered: ClusteredMarker[] = [];
        const clusteredIndices = new Set<number>();

        for (let i = 0; i < markers.length; i++) {
            if (clusteredIndices.has(i)) continue;

            const currentClusterItems: AnalysisItem[] = [markers[i]];
            const clusterIndices = [i];

            for (let j = i + 1; j < markers.length; j++) {
                if (clusteredIndices.has(j)) continue;

                const pos1 = markerPositions[i];
                const pos2 = markerPositions[j];
                const distance = Math.sqrt(Math.pow(pos1.leftPx - pos2.leftPx, 2) + Math.pow(pos1.topPx - pos2.topPx, 2));

                if (distance < MIN_DISTANCE) {
                    currentClusterItems.push(markers[j]);
                    clusterIndices.push(j);
                }
            }

            if (currentClusterItems.length > 1) {
                clusterIndices.forEach(idx => clusteredIndices.add(idx));
                const avgX = currentClusterItems.reduce((sum, item) => sum + item.x!, 0) / currentClusterItems.length;
                const avgY = currentClusterItems.reduce((sum, item) => sum + item.y!, 0) / currentClusterItems.length;

                clustered.push({
                    id: `cluster-${i}`,
                    x: avgX,
                    y: avgY,
                    isCluster: true,
                    items: currentClusterItems,
                });
            } else {
                clustered.push({ ...markers[i], isCluster: false });
            }
        }

        return clustered;
    }, [rawMarkers, getMarkerPosition, containerDimensions, originalImageDimensions]);


    const addCakeMessage = useCallback((position: 'top' | 'side' | 'base_board') => {
        let coords: { x?: number, y?: number } = {};

        // Get default coordinates based on position
        if (position === 'base_board') {
            const baseBoardCoords = analysisResult?.base_board?.[0];
            coords = { x: baseBoardCoords?.x, y: baseBoardCoords?.y };
        } else if (position === 'top') {
            // Default to center-top area for top messages
            coords = { x: 0, y: 0.3 };
        } else if (position === 'side') {
            // Default to center for side messages
            coords = { x: 0, y: 0 };
        }

        const newMessage: CakeMessageUI = {
            id: crypto.randomUUID(),
            type: 'gumpaste_letters',
            text: 'Your Text Here',
            position: position,
            color: '#000000',
            isEnabled: true,
            price: 0,
            x: coords.x,
            y: coords.y,
        };

        onCakeMessageChange([...cakeMessages, newMessage]);

        // After a short delay, select the newly created message to open its editor
        setTimeout(() => {
            setSelectedItem({ ...newMessage, itemCategory: 'message' });
        }, 100);
    }, [onCakeMessageChange, cakeMessages, analysisResult]);

    const handleCustomizedTabClick = () => {
        setActiveTab('customized');
    };

    return (<>
        <div className="flex flex-col items-center gap-4 w-full max-w-7xl mx-auto pb-28 px-4"> {/* Added px-4 padding */}
            <div className="w-full flex items-center gap-2 md:gap-4 pt-6"> {/* Added mb-4 and pt-6 */}
                <button onClick={onClose} className="p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label="Go back">
                    <BackIcon />
                </button>
                <div className="relative grow">
                    <SearchAutocomplete
                        value={searchInput}
                        onChange={setSearchInput}
                        onSearch={onSearch}
                        showUploadButton={false}
                        placeholder="Search for other designs..."
                        inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                    />
                </div>
                <button onClick={() => setAppState('cart')} className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors shrink-0" aria-label={`View cart with ${itemCount} items`}>
                    <ShoppingBag size={24} />
                    {itemCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                            {itemCount}
                        </span>
                    )}
                </button>
            </div>

            {/* SEO Breadcrumbs - Visible for both Shop Product and SEO Landing Pages */}
            {((product && merchant) || (recentSearchDesign && recentSearchDesign.slug)) && (
                <nav className="w-full" aria-label="Breadcrumb">
                    <ol className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
                        <li>
                            <a href="/" className="hover:text-purple-600 transition-colors">Home</a>
                        </li>
                        <li><span className="mx-1">/</span></li>

                        {product && merchant ? (
                            <>
                                <li>
                                    <a href="/shop" className="hover:text-purple-600 transition-colors">Shop</a>
                                </li>
                                <li><span className="mx-1">/</span></li>
                                <li>
                                    <a href={`/shop/${merchant.slug}`} className="hover:text-purple-600 transition-colors">{merchant.business_name}</a>
                                </li>
                                <li><span className="mx-1">/</span></li>
                                <li className="text-slate-700 font-medium" aria-current="page">{product.title}</li>
                            </>
                        ) : recentSearchDesign ? (
                            <>
                                <li>
                                    <a href="/customizing" className="hover:text-purple-600 transition-colors">Customizing</a>
                                </li>
                                <li><span className="mx-1">/</span></li>
                                <li className="text-slate-700 font-medium" aria-current="page">
                                    {recentSearchDesign.seo_title?.replace(/\s*\|\s*Genie\.ph\s*$/i, '') || recentSearchDesign.keywords || 'Custom Design'}
                                </li>
                            </>
                        ) : null}
                    </ol>
                </nav>
            )}

            {/* Product/Design Title */}
            {(product || recentSearchDesign) && (
                <div className="w-full">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
                        {product ? product.title : (recentSearchDesign?.seo_title?.replace(/\s*\|\s*Genie\.ph\s*$/i, '') || recentSearchDesign?.keywords || 'Custom Design')}
                    </h1>
                    {product?.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            {product.category}
                        </span>
                    )}
                </div>
            )}

            <button
                onClick={onOpenReportModal}
                disabled={!editedImage || isLoading || isReporting}
                className="w-full text-center bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors hover:bg-yellow-200 disabled:bg-yellow-100/50 disabled:text-yellow-600 disabled:cursor-not-allowed disabled:hover:bg-yellow-100"
            >
                BETA TEST: Features are experimental. Click here to report any issues.
            </button>
            {isReporting && reportStatus === null && (
                <div className="w-full flex items-center justify-center text-sm font-semibold p-2 rounded-xl animate-fade-in bg-blue-100 text-blue-700">
                    <Loader2 className="animate-spin mr-2 w-4 h-4" />
                    Submitting your report... Thank you!
                </div>
            )}
            {reportStatus && (
                <div className={`w-full text-center text-sm font-semibold p-2 rounded-xl animate-fade-in ${reportStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {reportStatus === 'success' ? 'Report submitted successfully. Thank you for your feedback!' : 'Failed to submit report. Please try again.'}
                </div>
            )}

            {/* Two-column layout for desktop/tablet landscape */}
            <div className="w-full flex flex-col md:flex-row gap-4">
                {/* LEFT COLUMN: Image and Update Design */}
                <div className="flex flex-col gap-4 w-full md:w-[calc(50%-6px)]">
                    <div ref={mainImageContainerRef} className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
                        <div className="p-2 shrink-0">
                            {editedImage && (
                                <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                                    <button onClick={() => setActiveTab('original')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50'}`}>Original</button>
                                    <button onClick={handleCustomizedTabClick} disabled={!editedImage} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'}`}>Customized</button>
                                </div>
                            )}
                            {isAnalyzing && (
                                <div className="mt-3 w-full text-center animate-fade-in">
                                    <div className="w-full bg-slate-200 rounded-full h-2.5 relative overflow-hidden">
                                        <div className="h-full bg-linear-to-r from-pink-500 to-purple-600 progress-bar-fill"></div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 font-medium">Analyzing design elements & pricing... You can start customizing below.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-2 pt-0 grow">
                            <div
                                ref={markerContainerRef}
                                className="relative w-full"
                                onContextMenu={(e) => e.preventDefault()}
                                style={{
                                    aspectRatio: originalImageDimensions
                                        ? `${originalImageDimensions.width} / ${originalImageDimensions.height}`
                                        : '1 / 1'
                                }}
                            >
                                {isUpdatingDesign && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-2xl z-20"><LoadingSpinner /><p className="mt-4 text-slate-500 font-semibold">{dynamicLoadingMessage}</p></div>}
                                {error && (
                                    <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20 p-4">
                                        <ErrorIcon />
                                        <p className="mt-4 font-semibold text-red-600">
                                            {error.startsWith('AI_REJECTION:') ? 'Image Rejected' : 'Update Failed'}
                                        </p>
                                        <p className="text-sm text-red-500 text-center">
                                            {error.replace('AI_REJECTION: ', '')}
                                        </p>
                                    </div>
                                )}
                                {!originalImagePreview && !isAnalyzing && !product?.image_url && !recentSearchDesign?.original_image_url && <div className="absolute inset-0 flex items-center justify-center text-center text-slate-400 py-16"><ImageIcon /><p className="mt-2 font-semibold">Your creation will appear here</p></div>}

                                {/* SSR / Initial Load Fallback Image using Props */}
                                {!originalImagePreview && (product?.image_url || recentSearchDesign?.original_image_url) && (
                                    <LazyImage
                                        src={product?.image_url || recentSearchDesign?.original_image_url || ''}
                                        alt={product?.alt_text || recentSearchDesign?.alt_text || product?.title || recentSearchDesign?.keywords || 'Cake Design'}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        imageClassName="object-contain rounded-lg"
                                        priority
                                        unoptimized
                                    />
                                )}

                                {(originalImagePreview) && (
                                    <>
                                        <LazyImage
                                            onLoad={(e) => {
                                                const img = e.currentTarget;
                                                const container = markerContainerRef.current;

                                                // CRITICAL: Only set originalImageDimensions from the ORIGINAL image
                                                // This keeps marker positions anchored to original coordinates
                                                // even when viewing the customized image (which may have different resolution)
                                                if (container) {
                                                    // Only update originalImageDimensions if not set OR if viewing original tab
                                                    if (!originalImageDimensions || activeTab === 'original') {
                                                        setOriginalImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                                                    }
                                                    // Always update container dimensions for proper rendering
                                                    setContainerDimensions({ width: container.clientWidth, height: container.clientHeight });
                                                }
                                            }}
                                            key={activeTab}
                                            src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview}
                                            alt={product?.alt_text || (product ? `${product.title} - Custom cake${merchant ? ` from ${merchant.business_name}` : ''}` : (activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"))}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 50vw"
                                            imageClassName="object-contain rounded-lg"
                                            priority
                                            unoptimized
                                        />

                                        {/* Save Design button - top left */}
                                        {originalImagePreview && analysisResult && (
                                            <div className="absolute top-3 left-3 z-10">
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!isAuthenticated || user?.is_anonymous) {
                                                            showInfo('Please log in to save designs');
                                                            router.push('/login?redirect=/customizing');
                                                            return;
                                                        }

                                                        try {
                                                            // Get the p_hash from the analysis or generate an identifier
                                                            const pHash = analysisId || `design-${Date.now()}`;
                                                            let currentImageUrl = editedImage || originalImagePreview || '';

                                                            // If the image is a data URI, upload it to storage first
                                                            if (currentImageUrl.startsWith('data:')) {
                                                                showInfo('Saving design...');
                                                                const { originalImageUrl, finalImageUrl } = await uploadCartImages({
                                                                    editedImageDataUri: editedImage || null,
                                                                    userId: user?.id
                                                                });
                                                                currentImageUrl = finalImageUrl;
                                                            }

                                                            // Build customization snapshot
                                                            const customizationSnapshot = {
                                                                flavors: cakeInfo?.flavors || [],
                                                                mainToppers: mainToppers.filter(t => t.isEnabled).map(t => ({
                                                                    description: t.description,
                                                                    type: t.type,
                                                                    size: t.size
                                                                })),
                                                                supportElements: supportElements.filter(e => e.isEnabled).map(e => ({
                                                                    description: e.description,
                                                                    type: e.type
                                                                })),
                                                                cakeMessages: cakeMessages.filter(m => m.isEnabled).map(m => ({
                                                                    text: m.text,
                                                                    color: m.color
                                                                })),
                                                                icingDesign: {
                                                                    drip: icingDesign?.drip || false,
                                                                    gumpasteBaseBoard: icingDesign?.gumpasteBaseBoard || false,
                                                                    colors: icingDesign?.colors
                                                                        ? Object.entries(icingDesign.colors).reduce((acc, [k, v]) => {
                                                                            if (v) acc[k] = v;
                                                                            return acc;
                                                                        }, {} as Record<string, string>)
                                                                        : {}
                                                                },
                                                                additionalInstructions: additionalInstructions || ''
                                                            };

                                                            await toggleSaveDesign({
                                                                analysisPHash: pHash,
                                                                customizationSnapshot: customizationSnapshot,
                                                                customizedImageUrl: currentImageUrl
                                                            });

                                                            const wasSaved = isDesignSaved(pHash);
                                                            showSuccess(wasSaved ? 'Removed from saved' : 'Design saved!');
                                                        } catch (err) {
                                                            console.error('Failed to save design:', err);
                                                            showError('Failed to save design. Please try again.');
                                                        }
                                                    }}

                                                    className={`backdrop-blur-sm rounded-full text-[10px] max-[360px]:text-[8px] font-semibold transition-all shadow-md px-2.5 py-1 max-[360px]:px-2 max-[360px]:py-0.5 flex items-center gap-1 ${isDesignSaved(analysisId || '')
                                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                                        : 'bg-white/90 text-slate-700 hover:bg-red-50 hover:text-red-500'
                                                        }`}
                                                    aria-label={isDesignSaved(analysisId || '') ? 'Remove from saved' : 'Save this design'}
                                                >
                                                    <Heart
                                                        className="w-3 h-3 max-[360px]:w-2.5 max-[360px]:h-2.5"
                                                        fill={isDesignSaved(analysisId || '') ? 'currentColor' : 'none'}
                                                    />
                                                    {isDesignSaved(analysisId || '') ? 'Saved' : 'Save'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Undo button */}
                                        <div className="absolute top-3 right-3 z-10 flex gap-2">
                                            {canUndo && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUndoWithModalCleanup();
                                                    }}
                                                    disabled={!canUndo || isLoading}
                                                    className="bg-orange-500/90 backdrop-blur-sm text-white rounded-full text-[10px] max-[360px]:text-[8px] font-semibold hover:bg-orange-600 transition-all shadow-md px-2.5 py-1 max-[360px]:px-2 max-[360px]:py-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                    aria-label="Undo last change"
                                                >
                                                    <ResetIcon className="w-2.5 h-2.5 max-[360px]:w-2 max-[360px]:h-2" />
                                                    Undo
                                                </button>
                                            )}
                                        </div>

                                        {/* Bounding Box Overlay - Replaces Markers */}
                                        {/* {analysisResult && originalImageDimensions && containerDimensions && (
                                            <BoundingBoxOverlay
                                                analysisResult={analysisResult}
                                                containerWidth={containerDimensions.width}
                                                containerHeight={containerDimensions.height}
                                                imageWidth={originalImageDimensions.width}
                                                imageHeight={originalImageDimensions.height}
                                            />
                                        )} */}

                                        <div className="absolute inset-0 pointer-events-none">
                                            {/* OLD MARKER SYSTEM - Currently disabled in favor of bounding boxes */}
                                            {false && originalImageDimensions && containerDimensions && containerDimensions!.height > 0 && areHelpersVisible && clusteredMarkers.map((item) => {
                                                if (item.x === undefined || item.y === undefined) return null;

                                                // Hide markers during Phase 1 (coordinates are 0,0)
                                                // They'll fade in during Phase 2 when real coordinates arrive
                                                if (item.x === 0 && item.y === 0) return null;

                                                const position = getMarkerPosition(item.x, item.y);
                                                const isSelected = selectedItem?.id === item.id;
                                                const isCluster = 'isCluster' in item && item.isCluster;
                                                const isAction = 'itemCategory' in item && item.itemCategory === 'action';

                                                // Handle click to detect overlapping markers
                                                const handleMarkerClick = (e: React.MouseEvent, item: ClusteredMarker) => {
                                                    e.stopPropagation();
                                                    setIsMotifPanelOpen(false);

                                                    // Check if it's a cluster or single item
                                                    if ('isCluster' in item && item.isCluster) {
                                                        // For now, if it's a cluster, we might want to just expand the first item or show a mini-menu
                                                        // But simpler: just treat it as clicking the first item if they are all same type
                                                        // Or just open the main modal if it contains toppers/elements
                                                        const hasToppers = item.items.some(i => i.itemCategory === 'topper' || i.itemCategory === 'element');
                                                        if (hasToppers) {
                                                            setActiveCustomization('toppers');
                                                            return;
                                                        }
                                                    } else {
                                                        const singleItem = item as AnalysisItem;
                                                        if (singleItem.itemCategory === 'topper' || singleItem.itemCategory === 'element') {
                                                            // Check for Edible Photo specific types
                                                            if (singleItem.type === 'edible_photo_top' || singleItem.type === 'edible_photo_side') {
                                                                setActiveCustomization('photos');
                                                            } else {
                                                                setActiveCustomization('toppers');
                                                            }
                                                            return;
                                                        } else if (singleItem.itemCategory === 'message') {
                                                            setActiveCustomization('messages');
                                                            return;
                                                        }
                                                    }

                                                    // Find all overlapping markers at this position (legacy logic for icing/other)
                                                    const OVERLAP_THRESHOLD = 12; // 24px marker / 2 = 12px radius
                                                    const clickedPos = getMarkerPosition(item.x!, item.y!);

                                                    const overlappingItems = clusteredMarkers.filter(marker => {
                                                        if (marker.x === undefined || marker.y === undefined) return false;
                                                        const markerPos = getMarkerPosition(marker.x, marker.y);
                                                        const distance = Math.sqrt(
                                                            Math.pow(markerPos.leftPx - clickedPos.leftPx, 2) +
                                                            Math.pow(markerPos.topPx - clickedPos.topPx, 2)
                                                        );
                                                        return distance < OVERLAP_THRESHOLD;
                                                    });

                                                    // If multiple items overlap, create a cluster
                                                    if (overlappingItems.length > 1) {
                                                        const clusterItem: ClusteredMarker = {
                                                            id: `overlap-cluster-${item.id}`,
                                                            x: item.x!,
                                                            y: item.y!,
                                                            isCluster: true,
                                                            items: overlappingItems.map(m => {
                                                                if ('isCluster' in m && m.isCluster) {
                                                                    return m.items; // Flatten if somehow already clustered
                                                                }
                                                                return m as AnalysisItem;
                                                            }).flat()
                                                        };
                                                        setSelectedItem(clusterItem);
                                                    } else {
                                                        // Single item - toggle selection
                                                        setSelectedItem(prev => prev?.id === item.id ? null : item);
                                                    }
                                                };

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`analysis-marker ${isSelected ? 'selected' : ''}`}
                                                        style={{ top: position.top, left: position.left }}
                                                        onMouseEnter={() => setHoveredItem(item)}
                                                        onMouseLeave={() => setHoveredItem(null)}
                                                        onClick={(e) => handleMarkerClick(e, item)}
                                                    >
                                                        <div className={`marker-dot ${isAction ? 'action-marker' : ''}`}>
                                                            {isCluster ? item.items.length : isAction ? '+' : markerMap.get(item.id)}
                                                        </div>
                                                        {hoveredItem?.id === item.id && (
                                                            <span className="marker-tooltip">
                                                                {isCluster ? `${item.items.length} items found here` : ('description' in item ? item.description : 'text' in item ? item.text : '')}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>


                                    </>
                                )}






                                {/* Small Apply button in lower right corner - only show when there are changes */}
                                {(hasIcingChanges || isUpdatingDesign) && (
                                    <button
                                        onClick={onUpdateDesign}
                                        disabled={isUpdatingDesign || !originalImageData}
                                        className="absolute bottom-4 right-4 bg-purple-600 text-purple-50 font-semibold py-1.5 px-3.5 rounded-lg shadow-md hover:shadow-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-1.5 text-sm"
                                        title="Apply icing color changes"
                                    >
                                        {isUpdatingDesign ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                <MagicSparkleIcon className="w-3.5 h-3.5" />
                                                Apply
                                            </>
                                        )}
                                    </button>
                                )}


                            </div></div>
                    </div>



                </div>
                {/* RIGHT COLUMN: Availability at top, then Feature List */}
                <div className="flex flex-col gap-4 w-full md:w-[calc(50%-6px)]">
                    {/* Availability Section - at top of right column */}


                    {/* Tip for reducing price - Moved from left column */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                        <span className="text-amber-500 text-sm">💡</span>
                        <p className="text-xs text-amber-700">
                            <span className="font-semibold">Tip:</span> Switch from toy toppers to edible or printed toppers to reduce the total price!
                        </p>
                    </div>

                    <div className="w-full bg-white/70 backdrop-blur-lg p-3 rounded-2xl shadow-lg border border-slate-200">
                        {isAnalyzing || (isLoading && !isDesignSaved) ? (
                            <div className="p-2 md:p-4">
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <MagicSparkleIcon className="w-5 h-5 text-purple-600 animate-pulse" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">Analyzing Design...</h2>
                                        <p className="text-xs text-slate-500">Extracting features and generating options</p>
                                    </div>
                                </div>
                                {/* Use granular skeletons to maintain layout structure */}
                                <div className="w-full">
                                    <p className="text-center text-xs font-semibold text-fuchsia-500 mb-2 px-4">
                                        LOWER THE PRICE by customizing your cake below
                                    </p>
                                    <CustomizationTabs
                                        activeTab={activeCustomization}
                                        onTabClick={(id) => {
                                            setActiveCustomization(id === activeCustomization ? null : id);
                                            setSelectedItem(null);
                                        }}
                                    />
                                </div>
                                <div className="mt-6">
                                    <ChosenOptionsSkeleton />
                                </div>

                                {/* Placeholder for other sections if needed, or keeping it minimal */}
                                <div className="mt-4 px-2">
                                    <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200/50 animate-pulse">
                                        <div className="h-4 w-32 bg-slate-200 rounded" />
                                        <div className="h-16 w-full bg-slate-200 rounded" />
                                    </div>
                                </div>
                            </div>
                        ) : (cakeInfo || analysisError) ? (
                            <div className="">
                                {/* Customization Tabs - Top of cake options */}
                                <div className="w-full">
                                    <p className="text-center text-xs font-semibold text-fuchsia-500 mb-2 px-4">
                                        LOWER THE PRICE by customizing your cake below
                                    </p>
                                    <div className={`transition-all duration-300 ${isRejectionError ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                        <CustomizationTabs
                                            activeTab={activeCustomization}
                                            onTabClick={(id) => {
                                                setActiveCustomization(id === activeCustomization ? null : id);
                                                setSelectedItem(null);
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Chosen Options Preview - Clickable to edit */}
                                {cakeInfo && !isAnalyzing && !isRejectionError && (
                                    <div className="mt-4 px-2">
                                        <p className="text-xs font-semibold text-slate-500 mb-1">Chosen Options</p>
                                        <div className="flex gap-2 overflow-x-auto pt-1 pb-2 scrollbar-hide mt-1">
                                            {/* Cake Type */}
                                            <button
                                                onClick={() => setActiveCustomization('options')}
                                                className="group flex flex-col items-center gap-1 min-w-[60px]"
                                            >
                                                <div className={`w-14 h-14 rounded-lg border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white ${activeCustomization === 'options' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                    <LazyImage
                                                        src={CAKE_TYPE_THUMBNAILS[cakeInfo.type]}
                                                        alt={cakeInfo.type}
                                                        fill
                                                        sizes="56px"
                                                        imageClassName="object-contain"
                                                    />
                                                </div>
                                                <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                    {cakeInfo.type}
                                                </span>
                                            </button>

                                            {/* Size */}
                                            <button
                                                onClick={() => setActiveCustomization('options')}
                                                className="group flex flex-col items-center gap-1 min-w-[60px]"
                                            >
                                                <div className={`w-14 h-14 rounded-lg border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white ${activeCustomization === 'options' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                    <LazyImage
                                                        src={CAKE_SIZE_THUMBNAILS[cakeInfo.size] || CAKE_TYPE_THUMBNAILS[cakeInfo.type]}
                                                        alt={cakeInfo.size}
                                                        fill
                                                        sizes="56px"
                                                        imageClassName="object-contain"
                                                    />
                                                    <div className="absolute inset-x-0 top-0 pt-4 text-black text-[10px] font-bold text-center leading-tight">
                                                        {(() => {
                                                            const sizePart = cakeInfo.size?.split(' ')[0] || '';
                                                            const tiers = sizePart?.match(/\d+"/g) || [];
                                                            return (
                                                                <div>
                                                                    {tiers.map((tier, index) => (
                                                                        <React.Fragment key={index}>
                                                                            <span>&lt;- {tier} -&gt;</span><br />
                                                                        </React.Fragment>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                    {cakeInfo.size}
                                                </span>
                                            </button>

                                            {/* Thickness */}
                                            <button
                                                onClick={() => setActiveCustomization('options')}
                                                className="group flex flex-col items-center gap-1 min-w-[60px]"
                                            >
                                                <div className={`w-14 h-14 rounded-lg border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white ${activeCustomization === 'options' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                    <LazyImage
                                                        src={CAKE_THICKNESS_THUMBNAILS[cakeInfo.thickness]}
                                                        alt={cakeInfo.thickness}
                                                        fill
                                                        sizes="56px"
                                                        imageClassName="object-contain"
                                                    />
                                                </div>
                                                <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                    {cakeInfo.thickness}
                                                </span>
                                            </button>

                                            {/* Flavors */}
                                            {cakeInfo.flavors.map((flavor, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActiveCustomization('options')}
                                                    className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                >
                                                    <div className={`w-14 h-14 rounded-lg border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white ${activeCustomization === 'options' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                        <LazyImage
                                                            src={FLAVOR_THUMBNAILS[flavor]}
                                                            alt={flavor}
                                                            fill
                                                            sizes="56px"
                                                            imageClassName="object-contain"
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                        {flavor}
                                                    </span>
                                                </button>
                                            ))}

                                            {/* Icing Colors */}
                                            {icingDesign && (
                                                <>
                                                    {/* Body Icing / Side & Top */}
                                                    {(() => {
                                                        const topColor = icingDesign.colors?.top;
                                                        const sideColor = icingDesign.colors?.side;
                                                        const icingColorsSame = topColor && sideColor && topColor.toUpperCase() === sideColor.toUpperCase();

                                                        if (icingColorsSame && topColor) {
                                                            return (
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveCustomization('icing');
                                                                        setSelectedItem({
                                                                            id: 'icing-edit-icing',
                                                                            itemCategory: 'icing',
                                                                            description: 'Body Icing',
                                                                            cakeType: cakeInfo?.type || '1 Tier'
                                                                        });
                                                                    }}
                                                                    className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                                >
                                                                    <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${activeCustomization === 'icing' && selectedItem?.id === 'icing-edit-icing' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                                        <LazyImage
                                                                            src={getIcingImage(icingDesign as IcingDesignUI, 'top', false)}
                                                                            alt="Icing"
                                                                            width={36}
                                                                            height={36}
                                                                            imageClassName="w-full h-full object-contain"
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                                        Body Icing
                                                                    </span>
                                                                </button>
                                                            );
                                                        }

                                                        return (
                                                            <>
                                                                {topColor && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setActiveCustomization('icing');
                                                                            setSelectedItem({
                                                                                id: 'icing-edit-top',
                                                                                itemCategory: 'icing',
                                                                                description: 'Top Icing',
                                                                                cakeType: cakeInfo?.type || '1 Tier'
                                                                            });
                                                                        }}
                                                                        className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                                    >
                                                                        <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${activeCustomization === 'icing' && selectedItem?.id === 'icing-edit-top' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                                            <LazyImage
                                                                                src={getIcingImage(icingDesign as IcingDesignUI, 'top', true)}
                                                                                alt="Top Icing"
                                                                                width={36}
                                                                                height={36}
                                                                                imageClassName="w-full h-full object-contain"
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                                            Top Icing
                                                                        </span>
                                                                    </button>
                                                                )}
                                                                {sideColor && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setActiveCustomization('icing');
                                                                            setSelectedItem({
                                                                                id: 'icing-edit-side',
                                                                                itemCategory: 'icing',
                                                                                description: 'Side Icing',
                                                                                cakeType: cakeInfo?.type || '1 Tier'
                                                                            });
                                                                        }}
                                                                        className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                                    >
                                                                        <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${activeCustomization === 'icing' && selectedItem?.id === 'icing-edit-side' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                                            <LazyImage
                                                                                src={getIcingImage(icingDesign as IcingDesignUI, 'side', false)}
                                                                                alt="Body Icing"
                                                                                width={36}
                                                                                height={36}
                                                                                imageClassName="w-full h-full object-contain"
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                                            Body Icing
                                                                        </span>
                                                                    </button>
                                                                )}
                                                            </>
                                                        );
                                                    })()}

                                                    {/* Drip */}
                                                    {icingDesign.drip && icingDesign.colors?.drip && (
                                                        <button
                                                            onClick={() => {
                                                                setActiveCustomization('icing');
                                                                setSelectedItem({
                                                                    id: 'icing-edit-drip',
                                                                    itemCategory: 'icing',
                                                                    description: 'Drip',
                                                                    cakeType: cakeInfo?.type || '1 Tier'
                                                                });
                                                            }}
                                                            className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                        >
                                                            <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${activeCustomization === 'icing' && selectedItem?.id === 'icing-edit-drip' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                                <LazyImage
                                                                    src={getIcingImage(icingDesign as IcingDesignUI, 'drip')}
                                                                    alt="Drip"
                                                                    width={36}
                                                                    height={36}
                                                                    imageClassName="w-full h-full object-contain"
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                                Drip
                                                            </span>
                                                        </button>
                                                    )}

                                                    {/* Top Border */}
                                                    {icingDesign.border_top && icingDesign.colors?.borderTop && (
                                                        <button
                                                            onClick={() => {
                                                                setActiveCustomization('icing');
                                                                setSelectedItem({
                                                                    id: 'icing-edit-borderTop',
                                                                    itemCategory: 'icing',
                                                                    description: 'Top',
                                                                    cakeType: cakeInfo?.type || '1 Tier'
                                                                });
                                                            }}
                                                            className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                        >
                                                            <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${activeCustomization === 'icing' && selectedItem?.id === 'icing-edit-borderTop' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                                <LazyImage
                                                                    src={getIcingImage(icingDesign as IcingDesignUI, 'borderTop')}
                                                                    alt="Top Border"
                                                                    width={36}
                                                                    height={36}
                                                                    imageClassName="w-full h-full object-contain"
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                                Top Border
                                                            </span>
                                                        </button>
                                                    )}

                                                    {/* Base Border */}
                                                    {icingDesign.border_base && icingDesign.colors?.borderBase && (
                                                        <button
                                                            onClick={() => {
                                                                setActiveCustomization('icing');
                                                                setSelectedItem({
                                                                    id: 'icing-edit-borderBase',
                                                                    itemCategory: 'icing',
                                                                    description: 'Bottom',
                                                                    cakeType: cakeInfo?.type || '1 Tier'
                                                                });
                                                            }}
                                                            className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                        >
                                                            <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${activeCustomization === 'icing' && selectedItem?.id === 'icing-edit-borderBase' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                                <LazyImage
                                                                    src={getIcingImage(icingDesign as IcingDesignUI, 'borderBase')}
                                                                    alt="Base Border"
                                                                    width={36}
                                                                    height={36}
                                                                    imageClassName="w-full h-full object-contain"
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                                Base Border
                                                            </span>
                                                        </button>
                                                    )}

                                                    {/* Base Board */}
                                                    {icingDesign.gumpasteBaseBoard && icingDesign.colors?.gumpasteBaseBoardColor && (
                                                        <button
                                                            onClick={() => {
                                                                setActiveCustomization('icing');
                                                                setSelectedItem({
                                                                    id: 'icing-edit-gumpasteBaseBoard',
                                                                    itemCategory: 'icing',
                                                                    description: 'Board',
                                                                    cakeType: cakeInfo?.type || '1 Tier'
                                                                });
                                                            }}
                                                            className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                        >
                                                            <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${activeCustomization === 'icing' && selectedItem?.id === 'icing-edit-gumpasteBaseBoard' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                                <LazyImage
                                                                    src={getIcingImage(icingDesign as IcingDesignUI, 'gumpasteBaseBoard')}
                                                                    alt="Base Board"
                                                                    width={36}
                                                                    height={36}
                                                                    imageClassName="w-full h-full object-contain"
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                                Base Board
                                                            </span>
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {/* Cake Toppers */}
                                            {(mainToppers.some(t => t.isEnabled) || supportElements.some(s => s.isEnabled)) && (
                                                <button
                                                    onClick={() => setActiveCustomization('toppers')}
                                                    className="group flex flex-col items-center gap-1 min-w-[60px]"
                                                    aria-label="Edit Cake Toppers"
                                                    tabIndex={0}
                                                >
                                                    <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-1 shadow-sm flex items-center justify-center ${activeCustomization === 'toppers' ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}>
                                                        <LazyImage
                                                            src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/topper.webp"
                                                            alt="Cake Toppers"
                                                            width={48}
                                                            height={48}
                                                            imageClassName="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2">
                                                        Toppers
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}


                                {/* Additional Instructions - Always visible in main view */}
                                <div className={`mt-1 bg-slate-50 rounded-lg border border-slate-200 p-3 transition-all duration-300 ${isRejectionError ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-slate-700 text-sm">Additional Instructions</h3>
                                    </div>
                                    <textarea
                                        value={additionalInstructions}
                                        onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
                                        className="w-full p-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        placeholder="Specific notes (e.g., 'Make horn gold'). Do not add new items here."
                                        disabled={!!isRejectionError}
                                        rows={3}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Note: Use for clarifications on existing items.
                                    </p>
                                </div>
                                {/* FeatureList removed as its parts are now broken out */}
                                {/* Previously FeatureList was here */}

                                {/* Action Buttons */}
                                <div className="w-full flex items-center justify-end gap-4 pt-2 mt-4 border-t border-slate-200/50">
                                    <button onClick={onOpenReportModal} disabled={!editedImage || isLoading || isReporting} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Report an issue with this image">
                                        <ReportIcon />
                                        <span className="ml-2">{isReporting ? 'Submitting...' : 'Report Issue'}</span>
                                    </button>
                                    <button onClick={onSave} disabled={!editedImage || isLoading || isSaving} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label={isSaving ? "Saving image" : "Save customized image"}>
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span className="ml-2">Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <SaveIcon />
                                                <span className="ml-2">Save</span>
                                            </>
                                        )}
                                    </button>
                                    <button onClick={onClearAll} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors" aria-label="Reset everything"><ResetIcon /><span className="ml-2">Reset Everything</span></button>
                                </div>
                            </div>
                        ) : <div className="text-center p-8 text-slate-500"><p>Upload an image to get started.</p></div>}
                    </div>
                </div>
            </div>

            {/* Product/Design Description & Tags - Spans full width of the two-column layout */}
            {((product && (product.long_description || product.short_description || (product.tags && product.tags.length > 0))) ||
                (recentSearchDesign && (recentSearchDesign.seo_description || recentSearchDesign.alt_text)) ||
                (analysisResult && (analysisResult.seo_description || analysisResult.alt_text))) && (
                    <div className="w-full mt-6">
                        <div className="bg-white/70 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-slate-200">
                            {/* Product Description */}
                            {product && (product.long_description || product.short_description) && (
                                <div className="mb-3">
                                    <h2 className="text-sm font-semibold text-slate-700 mb-2">About This Cake</h2>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {product.long_description || product.short_description}
                                    </p>
                                </div>
                            )}

                            {/* Design Description */}
                            {((recentSearchDesign && (recentSearchDesign.seo_description || recentSearchDesign.alt_text)) ||
                                (analysisResult && (analysisResult.seo_description || analysisResult.alt_text))) && (
                                    <div className="mb-3">
                                        <h2 className="text-sm font-semibold text-slate-700 mb-2">About This Design</h2>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            {analysisResult?.seo_description || analysisResult?.alt_text || recentSearchDesign?.seo_description || recentSearchDesign?.alt_text}
                                        </p>
                                        <p className="text-xs text-red-400 mt-4 flex items-center justify-center gap-1.5 text-center">
                                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Design inspiration shared by customer for pricing—final cake may vary slightly.
                                        </p>
                                    </div>
                                )}

                            {product && product.tags && product.tags.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-medium text-slate-500 mb-2">Related Tags</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {product.tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-purple-100 hover:text-purple-700 transition-colors cursor-default"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}


            {/* FloatingResultPanel - Only show for non-icing items */}
            {
                selectedItem && !('itemCategory' in selectedItem && selectedItem.itemCategory === 'icing') && (
                    <FloatingResultPanel
                        selectedItem={selectedItem}
                        onClose={() => setSelectedItem(null)}
                    />
                )
            }
            {/* Messages Panel */}
            {
                showMessagesPanel && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMessagesPanel(false)}>
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="sticky top-0 bg-white border-b border-slate-200 p-3 flex justify-between items-center rounded-t-xl">
                                <h2 className="text-lg font-bold text-slate-800">Cake Messages</h2>
                                <button
                                    onClick={() => setShowMessagesPanel(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                    aria-label="Close messages panel"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="p-3 space-y-3">
                                {/* List all messages */}
                                {cakeMessages.map((message) => (
                                    <div key={message.id} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1">
                                                <div className="text-xs font-semibold text-purple-600 uppercase mb-1">
                                                    {message.position === 'top' ? 'Cake Top' : message.position === 'side' ? 'Cake Front' : 'Base Board'}
                                                </div>
                                                <div className="text-sm font-medium text-slate-800">{message.text}</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    removeCakeMessage(message.id);
                                                    if (cakeMessages.length === 1) {
                                                        setShowMessagesPanel(false);
                                                    }
                                                }}
                                                className="text-red-500 hover:text-red-700 transition-colors ml-2"
                                                aria-label="Delete message"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex gap-2 text-xs text-slate-600">
                                            <span>Type: {message.type.replace('_', ' ')}</span>
                                            <span>•</span>
                                            <span>Color: {message.color}</span>
                                        </div>
                                    </div>
                                ))}

                                {/* Add message buttons */}
                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                    <div className="text-xs font-semibold text-slate-600 mb-2">Add New Message</div>
                                    {!cakeMessages.some(m => m.position === 'top') && (
                                        <button
                                            onClick={() => {
                                                addCakeMessage('top');
                                            }}
                                            className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                                        >
                                            <span className="text-base">+</span> Add Message (Cake Top)
                                        </button>
                                    )}
                                    {!cakeMessages.some(m => m.position === 'side') && (
                                        <button
                                            onClick={() => {
                                                addCakeMessage('side');
                                            }}
                                            className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                                        >
                                            <span className="text-base">+</span> Add Message (Cake Front)
                                        </button>
                                    )}
                                    {!cakeMessages.some(m => m.position === 'base_board') && cakeInfo?.type !== 'Bento' && (
                                        <button
                                            onClick={() => {
                                                addCakeMessage('base_board');
                                            }}
                                            className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                                        >
                                            <span className="text-base">+</span> Add Message (Base Board)
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                dominantMotif && (
                    <MotifPanel
                        isOpen={isMotifPanelOpen}
                        onClose={() => setIsMotifPanelOpen(false)}
                        dominantMotif={dominantMotif}
                        onColorChange={handleMotifColorChange}
                    />
                )
            }

            <CustomizationBottomSheet
                isOpen={activeCustomization !== null}
                onClose={() => setActiveCustomization(null)}
                title={
                    activeCustomization === 'options' ? 'Cake Options' :
                        activeCustomization === 'icing' ? 'Icing Colors' :
                            activeCustomization === 'messages' ? 'Cake Messages' :
                                activeCustomization === 'toppers' ? 'Cake Toppers' :
                                    activeCustomization === 'photos' ? 'Edible Photos' : 'Customize'
                }
                style={{ bottom: (67 + (availabilityType && !isAnalyzing ? 38 : 0) + (warningMessage ? 38 : 0)) + 'px' }}
                wrapperClassName="md:max-w-7xl md:mx-auto md:justify-end md:px-6"
                className="md:w-[calc(50%-6px)] md:max-w-none"
                actionButton={
                    activeCustomization === 'options' ? (
                        dirtyFields.has('cakeInfo') ? (
                            <button
                                onClick={() => setActiveCustomization(null)}
                                className="w-full bg-purple-600 text-purple-50 font-bold py-3 rounded-xl hover:shadow-lg hover:bg-purple-700 transition-all shadow-lg flex items-center justify-center gap-2"
                            >
                                <MagicSparkleIcon className="w-5 h-5" />
                                Apply Changes
                            </button>
                        ) : null
                    ) : activeCustomization === 'icing' ? (
                        (hasIcingChanges || isUpdatingDesign) ? (
                            <button
                                onClick={() => {
                                    onUpdateDesign();
                                    setActiveCustomization(null);
                                }}
                                disabled={isUpdatingDesign || !originalImageData}
                                className="w-full bg-purple-600 text-purple-50 font-bold py-3 rounded-xl hover:shadow-lg hover:bg-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUpdatingDesign ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <MagicSparkleIcon className="w-5 h-5" />
                                        Apply Changes
                                    </>
                                )}
                            </button>
                        ) : null
                    ) : activeCustomization === 'messages' ? (
                        hasMessageChanges ? (
                            <button
                                onClick={() => {
                                    onUpdateDesign();
                                    setActiveCustomization(null);
                                }}
                                disabled={isUpdatingDesign}
                                className="w-full bg-purple-600 text-purple-50 font-bold py-3 rounded-xl hover:shadow-lg hover:bg-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUpdatingDesign ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Updating Design...
                                    </>
                                ) : (
                                    <>
                                        <MagicSparkleIcon className="w-5 h-5" />
                                        Apply Changes
                                    </>
                                )}
                            </button>
                        ) : null
                    ) : activeCustomization === 'toppers' ? (
                        (hasToppersChanges || isUpdatingDesign) ? (
                            <button
                                onClick={() => {
                                    onUpdateDesign();
                                    setActiveCustomization(null);
                                }}
                                disabled={isUpdatingDesign}
                                className="w-full bg-purple-600 text-purple-50 font-bold py-3 rounded-xl hover:shadow-lg hover:bg-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUpdatingDesign ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Updating Design...
                                    </>
                                ) : (
                                    <>
                                        <MagicSparkleIcon className="w-5 h-5" />
                                        Apply Changes
                                    </>
                                )}
                            </button>
                        ) : null
                    ) : activeCustomization === 'photos' ? (
                        (hasPhotoChanges || isUpdatingDesign) ? (
                            <button
                                onClick={() => {
                                    onUpdateDesign();
                                    setActiveCustomization(null);
                                }}
                                disabled={isUpdatingDesign}
                                className="w-full bg-purple-600 text-purple-50 font-bold py-3 rounded-xl hover:shadow-lg hover:bg-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUpdatingDesign ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Updating Design...
                                    </>
                                ) : (
                                    <>
                                        <MagicSparkleIcon className="w-5 h-5" />
                                        Apply Changes
                                    </>
                                )}
                            </button>
                        ) : null
                    ) : null
                }
            >
                <div className={activeCustomization === 'options' ? 'block' : 'hidden'}>
                    {cakeInfo && (
                        <div className="space-y-4">
                            <CakeBaseOptions
                                cakeInfo={cakeInfo}
                                basePriceOptions={basePriceOptions}
                                onCakeInfoChange={onCakeInfoChange}
                                isAnalyzing={isAnalyzing}
                                addOnPricing={addOnPricing?.addOnPrice ?? 0}
                            />
                        </div>
                    )}
                </div>

                <div className={activeCustomization === 'icing' ? 'block' : 'hidden'}>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-slate-500">Customize your cake's colors and icing details.</p>
                            {hasIcingChanges && (
                                <button
                                    onClick={() => {
                                        if (analysisResult?.icing_design && icingDesign) {
                                            onIcingDesignChange({
                                                ...analysisResult.icing_design,
                                                dripPrice: icingDesign.dripPrice,
                                                gumpasteBaseBoardPrice: icingDesign.gumpasteBaseBoardPrice
                                            });
                                            onUpdateDesign();
                                            setSelectedItem(null);
                                            setActiveCustomization(null);
                                        }
                                    }}
                                    className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
                                >
                                    <ResetIcon className="w-3 h-3" />
                                    Revert
                                </button>
                            )}
                        </div>
                        <IcingToolbar
                            onSelectItem={setSelectedItem}
                            icingDesign={icingDesign}
                            cakeType={cakeInfo?.type || null}
                            isVisible={activeCustomization === 'icing'}
                            showGuide={false}
                            selectedItem={selectedItem}
                            mainToppers={mainToppers}
                        />
                        {/* Inline Icing Editor Panel */}
                        {selectedItem && 'itemCategory' in selectedItem && selectedItem.itemCategory === 'icing' && (
                            <div className="mt-2 pt-2 border-t border-slate-100 animate-fade-in">
                                {(() => {
                                    const description = selectedItem.description;
                                    const isBento = cakeInfo?.type === 'Bento';

                                    // Helper function for toggle + color picker (drip, borders, baseboard)
                                    const renderToggleAndColor = (
                                        featureKey: 'drip' | 'border_top' | 'border_base' | 'gumpasteBaseBoard',
                                        colorKey: keyof IcingColorDetails,
                                        label: string
                                    ) => {
                                        if (!icingDesign) return null;
                                        const isEnabled = icingDesign[featureKey];
                                        const isDisabled = (featureKey === 'border_base' || featureKey === 'gumpasteBaseBoard') && isBento;

                                        return (
                                            <>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-semibold text-slate-700">{label}</span>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={isEnabled || false}
                                                            disabled={isDisabled}
                                                            onChange={(e) => {
                                                                const newIcingDesign = { ...icingDesign, [featureKey]: e.target.checked };
                                                                if (e.target.checked && !newIcingDesign.colors[colorKey]) {
                                                                    newIcingDesign.colors = { ...newIcingDesign.colors, [colorKey]: '#FFFFFF' };
                                                                }
                                                                onIcingDesignChange(newIcingDesign);
                                                            }}
                                                        />
                                                        <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'peer-checked:bg-purple-600'}`}></div>
                                                    </label>
                                                </div>
                                                <div className={`transition-all duration-300 ${isDisabled ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-24 opacity-100'}`}>
                                                    <div className={`pb-2 transition-all duration-200 ${!isEnabled ? 'opacity-40 pointer-events-auto' : ''}`}>
                                                        <ColorPalette
                                                            selectedColor={icingDesign.colors[colorKey] || ''}
                                                            onColorChange={(newHex) => {
                                                                const newIcingDesign = {
                                                                    ...icingDesign,
                                                                    [featureKey]: true, // Ensure feature is enabled when color is picked
                                                                    colors: { ...icingDesign.colors, [colorKey]: newHex }
                                                                };
                                                                onIcingDesignChange(newIcingDesign);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    };

                                    // Helper function for color picker only (top/side icing)
                                    const renderColorOnly = (colorKey: keyof IcingColorDetails, label: string) => {
                                        if (!icingDesign) return null;
                                        return (
                                            <div className="pb-2">
                                                <ColorPalette
                                                    selectedColor={icingDesign.colors[colorKey] || ''}
                                                    onColorChange={(newHex) => {
                                                        onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: newHex } });
                                                    }}
                                                />
                                            </div>
                                        );
                                    };

                                    // Helper function for combined icing color picker
                                    const renderCombinedIcingColor = () => {
                                        if (!icingDesign) return null;
                                        const currentColor = icingDesign.colors.top || icingDesign.colors.side || '#FFFFFF';
                                        return (
                                            <div className="pb-2">
                                                <ColorPalette
                                                    selectedColor={currentColor}
                                                    onColorChange={(newHex) => {
                                                        onIcingDesignChange({
                                                            ...icingDesign,
                                                            colors: {
                                                                ...icingDesign.colors,
                                                                top: newHex,
                                                                side: newHex
                                                            }
                                                        });
                                                    }}
                                                />
                                            </div>
                                        );
                                    };

                                    // Switch based on description to render appropriate editor
                                    switch (description) {
                                        case 'Drip':
                                            return renderToggleAndColor('drip', 'drip', 'Drip Effect');
                                        case 'Top':
                                            return renderToggleAndColor('border_top', 'borderTop', 'Top Border');
                                        case 'Bottom':
                                            return renderToggleAndColor('border_base', 'borderBase', 'Base Border');
                                        case 'Board':
                                            return renderToggleAndColor('gumpasteBaseBoard', 'gumpasteBaseBoardColor', 'Covered Board');
                                        case 'Body Icing':
                                            return renderCombinedIcingColor();
                                        case 'Top Icing':
                                            return renderColorOnly('top', 'Top Icing Color');
                                        case 'Side Icing':
                                            return renderColorOnly('side', 'Side Icing Color');
                                        default:
                                            return <p className="p-2 text-xs text-slate-500">Select an icing feature to edit.</p>;
                                    }
                                })()}
                            </div>
                        )}
                    </div>
                </div>

                <div className={activeCustomization === 'messages' ? 'block' : 'hidden'}>
                    <CakeMessagesOptions
                        cakeMessages={cakeMessages}
                        markerMap={markerMap}
                        onItemClick={handleListItemClick}
                        addCakeMessage={addCakeMessage}
                        updateCakeMessage={updateCakeMessage}
                        removeCakeMessage={removeCakeMessage}
                    />
                </div>

                <div className={activeCustomization === 'toppers' ? 'block' : 'hidden'}>
                    <CakeToppersOptions
                        mainToppers={mainToppers}
                        supportElements={supportElements}
                        markerMap={markerMap}
                        updateMainTopper={updateMainTopper}
                        updateSupportElement={updateSupportElement}
                        onTopperImageReplace={onTopperImageReplace}
                        onSupportElementImageReplace={onSupportElementImageReplace}
                        itemPrices={itemPrices}
                        isAdmin={isAdmin}
                        isAnalyzing={isAnalyzing}
                    />
                </div>

                <div className={activeCustomization === 'photos' ? 'block' : 'hidden'}>
                    <div className="space-y-4">
                        {/* Logic to show Edible Photo options */}
                        {(() => {
                            const ediblePhotoTopper = mainToppers.find(t => t.original_type === 'edible_photo_top');
                            const ediblePhotoSupport = supportElements.find(s => s.original_type === 'edible_photo_side');

                            const photos = [];
                            if (ediblePhotoTopper) photos.push({ ...ediblePhotoTopper, category: 'topper' as const });
                            if (ediblePhotoSupport) photos.push({ ...ediblePhotoSupport, category: 'element' as const });

                            if (photos.length === 0) {
                                return (
                                    <div className="text-center p-8 text-slate-500">
                                        <p>No edible photos detected on this cake.</p>
                                        <p className="text-xs mt-2">Edible photos are only available if the AI detected them in the original design.</p>
                                    </div>
                                );
                            }

                            return photos.map((photo, index) => (
                                <div key={photo.id} className="border border-slate-200 rounded-xl p-4">
                                    <h3 className="font-bold text-slate-700 mb-2">
                                        {photo.category === 'topper' ? 'Top Photo' : 'Side Photo'}
                                    </h3>
                                    <TopperCard
                                        item={photo}
                                        type={photo.category}
                                        marker={markerMap.get(photo.id)}
                                        expanded={true}
                                        onToggle={() => { }}
                                        updateItem={(updates) => {
                                            if (photo.category === 'topper') {
                                                updateMainTopper(photo.id, updates);
                                            } else {
                                                updateSupportElement(photo.id, updates);
                                            }
                                        }}
                                        onImageReplace={(file) => {
                                            if (photo.category === 'topper') {
                                                onTopperImageReplace(photo.id, file);
                                            } else {
                                                onSupportElementImageReplace(photo.id, file);
                                            }
                                        }}
                                        itemPrice={itemPrices?.get(photo.id)}
                                        isAdmin={isAdmin}
                                    />
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </CustomizationBottomSheet>

            {/* Related Designs Section */}
            {displayedRelatedDesigns && displayedRelatedDesigns.length > 0 && (
                <div className="w-full py-6 mb-24">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">You May Also Like</h2>
                    <div className="flex flex-wrap justify-center gap-3">
                        {displayedRelatedDesigns.map((related, i) => (
                            <Link
                                key={`${related.slug}-${i}`}
                                href={`/customizing/${related.slug}`}
                                className="w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] lg:w-[calc(16.667%-10px)] bg-white p-3 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-gray-100 transition-all duration-300 group cursor-pointer h-full flex flex-col"
                                aria-label={`View ${related.keywords || 'custom'} cake design`}
                                tabIndex={0}
                            >
                                <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                    {related.original_image_url && (
                                        <LazyImage
                                            src={related.original_image_url}
                                            alt={related.alt_text || `${related.keywords || 'Custom'} cake design`}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                                            imageClassName="object-cover group-hover:scale-110 transition-transform duration-500"
                                            unoptimized
                                        />
                                    )}
                                    {/* Overlay Gradient on Hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>

                                    {/* Heart Button (decorative) */}
                                    <div className="absolute top-3 right-3 w-8 h-8 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm bg-white/90 text-gray-600 z-10">
                                        <Heart size={16} />
                                    </div>

                                    {/* Affordable Tag */}
                                    <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shadow-sm z-10">
                                        Affordable
                                    </span>
                                </div>

                                <div className="px-1 flex flex-col flex-1">
                                    <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-purple-600 transition-colors capitalize">
                                        {related.keywords || 'Custom Cake'}
                                    </h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-auto">
                                        <Cake size={12} /> 1 Tier
                                    </p>
                                    <div className="flex justify-between items-end border-t border-gray-50 pt-3 mt-3">
                                        <span className="font-black text-gray-900 text-base">
                                            ₱{related.price ? Math.round(related.price).toLocaleString() : '999'}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                                            <Star size={12} fill="currentColor" /> 5.0
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Show More Button */}
                    {hasMoreDesigns && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={handleLoadMoreDesigns}
                                disabled={isLoadingMoreDesigns}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                                aria-label="Show more related designs"
                            >
                                {isLoadingMoreDesigns ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Loading...
                                    </>
                                ) : (
                                    'Show More Designs'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <StickyAddToCartBar
                price={finalPrice}
                isLoading={isFetchingBasePrice}
                isAdding={isAddingToCart}
                error={basePriceError}
                onAddToCartClick={onAddToCart}
                onShareClick={onShare}
                isSharing={isSharing}
                canShare={!!analysisResult}
                isAnalyzing={isAnalyzing}
                cakeInfo={cakeInfo}
                warningMessage={isSafetyFallback ? "AI editing disabled for adult-themed content. Your design changes will still be saved." : warningMessage}
                warningDescription={warningDescription}
                onWarningClick={warningMessage && !isSafetyFallback ? () => setActiveCustomization('toppers') : undefined}
                availability={availabilityType}
            />
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onSubmit={handleReport}
                isSubmitting={isReporting}
                editedImage={editedImage}
                details={analysisResult ? buildCartItemDetails() : null}
                cakeInfo={cakeInfo}
            />
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={closeShareModal}
                shareData={shareData}
                onCreateLink={createShareLink}
                isSaving={isSavingDesign}
                finalPrice={finalPrice}
                imageUrl={editedImage || originalImagePreview || ''}
            />
        </div >
    </>);
};

export default CustomizingClient;
