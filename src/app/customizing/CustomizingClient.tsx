'use client';

import React, { Dispatch, SetStateAction, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { findClosestColor, hexToColorNameProse } from '@/utils/colorUtils';
import { generateDesignDetails } from '@/utils/designContentUtils';
import { X, Wand2, Palette, MessageSquare, PartyPopper, Image as ImageIconLucide, Cake, Zap, Clock, CalendarDays, ChevronRight } from 'lucide-react';
import { CakeBaseOptions } from '@/components/CakeBaseOptions';

import { SegmentationOverlay } from '../../components/SegmentationOverlay';
import { SegmentationBottomSheet } from '../../components/SegmentationBottomSheet';
import { CustomizationSkeleton } from '../../components/LoadingSkeletons';
import { BackIcon, UserCircleIcon, LogOutIcon, MapPinIcon, PackageIcon, TrashIcon } from '../../components/icons';
import { ShoppingBag } from 'lucide-react';
import { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, BasePriceInfo, CakeType, AvailabilitySettings, IcingColorDetails, AnalysisItem, ClusteredMarker, CartItem } from '../../types';
import { CakeGenieCartItem, CakeGenieMerchant, CakeGenieMerchantProduct } from '../../lib/database.types';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { AvailabilityType } from '../../lib/utils/availability';

import { COLORS, CAKE_TYPE_THUMBNAILS, CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, FLAVOR_THUMBNAILS } from '@/constants';
import { ColorPalette } from '../../components/ColorPalette';
import StickyAddToCartBar from '../../components/StickyAddToCartBar';
import { showSuccess, showError, showInfo } from '../../lib/utils/toast';
import { reportCustomization, uploadReportImage, getAnalysisByExactHash, getRelatedProductsByKeywords, getCollectionsForDesign } from '../../services/supabaseService';
import ReportModal from '../../components/ReportModal';
import ShareModal from '../../components/ShareModal';
import { CartItemDetails } from '../../types';
import { buildKnownSeoMetadata } from './knownSeoMetadata';
import { getRefLoadStrategy, parsePersistedAnalysis } from './refLoadStrategy';
import {
    CustomizingDiscoverySections,
    type CustomizingRelatedCollection,
    type CustomizingRelatedDesign,
} from './CustomizingDiscoverySections';
import { CustomizingPostAnalysisContent } from './CustomizingPostAnalysisContent';
import {
    CustomizingPageMetaHeader,
    CustomizingSupplementalContent,
} from './CustomizingPageMetaSections';
import { CustomizingEditorSheet } from './CustomizingEditorSheet';
import { CustomizingHeroPanel } from './CustomizingHeroPanel';
import { CustomizingIcingEditorPanel } from './CustomizingIcingEditorPanel';
import { CustomizingInstructionsPanel } from './CustomizingInstructionsPanel';
import { CustomizingMessagesPanel } from './CustomizingMessagesPanel';
import { CustomizingOptionsPanel } from './CustomizingOptionsPanel';
import { CustomizingPhotosPanel } from './CustomizingPhotosPanel';
import { CustomizingSidebarPanel } from './CustomizingSidebarPanel';
import { CustomizingStepSummarySections } from './CustomizingStepSummarySections';
import { CustomizingToppersPanel } from './CustomizingToppersPanel';
import {
    buildRelatedCollectionsRequestKey,
    getAutoRelatedDesignRequest,
    shouldHydrateImageFromExistingAnalysis,
    shouldLoadPropDesign,
    shouldLogShopifyCseMount,
} from './customizingClientGuards';


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
import { buildAiChatPromptSuggestions, shouldShowAiPromptSuggestion } from '@/utils/aiPromptSuggestions';
import { fillAiChatPromptTemplate, parseAiChatPromptTemplate, ParsedAiChatPromptTemplate } from '@/utils/aiChatPromptComposer';
import { mapAnalysisToState } from '@/utils/customizationMapper';
import type { DesignPromptGenerator } from '@/hooks/useDesignUpdate';

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
    _mainToppers,
    _supportElements,
    _cakeMessages,
    _icingDesign,
    additionalInstructions,
) => {
    const userRequest = additionalInstructions.match(AI_CHAT_USER_REQUEST_REGEX)?.[1]?.trim()
        ?? additionalInstructions.trim();

    const changes = [
        `- **⚡ PRIMARY USER REQUEST (HIGHEST PRIORITY):** ${userRequest}. Apply this user request directly to the cake image.`,
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
        <div className={`fixed bottom-28 right-4 w-80 max-w-[90vw] bg-white/90 backdrop-blur-lg shadow-2xl border border-slate-200 z-50 flex flex-col transform rounded-xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'}`}>
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
    initialCaption?: string;
    // Preloaded image URL from SSR for Shopify CSE handoff - enables instant display
    preloadImageUrl?: string | null;
}

const CustomizingClient: React.FC<CustomizingClientProps> = ({ product, merchant, recentSearchDesign, productDetails, initialPrices, relatedDesigns, currentKeywords, currentSlug, seoContentSlot, initialCaption, preloadImageUrl }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams();
    const slug = params?.slug || currentSlug;

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
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [reportStatus, setReportStatus] = useState<'success' | 'error' | null>(null);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const [pendingCartItems, setPendingCartItems] = useState<CartItem[]>([]);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [isPreparingSharedDesign, setIsPreparingSharedDesign] = useState(false);
    const [previousAnalysisSnapshot, setPreviousAnalysisSnapshot] = useState<HybridAnalysisResult | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [showAiPromptSuggestions, setShowAiPromptSuggestions] = useState(false);
    const [selectedAiPromptIndex, setSelectedAiPromptIndex] = useState(-1);
    const [selectedAiPromptTemplate, setSelectedAiPromptTemplate] = useState<ParsedAiChatPromptTemplate | null>(null);
    const [selectedAiPromptColor, setSelectedAiPromptColor] = useState('');
    const [showAiPromptColorPicker, setShowAiPromptColorPicker] = useState(false);

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
    const [relatedCollections, setRelatedCollections] = useState<CustomizingRelatedCollection[]>([]);
    const [isLoadingCollections, setIsLoadingCollections] = useState(false);

    // --- Refs ---
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const mainImageContainerRef = useRef<HTMLDivElement>(null);
    const isLoadingDesignRef = useRef(false); // Guard against duplicate analysis calls
    const isLoadingShopifyCseRef = useRef(false); // Guard against duplicate Shopify CSE loads
    const isResettingRef = useRef(false); // Guard against reloading the current design during Reset Everything
    const lastProcessedDesignRefUrl = useRef<string | null>(null);
    const lastAutoRelatedDesignRequestKeyRef = useRef<string | null>(null);
    const lastRelatedCollectionsRequestKeyRef = useRef<string | null>(null);
    const aiChatContainerRef = useRef<HTMLFormElement>(null);
    const aiChatInputRef = useRef<HTMLInputElement>(null);
    const stickyChatContainerRef = useRef<HTMLDivElement>(null);
    const stickyChatInputRef = useRef<HTMLTextAreaElement>(null);

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

    const relatedCollectionsTags = analysisResult?.tags || null;
    const relatedCollectionsKeyword = analysisResult?.keyword || null;
    const relatedCollectionsRequestKey = useMemo(
        () => buildRelatedCollectionsRequestKey(relatedCollectionsTags, relatedCollectionsKeyword),
        [relatedCollectionsTags, relatedCollectionsKeyword]
    );

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
        return aiChatPromptSuggestionItems.filter(({ suggestion, template }) => (
            shouldShowAiPromptSuggestion(suggestion, normalizedQuery)
            && (!normalizedQuery || `${suggestion} ${template?.placeholderLabel ?? ''}`
                .toLowerCase()
                .includes(normalizedQuery))
        ));
    }, [aiChatPromptSuggestionItems, chatInput]);

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


    const { isShareModalOpen, shareData, isSavingDesign, handleShare, createShareLink, closeShareModal } = useDesignSharing({
        slug: (persistedSlug || slug || seoMetadata?.slug) as string || null,
        originalImageUrl: seoMetadata?.original_image_url || null,
    });

    const knownSeoMetadata = useMemo(
        () => buildKnownSeoMetadata(product, recentSearchDesign),
        [product, recentSearchDesign]
    );

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

    // Auto-load related collections when analysis is complete
    useEffect(() => {
        if (!relatedCollectionsRequestKey) return;
        if (lastRelatedCollectionsRequestKeyRef.current === relatedCollectionsRequestKey) return;

        lastRelatedCollectionsRequestKeyRef.current = relatedCollectionsRequestKey;

        const fetchCollections = async () => {
            setIsLoadingCollections(true);
            try {
                const tags = relatedCollectionsTags || [];
                const keyword = relatedCollectionsKeyword || '';
                const { data } = await getCollectionsForDesign(tags, keyword);
                if (data) {
                    setRelatedCollections(data);
                }
            } catch (error) {
                lastRelatedCollectionsRequestKeyRef.current = null;
                // Silently handle meta data fetch error
            } finally {
                setIsLoadingCollections(false);
            }
        };

        fetchCollections();
    }, [relatedCollectionsKeyword, relatedCollectionsRequestKey, relatedCollectionsTags]);

    // --- AI Chat Customization Handler ---
    const submitAiChatPrompt = useCallback(async (prompt: string) => {
        const currentPrompt = prompt.trim();
        if (!currentPrompt || !analysisResult || isAiProcessing || isUpdatingDesign) return;

        const traceId = `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let resolveMergedAnalysis: ((value: HybridAnalysisResult) => void) | undefined;
        let rejectMergedAnalysis: ((reason?: unknown) => void) | undefined;

        setIsAiProcessing(true);
        setChatInput('');

        try {
            const syncedAnalysis = getSyncedAnalysisResult() || analysisResult;
            const mergedAnalysisReady = new Promise<HybridAnalysisResult>((resolve, reject) => {
                resolveMergedAnalysis = resolve;
                rejectMergedAnalysis = reject;
            });

            // 1. Fire Image Edit (runs in background, hook manages state/error)
            // We keep this fully parallel and drive the first image pass directly from the
            // raw user request + normal image-edit system instruction selection.
            handleUpdateDesign(`[USER REQUEST]: ${currentPrompt}`, {
                traceId,
                source: 'ai-chat-image-edit',
                promptGenerator: AI_CHAT_IMAGE_PROMPT_GENERATOR,
            }).catch(err => {
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
            const input = aiChatInputRef.current || stickyChatInputRef.current;
            if (input) {
                input.focus();
                const cursorPosition = suggestion.length;
                input.setSelectionRange(cursorPosition, cursorPosition);
            }
        });
    }, []);

    const handleStickySuggestionSelect = useCallback((suggestion: string) => {
        // For the sticky bar, always put the raw text into the textarea.
        // Replace the "..." placeholder so the user can just type the value after it.
        const text = suggestion.replace('...', '');
        setSelectedAiPromptTemplate(null);
        setSelectedAiPromptColor('');
        setShowAiPromptColorPicker(false);
        setChatInput(text);
        setShowAiPromptSuggestions(false);
        setSelectedAiPromptIndex(-1);

        requestAnimationFrame(() => {
            if (stickyChatInputRef.current) {
                stickyChatInputRef.current.focus();
                const cursorPosition = text.length;
                stickyChatInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
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
            aiChatInputRef.current?.focus();
            const cursorPosition = template.length;
            aiChatInputRef.current?.setSelectionRange(cursorPosition, cursorPosition);
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
            const isOutsideTopChat = aiChatContainerRef.current && !aiChatContainerRef.current.contains(event.target as Node);
            const isOutsideStickyChat = stickyChatContainerRef.current && !stickyChatContainerRef.current.contains(event.target as Node);

            // Close suggestions if clicked outside both containers
            if ((!aiChatContainerRef.current || isOutsideTopChat) && (!stickyChatContainerRef.current || isOutsideStickyChat)) {
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
        const targetImageUrl = product?.image_url || recentSearchDesign?.original_image_url;
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
                        analysisData
                            ? { imageUrl: targetImageUrl, precomputedAnalysis: analysisData, knownSeoMetadata: knownSeoMetadata || undefined }
                            : { imageUrl: targetImageUrl, knownSeoMetadata: knownSeoMetadata || undefined }
                    );
                })
                .catch(err => {
                    // Fallback to old full flow if fast path crashes
                    isLoadingDesignRef.current = false; // Reset lock to allow retry or old flow
                    setIsAnalyzing(false);
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
                    { imageUrl: targetImageUrl!, knownSeoMetadata: knownSeoMetadata || undefined }
                );

            } catch (err) {
                showError("Failed to load product.");
                setIsAnalyzing(false);
                isLoadingDesignRef.current = false;
            }
        };

        fetchProductImage();
    }, [product, recentSearchDesign, originalImageData, isImageManagementLoading, hookImageUpload, loadImageWithoutAnalysis, setIsAnalyzing, clearImages, clearCustomization, analysisResult, analysisId, persistedSlug, setCurrentSlug, setPendingAnalysisData, knownSeoMetadata, setAnalysisError]);

    // Handle image loading from external site (cakesandmemories.com Shopify CSE)
    // Uses URL query params because sessionStorage is per-origin and doesn't survive cross-domain redirects.
    // Expected URL: /customizing?source=shopify_cse&image_url=ENCODED_URL&image_name=cake.jpg&image_type=image/jpeg
    // NOTE: We read from window.location.search directly (not useSearchParams) because
    // Next.js can cache/stale the React hook value on subsequent cross-domain navigations.
    useEffect(() => {
        const loadPendingImage = async () => {
            try {
                // Read directly from the browser URL bar — avoids Next.js searchParams caching
                const urlParams = new URLSearchParams(window.location.search);
                const sourceParam = urlParams.get('source');
                const imageUrlParam = urlParams.get('image_url');

                // Not a Shopify CSE handoff — bail
                if (sourceParam !== 'shopify_cse') {
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
                setIsAnalyzing(true);
                showInfo("Loading your cake design...");

                // Reject blob URLs (dead after navigation)
                const imageUrl = imageUrlParam.startsWith('blob:') ? null : imageUrlParam;

                if (!imageUrl) {
                    setIsAnalyzing(false);
                    isLoadingShopifyCseRef.current = false;
                    showError("Image link expired. Please try again from the shop.");
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
                        setIsAnalyzing(false);
                        isLoadingShopifyCseRef.current = false;
                        showError("Failed to analyze image: " + error.message);
                    }
                );

            } catch (err: any) {
                setIsAnalyzing(false);
                isLoadingShopifyCseRef.current = false;
                showError("Failed to load image. Please try again.");
            }
        };

        loadPendingImage();
    }, [isImageManagementLoading, hookImageUpload, clearImages, clearCustomization]);

    // Handle "Customize This Design" flow (loading from URL ref) - Shopify/external integrations
    useEffect(() => {
        const refUrl = searchParams.get('ref');
        const fromSaved = searchParams.get('fromSaved') === 'true';
        const fromMerchant = searchParams.get('fromMerchant') === 'true';

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
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('fromMerchant');
            router.replace(`${pathname}?${newParams.toString()}`);

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
                                        setAnalysisError("Failed to load product");
                                        showError("Failed to load product");
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
                        if (err instanceof Error && err.message.startsWith('AI_REJECTION:')) {
                            setAnalysisError(err.message);
                            showError(err.message.replace('AI_REJECTION: ', ''));
                        } else {
                            showError("Failed to analyze the shared design.");
                        }
                        setIsAnalyzing(false);
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
                isLoadingDesignRef.current = false;
            }
        };

        fetchAndAnalyze();
    }, [searchParams, isImageManagementLoading, hookImageUpload, loadImageWithoutAnalysis, setIsAnalyzing, setPendingAnalysisData, analysisResult, clearImages, clearCustomization, setAnalysisError]);


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
    const onOpenReportModal = () => setIsReportModalOpen(true);

    const onUpdateDesign = handleUpdateDesign;
    const onSave = handleSave;
    const isSaving = false;

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
        if (previousAnalysisSnapshot) {
            setPendingAnalysisData(previousAnalysisSnapshot);
            setPreviousAnalysisSnapshot(null);
        }
        setEditedImage(null);
        setActiveTab('original');
    }, [previousAnalysisSnapshot, previousImageData, setEditedImage, setOriginalImageData, setPendingAnalysisData, setPreviousImageData]);

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
            cakeMessages: cakeMessages.filter((m: CakeMessageUI) => m.isEnabled && m.text && m.text.trim().length > 0).map((m: CakeMessageUI) => ({ text: m.text, color: hexToName(m.color) })),
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

    const onAddToCart = async () => {
        if (hasPendingVisualChanges) {
            showInfo('Apply your design changes first so the preview matches what you add to cart.');
            return;
        }

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
                    cakeMessages: cakeMessages.filter(m => m.isEnabled && m.text && m.text.trim().length > 0).map(m => ({
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
    const [selectedItem, setSelectedItem] = useState<ClusteredMarker | null>(null);
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
    const [activeTopperSection, setActiveTopperSection] = useState<'main' | 'support' | null>(null);





    const openTopperSheet = useCallback((section: 'main' | 'support' | null = null) => {
        setActiveTopperSection(section);
        setActiveCustomization('toppers');
    }, []);

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
            // Robust matching: Try ID first, then fallback to position since we typically have 1 message per position
            const originalMsg = analysisResult.cake_messages?.find((m: any) =>
                (m.id && m.id === currentMsg.id) || (!m.id && m.position === currentMsg.position)
            );

            if (!originalMsg) return true; // New message at a new position

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

    const hasPendingVisualChanges = useMemo(() => {
        return hasIcingChanges || hasMessageChanges || hasToppersChanges || hasPhotoChanges;
    }, [hasIcingChanges, hasMessageChanges, hasToppersChanges, hasPhotoChanges]);

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

    const handleApplyPendingDesignChanges = useCallback(() => {
        if (isUpdatingDesign || !originalImageData || !hasPendingVisualChanges) {
            return;
        }

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
            text: text || 'Your Text Here',
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

    const showStickyBar = finalPrice !== null || !!basePriceError || isAnalyzing || !!warningMessage || isSafetyFallback || hasPendingVisualChanges || isUpdatingDesign;

    return (
        <>
            <h1 className="sr-only">{seoMetadata?.seo_title || 'Customize Your Cake Design - Genie.ph'}</h1>
            <div className="w-full max-w-7xl mx-auto px-4">
                <div className="w-full flex items-center gap-2 md:gap-4 mb-4 pt-6">
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
                            fallbackImageUrl={product?.image_url || recentSearchDesign?.original_image_url || null}
                            fallbackImageAlt={product?.alt_text || recentSearchDesign?.alt_text || product?.title || recentSearchDesign?.keywords || 'Cake Design'}
                            fallbackImageTitle={product?.title || recentSearchDesign?.seo_title || recentSearchDesign?.keywords || 'Cake Design'}
                            initialCaption={initialCaption}
                            heroImageAlt={product?.alt_text || (product ? `${product.title} - Custom cake${merchant ? ` from ${merchant.business_name}` : ''}` : (activeTab === 'customized' && editedImage ? 'Edited Cake' : 'Original Cake'))}
                            heroImageTitle={product?.title || recentSearchDesign?.seo_title || recentSearchDesign?.keywords || (activeTab === 'customized' && editedImage ? 'Edited Cake' : 'Original Cake')}
                            showSaveDesignButton={Boolean(originalImagePreview && analysisResult)}
                            isCurrentDesignSaved={isDesignSaved(analysisId || '')}
                            canUndo={canUndo}
                            isLoading={isLoading}
                            isReporting={isReporting}
                            isSaving={isSaving}
                            showFooterActions={Boolean(cakeInfo || analysisError)}
                            onOriginalTabSelect={() => setActiveTab('original')}
                            onCustomizedTabSelect={handleCustomizedTabClick}
                            onToggleSaveDesign={handleToggleSavedDesign}
                            onUndo={handleUndoWithModalCleanup}
                            onOpenReportModal={onOpenReportModal}
                            onSave={onSave}
                            onClearAll={onClearAll}
                        />



                        <CustomizingStepSummarySections
                            layout="mobile"
                            cakeInfo={cakeInfo}
                            icingDesign={icingDesign}
                            cakeMessages={cakeMessages}
                            mainToppers={mainToppers}
                            supportElements={supportElements}
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
                        />

                    </div>
                    {/* RIGHT COLUMN: Availability at top, then Feature List */}
                    <div className="flex flex-row md:flex-col gap-2 w-[calc(100%+2rem)] md:w-[calc(50%-6px)] -mx-4 md:mx-0 overflow-x-auto md:overflow-visible scrollbar-hide snap-x snap-mandatory scroll-pl-4 pb-60 md:pb-0 -mb-60 md:mb-0 px-4 md:px-0 relative z-30">
                        {/* Availability Section - at top of right column */}


                        <CustomizingSidebarPanel
                            showLoadingState={isAnalyzing || (isLoading && !isDesignSaved)}
                            showContentState={Boolean(cakeInfo || analysisError)}
                            stepSummaryProps={{
                                cakeInfo,
                                icingDesign,
                                cakeMessages,
                                mainToppers,
                                supportElements,
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
                    showAvailabilityOffset={Boolean(availabilityType) && !isAnalyzing}
                    showWarningOffset={Boolean(warningMessage)}
                    hasCakeInfoChanges={dirtyFields.has('cakeInfo')}
                    hasPendingVisualChanges={hasPendingVisualChanges}
                    isUpdatingDesign={isUpdatingDesign}
                    hasOriginalImageData={Boolean(originalImageData)}
                    onClose={() => {
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
                        onCakeInfoChange={onCakeInfoChange}
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

                <StickyAddToCartBar
                    price={finalPrice}
                    isLoading={isFetchingBasePrice}
                    isAdding={isAddingToCart}
                    error={basePriceError}
                    onAddToCartClick={onAddToCart}
                    onShareClick={onShare}
                    isSharing={isSharing}
                    canShare={!!analysisResult && isAnalysisCached && !hasPendingVisualChanges && !isUpdatingDesign}
                    isAnalyzing={isAnalyzing}
                    cakeInfo={cakeInfo}
                    warningMessage={isSafetyFallback ? "AI editing disabled for adult-themed content. Your design changes will still be saved." : warningMessage}
                    warningDescription={warningDescription}
                    onWarningClick={warningMessage && !isSafetyFallback ? () => openTopperSheet() : undefined}
                    availability={availabilityType}
                    hasPendingDesignChanges={hasPendingVisualChanges}
                    onApplyChangesClick={handleApplyPendingDesignChanges}
                    isApplyingChanges={isUpdatingDesign}
                    applyChangesLabel="Apply Design Changes"
                    chatInput={chatInput}
                    onChatInputChange={handleAiChatInputChange}
                    onChatSubmit={handleChatSubmit}
                    isAiProcessing={isAiProcessing}
                    showAiPromptSuggestions={showAiPromptSuggestions}
                    filteredAiChatPromptSuggestions={filteredAiChatPromptSuggestions}
                    selectedAiPromptIndex={selectedAiPromptIndex}
                    onSuggestionSelect={handleAiPromptSuggestionSelect}
                    onInputInteract={handleAiChatInputInteract}
                    onInputKeyDown={handleAiPromptInputKeyDown}
                    containerRef={stickyChatContainerRef}
                    inputRef={stickyChatInputRef}
                    selectedAiPromptTemplate={selectedAiPromptTemplate}
                    selectedAiPromptColor={selectedAiPromptColor}
                    showAiPromptColorPicker={showAiPromptColorPicker}
                    onTemplateColorPickerToggle={handleAiPromptColorPickerToggle}
                    onTemplateClear={handleAiPromptTemplateClear}
                    onTemplateColorChange={handleAiPromptTemplateColorChange}
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
                />

                <CustomizingDiscoverySections
                    isAnalyzing={isAnalyzing}
                    relatedDesigns={displayedRelatedDesigns}
                    hasMoreDesigns={hasMoreDesigns}
                    isLoadingMoreDesigns={isLoadingMoreDesigns}
                    onLoadMoreDesigns={handleLoadMoreDesigns}
                    relatedCollections={relatedCollections}
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
            </div>
        </>
    );
};

export default CustomizingClient;
