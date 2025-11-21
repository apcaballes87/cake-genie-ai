import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  getShopifyCustomizationRequest,
  updateShopifyCustomizationRequest,
  ShopifyCustomizationRequest,
  reportCustomization
} from '../../services/supabaseService';
import {
  useImageManagement,
  useCakeCustomization,
  usePricing,
  useDesignUpdate
} from '../../hooks';
import { createShopifyEditPrompt } from './prompt';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { FeatureList } from '../../components/FeatureList';
import { MagicSparkleIcon, Loader2, ErrorIcon, ReportIcon, BackIcon, SaveIcon, ResetIcon } from '../../components/icons';
import { showError, showSuccess, showInfo } from '../../lib/utils/toast';
import { CartItemDetails, MainTopperUI, CakeMessageUI } from '../../types';
import { FloatingImagePreview } from '../../components/FloatingImagePreview';
import { COLORS } from '../../constants';
import ReportModal from '../../components/ReportModal';
import { FloatingResultPanel } from '../../components/FloatingResultPanel';
import { AnalysisItem } from '../customizing/page';
import { AvailabilityType } from '../../lib/utils/availability';

interface ShopifyCustomizingPageProps {
  sessionId: string;
  onNavigateHome: () => void;
  user?: { id?: string; email?: string } | null;
}

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


const ShopifyCustomizingPage: React.FC<ShopifyCustomizingPageProps> = ({ sessionId, onNavigateHome, user }) => {
  // --- Component State ---
  const [requestData, setRequestData] = useState<ShopifyCustomizationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'customized'>('original');
  const [isMainImageVisible, setIsMainImageVisible] = useState(true);
  const mainImageContainerRef = useRef<HTMLDivElement>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AnalysisItem | null>(null);


  // --- Core Hooks ---
  const {
    originalImageData,
    originalImagePreview,
    editedImage,
    threeTierReferenceImage,
    isLoading: isImageLoading,
    error: imageError,
    setEditedImage,
    loadImageWithoutAnalysis,
    uploadCartImages,
  } = useImageManagement();

  const {
    cakeInfo,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    additionalInstructions,
    analysisResult,
    // FIX: Destructure analysisId to pass it to the usePricing hook.
    analysisId,
    isCustomizationDirty,
    setIsCustomizationDirty,
    handleCakeInfoChange,
    onMainTopperChange,
    // FIX: Destructure the correct update/remove functions instead of the non-existent `onSupportElementChange`.
    updateMainTopper,
    removeMainTopper,
    updateSupportElement,
    removeSupportElement,
    onCakeMessageChange,
    updateCakeMessage,
    removeCakeMessage,
    onIcingDesignChange,
    onAdditionalInstructionsChange,
    handleTopperImageReplace,
    handleSupportElementImageReplace,
    initializeFromShopify,
    availability,
  } = useCakeCustomization();

  // FIX: Destructure `itemPrices` from the `usePricing` hook.
  const { addOnPricing, finalPrice, itemPrices } = usePricing({
    analysisResult,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    cakeInfo,
    onCakeInfoCorrection: handleCakeInfoChange,
    initialPriceInfo: requestData ? { size: requestData.shopify_variant_title, price: requestData.shopify_base_price } : null,
    // FIX: Pass the required analysisId prop to the usePricing hook.
    analysisId,
  });

  const {
    isLoading: isUpdatingDesign,
    error: designUpdateError,
    handleUpdateDesign,
    lastGenerationInfoRef,
  } = useDesignUpdate({
    originalImageData,
    analysisResult,
    cakeInfo,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    additionalInstructions,
    threeTierReferenceImage,
    onSuccess: (editedImageResult: string) => {
      setEditedImage(editedImageResult);
      setActiveTab('customized');
      setIsCustomizationDirty(false);
    },
    promptGenerator: createShopifyEditPrompt, // Use the specialized prompt generator
  });

  // --- Data Fetching Effect ---
  useEffect(() => {
    const loadRequest = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await getShopifyCustomizationRequest(sessionId);
        if (fetchError) throw fetchError;
        if (!data) throw new Error('Customization session not found.');

        setRequestData(data);
        await loadImageWithoutAnalysis(data.shopify_product_image_url);
        initializeFromShopify(data);

      } catch (err: any) {
        setError(err.message || 'Failed to load customization session.');
        showError(err.message || 'Failed to load customization session.');
      } finally {
        setIsLoading(false);
      }
    };
    loadRequest();
  }, [sessionId, initializeFromShopify, loadImageWithoutAnalysis]);

  const pageIsLoading = isLoading || isImageLoading;

  // --- Intersection Observer for Floating Image ---
  useEffect(() => {
    const element = mainImageContainerRef.current;

    // If the element doesn't exist yet, or the page is still loading,
    // we can't set up the observer. The effect will re-run when `pageIsLoading` changes.
    if (!element || pageIsLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainImageVisible(entry.isIntersecting);
      },
      {
        root: null, 
        rootMargin: '0px',
        threshold: 0.1,
      }
    );

    observer.observe(element);

    // Cleanup function: unobserve the element when the component unmounts
    // or when the effect re-runs.
    return () => {
      observer.unobserve(element);
    };
  }, [pageIsLoading]);
  
  // --- Derived State & Memos ---
  const pageError = error || imageError || designUpdateError;
  const totalAddOnPrice = addOnPricing?.addOnPrice ?? 0;
  const finalShopifyPrice = useMemo(() => {
    if (!requestData) return 0;
    return requestData.shopify_base_price + totalAddOnPrice;
  }, [requestData, totalAddOnPrice]);

  const primaryMessage = useMemo(() => cakeMessages.find(m => m.position !== 'base_board' && !m.originalMessage), [cakeMessages]);
  const baseBoardMessage = useMemo(() => cakeMessages.find(m => m.position === 'base_board' && !m.originalMessage), [cakeMessages]);
  const availabilityInfo = AVAILABILITY_MAP[availability];

  const HEX_TO_COLOR_NAME_MAP = useMemo(() => COLORS.reduce((acc, color) => {
    acc[color.hex.toLowerCase()] = color.name;
    return acc;
  }, {} as Record<string, string>), []);

  const handleListItemClick = useCallback((item: AnalysisItem) => {
    setSelectedItem(item);
  }, []);

  const markerMap = useMemo(() => new Map<string, string>(), []);

  // --- Handlers ---
  const handleCustomizedTabClick = () => {
    if (isCustomizationDirty) {
      handleUpdateDesign();
    } else {
      setActiveTab('customized');
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  
  const buildCartItemDetails = useCallback((): CartItemDetails | null => {
    if (!cakeInfo || !icingDesign) return null;
    const hexToName = (hex: string) => HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || hex;
    return {
        flavors: cakeInfo.flavors,
        mainToppers: mainToppers.filter(t => t.isEnabled).map(t => ({
            description: `${t.description} (${t.size})`,
            type: t.type,
            size: t.size,
        })),
        supportElements: supportElements.filter(s => s.isEnabled).map(s => ({
            description: `${s.description} (${s.coverage})`,
            type: s.type,
            coverage: s.coverage,
        })),
        cakeMessages: cakeMessages.filter(m => m.isEnabled).map(m => ({ text: m.text, color: hexToName(m.color) })),
        icingDesign: {
            drip: icingDesign.drip,
            gumpasteBaseBoard: icingDesign.gumpasteBaseBoard,
            colors: Object.entries(icingDesign.colors).reduce((acc, [key, value]) => {
                if (typeof value === 'string' && value) acc[key] = hexToName(value);
                return acc;
            }, {} as Record<string, string>),
        },
        additionalInstructions: additionalInstructions.trim(),
    };
  }, [cakeInfo, icingDesign, mainToppers, supportElements, cakeMessages, additionalInstructions, HEX_TO_COLOR_NAME_MAP]);
  
  const generateCustomizationProperties = useCallback(() => {
    const properties: Record<string, string> = {};
    if (!cakeInfo || !icingDesign) return properties;

    properties['Cake Size'] = cakeInfo.size;
    cakeInfo.flavors.forEach((flavor, index) => {
        const tierLabel = cakeInfo.flavors.length > 1 ? `Tier ${index + 1} ` : '';
        properties[`${tierLabel}Flavor`] = flavor;
    });

    mainToppers.filter(t => t.isEnabled).forEach((topper, i) => {
        let topperString = `${topper.description} (${topper.size})`;
        // FIX: Add type guard for topper.color to ensure it's a string before calling string methods.
        if (topper.color && (!topper.original_color || topper.color.toLowerCase() !== topper.original_color.toLowerCase())) {
          topperString += ` - Color: ${HEX_TO_COLOR_NAME_MAP[topper.color.toLowerCase()] || topper.color}`;
        }
        properties[`Topper ${i + 1}`] = topperString;
    });

    supportElements.filter(s => s.isEnabled).forEach((element, i) => {
        properties[`Support ${i + 1}`] = `${element.description} (${element.coverage})`;
    });

    cakeMessages.filter(m => m.isEnabled).forEach((message, i) => {
        properties[`Message ${i + 1}`] = `"${message.text}" (${HEX_TO_COLOR_NAME_MAP[message.color.toLowerCase()] || message.color})`;
    });

    if (icingDesign.drip) {
        properties['Icing Feature 1'] = 'Drip Effect';
    }
    if (icingDesign.gumpasteBaseBoard) {
        properties['Icing Feature 2'] = 'Gumpaste Base Board';
    }
    if (additionalInstructions) {
        properties['Instructions'] = additionalInstructions;
    }

    // Add final image URL
    if (editedImage) {
        properties['_Customized Image'] = editedImage; // Shopify uses underscore for hidden properties
    }
    
    return properties;
  }, [cakeInfo, icingDesign, mainToppers, supportElements, cakeMessages, additionalInstructions, editedImage, HEX_TO_COLOR_NAME_MAP]);

    const handleSaveCustomization = async () => {
        setIsSaving(true);
        try {
            if (isCustomizationDirty) {
                showInfo("Updating design one last time before saving...");
            }
            
            let finalImageUrl: string;
            if (isCustomizationDirty) {
                const newEditedImage = await handleUpdateDesign();
                if (!newEditedImage) throw new Error("Final image generation failed.");
                const { finalImageUrl: uploadedUrl } = await uploadCartImages({ editedImageDataUri: newEditedImage });
                finalImageUrl = uploadedUrl;
            } else {
                const { finalImageUrl: uploadedUrl } = await uploadCartImages();
                finalImageUrl = uploadedUrl;
            }
            
            const details = buildCartItemDetails();
            if (!details) throw new Error("Could not build customization details.");

            await updateShopifyCustomizationRequest(sessionId, {
                customized_image_url: finalImageUrl,
                customization_details: details,
            });

            showSuccess("Customization saved! Redirecting back to Shopify...");
            
            const shopDomain = "cakes-and-memories.myshopify.com";
            const properties = generateCustomizationProperties();
            
            const variantId = requestData?.shopify_variant_id.split('/').pop();
            if (!variantId) throw new Error("Could not extract Shopify variant ID.");

            const cartUrl = new URL(`https://${shopDomain}/cart/add`);
            cartUrl.searchParams.set('id', variantId);
            cartUrl.searchParams.set('quantity', '1');
            
            for(const [key, value] of Object.entries(properties)) {
                cartUrl.searchParams.set(`properties[${key}]`, value);
            }
            
            window.location.href = cartUrl.toString();

        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save customization.";
            showError(message);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAddPrintoutTopper = useCallback(() => {
        const newTopper: MainTopperUI = {
            id: uuidv4(),
            type: 'printout',
            original_type: 'printout',
            description: 'New Printout Topper',
            size: 'medium',
            quantity: 1,
            isEnabled: true,
            price: 0,
            replacementImage: undefined,
            replacementImageUrl: undefined,
            group_id: 'new-printouts',
            classification: 'hero',
            // FIX: Add missing 'markers' property to satisfy the MainTopperUI type.
            markers: [],
        };
        onMainTopperChange([...mainToppers, newTopper]);
        setSelectedItem({ ...newTopper, itemCategory: 'topper' });
    }, [mainToppers, onMainTopperChange]);

    const handleSetPrimaryMessage = useCallback((update: { text?: string, color?: string, useDefaultColor?: boolean }) => {
        const existingMessage = cakeMessages.find(m => m.position !== 'base_board' && !m.originalMessage);
        if (existingMessage) {
            updateCakeMessage(existingMessage.id, update);
        } else {
            onCakeMessageChange([
                ...cakeMessages,
                {
                    id: uuidv4(),
                    type: 'icing_script',
                    text: update.text || 'Your Text Here',
                    position: 'top',
                    color: update.color || '#000000',
                    isEnabled: true,
                    price: 0,
                    useDefaultColor: update.useDefaultColor ?? true,
                }
            ]);
        }
    }, [cakeMessages, updateCakeMessage, onCakeMessageChange]);

    const handleSetBaseBoardMessage = useCallback((update: { text?: string, color?: string, useDefaultColor?: boolean }) => {
        const existingMessage = cakeMessages.find(m => m.position === 'base_board' && !m.originalMessage);
        if (existingMessage) {
            updateCakeMessage(existingMessage.id, update);
        } else {
            onCakeMessageChange([
                ...cakeMessages,
                {
                    id: uuidv4(),
                    type: 'icing_script',
                    text: update.text || 'Your Text Here',
                    position: 'base_board',
                    color: update.color || '#000000',
                    isEnabled: true,
                    price: 0,
                    useDefaultColor: update.useDefaultColor ?? true,
                }
            ]);
        }
    }, [cakeMessages, updateCakeMessage, onCakeMessageChange]);
    
    const handleReport = useCallback(async (userFeedback: string) => {
        if (!editedImage || !originalImageData?.data || !lastGenerationInfoRef.current) {
            showError("Missing critical data for report.");
            return;
        }
        setIsReporting(true);
        try {
            const { prompt, systemInstruction } = lastGenerationInfoRef.current;
            const fullPrompt = `--- SYSTEM PROMPT ---\n${systemInstruction}\n\n--- USER PROMPT ---\n${prompt}`;
            await reportCustomization({
                original_image: originalImageData.data,
                customized_image: editedImage.split(',')[1],
                prompt_sent_gemini: fullPrompt.trim(),
                maintoppers: JSON.stringify(mainToppers.filter(t => t.isEnabled)),
                supportelements: JSON.stringify(supportElements.filter(s => s.isEnabled)),
                cakemessages: JSON.stringify(cakeMessages.filter(m => m.isEnabled)),
                icingdesign: JSON.stringify(icingDesign),
                addon_price: addOnPricing?.addOnPrice ?? 0,
                user_report: userFeedback.trim() || undefined,
            });
            showSuccess("Report submitted. Thank you!");
            setIsReportModalOpen(false);
        } catch (err) {
            showError("Failed to submit report.");
        } finally {
            setIsReporting(false);
        }
    }, [editedImage, originalImageData, lastGenerationInfoRef, mainToppers, supportElements, cakeMessages, icingDesign, addOnPricing]);

    if (pageIsLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <LoadingSpinner />
            </div>
        );
    }

    if (pageError) {
        return (
            <div className="w-full max-w-md mx-auto text-center p-8">
                <ErrorIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">Could Not Load Session</h2>
                <p className="text-slate-600 mb-6">{pageError}</p>
                <button
                    onClick={onNavigateHome}
                    className="bg-pink-500 text-white font-semibold py-2 px-6 rounded-lg hover:bg-pink-600 transition-all"
                >
                    Return Home
                </button>
            </div>
        );
    }
    
    const ActionButtons = () => (
      <div className="w-full flex items-center justify-end gap-4 mt-2">
        <button onClick={() => setIsReportModalOpen(true)} disabled={!editedImage || isUpdatingDesign || isReporting} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Report an issue with this image">
          <ReportIcon />
          <span className="ml-2">{isReporting ? 'Submitting...' : 'Report Issue'}</span>
        </button>
        <button disabled className="flex items-center justify-center text-sm text-slate-400 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Save customized image (disabled)">
          <SaveIcon />
          <span className="ml-2">Save</span>
        </button>
        <button disabled className="flex items-center justify-center text-sm text-slate-400 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Reset everything (disabled)">
          <ResetIcon />
          <span className="ml-2">Reset</span>
        </button>
      </div>
    );

    return (
        <>
            <FloatingImagePreview
                isVisible={!isMainImageVisible}
                originalImage={originalImagePreview}
                customizedImage={editedImage}
                isLoading={isImageLoading}
                isUpdatingDesign={isUpdatingDesign}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onUpdateDesign={handleUpdateDesign}
                isAnalyzing={false}
                analysisResult={analysisResult}
                isCustomizationDirty={isCustomizationDirty}
            />
            <div className="flex flex-col items-center gap-6 w-full max-w-6xl mx-auto pb-28">
                <div className="w-full flex items-center gap-4">
                    <button onClick={onNavigateHome} className="p-2 text-slate-600 hover:text-purple-700 transition-colors" aria-label="Go home">
                        <BackIcon />
                    </button>
                    <div className="text-center flex-grow">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Customize Your Order</h1>
                        <p className="text-sm text-slate-500">{requestData?.shopify_product_title}</p>
                    </div>
                </div>

                <div className="w-full grid grid-cols-1 gap-y-6 md:grid-cols-5 md:gap-8">
                    <div className="md:col-span-2 md:sticky md:top-8 self-start space-y-4">
                        <div ref={mainImageContainerRef} className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col p-2">
                            <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                                <button onClick={() => setActiveTab('original')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Original</button>
                                <button onClick={handleCustomizedTabClick} disabled={(!editedImage && !isCustomizationDirty) || isUpdatingDesign} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 disabled:text-slate-400'}`}>Customized</button>
                            </div>
                            <div className="relative flex-grow flex items-center justify-center p-2 aspect-square">
                                {isUpdatingDesign && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-2xl z-20"><LoadingSpinner /><p className="mt-4 text-slate-500 font-semibold">Updating design...</p></div>}
                                <img
                                    key={activeTab}
                                    src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview || ''}
                                    alt={activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"}
                                    className="w-full h-full object-contain rounded-lg"
                                />
                            </div>
                        </div>
                        <div className="w-full flex flex-col items-center gap-3">
                           <div className="hidden md:flex w-full">
                                <ActionButtons />
                           </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 flex flex-col space-y-4">
                        <div className={`w-full p-4 rounded-xl border-2 flex items-start gap-4 transition-all duration-300 animate-fade-in ${availabilityInfo.bgColor} ${availabilityInfo.borderColor}`}>
                            <div className="text-3xl flex-shrink-0 mt-1">{availabilityInfo.icon}</div>
                            <div className="flex-grow">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h4 className={`text-lg font-bold ${availabilityInfo.textColor}`}>{availabilityInfo.label}</h4>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${availabilityInfo.bgColor.replace('-50', '-200')} ${availabilityInfo.textColor}`}>{availabilityInfo.time}</span>
                                </div>
                                <p className={`text-sm mt-1 ${availabilityInfo.textColor.replace('800', '700')}`}>{availabilityInfo.description}</p>
                                <p className="text-xs mt-2 text-blue-600">⏰ Order before 12 PM for same-day pickup!</p>
                            </div>
                        </div>
                         <div className="w-full bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200 space-y-6">
                            <h2 className="text-xl font-bold text-slate-800 text-center -mb-2">Customize Your Cake</h2>
                            {cakeInfo && icingDesign && (
                                <FeatureList
                                    analysisError={null}
                                    analysisId={analysisId}
                                    cakeInfo={cakeInfo}
                                    basePriceOptions={null}
                                    mainToppers={mainToppers}
                                    supportElements={supportElements}
                                    cakeMessages={cakeMessages}
                                    icingDesign={icingDesign}
                                    additionalInstructions={additionalInstructions}
                                    onCakeInfoChange={handleCakeInfoChange}
                                    updateMainTopper={updateMainTopper}
                                    removeMainTopper={removeMainTopper}
                                    updateSupportElement={updateSupportElement}
                                    removeSupportElement={removeSupportElement}
                                    updateCakeMessage={updateCakeMessage}
                                    removeCakeMessage={removeCakeMessage}
                                    // FIX: Pass the required `onCakeMessageChange` prop to the FeatureList component.
                                    onCakeMessageChange={onCakeMessageChange}
                                    onIcingDesignChange={onIcingDesignChange}
                                    onAdditionalInstructionsChange={onAdditionalInstructionsChange}
                                    onTopperImageReplace={async (topperId, file) => {
                                        if (!user?.id) { showError("You must be logged in to upload images."); return; }
                                        await handleTopperImageReplace(topperId, file, user.id);
                                    }}
                                    onSupportElementImageReplace={async (elementId, file) => {
                                        if (!user?.id) { showError("You must be logged in to upload images."); return; }
                                        await handleSupportElementImageReplace(elementId, file, user.id);
                                    }}
                                    isAnalyzing={false}
                                    itemPrices={itemPrices}
                                    user={user}
                                    hideBaseOptions={true}
                                    hideSupportElements={true}
                                    onAddPrintoutTopper={handleAddPrintoutTopper}
                                    onSetPrimaryMessage={handleSetPrimaryMessage}
                                    primaryMessage={primaryMessage}
                                    onSetBaseBoardMessage={handleSetBaseBoardMessage}
                                    baseBoardMessage={baseBoardMessage}
                                    defaultOpenInstructions={true}
                                    shopifyFixedSize={requestData?.shopify_variant_title}
                                    shopifyBasePrice={requestData?.shopify_base_price}
                                    onItemClick={handleListItemClick}
                                    markerMap={markerMap}
                                />
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Action buttons for mobile view */}
                <div className="md:hidden flex w-full max-w-md mx-auto">
                    <ActionButtons />
                </div>

                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg p-3 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
                    <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                        <div className="min-w-[120px]">
                            <span className="text-sm text-slate-500 block">Final Price</span>
                            <span className="text-xl font-bold text-slate-800">₱{finalShopifyPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-1 gap-3">
                            <button
                                onClick={handleUpdateDesign}
                                disabled={isUpdatingDesign}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-pink-500 text-pink-600 font-bold text-sm rounded-xl shadow-sm hover:bg-pink-50 transition-all disabled:opacity-50"
                            >
                                {isUpdatingDesign ? <Loader2 className="w-5 h-5 animate-spin" /> : <MagicSparkleIcon className="w-5 h-5" />}
                                <span>{isUpdatingDesign ? 'Updating...' : 'Update Design'}</span>
                            </button>
                            <button
                                onClick={handleSaveCustomization}
                                disabled={isSaving || isUpdatingDesign}
                                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-50"
                            >
                                {isSaving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</> : 'Save & Add to Cart'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onSubmit={handleReport}
                isSubmitting={isReporting}
                editedImage={editedImage}
                details={buildCartItemDetails()}
                cakeInfo={cakeInfo}
            />
            <FloatingResultPanel
                selectedItem={selectedItem}
                onClose={() => setSelectedItem(null)}
                mainToppers={mainToppers}
                updateMainTopper={updateMainTopper}
                removeMainTopper={removeMainTopper}
                onTopperImageReplace={async (topperId, file) => {
                    if (!user?.id) { showError("You must be logged in to upload images."); return; }
                    await handleTopperImageReplace(topperId, file, user.id);
                }}
                supportElements={supportElements}
                updateSupportElement={updateSupportElement}
                removeSupportElement={removeSupportElement}
                onSupportElementImageReplace={async (elementId, file) => {
                    if (!user?.id) { showError("You must be logged in to upload images."); return; }
                    await handleSupportElementImageReplace(elementId, file, user.id);
                }}
                cakeMessages={cakeMessages}
                updateCakeMessage={updateCakeMessage}
                removeCakeMessage={removeCakeMessage}
                onCakeMessageChange={onCakeMessageChange}
                icingDesign={icingDesign}
                onIcingDesignChange={onIcingDesignChange}
                analysisResult={analysisResult}
                itemPrices={itemPrices}
            />
        </>
    );
};

export default ShopifyCustomizingPage;