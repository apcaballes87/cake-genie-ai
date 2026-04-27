'use client';

import dynamic from 'next/dynamic';
import React, { Dispatch, SetStateAction, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useSmartBack } from '@/hooks/useSmartBack';
import { useNavigation } from '@/contexts/NavigationContext';
import { v4 as uuidv4 } from 'uuid';
import { findClosestColor, hexToColorNameProse } from '@/utils/colorUtils';
import { generateDesignDetails, generateRichAltText } from '@/utils/designContentUtils';
import { X, Wand2, Palette, MessageSquare, PartyPopper, Image as ImageIconLucide, Cake, Zap, Clock, CalendarDays, ChevronRight } from 'lucide-react';

import { SegmentationOverlay } from '../../components/SegmentationOverlay';
import { SegmentationBottomSheet } from '../../components/SegmentationBottomSheet';
import { CustomizationSkeleton } from '../../components/LoadingSkeletons';
import { BackIcon, UserCircleIcon, LogOutIcon, MapPinIcon, PackageIcon, TrashIcon } from '../../components/icons';
import SameDayCutoffBanner from '@/components/SameDayCutoffBanner';
import { ShoppingBag } from 'lucide-react';
import { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, BasePriceInfo, CakeType, CakeSize, CakeThickness, AvailabilitySettings, IcingColorDetails, AnalysisItem, ClusteredMarker, CartItem } from '../../types';
import { CakeGenieCartItem, CakeGenieMerchant, CakeGenieMerchantProduct } from '../../lib/database.types';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { AvailabilityType } from '../../lib/utils/availability';

import {
    COLORS,
    CAKE_TYPE_THUMBNAILS,
    CAKE_SIZE_THUMBNAILS,
    CAKE_THICKNESS_THUMBNAILS,
    FLAVOR_THUMBNAILS,
    DEFAULT_ICING_DESIGN,
    THICKNESS_OPTIONS_MAP,
    getEquivalentCakeSizeForIcingBase,
    getEquivalentCakeTypeForIcingBase,
    inferIcingBaseFromCakeType,
} from '@/constants';
import { ColorPalette } from '../../components/ColorPalette';
import StickyAddToCartBar from '../../components/StickyAddToCartBar';
import { showSuccess, showError, showInfo } from '../../lib/utils/toast';
import { reportCustomization, uploadReportImage, getAnalysisByExactHash, getRelatedProductsByKeywords, getCollectionsForDesign } from '../../services/supabaseService';
import { trackViewItem } from '@/lib/analytics';
import ReportModal from '../../components/ReportModal';
import ShareModal from '../../components/ShareModal';
import ChatModal from '../../components/ChatModal';
import { CartItemDetails } from '../../types';
import { buildKnownSeoMetadata } from './knownSeoMetadata';
import { getRefLoadStrategy, parsePersistedAnalysis } from './refLoadStrategy';
import {
    CustomizingDiscoverySections,
    type CustomizingRelatedDesign,
} from './CustomizingDiscoverySections';
import { CustomizingPostAnalysisContent } from './CustomizingPostAnalysisContent';
import {
    cleanDisplayTitle,
    CustomizingPageMetaHeader,
    CustomizingSupplementalContent,
    getRecentSearchDisplayTitle,
} from './CustomizingPageMetaSections';
import { CustomizingEditorSheet } from './CustomizingEditorSheet';
import { CustomizingHeroPanel } from './CustomizingHeroPanel';
import { CustomizingIcingEditorPanel } from './CustomizingIcingEditorPanel';
import { CustomizingInstructionsPanel } from './CustomizingInstructionsPanel';
import { CustomizingMessagesPanel } from './CustomizingMessagesPanel';
import { CustomizingOptionsPanel } from './CustomizingOptionsPanel';
import { CakeFlavorBottomSheet } from '@/components/CakeFlavorBottomSheet';
import { CustomizingPhotosPanel } from './CustomizingPhotosPanel';
import { CustomizingSidebarPanel } from './CustomizingSidebarPanel';
import { CustomizingStepSummarySections } from './CustomizingStepSummarySections';
import { CustomizingAiChatPanel } from './CustomizingAiChatPanel';
import { CustomizingToppersPanel } from './CustomizingToppersPanel';
import {
    buildRetryUploadUrl,
    buildRelatedCollectionsRequestKey,
    getAutoRelatedDesignRequest,
    shouldHydrateImageFromExistingAnalysis,
    shouldLoadPropDesign,
    shouldLogShopifyCseMount,
} from './customizingClientGuards';

const PreSelectionModal = dynamic(
    () => import('@/components/PreSelectionModal').then((mod) => mod.PreSelectionModal),
    { ssr: false }
);
const ImageUploader = dynamic(
    () => import('@/components/ImageUploader').then((mod) => mod.ImageUploader),
    { ssr: false }
);

// Hooks
import { useCakeCustomization, type CustomizationState } from '@/contexts/CustomizationContext';
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
import { buildAiChatPromptSuggestions, shouldShowAiPromptSuggestion } from '@/utils/aiPromptSuggestions';
import { fillAiChatPromptTemplate, parseAiChatPromptTemplate, ParsedAiChatPromptTemplate } from '@/utils/aiChatPromptComposer';
import { mapAnalysisToState } from '@/utils/customizationMapper';
import type { DesignPromptGenerator } from '@/hooks/useDesignUpdate';
import { createClient } from '@/lib/supabase/client';
import {
    buildToyToPrintoutInstruction,
    isToyLikeType,
    requestMentionsPrintoutConversion,
} from '@/utils/printoutConversionPrompt';
import { buildDecorLocalizationHint } from '@/utils/editImageTuning';

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

const AI_CHAT_USER_REQUEST_REGEX = /\[USER REQUEST\]:\s*(.*)/;

const AI_CHAT_IMAGE_PROMPT_GENERATOR: DesignPromptGenerator = (
    _originalAnalysis,
    newCakeInfo,
    mainToppers,
    _supportElements,
    _cakeMessages,
    _icingDesign,
    additionalInstructions,
) => {
    const userRequest = additionalInstructions.match(AI_CHAT_USER_REQUEST_REGEX)?.[1]?.trim()
        ?? additionalInstructions.trim();

    const toyToPrintoutTargets = requestMentionsPrintoutConversion(userRequest)
        ? mainToppers.filter(topper =>
            topper.isEnabled && isToyLikeType(topper.original_type || topper.type)
        )
        : [];

    const changes = [
        `- **⚡ PRIMARY USER REQUEST (HIGHEST PRIORITY):** ${userRequest}. Apply this user request directly to the cake image.`,
        ...toyToPrintoutTargets.slice(0, 3).map(topper => {
            const localizationHint = buildDecorLocalizationHint(topper);

            return `- **Material conversion detail:** ${buildToyToPrintoutInstruction({
                description: topper.description,
                originalType: topper.original_type || topper.type,
            })}${localizationHint ? ` ${localizationHint}` : ''}`;
        }),
        toyToPrintoutTargets.length > 3
            ? `- Apply the same toy-to-printout conversion treatment to the remaining ${toyToPrintoutTargets.length - 3} toy-derived topper(s) as well.`
            : null,
        newCakeInfo?.size ? `- Preserve the final **cake size** as "${newCakeInfo.size}".` : null,
        '- Preserve all other cake details that the user did not mention.',
    ].filter(Boolean).join('\n');

    return `---
### **List of Changes to Apply**
---

${changes}`;
};

const AVAILABILITY_MAP: Record<AvailabilityType, AvailabilityInfo> = {
    rush: {
        type: 'rush',
        label: 'Rush Order Available!',
        time: 'Ready in 60 minutes',
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

const MotifPanel: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    dominantMotif: { hex: string; name: string };
    onColorChange: (newHex: string) => void;
}> = ({ isOpen, onClose, dominantMotif, onColorChange }) => {
    if (!isOpen) return null;

    return (
        <div className={`fixed bottom-28 right-4 w-80 max-w-[90vw] bg-white/90 backdrop-blur-lg shadow-2xl border border-slate-200 z-100 flex flex-col transform rounded-xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'}`}>
            <div className="p-4 flex justify-between items-center border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-800">Change Motif Color</h2>
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
    studio_edited_image_url?: string | null;
    price: number | null;
    keywords: string | null;
    analysis_json: any;
    slug: string | null;
    alt_text: string | null;
    seo_title: string | null;
    seo_description: string | null;
    created_at: string;
    availability?: string | null;
    tags?: string[] | null;
}

const firstNonBlankImageUrl = (...urls: unknown[]) => {
    for (const url of urls) {
        if (typeof url === 'string' && url.trim()) {
            return url.trim();
        }
    }

    return null;
};

interface CustomizingClientProps {
    product?: CakeGenieMerchantProduct;
    merchant?: CakeGenieMerchant;
    recentSearchDesign?: RecentSearchDesignProp;
    productDetails?: React.ReactNode;
    initialPrices?: BasePriceInfo[];
    relatedDesigns?: CustomizingRelatedDesign[];
    currentKeywords?: string | null;
    currentSlug?: string | null;
    seoContentSlot?: React.ReactNode;
    postEditorSlot?: React.ReactNode;
    initialCaption?: string;
    preloadSource?: string;
    preloadImageUrl?: string;
    hideAiChat?: boolean;
    isCombining?: boolean;
    clearMessageTexts?: boolean;
    hideStickyBar?: boolean;
    useBasePriceAsFallback?: boolean;
    ediblePhotoAddonPrice?: number;
    separateIcingStep?: boolean;
    hideBanner?: boolean;
    hideStepOne?: boolean;
    hideStepFour?: boolean;
    photoStepNode?: React.ReactNode;
}

const CustomizingClient: React.FC<CustomizingClientProps> = ({ product, merchant, recentSearchDesign, productDetails, initialPrices, relatedDesigns, currentKeywords, currentSlug, seoContentSlot, postEditorSlot, initialCaption, preloadSource, preloadImageUrl, hideAiChat = false, isCombining = false, clearMessageTexts = false, hideStickyBar = false, useBasePriceAsFallback = false, ediblePhotoAddonPrice = 0, separateIcingStep = false, hideBanner = false, hideStepOne = false, hideStepFour = false, photoStepNode = null }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams();
    const slug = params?.slug || currentSlug;
    const supabase = useMemo(() => createClient(), []);

    // Smart back navigation
    const { goBack } = useSmartBack('customizing');
    const { navigationState, recordNavigation } = useNavigation();

    // Record navigation when entering customizing page (for direct visits)
    useEffect(() => {
        if (!navigationState.entrySource) {
            recordNavigation('customizing', 'direct');
        }
    }, [recordNavigation, navigationState.entrySource]);

    // Hide the SSR fallback content once the interactive client has mounted.
    // SSRCakeDetails is visible on initial paint for Googlebot image crawlability,
    // then hidden here to avoid duplication with the interactive UI.
    useEffect(() => {
        const ssrContent = document.getElementById('ssr-content');
        if (ssrContent) ssrContent.style.display = 'none';
    }, []);

    // GA4: fire view_item once per design mount (price may be a fallback
    // before AI analysis completes; still useful for funnel counting).
    const viewItemFiredRef = useRef(false);
    useEffect(() => {
        if (viewItemFiredRef.current) return;
        const itemId = product?.product_id || recentSearchDesign?.slug || recentSearchDesign?.p_hash || (typeof slug === 'string' ? slug : null);
        if (!itemId) return;
        const itemName = product?.title || recentSearchDesign?.seo_title || 'custom-cake';
        const price = (product?.custom_price && product.custom_price > 0)
            ? product.custom_price
            : (recentSearchDesign?.price && recentSearchDesign.price > 0)
                ? recentSearchDesign.price
                : 1099;
        trackViewItem({
            item_id: String(itemId),
            item_name: itemName,
            price,
            item_category: product?.category || recentSearchDesign?.keywords || undefined,
        });
        viewItemFiredRef.current = true;
    }, [product, recentSearchDesign, slug]);

    // --- Context Hooks ---
    const { user, isAuthenticated } = useAuth();
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
        getSyncedAnalysisResult,
        clearDirtyState,
        applyFullCustomizationState,
        chatHistory, addChatEntry,
    } = useCakeCustomization();

    const {
        originalImageData, sourceImageData, previousImageData, originalImagePreview, editedImage, threeTierReferenceImage,
        isLoading: isImageManagementLoading, error: imageManagementError,
        setEditedImage, setError: setImageManagementError, setOriginalImageData, setPreviousImageData,
        handleImageUpload: hookImageUpload, handleSave, uploadCartImages, clearImages,
        loadImageWithoutAnalysis, setCurrentSlug, currentSlug: persistedSlug,
        seoMetadata, isAnalysisCached,
    } = useImageManagement();

    // --- Local State ---
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isPreSelectionModalOpen, setIsPreSelectionModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [reportStatus, setReportStatus] = useState<'success' | 'error' | null>(null);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const [pendingCartItems, setPendingCartItems] = useState<CartItem[]>([]);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [isPreparingSharedDesign, setIsPreparingSharedDesign] = useState(false);
    const [previousUIState, setPreviousUIState] = useState<CustomizationState | null>(null);
    const committedStateRef = useRef<CustomizationState | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [showAiPromptSuggestions, setShowAiPromptSuggestions] = useState(false);
    const [selectedAiPromptIndex, setSelectedAiPromptIndex] = useState(-1);
    const [selectedAiPromptTemplate, setSelectedAiPromptTemplate] = useState<ParsedAiChatPromptTemplate | null>(null);
    const [selectedAiPromptColor, setSelectedAiPromptColor] = useState('');
    const [showAiPromptColorPicker, setShowAiPromptColorPicker] = useState(false);
    const addToCartInFlightRef = useRef(false);
    const addToCartResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Open pre-selection modal when arriving from search with analysis already in progress
    // (analysis was started in SearchingClient before navigating here)
    // DISABLED: Preselection modal disabled for now
    // useEffect(() => {
    //     const urlParams = new URLSearchParams(window.location.search);
    //     if (urlParams.get('from') === 'search' && isAnalyzing && !isPreSelectionModalOpen) {
    //         setIsPreSelectionModalOpen(true);
    //     }
    // }, []); // Run once on mount

    useEffect(() => {
        return () => {
            if (addToCartResetTimeoutRef.current !== null) {
                clearTimeout(addToCartResetTimeoutRef.current);
            }
        };
    }, []);

    const handleImageSelect = useCallback((file: File) => {
        // Clear previous state to avoid mixing old analysis with new one
        clearCustomization();
        clearImages();
        setIsUploaderOpen(false);
        setActiveTab('original');
        setAnalysisError(null);
        setPreloadedHeroImage(null);
        setIsAnalyzing(true);
        // DISABLED: Preselection modal disabled
        // setIsPreSelectionModalOpen(true);

        // Use the hook to upload and analyze
        hookImageUpload(
            file,
            (result: HybridAnalysisResult) => {
                console.log('Analysis successful:', result);
                setPendingAnalysisData(result);
                setIsAnalyzing(false);
            },
            (err: Error) => {
                console.warn('Analysis failed:', err.message);
                setIsAnalyzing(false);
                setAnalysisError(err.message);
                // DISABLED: Preselection modal disabled
                // setIsPreSelectionModalOpen(false);
            }
        );
    }, [clearCustomization, clearImages, setAnalysisError, setIsAnalyzing, hookImageUpload, setPendingAnalysisData]);

    const handlePreSelectionApply = useCallback((preSelectedCakeInfo: CakeInfoUI) => {
        handleCakeInfoChange(preSelectedCakeInfo);
        setIsPreSelectionModalOpen(false);
    }, [handleCakeInfoChange]);

    const handlePreSelectionClose = useCallback(() => {
        setIsPreSelectionModalOpen(false);
    }, []);


    // Preloaded image from SSR for Shopify CSE handoff - shows immediately while processing
    const [preloadedHeroImage, setPreloadedHeroImage] = useState<string | null>(preloadImageUrl || null);

    // Sync preloadImageUrl to state on mount (from SSR)
    useEffect(() => {
        if (preloadImageUrl && !preloadedHeroImage) {
            setPreloadedHeroImage(preloadImageUrl);
        }
    }, [preloadImageUrl]);

    // Related Designs Pagination State
    const [displayedRelatedDesigns, setDisplayedRelatedDesigns] = useState<CustomizingRelatedDesign[]>(relatedDesigns || []);
    const [isLoadingMoreDesigns, setIsLoadingMoreDesigns] = useState(false);
    const [hasMoreDesigns, setHasMoreDesigns] = useState(true);

    // Track "committed" state = UI state that matches the currently displayed image.
    // Only updates when dirty state is cleared (after analysis apply or design update sync).
    useEffect(() => {
        if (!isCustomizationDirty) {
            committedStateRef.current = {
                cakeInfo, mainToppers, supportElements, cakeMessages,
                icingDesign, additionalInstructions, analysisResult, analysisId,
            };
        }
    }, [isCustomizationDirty, cakeInfo, mainToppers, supportElements, cakeMessages,
        icingDesign, additionalInstructions, analysisResult, analysisId]);

    // --- Refs ---
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const mainImageContainerRef = useRef<HTMLDivElement>(null);
    const isLoadingDesignRef = useRef(false); // Guard against duplicate analysis calls
    const isLoadingShopifyCseRef = useRef(false); // Guard against duplicate Shopify CSE loads
    const isResettingRef = useRef(false); // Guard against reloading the current design during Reset Everything
    const lastProcessedDesignRefUrl = useRef<string | null>(null);
    const lastAutoRelatedDesignRequestKeyRef = useRef<string | null>(null);
    const aiChatMobileContainerRef = useRef<HTMLFormElement>(null);
    const aiChatDesktopContainerRef = useRef<HTMLFormElement>(null);
    const aiChatMobileInputRef = useRef<HTMLInputElement>(null);
    const aiChatDesktopInputRef = useRef<HTMLInputElement>(null);

    const getActiveChatContainer = () => {
        if (typeof window === 'undefined') return null;
        return window.innerWidth >= 768 ? aiChatDesktopContainerRef.current : aiChatMobileContainerRef.current;
    };
    const getActiveChatInput = () => {
        if (typeof window === 'undefined') return null;
        return window.innerWidth >= 768 ? aiChatDesktopInputRef.current : aiChatMobileInputRef.current;
    };


    // --- Hooks ---
    const { addOnPricing, itemPrices, basePriceOptions: hookBasePriceOptions, isFetchingBasePrice, basePriceError, basePrice, finalPrice } = usePricing({
        analysisResult, mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo, onCakeInfoCorrection: handleCakeInfoChange, analysisId, merchantId: merchant?.merchant_id
    });

    // Use initialPrices for SSR if hook data isn't ready yet
    const basePriceOptions = useMemo(() => {
        if (hookBasePriceOptions && hookBasePriceOptions.length > 0) return hookBasePriceOptions;
        return initialPrices || [];
    }, [hookBasePriceOptions, initialPrices]);

    const autoRelatedDesignRequest = useMemo(() => getAutoRelatedDesignRequest({
        currentKeywords,
        recentSearchKeywords: recentSearchDesign?.keywords,
        analysisKeyword: analysisResult?.keyword,
        currentSlug,
        persistedSlug,
        recentSearchSlug: recentSearchDesign?.slug,
    }), [currentKeywords, recentSearchDesign?.keywords, analysisResult?.keyword, currentSlug, persistedSlug, recentSearchDesign?.slug]);

    const aiChatSuggestionAnalysis = useMemo(() => {
        // Prefer the current synced customization state, but fall back to the original design image analysis_json.
        return getSyncedAnalysisResult()
            || analysisResult
            || (recentSearchDesign?.analysis_json as HybridAnalysisResult | null | undefined)
            || null;
    }, [analysisResult, getSyncedAnalysisResult, recentSearchDesign?.analysis_json]);

    const aiChatPromptSuggestions = useMemo(
        () => buildAiChatPromptSuggestions(aiChatSuggestionAnalysis, { cakeInfo, basePriceOptions }),
        [aiChatSuggestionAnalysis, basePriceOptions, cakeInfo]
    );

    const aiChatPromptSuggestionItems = useMemo(() => (
        aiChatPromptSuggestions.map(suggestion => ({
            suggestion,
            template: parseAiChatPromptTemplate(suggestion),
        }))
    ), [aiChatPromptSuggestions]);
    const hasAiChatPromptSuggestions = aiChatPromptSuggestions.length > 0;

    const filteredAiChatPromptSuggestions = useMemo(() => {
        const normalizedQuery = chatInput.trim().toLowerCase();
        return aiChatPromptSuggestionItems.filter(({ suggestion, template }) => {
            const normalizedSuggestion = suggestion.toLowerCase();
            const isIcingRelated = normalizedSuggestion.includes('icing') || normalizedSuggestion.includes('drip') || normalizedSuggestion.includes('border') || normalizedSuggestion.includes('board');
            if (!isIcingRelated) return false;

            return shouldShowAiPromptSuggestion(suggestion, normalizedQuery)
                && (!normalizedQuery || `${suggestion} ${template?.placeholderLabel ?? ''}`
                    .toLowerCase()
                    .includes(normalizedQuery));
        });
    }, [aiChatPromptSuggestionItems, chatInput]);

    const {
        isLoading: isUpdatingDesign, error: designUpdateError, lastGenerationInfoRef, handleUpdateDesign, setError: setDesignUpdateError, isSafetyFallback
    } = useDesignUpdate({
        originalImageData, editedImage, analysisResult, cakeInfo, mainToppers, supportElements, cakeMessages,
        icingDesign, additionalInstructions, threeTierReferenceImage,
        onSuccess: (editedImageResult: string, baseImageData) => {
            // Save the committed state (matches the previous image) for undo.
            // committedStateRef tracks state from before user edits, so it won't
            // contain the user's latest changes captured by the closure.
            setPreviousUIState(committedStateRef.current);

            setEditedImage(editedImageResult);
            setActiveTab('customized');
            setPreviousImageData(baseImageData);
            syncAnalysisResultWithCurrentState();
            clearDirtyState();
        },
    });


    const { isShareModalOpen, shareData, isSavingDesign, handleShare, createShareLink, closeShareModal } = useDesignSharing({
        slug: (persistedSlug || slug || seoMetadata?.slug) as string || null,
        originalImageUrl: seoMetadata?.original_image_url || null,
    });

    const handleChatClick = React.useCallback(() => {
        setIsChatModalOpen(true);
    }, []);

    const knownSeoMetadata = useMemo(
        () => buildKnownSeoMetadata(product, recentSearchDesign),
        [product, recentSearchDesign]
    );

    const recentSearchRichAlt = useMemo(() => {
        if (!recentSearchDesign) return null;

        return generateRichAltText({
            ...recentSearchDesign,
            analysis_json: recentSearchDesign.analysis_json ?? {},
            tags: recentSearchDesign.tags ?? [],
        });
    }, [recentSearchDesign]);

    const pageDisplayTitle = useMemo(() => {
        if (product?.title) return cleanDisplayTitle(product.title) || product.title;
        if (recentSearchDesign) return getRecentSearchDisplayTitle(recentSearchDesign);
        return cleanDisplayTitle(seoMetadata?.seo_title) || 'Customize Your Cake Design';
    }, [product?.title, recentSearchDesign, seoMetadata?.seo_title]);

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
    const handleLoadMoreDesigns = useCallback(async () => {
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
            // Silently handle discovery error
        } finally {
            setIsLoadingMoreDesigns(false);
        }
    }, [
        currentKeywords,
        currentSlug,
        displayedRelatedDesigns.length,
        hasMoreDesigns,
        isLoadingMoreDesigns,
        recentSearchDesign?.keywords,
        recentSearchDesign?.slug,
    ]);

    // Auto-load related designs when analysis is complete
    useEffect(() => {
        if (!autoRelatedDesignRequest) return;

        // Don't auto-load if we already have items (prevent dupes or overriding props)
        if (displayedRelatedDesigns.length > 0) return;

        // Don't auto-load if we're currently loading
        if (isLoadingMoreDesigns) return;

        if (lastAutoRelatedDesignRequestKeyRef.current === autoRelatedDesignRequest.key) return;

        lastAutoRelatedDesignRequestKeyRef.current = autoRelatedDesignRequest.key;

        const fetchRelated = async () => {
            setIsLoadingMoreDesigns(true);
            try {
                // Use the most relevant keyword for the first batch
                const { data } = await getRelatedProductsByKeywords(
                    autoRelatedDesignRequest.keyword,
                    autoRelatedDesignRequest.slug,
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
                lastAutoRelatedDesignRequestKeyRef.current = null;
                // Silently handle discovery error
            } finally {
                setIsLoadingMoreDesigns(false);
            }
        };

        fetchRelated();
    }, [autoRelatedDesignRequest, displayedRelatedDesigns.length, isLoadingMoreDesigns]);

    // --- AI Chat Customization Handler ---
    const onAddToCart = useCallback(async () => {
        if (addToCartInFlightRef.current) return;

        const effectivePrice = finalPrice ?? (useBasePriceAsFallback ? basePrice : null);
        if (!effectivePrice || !cakeInfo) return;

        addToCartInFlightRef.current = true;
        setIsAddingToCart(true);

        try {
            let cartUser = user;

            if (!cartUser) {
                const { data: { user: liveUser }, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                cartUser = liveUser;
            }

            if (!cartUser) {
                throw new Error('Your cart session is still loading. Please try again in a moment.');
            }

            // 1. Prepare Base64 placeholders for immediate optimistic display
            const optimisticOriginal = originalImagePreview || '';
            const optimisticCustomized = editedImage || '';

            // 2. Start Upload in Background (Do NOT await)
            const uploadPromise = uploadCartImages({
                editedImageDataUri: editedImage,
                userId: cartUser.id,
                slug: typeof slug === 'string' ? slug : undefined
            });

            const cartItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'> = {
                user_id: cartUser.is_anonymous ? null : cartUser.id,
                session_id: cartUser.is_anonymous ? cartUser.id : null,
                merchant_id: null, // Will be set when ordering from a specific merchant shop
                product_id: product?.product_id || null,
                cake_type: cakeInfo.type,
                cake_thickness: cakeInfo.thickness,
                cake_size: cakeInfo.size,
                base_price: basePrice || 0,
                addon_price: (effectivePrice || 0) - (basePrice || 0) + ediblePhotoAddonPrice,
                final_price: (effectivePrice || 0) + ediblePhotoAddonPrice,
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
                    additionalInstructions: additionalInstructions,
                    chat_history: chatHistory
                }
            };

            // 4. Fire-and-forget: optimistic update happens instantly, upload runs in background
            // No await needed - function returns immediately after optimistic update
            void addToCartWithBackgroundUpload(cartItem, uploadPromise);

            showSuccess('Added to cart!');
            router.push('/cart');
        } catch (err) {
            addToCartInFlightRef.current = false;
            setIsAddingToCart(false);
            showError('Failed to add to cart: ' + (err instanceof Error ? err.message : 'Unknown error'));
            return;
        }

        addToCartResetTimeoutRef.current = setTimeout(() => {
            addToCartInFlightRef.current = false;
            setIsAddingToCart(false);
        }, 1000);
    }, [
        finalPrice,
        useBasePriceAsFallback,
        cakeInfo,
        originalImagePreview,
        editedImage,
        uploadCartImages,
        user,
        basePrice,
        mainToppers,
        supportElements,
        cakeMessages,
        icingDesign,
        additionalInstructions,
        addToCartWithBackgroundUpload,
        ediblePhotoAddonPrice,
        chatHistory,
        product?.product_id,
        router,
        slug,
        supabase,
    ]);

    const submitAiChatPrompt = useCallback(async (prompt: string) => {

        const currentPrompt = prompt.trim();
        if (!currentPrompt || !analysisResult || isAiProcessing || isUpdatingDesign) return;

        const traceId = `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let resolveMergedAnalysis: ((value: HybridAnalysisResult) => void) | undefined;
        let rejectMergedAnalysis: ((reason?: unknown) => void) | undefined;

        setIsAiProcessing(true);
        setChatInput('');
        addChatEntry(currentPrompt);

        try {
            const syncedAnalysis = getSyncedAnalysisResult() || analysisResult;
            const mergedAnalysisReady = new Promise<HybridAnalysisResult>((resolve, reject) => {
                resolveMergedAnalysis = resolve;
                rejectMergedAnalysis = reject;
            });

            // 1. Fire Image Edit (runs in background, hook manages state/error)
            // We keep this fully parallel and drive the first image pass directly from the
            // raw user request + normal image-edit system instruction selection.
            const imageUpdatePromise = handleUpdateDesign(`[USER REQUEST]: ${currentPrompt}`, {
                traceId,
                source: 'ai-chat-image-edit',
                promptGenerator: AI_CHAT_IMAGE_PROMPT_GENERATOR,
            });

            imageUpdatePromise.catch(err => {
                void (async () => {
                    try {
                        const mergedAnalysisForRetry = await mergedAnalysisReady;
                        const mappedState = mapAnalysisToState(mergedAnalysisForRetry);
                        const fallbackCakeInfo = cakeInfo ? {
                            ...cakeInfo,
                            type: mergedAnalysisForRetry.cakeType ?? cakeInfo.type,
                            thickness: mergedAnalysisForRetry.cakeThickness ?? cakeInfo.thickness,
                        } : mappedState.cakeInfo ?? null;

                        if (!fallbackCakeInfo || !mappedState.icingDesign) {
                            throw err;
                        }

                        await handleUpdateDesign(`[USER REQUEST]: ${currentPrompt}`, {
                            traceId: `${traceId}-retry`,
                            source: 'ai-chat-image-edit-retry',
                            stateOverrides: {
                                analysisResult: syncedAnalysis,
                                cakeInfo: fallbackCakeInfo,
                                mainToppers: mappedState.mainToppers ?? [],
                                supportElements: mappedState.supportElements ?? [],
                                cakeMessages: mappedState.cakeMessages ?? [],
                                icingDesign: mappedState.icingDesign,
                            },
                        });
                    } catch (retryErr) {
                        // Image generation failed in background
                    }
                })();
            });

            // 2. Fire Chat Edit (waits for JSON to update UI)
            const response = await fetch('/api/ai/chat-edit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ai-trace-id': traceId,
                    'x-ai-request-source': 'ai-chat-json-edit',
                },
                body: JSON.stringify({
                    prompt: currentPrompt,
                    currentAnalysis: syncedAnalysis,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update design');
            }

            const data = await response.json();
            const aiResponse = data.analysis_json;

            // Handle Design Restriction Violations
            if (aiResponse.restrictionViolation) {
                // 1. Show descriptive error toast
                showError(aiResponse.restrictionViolation);

                // 2. Cancel/Revert the visual track
                // Since handleUpdateDesign might have already finished or be in flight,
                // we set the edited image back to the "original" state (pre-generation).
                // If we have previousImageData, used that, otherwise originalImagePreview.
                const revertImage = previousImageData
                    ? `data:${previousImageData.mimeType};base64,${previousImageData.data}`
                    : (originalImagePreview || '');

                setEditedImage(revertImage);

                // Also ensure we stay on the current tab if image update hasn't finished yet
                // (though hook might have already switched it)

                // We stop here and do NOT apply the JSON changes
                return;
            }

            // DEFENSIVE MERGE: The AI sometimes returns partial JSON, omitting fields
            // it didn't change. We must merge with the synced state so missing fields
            // fall back to current values instead of becoming undefined (which wipes data).
            const mergedAnalysis = {
                ...syncedAnalysis,           // start with everything we sent
                ...aiResponse,               // overlay what AI returned
                // For arrays/objects, only use AI's version if it actually returned them
                cake_messages: aiResponse.cake_messages ?? syncedAnalysis.cake_messages,
                main_toppers: aiResponse.main_toppers ?? syncedAnalysis.main_toppers,
                support_elements: aiResponse.support_elements ?? syncedAnalysis.support_elements,
                icing_design: aiResponse.icing_design ?? syncedAnalysis.icing_design,
            };

            // Clear dirty state so AI changes take precedence over previous manual overrides
            clearDirtyState();

            // Apply the merged analysis as if it was analyzed from an image
            // This instantly updates UI toggles, price, and tags 
            setPendingAnalysisData(mergedAnalysis);
            resolveMergedAnalysis?.(mergedAnalysis);

            // Notify user while image is still spinning
            showSuccess('AI applied changes! Image is generating...');

            // 3. Handle extra actions (add to cart, update instructions)
            if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
                for (const action of aiResponse.actions) {
                    if (action.type === 'update_instructions' && action.content) {
                        const newInstructions = additionalInstructions
                            ? `${additionalInstructions}\n${action.content}`
                            : action.content;
                        onAdditionalInstructionsChange(newInstructions);
                        showSuccess('Added a note to your instructions!');
                    }
                    if (action.type === 'add_to_cart') {
                        // Short delay to allow design changes to be reflected in UI first
                        setTimeout(() => {
                            void onAddToCart();
                        }, 1200);
                    }
                }
            }

        } catch (err: any) {
            rejectMergedAnalysis?.(err);
            showError(err.message || 'Failed to process your request. Please try again.');
        } finally {
            setIsAiProcessing(false);
        }
    }, [
        analysisResult,
        cakeInfo,
        clearDirtyState,
        getSyncedAnalysisResult,
        handleUpdateDesign,
        isAiProcessing,
        isUpdatingDesign,
        setPendingAnalysisData,
        additionalInstructions,
        onAdditionalInstructionsChange,
        onAddToCart,
    ]);

    const handleChatSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        await submitAiChatPrompt(chatInput);
    }, [chatInput, submitAiChatPrompt]);

    const handleAiPromptSuggestionSelect = useCallback((suggestion: string) => {
        const parsedTemplate = parseAiChatPromptTemplate(suggestion);

        if (parsedTemplate) {
            setSelectedAiPromptTemplate(parsedTemplate);
            setSelectedAiPromptColor('');
            setShowAiPromptColorPicker(false);
            setChatInput('');
            setShowAiPromptSuggestions(false);
            setSelectedAiPromptIndex(-1);
            return;
        }

        setSelectedAiPromptTemplate(null);
        setSelectedAiPromptColor('');
        setShowAiPromptColorPicker(false);
        setChatInput(suggestion);
        setShowAiPromptSuggestions(false);
        setSelectedAiPromptIndex(-1);

        requestAnimationFrame(() => {
            const input = getActiveChatInput();
            if (input) {
                input.focus();
                const cursorPosition = suggestion.length;
                input.setSelectionRange(cursorPosition, cursorPosition);
            }
        });
    }, []);



    const handleAiPromptTemplateClear = useCallback(() => {
        const template = selectedAiPromptTemplate?.template ?? '';
        setSelectedAiPromptTemplate(null);
        setSelectedAiPromptColor('');
        setShowAiPromptColorPicker(false);
        setChatInput(template);

        requestAnimationFrame(() => {
            const activeChatInput = getActiveChatInput();
            activeChatInput?.focus();
            const cursorPosition = template.length;
            activeChatInput?.setSelectionRange(cursorPosition, cursorPosition);
        });
    }, [selectedAiPromptTemplate]);

    const handleAiPromptTemplateColorChange = useCallback(async (colorHex: string) => {
        if (!selectedAiPromptTemplate) return;

        const selectedColorName = COLORS.find(color => color.hex.toLowerCase() === colorHex.toLowerCase())?.name
            ?? hexToColorNameProse(colorHex);
        const nextPrompt = fillAiChatPromptTemplate(selectedAiPromptTemplate, selectedColorName);

        setSelectedAiPromptColor(colorHex);
        setShowAiPromptColorPicker(false);
        setSelectedAiPromptTemplate(null);
        setShowAiPromptSuggestions(false);
        setSelectedAiPromptIndex(-1);

        await submitAiChatPrompt(nextPrompt);
    }, [selectedAiPromptTemplate, submitAiChatPrompt]);

    const handleAiPromptColorPickerToggle = useCallback(() => {
        setShowAiPromptColorPicker(prev => !prev);
    }, []);

    const handleAiChatInputChange = useCallback((value: string) => {
        setSelectedAiPromptTemplate(null);
        setSelectedAiPromptColor('');
        setShowAiPromptColorPicker(false);
        setChatInput(value);
        setShowAiPromptSuggestions(hasAiChatPromptSuggestions);
        setSelectedAiPromptIndex(-1);
    }, [hasAiChatPromptSuggestions]);

    const handleAiChatInputInteract = useCallback(() => {
        if (hasAiChatPromptSuggestions) {
            setShowAiPromptSuggestions(true);
        }
    }, [hasAiChatPromptSuggestions]);

    const handleMainChatInputInteract = useCallback((e?: React.MouseEvent | React.FocusEvent) => {
        e?.preventDefault();
        const input = getActiveChatInput();
        if (input) {
            input.focus();
        }
    }, []);

    const handleAiPromptInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            setShowAiPromptSuggestions(false);
            setSelectedAiPromptIndex(-1);
            return;
        }

        if (!showAiPromptSuggestions || filteredAiChatPromptSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedAiPromptIndex(prev => (
                prev < filteredAiChatPromptSuggestions.length - 1 ? prev + 1 : filteredAiChatPromptSuggestions.length - 1
            ));
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedAiPromptIndex(prev => (prev > 0 ? prev - 1 : 0));
            return;
        }

        if (e.key === 'Enter' && selectedAiPromptIndex >= 0) {
            e.preventDefault();
            handleAiPromptSuggestionSelect(filteredAiChatPromptSuggestions[selectedAiPromptIndex].suggestion);
        }
    }, [filteredAiChatPromptSuggestions, handleAiPromptSuggestionSelect, selectedAiPromptIndex, showAiPromptSuggestions]);

    // --- Effects ---
    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            const isOutsideMobileChat = aiChatMobileContainerRef.current && !aiChatMobileContainerRef.current.contains(event.target as Node);
            const isOutsideDesktopChat = aiChatDesktopContainerRef.current && !aiChatDesktopContainerRef.current.contains(event.target as Node);

            // Close suggestions if clicked outside both containers
            if ((!aiChatMobileContainerRef.current || isOutsideMobileChat) && (!aiChatDesktopContainerRef.current || isOutsideDesktopChat)) {
                setShowAiPromptSuggestions(false);
                setSelectedAiPromptIndex(-1);
                setShowAiPromptColorPicker(false);
            }
        };

        document.addEventListener('pointerdown', handleClickOutside);
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, []);

    // Handle product prop loading (from SEO-friendly routes like /shop/[merchant]/[product]/customize)
    // AND recent search designs (from /customizing/[slug])
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sourceParam = urlParams.get('source');

        // Unify the data source (Product Page vs Customizing Page)
        const targetSlug = product?.slug || recentSearchDesign?.slug || recentSearchDesign?.p_hash;
        const targetImageUrl = firstNonBlankImageUrl(
            product?.image_url,
            recentSearchDesign?.studio_edited_image_url,
            recentSearchDesign?.original_image_url,
        );
        const targetPHash = product?.p_hash || recentSearchDesign?.p_hash;
        const targetTitle = product?.title || recentSearchDesign?.seo_title || 'Design';

        if (!shouldLoadPropDesign({
            sourceParam,
            isResetting: isResettingRef.current,
            targetImageUrl,
            targetSlug,
            persistedSlug,
            hasLoadedImage: !!originalImageData,
            isLoadingDesign: isLoadingDesignRef.current,
        })) {
            return;
        }

        if (!targetImageUrl) {
            return;
        }

        // CRITICAL: Set the current slug FIRST - this will automatically clear stale images
        // if the slug changed from a previously persisted session
        setCurrentSlug(targetSlug || null);

        isLoadingDesignRef.current = true;
        // Loading item from props

        // Show pre-selection modal for search arrivals (user can pick cake specs while loading)
        // DISABLED: Preselection modal disabled
        const isFromSearch = urlParams.get('from') === 'search';
        if (isFromSearch) {
            // setIsPreSelectionModalOpen(true);
        }

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
            // DISABLED: Preselection modal disabled
            // setIsPreSelectionModalOpen(true);
        }

        const shouldReuseSsrAnalysis = shouldHydrateImageFromExistingAnalysis({ hasSsrData: hasSSRData });

        if (targetPHash && shouldReuseSsrAnalysis) {

            loadImageWithoutAnalysis(targetImageUrl, {
                fileName: 'product.jpg',
                fallbackMimeType: 'image/jpeg',
                knownSeoMetadata: knownSeoMetadata || undefined,
                errorMessage: 'Failed to load product',
            })
                .then(() => {
                    setIsAnalyzing(false);
                    isLoadingDesignRef.current = false;
                })
                .catch(err => {
                    setAnalysisError('Failed to load product');
                    isLoadingDesignRef.current = false;
                    setIsAnalyzing(false);
                });

            return;
        }

        if (targetPHash) {

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
                            }
                        },
                        (error) => {
                            const message = error instanceof Error ? error.message : "Failed to load product";
                            setAnalysisError(message);
                            showError(message.replace('AI_REJECTION: ', ''));
                            setIsAnalyzing(false);
                            setIsPreSelectionModalOpen(false);
                            isLoadingDesignRef.current = false;
                        },
                        // Pass analysisData as precomputed if available to skip AI
                        analysisData
                            ? { imageUrl: targetImageUrl, precomputedAnalysis: analysisData, knownSeoMetadata: knownSeoMetadata || undefined }
                            : { imageUrl: targetImageUrl, knownSeoMetadata: knownSeoMetadata || undefined }
                    );
                })
                .catch(err => {
                    // Fallback to old full flow if fast path crashes
                    isLoadingDesignRef.current = false; // Reset lock to allow retry or old flow
                    setIsAnalyzing(false);
                    setIsPreSelectionModalOpen(false);
                });

            return;
        }

        // OLD FLOW (Fallback): Load image and calculate hash client-side
        setIsAnalyzing(true);
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
                        setPendingAnalysisData(result);
                        setIsAnalyzing(false);
                        showSuccess("Design loaded!");
                        isLoadingDesignRef.current = false;
                    },
                    (error) => {
                        const message = error instanceof Error ? error.message : "Failed to load product";
                        setAnalysisError(message);
                        showError(message.replace('AI_REJECTION: ', ''));
                        setIsAnalyzing(false);
                        setIsPreSelectionModalOpen(false);
                        isLoadingDesignRef.current = false;
                    },
                    { imageUrl: targetImageUrl!, knownSeoMetadata: knownSeoMetadata || undefined }
                );

            } catch (err) {
                showError("Failed to load product.");
                setIsAnalyzing(false);
                setIsPreSelectionModalOpen(false);
                isLoadingDesignRef.current = false;
            }
        };

        fetchProductImage();
    }, [product, recentSearchDesign, originalImageData, isImageManagementLoading, hookImageUpload, loadImageWithoutAnalysis, setIsAnalyzing, clearImages, clearCustomization, analysisResult, analysisId, persistedSlug, setCurrentSlug, setPendingAnalysisData, knownSeoMetadata, setAnalysisError]);

    // Handle image loading from external site (cakesandmemories.com Shopify CSE, Chrome Extension)
    // Uses URL query params because sessionStorage is per-origin and doesn't survive cross-domain redirects.
    // Expected URL: /customizing?source=shopify_cse&image_url=ENCODED_URL&image_name=cake.jpg&image_type=image/jpeg
    // OR: /customizing?source=chrome_extension&image_url=ENCODED_URL&image_name=cake.jpg&image_type=image/jpeg
    // NOTE: We read from window.location.search directly (not useSearchParams) because
    // Next.js can cache/stale the React hook value on subsequent cross-domain navigations.
    useEffect(() => {
        const loadPendingImage = async () => {
            try {
                // Read directly from the browser URL bar — avoids Next.js searchParams caching
                const urlParams = new URLSearchParams(window.location.search);
                const sourceParam = urlParams.get('source');
                const imageUrlParam = urlParams.get('image_url');

                // Not an external source handoff — bail
                // Match shopify_cse, shopify, and chrome_extension as valid external origins
                const isExternalSource = sourceParam === 'shopify_cse' || sourceParam === 'shopify' || sourceParam === 'chrome_extension';
                if (!isExternalSource) {
                    return;
                }

                if (!imageUrlParam) {
                    return;
                }

                // Prevent duplicate processing
                if (isLoadingShopifyCseRef.current) {
                    return;
                }

                // Wait for image management hook to be ready
                if (isImageManagementLoading) {
                    return;
                }

                const pendingImageName = urlParams.get('image_name');
                const pendingImageType = urlParams.get('image_type');

                isLoadingShopifyCseRef.current = true;

                // Clear previous image immediately so there's no flash of the old design
                clearImages();
                clearCustomization();
                setActiveTab('original');
                // Clear any previous loading toasts from previous pages
                toast.dismiss();
                setIsAnalyzing(true);
                // DISABLED: Preselection modal disabled
                // setIsPreSelectionModalOpen(true);
                showInfo("Loading your cake design...");

                // Reject blob URLs (dead after navigation)
                const imageUrl = imageUrlParam.startsWith('blob:') ? null : imageUrlParam;

                if (!imageUrl) {
                    setIsAnalyzing(false);
                    isLoadingShopifyCseRef.current = false;
                    showError("Image link expired. Please try again.");
                    return;
                }

                // Always use the proxy for cross-origin images to avoid CORS errors
                const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
                if (!proxyResponse.ok) {
                    throw new Error(`Proxy fetch failed with status ${proxyResponse.status}`);
                }
                const blob = await proxyResponse.blob();

                const fileName = pendingImageName || 'cake-design.jpg';
                const fileType = pendingImageType || blob.type || 'image/jpeg';
                const file = new File([blob], fileName, { type: fileType });

                // Clean up URL params using history API directly (avoids Next.js router cache issues)
                urlParams.delete('source');
                urlParams.delete('image_url');
                urlParams.delete('image_name');
                urlParams.delete('image_type');
                const currentPath = window.location.pathname;
                const cleanUrl = urlParams.toString() ? `${currentPath}?${urlParams.toString()}` : currentPath;
                window.history.replaceState({}, '', cleanUrl);

                hookImageUpload(
                    file,
                    (result) => {
                        setPendingAnalysisData(result);
                        setIsAnalyzing(false);
                        isLoadingShopifyCseRef.current = false;
                        showSuccess("Design loaded!");
                    },
                    (error: Error) => {
                        setAnalysisError(error.message);
                        showError("Failed to analyze image: " + error.message.replace('AI_REJECTION: ', ''));
                        setIsAnalyzing(false);
                        setIsPreSelectionModalOpen(false);
                        isLoadingShopifyCseRef.current = false;
                    }
                );

            } catch (err: any) {
                setIsAnalyzing(false);
                setIsPreSelectionModalOpen(false);
                isLoadingShopifyCseRef.current = false;
                showError("Failed to load image. Please try again.");
            }
        };

        loadPendingImage();
    }, [isImageManagementLoading, hookImageUpload, clearImages, clearCustomization]);

    // Handle "Customize This Design" flow (loading from URL ref) - Shopify/external integrations
    // NOTE: We read from window.location.search directly (not useSearchParams) because
    // Next.js can cache/stale the React hook value on cross-domain navigations (e.g., from cakesandmemories.com).
    // This is the same fix applied to the Shopify CSE handler above.
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const refUrl = urlParams.get('ref');
        const fromSaved = urlParams.get('fromSaved') === 'true';
        const fromMerchant = urlParams.get('fromMerchant') === 'true';

        if (!refUrl) {
            lastProcessedDesignRefUrl.current = null;
            return;
        }

        if (isImageManagementLoading) {
            return;
        }

        // Guard against duplicate calls (e.g., from React strict mode or URL changes)

        if (isLoadingDesignRef.current) {
            return;
        }

        // Clear any previous loading toasts from previous pages
        toast.dismiss();

        const decodedUrl = decodeURIComponent(refUrl);
        const pathname = window.location.pathname;
        const persistedAnalysis = parsePersistedAnalysis(localStorage.getItem('cakegenie_analysis'));
        const refLoadStrategy = getRefLoadStrategy({
            decodedUrl,
            fromSaved,
            fromMerchant,
            persistedAnalysis,
            hasLiveAnalysisResult: !!analysisResult,
            lastProcessedRefUrl: lastProcessedDesignRefUrl.current,
        });

        if (refLoadStrategy === 'skip') {
            return;
        }

        if (refLoadStrategy === 'reuse') {
            lastProcessedDesignRefUrl.current = decodedUrl;
            showInfo("Welcome back! Your analysis is ready.");
            return;
        }

        // If coming from Saved page, try to restore state from localStorage without re-analysis
        if (fromSaved) {
            // Set loading guard FIRST before any side effects
            isLoadingDesignRef.current = true;


            // Clear any existing stale image/customization data first
            clearImages();
            clearCustomization();
            setActiveTab('original');

            // Remove fromSaved param to prevent infinite loop (since we just cleared images)
            // Use window.history.replaceState to avoid Next.js router cache issues
            const savedCleanParams = new URLSearchParams(window.location.search);
            savedCleanParams.delete('fromSaved');
            const savedCleanUrl = savedCleanParams.toString() ? `${pathname}?${savedCleanParams.toString()}` : pathname;
            window.history.replaceState({}, '', savedCleanUrl);

            try {
                const savedData = localStorage.getItem('cakegenie_restore_saved');
                if (savedData) {
                    const parsed = JSON.parse(savedData);
                    // Validate. Ideally we check URL match, but if user clicked "saved", 
                    // they want THAT saved item. The localStorage should have just been set by SavedClient.
                    // We trust it if it's recent.
                    if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
                        if (parsed.imageUrl !== decodedUrl) {
                        }

                        const hasPrecomputedAnalysis = parsed.cachedAnalysis != null;

                        // Show loading state
                        setIsAnalyzing(true);
                        showInfo("Loading your saved design...");

                        if (shouldHydrateImageFromExistingAnalysis({ hasCachedAnalysis: hasPrecomputedAnalysis })) {
                            loadImageWithoutAnalysis(parsed.imageUrl, {
                                fileName: 'saved-design.webp',
                                fallbackMimeType: 'image/webp',
                                errorMessage: 'Failed to load saved design.',
                            })
                                .then(() => {
                                    lastProcessedDesignRefUrl.current = decodedUrl;
                                    setPendingAnalysisData(parsed.cachedAnalysis);
                                    setIsAnalyzing(false);
                                    isLoadingDesignRef.current = false;
                                    showSuccess("Design loaded!");
                                })
                                .catch((err) => {
                                    setIsAnalyzing(false);
                                    isLoadingDesignRef.current = false;
                                });

                            localStorage.removeItem('cakegenie_restore_saved');
                            return;
                        }

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
                                    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(parsed.imageUrl)}`;
                                    const response = await fetch(proxyUrl);
                                    if (response.ok) {
                                        blob = await response.blob();
                                    }
                                }

                                if (!blob) throw new Error("Failed to load image");

                                const file = new File([blob], 'saved-design.webp', { type: blob.type || 'image/webp' });
                                // Use hookImageUpload with precomputedAnalysis if available
                                await hookImageUpload(
                                    file,
                                    (result) => {
                                        lastProcessedDesignRefUrl.current = decodedUrl;
                                        setPendingAnalysisData(result);
                                        setIsAnalyzing(false);
                                        isLoadingDesignRef.current = false;
                                        showSuccess("Design loaded!");
                                    },

                                    (err) => {
                                        const message = err instanceof Error ? err.message : 'Failed to analyze image. Please try again.';
                                        setAnalysisError(message);
                                        showError(message.replace('AI_REJECTION: ', ''));
                                        setIsAnalyzing(false);
                                        isLoadingDesignRef.current = false; // Reset guard
                                    },
                                    {
                                        imageUrl: parsed.imageUrl,
                                        precomputedAnalysis: parsed.cachedAnalysis || undefined
                                    }
                                );

                            } catch (err) {
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


            // Clear any existing stale image/customization data first
            clearImages();
            clearCustomization();

            // Remove fromMerchant param to prevent infinite loop
            // Use window.history.replaceState to avoid Next.js router cache issues
            const merchantCleanParams = new URLSearchParams(window.location.search);
            merchantCleanParams.delete('fromMerchant');
            const merchantCleanUrl = merchantCleanParams.toString() ? `${pathname}?${merchantCleanParams.toString()}` : pathname;
            window.history.replaceState({}, '', merchantCleanUrl);

            try {
                const merchantData = localStorage.getItem('cakegenie_merchant_product');
                if (merchantData) {
                    const parsed = JSON.parse(merchantData);
                    // Validate timestamp (5 minutes)
                    if (Date.now() - parsed.timestamp < 5 * 60 * 1000 && parsed.imageUrl) {

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
                                        lastProcessedDesignRefUrl.current = decodedUrl;
                                        setIsAnalyzing(false);
                                        showSuccess("Product loaded!");
                                        isLoadingDesignRef.current = false;
                                    },

                                    (error) => {
                                        const message = error instanceof Error ? error.message : "Failed to load product";
                                        setAnalysisError(message);
                                        showError(message.replace('AI_REJECTION: ', ''));
                                        setIsAnalyzing(false);
                                        isLoadingDesignRef.current = false;
                                    },
                                    { imageUrl: parsed.imageUrl }
                                );

                            } catch (err) {
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
                isLoadingDesignRef.current = false;
            }

            localStorage.removeItem('cakegenie_merchant_product');
            return; // Always return for fromMerchant to prevent duplicate loads
        }

        isLoadingDesignRef.current = true;

        // Always clear stale state before loading an external ref.
        // Returning users can otherwise see a previous image and never get the new analysis.
        clearImages();
        clearCustomization();
        setAnalysisError(null);

        // Show loading state immediately
        setIsAnalyzing(true);
        // DISABLED: Preselection modal disabled
        // setIsPreSelectionModalOpen(true);
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
        // TODO: SEO Titles/Descriptions for shared designs
        // - [/] Fix `seo_title` and `seo_description` for 52 items in `cakegenie_analysis_cache`
        // - [x] Refine implementation plan based on user feedback (descriptive titles)
        // - [/] Create generation script for SEO fields
        // - [ ] Execute updates in Supabase
        // - [ ] Verify updated entries match the requested format

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
                    const response = await fetchWithTimeout(decodedUrl, 8000); // 8s timeout for direct
                    if (response.ok) {
                        blob = await response.blob();
                    }
                } catch (err) {
                    // Direct fetch failed
                }

                // 2. Fallback to Proxy if Direct failed
                if (!blob) {
                    try {
                        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(decodedUrl)}`;
                        const response = await fetchWithTimeout(proxyUrl, 15000); // 15s timeout for proxy
                        if (response.ok) {
                            blob = await response.blob();
                        } else {
                            throw new Error(`Proxy fetch failed with status: ${response.status}`);
                        }
                    } catch (proxyErr) {
                        throw proxyErr; // Throw if both failed
                    }
                }

                if (!blob) throw new Error("Failed to load image from both sources.");

                // Verify it is an image (skip strict check if type is empty due to proxy)
                if (blob.type && !blob.type.startsWith('image/') && !blob.type.startsWith('application/octet-stream')) {
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
                        // Update the customization context with the analysis result
                        lastProcessedDesignRefUrl.current = decodedUrl;
                        setPendingAnalysisData(result);
                        setIsAnalyzing(false);
                        isLoadingDesignRef.current = false;
                    },
                    (err) => {
                        const message = err instanceof Error ? err.message : "Failed to analyze the shared design.";
                        setAnalysisError(message);
                        showError(message.replace('AI_REJECTION: ', ''));
                        setIsAnalyzing(false);
                        setIsPreSelectionModalOpen(false);
                        isLoadingDesignRef.current = false;
                    },
                    { imageUrl: decodedUrl } // Pass original URL
                );

            } catch (err) {
                let msg = "Could not load the shared design.";
                if (err instanceof Error && err.name === 'AbortError') {
                    msg = "Image loading timed out. Please try uploading directly.";
                } else if (err instanceof Error) {
                    msg = `Could not load design: ${err.message}`;
                }
                showError(msg);
                setIsAnalyzing(false);
                setIsPreSelectionModalOpen(false);
                isLoadingDesignRef.current = false;
            }
        };

        fetchAndAnalyze();
    }, [searchParams, isImageManagementLoading, hookImageUpload, loadImageWithoutAnalysis, setIsAnalyzing, setPendingAnalysisData, analysisResult, clearImages, clearCustomization, setAnalysisError]);


    const onClose = () => {
        // Use smart back navigation - it will automatically determine the right destination
        // based on where the user came from (search, saved, or home)

        // Check URL params for specific redirect logic (legacy support)
        if (searchParams.get('from') === 'search') {
            // Use smart back to go back to search results
            goBack();
        } else if (sessionStorage.getItem('cakegenie_from_saved') === 'true') {
            // If came from saved page, go back to saved
            sessionStorage.removeItem('cakegenie_from_saved');
            router.push('/saved');
        } else {
            // Default: go home
            router.push('/');
        }
    };
    const onOpenReportModal = () => setIsReportModalOpen(true);

    const onUpdateDesign = handleUpdateDesign;
    const onSave = handleSave;
    const isSaving = false;

    const handleUploadAnother = useCallback(() => {
        const nextUrl = buildRetryUploadUrl(window.location.pathname, window.location.search);
        window.history.replaceState({}, '', nextUrl);

        isLoadingDesignRef.current = false;
        isLoadingShopifyCseRef.current = false;
        lastProcessedDesignRefUrl.current = null;
        setPreloadedHeroImage(null);
        setActiveTab('original');
        setIsPreSelectionModalOpen(false);
        setAnalysisError(null);
        clearImages();
        clearCustomization();
        setIsUploaderOpen(true);
    }, [clearCustomization, clearImages, setAnalysisError]);

    const onClearAll = () => {
        isResettingRef.current = true;
        clearImages();
        clearCustomization();
        setActiveTab('original');
        router.push('/');
    };

    const handleToggleSavedDesign = useCallback(async () => {
        if (!isAuthenticated || user?.is_anonymous) {
            showInfo('Please log in to save designs');
            router.push('/login?redirect=/customizing');
            return;
        }

        try {
            const pHash = analysisId || `design-${Date.now()}`;
            let currentImageUrl = editedImage || originalImagePreview || '';

            if (currentImageUrl.startsWith('data:')) {
                showInfo('Saving design...');
                const { finalImageUrl } = await uploadCartImages({
                    editedImageDataUri: editedImage || null,
                    userId: user?.id,
                });
                currentImageUrl = finalImageUrl;
            }

            const customizationSnapshot = {
                flavors: cakeInfo?.flavors || [],
                mainToppers: mainToppers.filter(t => t.isEnabled).map(t => ({
                    description: t.description,
                    type: t.type,
                    size: t.size,
                })),
                supportElements: supportElements.filter(e => e.isEnabled).map(e => ({
                    description: e.description,
                    type: e.type,
                })),
                cakeMessages: cakeMessages.filter(m => m.isEnabled).map(m => ({
                    text: m.text,
                    color: m.color,
                })),
                icingDesign: {
                    drip: icingDesign?.drip || false,
                    gumpasteBaseBoard: icingDesign?.gumpasteBaseBoard || false,
                    colors: icingDesign?.colors
                        ? Object.entries(icingDesign.colors).reduce((acc, [key, value]) => {
                            if (value) acc[key] = value;
                            return acc;
                        }, {} as Record<string, string>)
                        : {},
                },
                additionalInstructions: additionalInstructions || '',
            };

            await toggleSaveDesign({
                analysisPHash: pHash,
                customizationSnapshot,
                customizedImageUrl: currentImageUrl,
            });

            const wasSaved = isDesignSaved(pHash);
            showSuccess(wasSaved ? 'Removed from saved' : 'Design saved!');
        } catch (err) {
            showError('Failed to save design. Please try again.');
        }
    }, [
        additionalInstructions,
        analysisId,
        cakeInfo?.flavors,
        cakeMessages,
        editedImage,
        icingDesign,
        isAuthenticated,
        isDesignSaved,
        mainToppers,
        originalImagePreview,
        router,
        supportElements,
        toggleSaveDesign,
        uploadCartImages,
        user?.id,
        user?.is_anonymous,
    ]);

    const onUndo = useCallback(() => {
        if (previousImageData) {
            setOriginalImageData(previousImageData);
            setPreviousImageData(null);
        }
        if (previousUIState) {
            applyFullCustomizationState(previousUIState);
            setPreviousUIState(null);
        }
        setEditedImage(null);
        setActiveTab('original');
    }, [previousUIState, previousImageData, setEditedImage, setOriginalImageData, setPreviousImageData, applyFullCustomizationState]);

    const canUndo = !!previousImageData;
    const error = analysisError || imageManagementError || designUpdateError || basePriceError || authError || null;
    const isRejectionError = analysisError?.startsWith('AI_REJECTION:');
    const isSharing = isPreparingSharedDesign || isSavingDesign;

    const { warningMessage, warningDescription } = useMemo(() => {
        // Check for active toys/figurines (manual selection)
        const hasActiveToy = [...mainToppers, ...supportElements].some(
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
                warningMessage: "Toy Temporarily Replaced with Printout",
                warningDescription: "We changed the topper to printout for now due to availability."
            };
        }

        return { warningMessage: null, warningDescription: null };
    }, [mainToppers]);



    const buildCartItemDetails = useCallback((): CartItemDetails => {
        if (!cakeInfo || !icingDesign) throw new Error("Missing data for cart item.");
        const hexToName = hexToColorNameProse;
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
    }, [cakeInfo, icingDesign, mainToppers, supportElements, cakeMessages, additionalInstructions]);



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
    const handleIcingTypeChange = useCallback((newBase: IcingDesignUI['base']) => {
        if (!cakeInfo) return;

        const currentBase = icingDesign?.base ?? inferIcingBaseFromCakeType(cakeInfo.type);
        const nextType = getEquivalentCakeTypeForIcingBase(cakeInfo.type, newBase);
        const hasTypeChanged = nextType !== cakeInfo.type;
        const hasBaseChanged = currentBase !== newBase;

        if (!hasTypeChanged && !hasBaseChanged) {
            return;
        }

        const nextCakeInfoUpdates: Partial<CakeInfoUI> = {
            type: nextType,
        };

        if (hasTypeChanged) {
            if (cakeInfo.type !== 'Bento' && nextType !== 'Bento') {
                nextCakeInfoUpdates.size = getEquivalentCakeSizeForIcingBase(cakeInfo.size, newBase);
            }

            if (THICKNESS_OPTIONS_MAP[nextType]?.includes(cakeInfo.thickness)) {
                nextCakeInfoUpdates.thickness = cakeInfo.thickness;
            }

            const currentTierCount = cakeInfo.flavors.length;
            const nextTierCount = nextType.includes('3 Tier') ? 3 : nextType.includes('2 Tier') ? 2 : 1;

            if (currentTierCount === nextTierCount) {
                nextCakeInfoUpdates.flavors = cakeInfo.flavors;
            }
        }

        handleCakeInfoChange(nextCakeInfoUpdates);

        const nextIcingDesign = icingDesign
            ? { ...icingDesign, base: newBase }
            : { ...DEFAULT_ICING_DESIGN, base: newBase };

        onIcingDesignChange(nextIcingDesign);
    }, [cakeInfo, icingDesign, handleCakeInfoChange, onIcingDesignChange]);

    const availability = AVAILABILITY_MAP[availabilityType];
    // Temporary state backups for modals (to discard changes on cancel)
    const [tempCakeMessagesBackup, setTempCakeMessagesBackup] = useState<CakeMessageUI[] | null>(null);
    const [tempToppersBackup, setTempToppersBackup] = useState<{ mainToppers: MainTopperUI[], supportElements: SupportElementUI[] } | null>(null);
    const [tempEdiblePhotoBackup, setTempEdiblePhotoBackup] = useState<{ item: MainTopperUI | SupportElementUI, category: 'topper' | 'element' } | null>(null);
    const [selectedItem, setSelectedItem] = useState<ClusteredMarker | null>(null);
    const [isMotifPanelOpen, setIsMotifPanelOpen] = useState(false);
    const [dynamicLoadingMessage, setDynamicLoadingMessage] = useState<string>('');
    const [showIcingGuide, setShowIcingGuide] = useState(false);
    const [hasShownGuide, setHasShownGuide] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false); // Collapsible color picker state
    const [showMessagesPanel, setShowMessagesPanel] = useState(false); // Messages panel visibility
    const [wasUpdating, setWasUpdating] = useState(false);
    // --- UI State ---
    const [activeTab, setActiveTab] = useState<'original' | 'customized'>('original');
    const [activeCustomization, setActiveCustomization] = useState<string | null>(null);
    const [activeTopperSection, setActiveTopperSection] = useState<'main' | 'support' | null>(null);

    // Draft state snapshot for Step 2, 3, 4
    const [draftSnapshot, setDraftSnapshot] = useState<{
        icingDesign: IcingDesignUI | null;
        cakeMessages: CakeMessageUI[];
        mainToppers: MainTopperUI[];
        supportElements: SupportElementUI[];
    } | null>(null);
    const isDraftApplied = useRef(false);

    // Capture snapshot when a customization panel is opened
    useEffect(() => {
        if (activeCustomization && !draftSnapshot) {
            setDraftSnapshot({
                icingDesign: icingDesign ? JSON.parse(JSON.stringify(icingDesign)) : null,
                cakeMessages: JSON.parse(JSON.stringify(cakeMessages)),
                mainToppers: JSON.parse(JSON.stringify(mainToppers)),
                supportElements: JSON.parse(JSON.stringify(supportElements)),
            });
            isDraftApplied.current = false;
        } else if (!activeCustomization) {
            setDraftSnapshot(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCustomization]);






    const openTopperSheet = useCallback((section: 'main' | 'support' | null = null) => {
        setActiveTopperSection(section);
        setActiveCustomization('toppers');
    }, []);

    const hasTypeChanges = useMemo(() => {
        if (!analysisResult?.cakeType || !cakeInfo?.type) return false;
        return cakeInfo.type !== analysisResult.cakeType;
    }, [cakeInfo?.type, analysisResult?.cakeType]);

    // Calculate icing changes at the top level to avoid hook errors
    const hasIcingChanges = useMemo(() => {
        if (!icingDesign) return false;
        // No prior analysis (e.g. coldcaking before a pitch upload) — any icing is pending if image is loaded
        if (!analysisResult?.icing_design) return !!originalImageData;
        return (
            JSON.stringify(icingDesign.colors) !== JSON.stringify(analysisResult.icing_design.colors) ||
            icingDesign.drip !== analysisResult.icing_design.drip ||
            icingDesign.border_top !== analysisResult.icing_design.border_top ||
            icingDesign.border_base !== analysisResult.icing_design.border_base ||
            icingDesign.gumpasteBaseBoard !== analysisResult.icing_design.gumpasteBaseBoard
        );
    }, [icingDesign, analysisResult, originalImageData]);

    // Check if cake messages have changed
    const hasMessageChanges = useMemo(() => {
        if (!analysisResult?.cake_messages) return false;

        // Check if number of messages changed
        if (cakeMessages.length !== analysisResult.cake_messages.length) return true;

        // Check if any message properties changed
        return cakeMessages.some(currentMsg => {
            // Robust matching: Try ID first, then fallback to position since we typically have 1 message per position
            const originalMsg = analysisResult.cake_messages?.find(m =>
                (m.id && m.id === currentMsg.id) || (!m.id && m.position === currentMsg.position)
            );

            if (!originalMsg) return true; // New message at a new position

            return (
                currentMsg.text !== originalMsg.text ||
                currentMsg.color !== originalMsg.color ||
                currentMsg.isEnabled !== (originalMsg.isEnabled ?? true) ||
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

    const hasPendingVisualChanges = useMemo(() => {
        return hasIcingChanges || hasMessageChanges || hasToppersChanges || hasPhotoChanges || hasTypeChanges;
    }, [hasIcingChanges, hasMessageChanges, hasToppersChanges, hasPhotoChanges, hasTypeChanges]);

    const hasToyTopper = useMemo(() => {
        if (!mainToppers || !supportElements) return false;
        return [...mainToppers, ...supportElements].some(t => t.isEnabled && (t.type === 'toy' || t.type === 'figurine'));
    }, [mainToppers, supportElements]);

    const restoreOriginalCakeMessages = useCallback(() => {
        const originalMessages = analysisResult?.cake_messages?.map((m: any, index: number) => ({
            id: `msg-${index}`,
            type: m.type,
            text: m.text,
            position: m.position,
            color: m.color,
            x: m.x,
            y: m.y,
            isEnabled: true,
            price: 0,
            originalMessage: m
        })) || [];

        onCakeMessageChange(originalMessages as CakeMessageUI[]);
    }, [analysisResult, onCakeMessageChange]);

    // When clearMessageTexts is true (e.g. coldcaking page), blank out any pre-populated message text from analysis
    useEffect(() => {
        if (!clearMessageTexts || cakeMessages.length === 0) return;
        const hasText = cakeMessages.some(m => m.text);
        if (!hasText) return;
        onCakeMessageChange(cakeMessages.map(m => ({ ...m, text: '' })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clearMessageTexts, analysisResult]);

    const handleApplyPendingDesignChanges = useCallback(() => {
        if (isUpdatingDesign || !originalImageData || !hasPendingVisualChanges) {
            return;
        }

        isDraftApplied.current = true;
        void onUpdateDesign();
        setActiveCustomization(null);
        setActiveTopperSection(null);
        setSelectedItem(null);
    }, [hasPendingVisualChanges, isUpdatingDesign, onUpdateDesign, originalImageData]);


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

        const description = 'description' in selectedItem ? selectedItem.description : '';
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
                    [colorKey as string]: color.hex
                }
            } as unknown as IcingDesignUI;

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
    const handleListItemClick = useCallback((item: AnalysisItem) => {
        setSelectedItem(item);
        mainImageContainerRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    }, []);



    const isAdmin = useMemo(() => user?.email === 'apcaballes@gmail.com', [user]);

    // Handle undo with modal state cleanup
    const handleUndoWithModalCleanup = useCallback(() => {
        // Clear any pending modal changes
        setTempCakeMessagesBackup(null);
        setTempToppersBackup(null);
        setTempEdiblePhotoBackup(null);

        // Close any open modals
        setActiveCustomization(null);
        setSelectedItem(null);

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

    const addCakeMessage = useCallback((position: 'top' | 'side' | 'base_board', text?: string, color?: string) => {
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
            text: text || '',
            position: position,
            color: color || '#000000',
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

    const [isTopSearchBarScrolled, setIsTopSearchBarScrolled] = useState(false);

    useEffect(() => {
        const updateTopSearchBarState = () => {
            setIsTopSearchBarScrolled(window.scrollY > 12);
        };

        updateTopSearchBarState();
        window.addEventListener('scroll', updateTopSearchBarState, { passive: true });

        return () => window.removeEventListener('scroll', updateTopSearchBarState);
    }, []);

    const showStickyBar = finalPrice !== null || !!basePriceError || isAnalyzing || !!warningMessage || isSafetyFallback || hasPendingVisualChanges || isUpdatingDesign;

    return (
        <>
            <h1 className="sr-only">{pageDisplayTitle}</h1>
            {/* Same-day cutoff countdown — live urgency signal */}
            {!hideBanner && (
                <div className="w-full bg-purple-400 py-[4.5px] flex justify-center items-center">
                    <SameDayCutoffBanner />
                </div>
            )}
            <div className={`sticky top-0 z-80 w-full border-b transition-all duration-200 ${isTopSearchBarScrolled ? 'border-purple-100 bg-white/90 shadow-sm backdrop-blur-lg' : 'border-transparent bg-transparent'}`}>
                <div className="w-full max-w-7xl mx-auto px-4">
                    <div className="w-full flex items-center gap-2 md:gap-4 py-[11px] md:py-[14px]">
                        <button onClick={onClose} className="p-2 genie-icon-button rounded-full shrink-0" aria-label="Go back">
                            <BackIcon />
                        </button>
                        <div className="relative grow">
                            <SearchAutocomplete
                                value={searchInput}
                                onChange={setSearchInput}
                                onSearch={onSearch}
                                showUploadButton={false}
                                placeholder="Search for other designs..."
                                inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-purple-100 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                            />
                        </div>
                        <button onClick={() => setAppState('cart')} className="relative p-2 genie-icon-button rounded-full shrink-0" aria-label={`View cart with ${itemCount} items`}>
                            <ShoppingBag size={24} />
                            {itemCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                                    {itemCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className={`flex flex-col items-center gap-2 w-full max-w-7xl mx-auto px-4 transition-all duration-300 ${showStickyBar ? 'pb-2' : 'pb-4'}`}>

                {/* SEO Breadcrumbs - Visible for both Shop Product and SEO Landing Pages */}
                <CustomizingPageMetaHeader
                    product={product}
                    merchant={merchant}
                    recentSearchDesign={recentSearchDesign}
                />



                {/* Two-column layout for desktop/tablet landscape */}
                <div className="w-full flex flex-col md:flex-row gap-2">
                    {/* LEFT COLUMN: Image and Update Design */}
                    <div className="flex flex-col gap-4 w-full md:w-[calc(50%-6px)]">
                        <CustomizingHeroPanel
                            mainImageContainerRef={mainImageContainerRef}
                            editedImage={editedImage}
                            activeTab={activeTab}
                            isAnalyzing={isAnalyzing}
                            isUpdatingDesign={isUpdatingDesign}
                            dynamicLoadingMessage={dynamicLoadingMessage}
                            error={error}
                            originalImagePreview={originalImagePreview}
                            preloadedHeroImage={preloadedHeroImage}
                            fallbackImageUrl={firstNonBlankImageUrl(
                                product?.image_url,
                                recentSearchDesign?.studio_edited_image_url,
                                recentSearchDesign?.original_image_url,
                            )}
                            fallbackImageAlt={product?.alt_text || recentSearchRichAlt || recentSearchDesign?.alt_text || product?.title || recentSearchDesign?.keywords || 'Custom Cake Design - Cebu Philippines'}
                            fallbackImageTitle={pageDisplayTitle || recentSearchRichAlt || 'Cake Design'}
                            initialCaption={initialCaption}
                            heroImageAlt={product?.alt_text || (product ? `${product.title} - Custom cake${merchant ? ` from ${merchant.business_name}` : ''}` : (activeTab === 'customized' && editedImage ? 'Customized Cake Design - Genie.ph' : (recentSearchRichAlt || recentSearchDesign?.alt_text || recentSearchDesign?.keywords || 'Custom Cake Design - Browse Birthday, Wedding & Character Cakes in Cebu')))}
                            heroImageTitle={pageDisplayTitle || recentSearchRichAlt || (activeTab === 'customized' && editedImage ? 'Edited Cake' : 'Original Cake')}
                            showSaveDesignButton={Boolean(originalImagePreview && analysisResult)}
                            isCurrentDesignSaved={isDesignSaved(analysisId || '')}
                            canUndo={canUndo}
                            isLoading={isLoading}
                            isReporting={isReporting}
                            isSaving={isSaving}
                            showFooterActions={Boolean(cakeInfo || analysisError)}
                            showPriceGuarantee={finalPrice !== null && !isAnalyzing}
                            isCombining={isCombining}
                            onOriginalTabSelect={() => setActiveTab('original')}
                            onCustomizedTabSelect={handleCustomizedTabClick}
                            onToggleSaveDesign={handleToggleSavedDesign}
                            onUndo={handleUndoWithModalCleanup}
                            onOpenReportModal={onOpenReportModal}
                            onSave={onSave}
                            onClearAll={onClearAll}
                        />




                        <div className="md:hidden">
                            {isAnalyzing ? (
                                <CustomizingSidebarPanel
                                    className="w-full flex flex-col gap-2 mt-2"
                                    showLoadingState
                                    showContentState={false}
                                    analysisError={null}
                                    stepSummaryProps={{
                                        cakeInfo,
                                        icingDesign,
                                        cakeMessages,
                                        mainToppers,
                                        supportElements,
                                        basePriceOptions,
                                        markerMap,
                                        itemPrices,
                                        isAdmin,
                                        isAnalyzing,
                                        isRejectionError,
                                        activeCustomization,
                                        selectedItemId: selectedItem?.id ?? null,
                                        setActiveCustomization,
                                        setSelectedItem,
                                        removeCakeMessage,
                                        updateMainTopper,
                                        updateSupportElement,
                                        onTopperImageReplace: onTopperImageReplace,
                                        onSupportElementImageReplace: onSupportElementImageReplace,
                                        openTopperSheet,
                                        onCakeInfoChange,
                                        onIcingTypeChange: handleIcingTypeChange,
                                        addOnPricing: addOnPricing?.addOnPrice ?? 0,
                                        separateIcingStep,
                                        hideStepFour,
                                        photoStepNode,
                                        onUpdateDesign: handleUpdateDesign,
                                        isUpdatingDesign: isUpdatingDesign,
                                        dirtyFields: dirtyFields,
                                        aiChatNode: !analysisError && !hideAiChat ? (
                                            <CustomizingAiChatPanel
                                                className="w-full"
                                                containerRef={aiChatDesktopContainerRef}
                                                inputRef={aiChatDesktopInputRef}
                                                chatInput={chatInput}
                                                selectedAiPromptTemplate={selectedAiPromptTemplate}
                                                selectedAiPromptColor={selectedAiPromptColor}
                                                showAiPromptColorPicker={showAiPromptColorPicker}
                                                showAiPromptSuggestions={showAiPromptSuggestions}
                                                filteredAiChatPromptSuggestions={filteredAiChatPromptSuggestions}
                                                selectedAiPromptIndex={selectedAiPromptIndex}
                                                isAiProcessing={isAiProcessing}
                                                isUpdatingDesign={isUpdatingDesign}
                                                onSubmit={handleChatSubmit}
                                                onTemplateColorPickerToggle={handleAiPromptColorPickerToggle}
                                                onTemplateClear={handleAiPromptTemplateClear}
                                                onTemplateColorChange={handleAiPromptTemplateColorChange}
                                                onInputChange={handleAiChatInputChange}
                                                onInputInteract={handleAiChatInputInteract}
                                                onInputBlur={() => setShowAiPromptSuggestions(false)}
                                                onInputKeyDown={handleAiPromptInputKeyDown}
                                                onSuggestionSelect={handleAiPromptSuggestionSelect}
                                                placeholder="✨ Describe the icing colors you want..."
                                                title="Step 4: Change Icing Colors"
                                            />
                                        ) : null,
                                    }}
                                />
                            ) : analysisError ? (
                                <div className="text-center p-6 genie-card rounded-2xl border-red-200 flex flex-col items-center justify-center gap-4 mt-2">
                                    <div className="text-red-500 bg-red-50 p-3 rounded-full">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-800">Analysis Error</h2>
                                    <p className="text-slate-600 mb-2">{analysisError.replace('AI_REJECTION: ', '')}</p>

                                    <div className="bg-orange-50 text-orange-800 text-sm p-4 rounded-xl text-left space-y-2 mb-2 w-full">
                                        <p className="font-semibold text-orange-900 border-b border-orange-200 pb-1 mb-2">Tips for better results:</p>
                                        <ul className="list-disc pl-4 space-y-1">
                                            <li>Only add images with 1 cake</li>
                                            <li>We only process cakes 1 to 3 tiers (for now)</li>
                                            <li>Use clear, well-lit images</li>
                                        </ul>
                                    </div>

                                    <div className="flex flex-col gap-2 w-full mt-2">
                                        <button
                                            onClick={handleUploadAnother}
                                            className="genie-btn-primary font-bold py-3 px-4 rounded-xl w-full"
                                        >
                                            Upload Another
                                        </button>
                                        <button
                                            onClick={() => router.push('/')}
                                            className="genie-btn-secondary font-bold py-3 px-4 rounded-xl w-full"
                                        >
                                            Go Back Home
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <CustomizingStepSummarySections
                                    layout="mobile"
                                    cakeInfo={cakeInfo}
                                    icingDesign={icingDesign}
                                    cakeMessages={cakeMessages}
                                    mainToppers={mainToppers}
                                    supportElements={supportElements}
                                    basePriceOptions={basePriceOptions}
                                    markerMap={markerMap}
                                    itemPrices={itemPrices}
                                    isAdmin={isAdmin}
                                    isAnalyzing={isAnalyzing}
                                    isRejectionError={isRejectionError}
                                    activeCustomization={activeCustomization}
                                    selectedItemId={selectedItem?.id ?? null}
                                    setActiveCustomization={setActiveCustomization}
                                    setSelectedItem={setSelectedItem}
                                    removeCakeMessage={removeCakeMessage}
                                    updateMainTopper={updateMainTopper}
                                    updateSupportElement={updateSupportElement}
                                    onTopperImageReplace={onTopperImageReplace}
                                    onSupportElementImageReplace={onSupportElementImageReplace}
                                    openTopperSheet={openTopperSheet}
                                    onCakeInfoChange={onCakeInfoChange}
                                    onIcingTypeChange={handleIcingTypeChange}
                                    addOnPricing={addOnPricing?.addOnPrice ?? 0}
                                    separateIcingStep={separateIcingStep}
                                    hideStepOne={hideStepOne}
                                    hideStepFour={hideStepFour}
                                    photoStepNode={photoStepNode}
                                    aiChatNode={!analysisError && !hideAiChat ? (
                                        <CustomizingAiChatPanel
                                            className="w-full"
                                            containerRef={aiChatMobileContainerRef}
                                            inputRef={aiChatMobileInputRef}
                                            chatInput={chatInput}
                                            selectedAiPromptTemplate={selectedAiPromptTemplate}
                                            selectedAiPromptColor={selectedAiPromptColor}
                                            showAiPromptColorPicker={showAiPromptColorPicker}
                                            showAiPromptSuggestions={showAiPromptSuggestions}
                                            filteredAiChatPromptSuggestions={filteredAiChatPromptSuggestions}
                                            selectedAiPromptIndex={selectedAiPromptIndex}
                                            isAiProcessing={isAiProcessing}
                                            isUpdatingDesign={isUpdatingDesign}
                                            onSubmit={handleChatSubmit}
                                            onTemplateColorPickerToggle={handleAiPromptColorPickerToggle}
                                            onTemplateClear={handleAiPromptTemplateClear}
                                            onTemplateColorChange={handleAiPromptTemplateColorChange}
                                            onInputChange={handleAiChatInputChange}
                                            onInputInteract={handleAiChatInputInteract}
                                            onInputBlur={() => setShowAiPromptSuggestions(false)}
                                            onInputKeyDown={handleAiPromptInputKeyDown}
                                            onSuggestionSelect={handleAiPromptSuggestionSelect}
                                            placeholder="✨ Describe the icing colors you want..."
                                        />
                                    ) : null}
                                    onUpdateDesign={handleUpdateDesign}
                                    isUpdatingDesign={isUpdatingDesign}
                                    dirtyFields={dirtyFields}
                                    originalCakeType={analysisResult?.cakeType}
                                />
                            )}
                        </div>

                    </div>
                    {/* RIGHT COLUMN: Availability at top, then Feature List */}
                    <div className="flex flex-row md:flex-col gap-2 w-[calc(100%+2rem)] md:w-[calc(50%-6px)] -mx-4 md:mx-0 overflow-x-auto md:overflow-visible scrollbar-hide snap-x snap-mandatory scroll-pl-4 pb-60 md:pb-0 -mb-60 md:mb-0 px-4 md:px-0">
                        {/* Availability Section - at top of right column */}



                        <CustomizingSidebarPanel
                            showLoadingState={isAnalyzing || (isLoading && !isDesignSaved)}
                            showContentState={Boolean(cakeInfo)}
                            analysisError={analysisError}
                            onUploadAnother={handleUploadAnother}
                            onGoBackHome={() => router.push('/')}
                            onUpdateDesign={handleUpdateDesign}
                            isUpdatingDesign={isUpdatingDesign}
                            dirtyFields={dirtyFields}
                            stepSummaryProps={{
                                cakeInfo,
                                icingDesign,
                                cakeMessages,
                                mainToppers,
                                supportElements,
                                basePriceOptions,
                                markerMap,
                                itemPrices,
                                isAdmin,
                                isAnalyzing,
                                isRejectionError,
                                activeCustomization,
                                selectedItemId: selectedItem?.id ?? null,
                                setActiveCustomization,
                                setSelectedItem,
                                removeCakeMessage,
                                updateMainTopper,
                                updateSupportElement,
                                onTopperImageReplace: onTopperImageReplace,
                                onSupportElementImageReplace: onSupportElementImageReplace,
                                openTopperSheet,
                                onCakeInfoChange,
                                onIcingTypeChange: handleIcingTypeChange,
                                addOnPricing: addOnPricing?.addOnPrice ?? 0,
                                separateIcingStep,
                                hideStepOne,
                                hideStepFour,
                                photoStepNode,
                                originalCakeType: analysisResult?.cakeType,
                                aiChatNode: !analysisError && !hideAiChat ? (
                                    <CustomizingAiChatPanel
                                        className="w-full"
                                        containerRef={aiChatDesktopContainerRef}
                                        inputRef={aiChatDesktopInputRef}
                                        chatInput={chatInput}
                                        selectedAiPromptTemplate={selectedAiPromptTemplate}
                                        selectedAiPromptColor={selectedAiPromptColor}
                                        showAiPromptColorPicker={showAiPromptColorPicker}
                                        showAiPromptSuggestions={showAiPromptSuggestions}
                                        filteredAiChatPromptSuggestions={filteredAiChatPromptSuggestions}
                                        selectedAiPromptIndex={selectedAiPromptIndex}
                                        isAiProcessing={isAiProcessing}
                                        isUpdatingDesign={isUpdatingDesign}
                                        onSubmit={handleChatSubmit}
                                        onTemplateColorPickerToggle={handleAiPromptColorPickerToggle}
                                        onTemplateClear={handleAiPromptTemplateClear}
                                        onTemplateColorChange={handleAiPromptTemplateColorChange}
                                        onInputChange={handleAiChatInputChange}
                                        onInputInteract={handleAiChatInputInteract}
                                        onInputBlur={() => setShowAiPromptSuggestions(false)}
                                        onInputKeyDown={handleAiPromptInputKeyDown}
                                        onSuggestionSelect={handleAiPromptSuggestionSelect}
                                        placeholder="✨ Describe the icing colors you want..."
                                    />
                                ) : null,
                            }}
                        />
                    </div>
                </div>

                {/* Product/Design Description & Tags - Spans full width of the two-column layout */}
                {/* SEO Content Slot from SSR (if present) OR Client-side fallback (if no slug) */}
                <CustomizingSupplementalContent
                    product={product}
                    seoContentSlot={seoContentSlot}
                    showClientFallback={!slug}
                />


                {dominantMotif && (
                    <MotifPanel
                        isOpen={isMotifPanelOpen}
                        onClose={() => setIsMotifPanelOpen(false)}
                        dominantMotif={dominantMotif}
                        onColorChange={handleMotifColorChange}
                    />
                )}

                <CustomizingEditorSheet
                    isOpen={activeCustomization !== null}
                    activeCustomization={activeCustomization}
                    activeTopperSection={activeTopperSection}
                    hideStickyBar={hideStickyBar}
                    hideAiChat={hideAiChat}
                    showAvailabilityOffset={!hideStickyBar && Boolean(availabilityType) && !isAnalyzing}
                    showWarningOffset={!hideStickyBar && Boolean(warningMessage)}
                    hasCakeInfoChanges={dirtyFields.has('cakeInfo')}
                    hasPendingVisualChanges={hasPendingVisualChanges}
                    isUpdatingDesign={isUpdatingDesign}
                    hasOriginalImageData={Boolean(originalImageData)}
                    isEmpty={
                        (activeCustomization === 'toppers' && (
                            (activeTopperSection === 'main' && mainToppers.length === 0) ||
                            (activeTopperSection === 'support' && supportElements.length === 0)
                        ))
                    }
                    onClose={() => {
                        if (!isDraftApplied.current && draftSnapshot) {
                            onIcingDesignChange(draftSnapshot.icingDesign!);
                            onCakeMessageChange(draftSnapshot.cakeMessages);
                            onMainTopperChange(draftSnapshot.mainToppers);
                            onSupportElementChange(draftSnapshot.supportElements);
                        }
                        setActiveCustomization(null);
                        setActiveTopperSection(null);
                        setSelectedItem(null);
                    }}

                    onApplyOptions={() => setActiveCustomization(null)}
                    onApplyPendingDesignChanges={handleApplyPendingDesignChanges}
                >
                    <CustomizingOptionsPanel
                        isVisible={activeCustomization === 'options'}
                        cakeInfo={cakeInfo}
                        basePriceOptions={basePriceOptions}
                        icingDesign={icingDesign}
                        onCakeInfoChange={onCakeInfoChange}
                        onIcingBaseChange={handleIcingTypeChange}
                        isAnalyzing={isAnalyzing}
                        addOnPricing={addOnPricing?.addOnPrice ?? 0}
                    />

                    <CustomizingIcingEditorPanel
                        isVisible={activeCustomization === 'icing'}
                        hasIcingChanges={hasIcingChanges}
                        icingDesign={icingDesign}
                        cakeType={cakeInfo?.type || null}
                        selectedItem={selectedItem}
                        mainToppers={mainToppers}
                        onSelectItem={setSelectedItem}
                        onIcingDesignChange={onIcingDesignChange}
                        onRevert={() => {
                            if (analysisResult?.icing_design && icingDesign) {
                                onIcingDesignChange({
                                    ...analysisResult.icing_design,
                                    dripPrice: icingDesign.dripPrice,
                                    gumpasteBaseBoardPrice: icingDesign.gumpasteBaseBoardPrice,
                                });
                                setSelectedItem(null);
                            }
                        }}
                    />

                    <CustomizingMessagesPanel
                        isVisible={activeCustomization === 'messages'}
                        cakeMessages={cakeMessages}
                        markerMap={markerMap}
                        selectedMessageId={selectedItem && 'itemCategory' in selectedItem && selectedItem.itemCategory === 'message' ? selectedItem.id : undefined}
                        cakeType={cakeInfo?.type}
                        onItemClick={handleListItemClick}
                        addCakeMessage={addCakeMessage}
                        updateCakeMessage={updateCakeMessage}
                        removeCakeMessage={removeCakeMessage}
                    />

                    <CustomizingToppersPanel
                        isVisible={activeCustomization === 'toppers'}
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
                        visibleSections={activeTopperSection ?? 'all'}
                        selectedTopperItem={
                            selectedItem && !selectedItem.isCluster && (selectedItem.itemCategory === 'topper' || selectedItem.itemCategory === 'element')
                                ? selectedItem
                                : null
                        }
                    />

                    <CustomizingPhotosPanel
                        isVisible={activeCustomization === 'photos'}
                        mainToppers={mainToppers}
                        supportElements={supportElements}
                        markerMap={markerMap}
                        updateMainTopper={updateMainTopper}
                        updateSupportElement={updateSupportElement}
                        onTopperImageReplace={onTopperImageReplace}
                        onSupportElementImageReplace={onSupportElementImageReplace}
                        itemPrices={itemPrices}
                        isAdmin={isAdmin}
                    />

                    <CustomizingInstructionsPanel
                        isVisible={activeCustomization === 'instructions'}
                        additionalInstructions={additionalInstructions}
                        onAdditionalInstructionsChange={onAdditionalInstructionsChange}
                    />
                </CustomizingEditorSheet>

                <CakeFlavorBottomSheet
                    isOpen={activeCustomization === 'flavor'}
                    onClose={() => setActiveCustomization(null)}
                    flavors={cakeInfo?.flavors || []}
                    cakeType={cakeInfo?.type || ''}
                    onFlavorChange={(newFlavors) => {
                        onCakeInfoChange({ flavors: newFlavors });
                    }}
                />

                {!slug && analysisResult && (
                    <CustomizingPostAnalysisContent
                        analysisResult={analysisResult}
                        keywords={currentKeywords || recentSearchDesign?.keywords || 'custom'}
                        availability={recentSearchDesign?.availability || availabilityType || 'normal'}
                        tags={recentSearchDesign?.tags || []}
                        aboutDescription={recentSearchDesign?.seo_description || recentSearchDesign?.alt_text || analysisResult.seo_description || analysisResult.alt_text || ''}
                        basePriceOptions={basePriceOptions}
                    />
                )}

                {postEditorSlot}

                <div className="w-full pb-28">
                    <CustomizingDiscoverySections
                        isAnalyzing={isAnalyzing}
                        relatedDesigns={displayedRelatedDesigns}
                        hasMoreDesigns={hasMoreDesigns}
                        isLoadingMoreDesigns={isLoadingMoreDesigns}
                        onLoadMoreDesigns={handleLoadMoreDesigns}
                    />
                </div>

                <StickyAddToCartBar
                    price={hideStickyBar ? null : (() => { const raw = finalPrice ?? (useBasePriceAsFallback ? (basePrice ?? null) : null); return raw !== null ? raw + ediblePhotoAddonPrice : null; })()}
                    ediblePhotoAddonNote={!hideStickyBar && ediblePhotoAddonPrice > 0}
                    isLoading={hideStickyBar ? false : isFetchingBasePrice}
                    isAdding={isAddingToCart}
                    error={hideStickyBar ? null : (basePriceError || analysisError || null)}
                    onAddToCartClick={onAddToCart}
                    onShareClick={onShare}
                    onChatClick={handleChatClick}
                    isSharing={isSharing}
                    canShare={!!analysisResult && isAnalysisCached}
                    isAnalyzing={hideStickyBar ? false : isAnalyzing}
                    // DISABLED: Preselection modal disabled
                    // isBlurred={isPreSelectionModalOpen}
                    cakeInfo={cakeInfo}
                    warningMessage={hideStickyBar ? undefined : (isSafetyFallback ? "AI editing disabled for adult-themed content. Your design changes will still be saved." : warningMessage)}
                    warningDescription={hideStickyBar ? undefined : warningDescription}
                    onWarningClick={warningMessage && !isSafetyFallback ? () => openTopperSheet() : undefined}
                    availability={hideStickyBar ? undefined : availabilityType}
                    hasPendingDesignChanges={hideStickyBar ? false : hasPendingVisualChanges}
                    onApplyChangesClick={handleApplyPendingDesignChanges}
                    isApplyingChanges={hideStickyBar ? false : isUpdatingDesign}
                    applyChangesLabel="Apply Design Changes"
                />
                <ReportModal
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    onSubmit={handleReport}
                    isSubmitting={isReporting}
                    editedImage={editedImage}
                    details={analysisResult && cakeInfo && icingDesign ? buildCartItemDetails() : null}
                    cakeInfo={cakeInfo}
                />
                <ShareModal
                    isOpen={isShareModalOpen}
                    onClose={closeShareModal}
                    shareData={shareData}
                />
                <ChatModal
                    isOpen={isChatModalOpen}
                    onClose={() => setIsChatModalOpen(false)}
                    userId={user?.id}
                    userEmail={user?.email}
                    userName={user?.email?.split('@')[0]}
                />
                <ImageUploader
                    isOpen={isUploaderOpen}
                    onClose={() => setIsUploaderOpen(false)}
                    onImageSelect={handleImageSelect}
                    source="customizing"
                />
                <PreSelectionModal
                    // DISABLED: Preselection modal disabled
                    isOpen={false}
                    isAnalyzing={isAnalyzing}
                    onClose={handlePreSelectionClose}
                    onApply={handlePreSelectionApply}
                />
            </div>
        </>
    );
};

export default CustomizingClient;
