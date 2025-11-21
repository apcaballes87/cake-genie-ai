import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  getShopifyCustomizationRequest,
  updateShopifyCustomizationRequest,
  ShopifyCustomizationRequest,
  reportCustomization,
  uploadReportImage
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
import { MagicSparkleIcon, Loader2, ErrorIcon, ReportIcon } from '../../components/icons';
import { showError, showSuccess, showInfo } from '../../lib/utils/toast';
import { CartItemDetails, MainTopperUI, CakeMessageUI } from '../../types';
import { FloatingImagePreview } from '../../components/FloatingImagePreview';
import { ImageZoomModal } from '../../components/ImageZoomModal';
import { COLORS } from '../../constants';
import ReportModal from '../../components/ReportModal';
import { FloatingResultPanel } from '../../components/FloatingResultPanel';
import { AnalysisItem } from '../customizing/page';

interface ShopifyCustomizingPageProps {
  sessionId: string;
  onNavigateHome: () => void;
  user?: { email?: string } | null;
}

const ShopifyCustomizingPage: React.FC<ShopifyCustomizingPageProps> = ({ sessionId, onNavigateHome, user }) => {
  // --- Component State ---
  const [requestData, setRequestData] = useState<ShopifyCustomizationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'customized'>('original');
  const [isMainImageVisible, setIsMainImageVisible] = useState(true);
  const [isMainZoomModalOpen, setIsMainZoomModalOpen] = useState(false);
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
  } = useCakeCustomization();

  const addCakeMessage = useCallback((position: 'top' | 'side' | 'base_board') => {
    const newMessage: CakeMessageUI = {
      id: crypto.randomUUID(),
      type: 'icing_script',
      text: '',
      position,
      color: '#000000',
      isEnabled: true,
      price: 0,
      useDefaultColor: true,
    };
    onCakeMessageChange([...cakeMessages, newMessage]);
  }, [cakeMessages, onCakeMessageChange]);

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
      properties[`${tierLabel} Flavor`] = flavor;
    });

    mainToppers.filter(t => t.isEnabled).forEach((topper, i) => {
      let topperString = `${topper.description} (${topper.size})`;
      // Check if color was customized
      // FIX: Add type guard for topper.color to ensure it's a string before calling string methods.
      if (topper.color && typeof topper.color === 'string' && topper.color !== topper.original_color) {
        const colorName = HEX_TO_COLOR_NAME_MAP[topper.color.toLowerCase()] || '';
        const colorString = `${topper.color.toUpperCase()} ${colorName.toUpperCase()} `.trim();
        topperString += ` (Color: ${colorString})`;
      }
      properties[`Topper ${i + 1} `] = topperString;
    });

    cakeMessages.filter(m => m.isEnabled && m.text.trim()).forEach((msg, i) => {
      let messageString = `"${msg.text}"`;
      // Check if color was customized by user
      if (msg.useDefaultColor === false) {
        const colorName = HEX_TO_COLOR_NAME_MAP[msg.color.toLowerCase()] || '';
        const colorString = `${msg.color.toUpperCase()} ${colorName.toUpperCase()} `.trim();
        messageString += ` (Color: ${colorString})`;
      }
      properties[`Message ${i + 1} `] = messageString;
    });

    if (icingDesign.drip) properties['Icing Drip'] = 'Yes';
    Object.entries(icingDesign.colors).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        const keyName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const colorName = HEX_TO_COLOR_NAME_MAP[value.toLowerCase()] || '';
        const colorString = `${value.toUpperCase()} ${colorName.toUpperCase()} `.trim();
        properties[`${keyName} Color`] = colorString;
      }
    });

    if (additionalInstructions.trim()) {
      properties['Instructions'] = additionalInstructions.trim();
    }

    properties['Add-on Cost'] = `₱${totalAddOnPrice.toLocaleString()} `;

    return properties;
  }, [cakeInfo, icingDesign, mainToppers, cakeMessages, additionalInstructions, totalAddOnPrice, HEX_TO_COLOR_NAME_MAP]);

  const handleShopifyAddToCart = useCallback(async () => {
    if (!requestData) return;
    setIsSaving(true);
    try {
      let finalImageToUpload = editedImage;

      // If customization is dirty, generate the final image first
      if (isCustomizationDirty) {
        showInfo("Updating your design before adding to cart...");
        const newImage = await handleUpdateDesign();
        if (!newImage) throw new Error("Failed to generate the final design.");
        finalImageToUpload = newImage;
      }

      // Upload images to Supabase Storage and get a public URL
      const { finalImageUrl } = await uploadCartImages({ editedImageDataUri: finalImageToUpload });

      // Generate properties for Shopify for the main cake
      const properties = generateCustomizationProperties();
      properties['Custom Image URL'] = finalImageUrl;
      properties['_Final Price'] = finalShopifyPrice.toString(); // For display/logic in Shopify theme

      // Construct the Shopify Add to Cart URL for multiple items
      const shopifyDomain = "https://cakesandmemories.com";
      const cartUrl = new URL(`${shopifyDomain} /cart/add`);

      // Item 0: The main cake
      cartUrl.searchParams.append('items[0][id]', requestData.shopify_variant_id);
      cartUrl.searchParams.append('items[0][quantity]', '1');
      for (const [key, value] of Object.entries(properties)) {
        // FIX: Cast value to string as Object.entries can return `unknown` in strict TypeScript configurations.
        cartUrl.searchParams.append(`items[0][properties][${key}]`, value as string);
      }

      let itemIndex = 1;

      // Item 1 (optional): Drip effect
      if (icingDesign?.drip) {
        cartUrl.searchParams.append(`items[${itemIndex}][id]`, '47132107440384');
        cartUrl.searchParams.append(`items[${itemIndex}][quantity]`, '1');
        itemIndex++;
      }

      // Item 2 (optional): Gumpaste base board
      if (icingDesign?.gumpasteBaseBoard) {
        cartUrl.searchParams.append(`items[${itemIndex}][id]`, '47132107473152');
        cartUrl.searchParams.append(`items[${itemIndex}][quantity]`, '1');
        itemIndex++;
      }

      // Update the Supabase record in the background (fire-and-forget)
      const cartDetails = buildCartItemDetails();
      if (cartDetails) {
        updateShopifyCustomizationRequest(sessionId, {
          customized_image_url: finalImageUrl,
          customization_details: cartDetails
        }).catch(console.error);
      }

      // Redirect user to Shopify cart
      window.location.href = cartUrl.toString();

    } catch (err: any) {
      showError(err.message || "Failed to add to cart.");
      setIsSaving(false);
    }
  }, [requestData, editedImage, isCustomizationDirty, handleUpdateDesign, uploadCartImages, generateCustomizationProperties, buildCartItemDetails, sessionId, finalShopifyPrice, icingDesign]);

  const handleReport = useCallback(async (userFeedback: string) => {
    if (!editedImage || !originalImageData?.data || !lastGenerationInfoRef.current) {
      showError("Missing critical data for report.");
      return;
    }
    setIsReporting(true);
    try {
      const { prompt, systemInstruction } = lastGenerationInfoRef.current;
      const fullPrompt = `--- SYSTEM PROMPT ---
${systemInstruction}

--- USER PROMPT ---
${prompt}
`;

      // Upload images to Supabase storage first
      showInfo("Uploading images...");
      const [originalImageUrl, customizedImageUrl] = await Promise.all([
        uploadReportImage(originalImageData.data, 'original'),
        uploadReportImage(editedImage, 'customized')
      ]);

      // Submit report with image URLs
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
      showSuccess("Report submitted. Thank you!");
      setIsReportModalOpen(false);
    } catch (err) {
      showError("Failed to submit report.");
    } finally {
      setIsReporting(false);
    }
  }, [editedImage, originalImageData, lastGenerationInfoRef, mainToppers, supportElements, cakeMessages, icingDesign, addOnPricing]);

  // --- Render Logic ---
  if (pageIsLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <ErrorIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h2>
        <p className="text-slate-600 mb-6">{pageError}</p>
        <button onClick={onNavigateHome} className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all">Go Home</button>
      </div>
    );
  }

  if (!requestData || !cakeInfo || !icingDesign) {
    return null; // Or another loading/error state
  }

  return (
    <>
      <FloatingImagePreview
        isVisible={!isMainImageVisible}
        originalImage={originalImagePreview}
        customizedImage={editedImage}
        isLoading={isUpdatingDesign}
        isUpdatingDesign={isUpdatingDesign}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onUpdateDesign={handleUpdateDesign}
        isAnalyzing={false}
        analysisResult={analysisResult}
        isCustomizationDirty={isCustomizationDirty}
      />
      <ImageZoomModal
        isOpen={isMainZoomModalOpen}
        onClose={() => setIsMainZoomModalOpen(false)}
        originalImage={originalImagePreview}
        customizedImage={editedImage}
        initialTab={activeTab}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleReport}
        isSubmitting={isReporting}
        editedImage={editedImage}
        details={buildCartItemDetails()}
        cakeInfo={cakeInfo}
      />
      <div className="flex flex-col items-center gap-6 w-full max-w-6xl mx-auto py-8 px-4 pb-28">
        {/* Header */}
        <div className="text-center w-full max-w-4xl">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mb-2">
            Genie
          </h1>
          <h2 className="text-2xl font-bold text-slate-800">Customize Your Cake</h2>
          <p className="text-slate-600 mt-1">{requestData.shopify_product_title}</p>
        </div>

        {/* Main Layout: Image + Features */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image Column */}
          <div>
            <div ref={mainImageContainerRef} className="w-full max-w-4xl aspect-[7/6] bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
              <div className="p-2 flex-shrink-0">
                <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                  <button onClick={() => setActiveTab('original')} className={`w - 1 / 2 py - 2 text - sm font - semibold rounded - md transition - all duration - 200 ease -in -out ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50'} `}>Original</button>
                  <button onClick={handleCustomizedTabClick} disabled={(!editedImage && !isCustomizationDirty) || isUpdatingDesign} className={`w - 1 / 2 py - 2 text - sm font - semibold rounded - md transition - all duration - 200 ease -in -out ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'} `}>Customized</button>
                </div>
              </div>
              <div className="relative flex-grow flex items-center justify-center p-2 pt-0 min-h-0">
                {(isUpdatingDesign) && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20"><LoadingSpinner /><p className="mt-4 text-slate-500 font-semibold">Updating Design...</p></div>}
                <button
                  type="button"
                  onClick={() => setIsMainZoomModalOpen(true)}
                  className="w-full h-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-lg"
                >
                  <img key={activeTab} src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview} alt={activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"} className="w-full h-full object-contain rounded-lg" />
                </button>
              </div>
            </div>
            <button
              onClick={handleUpdateDesign}
              disabled={isUpdatingDesign}
              className="w-full mt-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-4 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center text-lg"
            >
              {isUpdatingDesign ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Updating...</> : <><MagicSparkleIcon /> Update Design</>}
            </button>
          </div>

          {/* Features Column */}
          <div className="w-full bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200 space-y-4">
            <div className="flex flex-col gap-2">
              <button
                className="w-full text-center bg-white border border-dashed border-slate-400 text-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                onClick={() => {
                  const newTopper: MainTopperUI = {
                    id: crypto.randomUUID(),
                    type: 'printout',
                    original_type: 'printout',
                    description: 'New Printout Topper',
                    size: 'medium',
                    quantity: 1,
                    group_id: `new- ${Date.now()} `,
                    classification: 'hero',
                    isEnabled: true,
                    price: 0,
                  };
                  onMainTopperChange([...mainToppers, newTopper]);
                }}
              >
                + Add Printout Topper
              </button>
              <button
                className="w-full text-center bg-white border border-dashed border-slate-400 text-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                onClick={() => {
                  if (!primaryMessage) {
                    const newMessage: CakeMessageUI = {
                      id: crypto.randomUUID(),
                      type: 'icing_script',
                      text: 'Happy Birthday!',
                      position: 'top',
                      color: '#000000',
                      isEnabled: true,
                      price: 0,
                      useDefaultColor: true,
                    };
                    onCakeMessageChange([...cakeMessages, newMessage]);
                  }
                }}
              >
                + Add Cake Message
              </button>
            </div>
            {/* FIX: Pass the required `itemPrices` and correct update/remove props to the FeatureList component. */}
            <FeatureList
              analysisError={null}
              analysisId={"shopify"}
              cakeInfo={cakeInfo}
              basePriceOptions={null} // Base price is fixed from Shopify
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
              addCakeMessage={addCakeMessage}
              onIcingDesignChange={onIcingDesignChange}
              onAdditionalInstructionsChange={onAdditionalInstructionsChange}
              onTopperImageReplace={handleTopperImageReplace}
              onSupportElementImageReplace={handleSupportElementImageReplace}
              isAnalyzing={false}
              itemPrices={itemPrices}
              // Shopify-specific props
              shopifyFixedSize={requestData.shopify_variant_title}
              shopifyBasePrice={requestData.shopify_base_price}
              onItemClick={handleListItemClick}
              markerMap={markerMap}
              user={user}
            />
          </div>
        </div>

        <div className="w-full max-w-4xl flex items-center justify-end gap-4 mt-4">
          <button
            onClick={() => setIsReportModalOpen(true)}
            disabled={!editedImage || isUpdatingDesign || isReporting}
            className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Report an issue with this image"
          >
            <ReportIcon />
            <span className="ml-2">{isReporting ? 'Submitting...' : 'Report Issue'}</span>
          </button>
        </div>

        {/* Sticky Footer for Pricing and Save */}
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="bg-white/80 backdrop-blur-lg p-3 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
            <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
              <div className="flex-1">
                <div className="text-left">
                  <span className="text-lg font-bold text-slate-800">₱{finalShopifyPrice.toLocaleString()}</span>
                  <span className="text-xs text-slate-500 block">Final Price</span>
                </div>
                {totalAddOnPrice > 0 && <p className="text-xs text-green-600 font-medium">+ ₱{totalAddOnPrice.toLocaleString()} add-ons</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleShopifyAddToCart}
                  disabled={isSaving || isUpdatingDesign}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-50 flex items-center"
                >
                  {isSaving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Adding to Cart...</> : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FloatingResultPanel
        selectedItem={selectedItem}
        onClose={() => setSelectedItem(null)}
        mainToppers={mainToppers}
        updateMainTopper={updateMainTopper}
        removeMainTopper={removeMainTopper}
        onTopperImageReplace={handleTopperImageReplace}
        supportElements={supportElements}
        updateSupportElement={updateSupportElement}
        removeSupportElement={removeSupportElement}
        onSupportElementImageReplace={handleSupportElementImageReplace}
        cakeMessages={cakeMessages}
        updateCakeMessage={updateCakeMessage}
        removeCakeMessage={removeCakeMessage}
        onCakeMessageChange={onCakeMessageChange}
        icingDesign={icingDesign}
        onIcingDesignChange={onIcingDesignChange}
        analysisResult={analysisResult}
        itemPrices={itemPrices}
        isAdmin={user?.email === 'apcaballes@gmail.com'}
        addCakeMessage={addCakeMessage}
        onUpdateDesign={handleUpdateDesign}
        isUpdatingDesign={isUpdatingDesign}
      />
    </>
  );
};

export default ShopifyCustomizingPage;