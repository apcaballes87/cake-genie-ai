import React, { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { useCart } from './contexts/CartContext';
import { showSuccess, showError, showInfo } from './lib/utils/toast';
import { LoadingSpinner } from './components/LoadingSpinner';
import { CartIcon, UserCircleIcon, LogOutIcon, MapPinIcon, PackageIcon, ErrorIcon } from './components/icons';
import { reportCustomization } from './services/supabaseService';
import { CartItem, CartItemDetails, CakeType } from './types';
import { COLORS, DEFAULT_THICKNESS_MAP } from './constants';
import { CakeGenieCartItem } from './lib/database.types';
import { ErrorBoundary } from './components/ErrorBoundary';
import StickyAddToCartBar from './components/StickyAddToCartBar';
import AnimatedBlobs from './components/UI/AnimatedBlobs';

console.log('App.tsx: File loaded');

// --- Custom Hooks for Core Logic (Simplified Import) ---
import {
  useAuth,
  useAppNavigation,
  useImageManagement,
  useCakeCustomization,
  useSearchEngine,
  usePricing,
  useDesignUpdate,
  useDesignSharing,
  AppState,
  useAvailabilitySettings,
} from './hooks';

import TestGemini from './components/TestGemini';

// Lazy load heavy page components
const LandingPage = lazy(() => import('./app/landing/page'));
const SearchingPage = lazy(() => import('./app/searching/page'));
const CustomizingPage = lazy(() => import('./app/customizing/page'));
const AddressesPage = lazy(() => import('./app/account/addresses/page'));
const OrdersPage = lazy(() => import('./app/account/orders/page'));
const AuthPage = lazy(() => import('./app/(auth)/AuthPage'));
const OrderConfirmationPage = lazy(() => import('./app/order-confirmation/page'));
const CartPage = lazy(() => import('./app/cart/page'));
const SharedDesignPage = lazy(() => import('./app/design/page'));
const AboutPage = lazy(() => import('./app/about/page'));
const HowToOrderPage = lazy(() => import('./app/how-to-order/page'));
const ContactPage = lazy(() => import('./app/contact/page'));
const ReviewsPage = lazy(() => import('./app/reviews/page'));
const ShopifyCustomizingPage = lazy(() => import('./app/shopify-customizing/page'));
const PricingSandboxPage = lazy(() => import('./app/pricing-sandbox/page'));

// Lazy load heavy modal components
const ImageUploader = lazy(() => import('./components/ImageUploader').then(module => ({ default: module.ImageUploader })));
const ImageZoomModal = lazy(() => import('./components/ImageZoomModal').then(module => ({ default: module.ImageZoomModal })));
const ReportModal = lazy(() => import('./components/ReportModal'));
const ShareModal = lazy(() => import('./components/ShareModal').then(module => ({ default: module.ShareModal })));


type ImageTab = 'original' | 'customized';

// Declare gtag for Google Analytics event tracking
declare const gtag: (...args: any[]) => void;

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)', '2 Tier': '2 Tier (Soft icing)', '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant', '2 Tier Fondant': '2 Tier Fondant', '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square', 'Rectangle': 'Rectangle', 'Bento': 'Bento',
};

export default function App(): React.ReactElement {
  // For testing purposes, let's show the test component by default
  const [showTest, setShowTest] = useState(false);

  // --- CORE CONTEXT HOOKS ---
  const { user, isAuthenticated, signOut } = useAuth();
  const { itemCount: supabaseItemCount, addToCartOptimistic, removeItemOptimistic, authError, isLoading: isCartLoading } = useCart();
  const { settings: availabilitySettings, loading: isLoadingAvailabilitySettings } = useAvailabilitySettings();

  // --- CUSTOM BUSINESS LOGIC HOOKS ---
  const { appState, previousAppState, confirmedOrderId, viewingDesignId, viewingShopifySessionId, setAppState, setConfirmedOrderId } = useAppNavigation();

  const {
    originalImageData, originalImagePreview, editedImage, threeTierReferenceImage,
    isLoading: isImageManagementLoading, error: imageManagementError,
    setEditedImage, setError: setImageManagementError,
    handleImageUpload: hookImageUpload, handleSave, uploadCartImages, clearImages,
    loadImageWithoutAnalysis,
  } = useImageManagement();
  
  const {
    cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions,
    analysisResult, analysisId, isAnalyzing, analysisError, isCustomizationDirty,
    setIsAnalyzing, setAnalysisError, setPendingAnalysisData, setIsCustomizationDirty,
    handleCakeInfoChange, 
    updateMainTopper, removeMainTopper,
    updateSupportElement, removeSupportElement,
    updateCakeMessage, removeCakeMessage,
    onIcingDesignChange, onAdditionalInstructionsChange, handleTopperImageReplace,
    handleSupportElementImageReplace, clearCustomization, initializeDefaultState,
    initializeFromShopify,
    availability: baseAvailability,
    // FIX: Destructure onCakeMessageChange from useCakeCustomization hook.
    onCakeMessageChange,
  } = useCakeCustomization();

  const availability = useMemo(() => {
    if (!availabilitySettings || !baseAvailability) return baseAvailability;

    if (availabilitySettings.rush_same_to_standard_enabled) {
        if (baseAvailability === 'rush' || baseAvailability === 'same-day') {
            return 'normal';
        }
    }
    
    if (availabilitySettings.rush_to_same_day_enabled) {
        if (baseAvailability === 'rush') {
            return 'same-day';
        }
    }

    return baseAvailability;
  }, [baseAvailability, availabilitySettings]);
  const availabilityWasOverridden = availability !== baseAvailability;

  const { addOnPricing, itemPrices, basePriceOptions, isFetchingBasePrice, basePriceError, basePrice, finalPrice } = usePricing({
      analysisResult, mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo, onCakeInfoCorrection: handleCakeInfoChange, analysisId
  });

  const {
    isLoading: isUpdatingDesign, error: designUpdateError, lastGenerationInfoRef, handleUpdateDesign, setError: setDesignUpdateError,
  } = useDesignUpdate({
      originalImageData, analysisResult, cakeInfo, mainToppers, supportElements, cakeMessages,
      icingDesign, additionalInstructions, threeTierReferenceImage,
      onSuccess: (editedImageResult: string) => {
          setEditedImage(editedImageResult);
          setActiveTab('customized');
          setIsCustomizationDirty(false);
      },
  });

  const HEX_TO_COLOR_NAME_MAP = useMemo(() => {
    return COLORS.reduce((acc, color) => {
      acc[color.hex.toLowerCase()] = color.name;
      return acc;
    }, {} as Record<string, string>);
  }, []);
  
  const { isShareModalOpen, shareData, isSavingDesign, handleShare, createShareLink, closeShareModal } = useDesignSharing({
    editedImage, originalImagePreview, cakeInfo, basePrice, finalPrice, mainToppers,
    supportElements, icingDesign, analysisResult, HEX_TO_COLOR_NAME_MAP,
    cakeMessages, additionalInstructions
  });

  // --- UI-DRIVEN HOOKS ---
  const [isFetchingWebImage, setIsFetchingWebImage] = useState(false);
  const { isSearching, searchInput, setSearchInput, searchQuery, handleSearch } = useSearchEngine({
    appState, setAppState, handleImageUpload: (file: File, imageUrl?: string) => handleAppImageUpload(file, imageUrl), setImageError: setImageManagementError, originalImageData, setIsFetchingWebImage
  });

  // --- COMPONENT-LEVEL UI STATE ---
  const [activeTab, setActiveTab] = useState<ImageTab>('original');
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMainZoomModalOpen, setIsMainZoomModalOpen] = useState(false);
  const [pendingCartItems, setPendingCartItems] = useState<CartItem[]>([]);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportStatus, setReportStatus] = useState<'success' | 'error' | null>(null);
  const [isPreparingSharedDesign, setIsPreparingSharedDesign] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const mainImageContainerRef = useRef<HTMLDivElement>(null);

  // --- DERIVED STATE & MEMOIZED VALUES ---
  // isLoading is for overlays that block image interaction (image processing, updating design)
  // isAnalyzing is for background analysis which should NOT block the UI
  const isLoading = useMemo(() => isImageManagementLoading || isUpdatingDesign || isFetchingWebImage, [isImageManagementLoading, isUpdatingDesign, isFetchingWebImage]);
  const itemCount = useMemo(() => supabaseItemCount + pendingCartItems.length, [supabaseItemCount, pendingCartItems]);

  const toyWarningMessage = useMemo(() => {
    const hasToy = mainToppers.some(
        topper => topper.isEnabled && ['toy', 'figurine', 'plastic_ball'].includes(topper.type)
    );
    return hasToy ? "Toys are subject for availability" : null;
  }, [mainToppers]);

  // --- ORCHESTRATION LOGIC (Connecting Hooks & State) ---
  const clearAllState = useCallback((backToLanding: boolean = true) => {
    if (backToLanding) setAppState('landing');
    clearImages();
    clearCustomization();
    setActiveTab('original');
  }, [clearImages, clearCustomization, setAppState]);

  const handleAppImageUpload = useCallback((file: File, imageUrl?: string) => {
    // Analytics: Track when a user starts the design process via upload
    if (typeof gtag === 'function') {
        gtag('event', 'start_design', {
            'event_category': 'ecommerce_funnel',
            'event_label': 'upload'
        });
    }

    // IMMEDIATE actions (non-blocking)
    clearAllState(false);
    setAppState('customizing');
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    // Set default state so user can customize immediately
    initializeDefaultState();

    // Start file processing and background analysis, wrapped in a Promise
    return new Promise<void>((resolve, reject) => {
      hookImageUpload(
        file,
        (result) => { // on analysis success
          // Analytics: Track when AI analysis is successfully completed
          if (typeof gtag === 'function') {
              gtag('event', 'analysis_complete', {
                  'event_category': 'ecommerce_funnel'
              });
          }
          setPendingAnalysisData(result);
          setIsAnalyzing(false);
          resolve();
        },
        (error) => { // on analysis error
          const errorMessage = error.message;
          setAnalysisError(errorMessage);
          showError(errorMessage);
          setIsAnalyzing(false);
          setAppState('landing'); // Go back to landing on critical failure
          reject(error);
        },
        { imageUrl }
      );
    });
  }, [clearAllState, hookImageUpload, setIsAnalyzing, setAnalysisError, setPendingAnalysisData, setAppState, initializeDefaultState]);

  const buildCartItemDetails = useCallback((): CartItemDetails => {
    if (!cakeInfo || !icingDesign) throw new Error("Missing data for cart item.");
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
            coverage: s.coverage
        })),
        cakeMessages: cakeMessages.filter(m => m.isEnabled).map(m => ({ text: m.text, color: hexToName(m.color) })),
        icingDesign: {
            drip: icingDesign.drip, gumpasteBaseBoard: icingDesign.gumpasteBaseBoard,
            colors: Object.entries(icingDesign.colors).reduce((acc, [key, value]) => {
                if (typeof value === 'string' && value) acc[key] = hexToName(value);
                return acc;
            }, {} as Record<string, string>),
        },
        additionalInstructions: additionalInstructions.trim(),
    };
  }, [cakeInfo, icingDesign, mainToppers, supportElements, cakeMessages, additionalInstructions, HEX_TO_COLOR_NAME_MAP]);
  
  const handleAddToCart = useCallback(async () => {
    if (!originalImagePreview || !cakeInfo || !finalPrice || !analysisResult) return;
    setIsAddingToCart(true);

    // Analytics: Track add_to_cart event
    if (typeof gtag === 'function') {
        gtag('event', 'add_to_cart', {
            currency: 'PHP',
            value: finalPrice,
            items: [{
                item_id: `${analysisResult.cakeType}_${cakeInfo.size}`, // e.g., 1 Tier_8" Round
                item_name: `Custom Cake - ${cakeTypeDisplayMap[cakeInfo.type]}`,
                price: finalPrice,
                quantity: 1
            }]
        });
    }

    try {
        const cartItemDetails = buildCartItemDetails();
        if (!isCustomizationDirty) {
            const { originalImageUrl, finalImageUrl } = await uploadCartImages();
            const newItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'> = {
                user_id: null, session_id: null, cake_type: cakeTypeDisplayMap[cakeInfo.type], cake_thickness: cakeInfo.thickness, cake_size: cakeInfo.size,
                base_price: basePrice!, addon_price: addOnPricing?.addOnPrice ?? 0, final_price: finalPrice, quantity: 1,
                original_image_url: originalImageUrl, customized_image_url: finalImageUrl, customization_details: cartItemDetails,
            };
            setAppState('cart');
            await addToCartOptimistic(newItem);
            showSuccess('Added to cart!');
        } else {
            const tempId = `pending-${Date.now()}`;
            setPendingCartItems(prev => [...prev, {
                id: tempId, image: originalImagePreview, status: 'pending', type: cakeTypeDisplayMap[cakeInfo.type],
                thickness: cakeInfo.thickness, size: cakeInfo.size, totalPrice: finalPrice, details: cartItemDetails,
            }]);
            setAppState('cart');

            handleUpdateDesign().then(async (newEditedImage) => {
                if (!newEditedImage) throw new Error("Background image generation failed.");
                
                // Pass the newly generated image data URI directly to the upload function
                // to avoid using stale state from the closure.
                const { originalImageUrl, finalImageUrl } = await uploadCartImages({ editedImageDataUri: newEditedImage });
                
                const newItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'> = {
                    user_id: null, session_id: null, cake_type: cakeTypeDisplayMap[cakeInfo.type], cake_thickness: cakeInfo.thickness, cake_size: cakeInfo.size,
                    base_price: basePrice!, addon_price: addOnPricing?.addOnPrice ?? 0, final_price: finalPrice, quantity: 1,
                    original_image_url: originalImageUrl, customized_image_url: finalImageUrl, customization_details: cartItemDetails,
                };
                await addToCartOptimistic(newItem, { skipOptimistic: true });
                showSuccess('Custom design added to cart!');
            }).catch((err) => {
                showError("Failed to add custom design to cart.");
            }).finally(() => {
                setPendingCartItems(prev => prev.filter(p => p.id !== tempId));
            });
        }
    } catch (err) { showError("Failed to add to cart."); } finally { setIsAddingToCart(false); }
  }, [originalImagePreview, cakeInfo, finalPrice, analysisResult, buildCartItemDetails, isCustomizationDirty, uploadCartImages, basePrice, addOnPricing, setAppState, addToCartOptimistic, handleUpdateDesign]);
  
  const handleReport = useCallback(async (userFeedback: string) => {
    if (!editedImage || !originalImageData?.data || !lastGenerationInfoRef.current) {
        showError("Missing critical data for report.");
        return;
    }
    setIsReporting(true); setReportStatus(null);
    try {
        const { prompt, systemInstruction } = lastGenerationInfoRef.current;
        const fullPrompt = `--- SYSTEM PROMPT ---
${systemInstruction}

--- USER PROMPT ---
${prompt}
`;
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
        setReportStatus('success'); showSuccess("Report submitted. Thank you!"); setIsReportModalOpen(false);
    } catch (err) {
        setReportStatus('error'); showError("Failed to submit report.");
    } finally {
        setIsReporting(false);
        setTimeout(() => setReportStatus(null), 5000);
    }
  }, [editedImage, originalImageData, lastGenerationInfoRef, mainToppers, supportElements, cakeMessages, icingDesign, addOnPricing]);

  const handleStartWithSharedDesign = useCallback(async (sharedDesign: any) => {
      clearAllState(false); setIsPreparingSharedDesign(true);
      try {
          const response = await fetch(sharedDesign.customized_image_url);
          if (!response.ok) throw new Error('Failed to fetch shared image');
          const blob = await response.blob();
          const file = new File([blob], 'shared-design.webp', { type: blob.type || 'image/webp' });
          handleAppImageUpload(file); // This is now non-blocking
          setAppState('customizing');
      } catch (error) { showError("Could not start with this design."); setAppState('landing');
      } finally {
          setIsPreparingSharedDesign(false);
          if (typeof window !== 'undefined') {
            if (window.history.pushState) window.history.pushState("", document.title, window.location.pathname + window.location.search);
            else window.location.hash = "#";
          }
      }
  }, [clearAllState, handleAppImageUpload, setAppState]);

  const handlePurchaseSharedDesign = useCallback(async (sharedDesign: any) => {
    setIsAddingToCart(true);
    
    if (typeof gtag === 'function') {
        gtag('event', 'add_to_cart', {
            currency: 'PHP',
            value: sharedDesign.final_price,
            items: [{
                item_id: `${sharedDesign.cake_type}_${sharedDesign.cake_size}`,
                item_name: `Custom Cake - ${cakeTypeDisplayMap[sharedDesign.cake_type as CakeType] || sharedDesign.cake_type}`,
                price: sharedDesign.final_price,
                quantity: 1
            }]
        });
    }

    try {
      const icingColors: Record<string, string> = {};
      if (sharedDesign.icing_colors && Array.isArray(sharedDesign.icing_colors)) {
          for (const colorInfo of sharedDesign.icing_colors) {
              const [key, colorName] = (colorInfo.name || '').split(': ');
              if (key && colorName) {
                  const keyMap: Record<string, string> = { 'Side': 'side', 'Top': 'top', 'Top Border': 'borderTop', 'Base Border': 'borderBase', 'Drip': 'drip', 'Base Board Color': 'gumpasteBaseBoardColor' };
                  const mappedKey = keyMap[key];
                  if(mappedKey) icingColors[mappedKey] = colorName;
              }
          }
      }
      
      const cartItemDetails: CartItemDetails = {
        flavors: sharedDesign.cake_flavor ? sharedDesign.cake_flavor.split(', ') : ['Chocolate Cake'],
        mainToppers: (sharedDesign.accessories || []).map((acc: string) => ({
            description: acc,
            type: 'printout', // Use a safe default type as full info isn't stored for shared designs
        })),
        supportElements: [],
        cakeMessages: [],
        icingDesign: { drip: !!icingColors.drip, gumpasteBaseBoard: !!icingColors.gumpasteBaseBoardColor, colors: icingColors },
        additionalInstructions: '',
      };

      const addonPrice = sharedDesign.final_price - sharedDesign.base_price;

      const newItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'> = {
        user_id: null, session_id: null,
        cake_type: cakeTypeDisplayMap[sharedDesign.cake_type as CakeType] || sharedDesign.cake_type,
        cake_thickness: sharedDesign.cake_thickness || DEFAULT_THICKNESS_MAP[sharedDesign.cake_type as CakeType] || '4 in',
        cake_size: sharedDesign.cake_size,
        base_price: sharedDesign.base_price,
        addon_price: addonPrice > 0 ? addonPrice : 0,
        final_price: sharedDesign.final_price,
        quantity: 1,
        original_image_url: sharedDesign.original_image_url || sharedDesign.customized_image_url,
        customized_image_url: sharedDesign.customized_image_url,
        customization_details: cartItemDetails,
      };

      await addToCartOptimistic(newItem);
      showSuccess('Added shared design to cart!');
      setAppState('cart');
    } catch (err) {
      console.error("Failed to add shared design to cart:", err);
      showError("Could not add this design to your cart.");
      throw err;
    } finally {
      setIsAddingToCart(false);
    }
  }, [addToCartOptimistic, setAppState]);

  // --- UI EFFECTS ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) setIsAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = useCallback(async () => { await signOut(); setIsAccountMenuOpen(false); showSuccess("You've been signed out."); }, [signOut]);

  // --- RENDER LOGIC ---
  const toastOptions = { style: { borderRadius: '9999px', background: '#333', color: '#fff', boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)' } };

  const renderAppState = () => {
    switch(appState) {
        case 'landing': return <LandingPage user={user} onSearch={(q) => { setSearchInput(q); handleSearch(q); }} onUploadClick={() => setIsUploaderOpen(true)} setAppState={setAppState as React.Dispatch<React.SetStateAction<AppState>>} />;
        case 'searching': return <SearchingPage searchInput={searchInput} setSearchInput={setSearchInput} searchQuery={searchQuery} error={imageManagementError} isSearching={isSearching} isLoading={isLoading} onSearch={() => handleSearch()} onClose={() => setAppState('landing')} originalImageData={originalImageData} onUploadClick={() => setIsUploaderOpen(true)} />;
        case 'customizing': return <CustomizingPage 
            onClose={() => setAppState(previousAppState.current === 'searching' ? 'searching' : 'landing')} searchInput={searchInput} setSearchInput={setSearchInput} onSearch={() => handleSearch()} 
            setAppState={setAppState as React.Dispatch<React.SetStateAction<AppState>>} itemCount={itemCount} isAuthenticated={isAuthenticated} isAccountMenuOpen={isAccountMenuOpen} 
            setIsAccountMenuOpen={setIsAccountMenuOpen} accountMenuRef={accountMenuRef} user={user} onSignOut={handleSignOut} isCustomizationDirty={isCustomizationDirty}
            onOpenReportModal={() => setIsReportModalOpen(true)} editedImage={editedImage} isLoading={isLoading} isUpdatingDesign={isUpdatingDesign}
            isReporting={isReporting} reportStatus={reportStatus} mainImageContainerRef={mainImageContainerRef} activeTab={activeTab} 
            setActiveTab={setActiveTab} originalImagePreview={originalImagePreview} isAnalyzing={isAnalyzing} setIsMainZoomModalOpen={setIsMainZoomModalOpen} 
            originalImageData={originalImageData} onUpdateDesign={handleUpdateDesign} 
            analysisResult={analysisResult} analysisError={analysisError} analysisId={analysisId} cakeInfo={cakeInfo} 
            basePriceOptions={basePriceOptions} mainToppers={mainToppers} supportElements={supportElements} cakeMessages={cakeMessages} 
            icingDesign={icingDesign} additionalInstructions={additionalInstructions} onCakeInfoChange={handleCakeInfoChange} 
            updateMainTopper={updateMainTopper} removeMainTopper={removeMainTopper}
            updateSupportElement={updateSupportElement} removeSupportElement={removeSupportElement}
            updateCakeMessage={updateCakeMessage} removeCakeMessage={removeCakeMessage}
            onIcingDesignChange={onIcingDesignChange} onAdditionalInstructionsChange={onAdditionalInstructionsChange} onTopperImageReplace={handleTopperImageReplace} 
            onSupportElementImageReplace={handleSupportElementImageReplace} onSave={handleSave} isSaving={isImageManagementLoading} 
            onClearAll={() => { clearAllState(true); }} error={designUpdateError} itemPrices={itemPrices}
            availability={availability}
            availabilitySettings={availabilitySettings}
            isLoadingAvailabilitySettings={isLoadingAvailabilitySettings}
            availabilityWasOverridden={availabilityWasOverridden}
            onCakeMessageChange={onCakeMessageChange}
        />;
        case 'cart': return <CartPage pendingItems={pendingCartItems} isLoading={isCartLoading} onRemoveItem={removeItemOptimistic} onClose={() => setAppState(previousAppState.current || 'customizing')} onContinueShopping={() => setAppState('customizing')} onAuthRequired={() => setAppState('auth')} />;
        case 'order_confirmation': return confirmedOrderId ? <OrderConfirmationPage orderId={confirmedOrderId} onContinueShopping={() => setAppState('landing')} onGoToOrders={() => setAppState('orders')} /> : <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
        case 'auth': return <AuthPage onClose={() => setAppState(previousAppState.current || 'landing')} onSuccess={() => setAppState(previousAppState.current && previousAppState.current !== 'auth' ? previousAppState.current : 'landing')} />;
        case 'addresses': return <AddressesPage onClose={() => setAppState(previousAppState.current || 'landing')} />;
        case 'orders': return <OrdersPage onClose={() => setAppState(previousAppState.current || 'landing')} />;
        case 'shared_design': return viewingDesignId ? <SharedDesignPage designId={viewingDesignId} onStartWithDesign={handleStartWithSharedDesign} onNavigateHome={() => { setAppState('landing'); }} onPurchaseDesign={handlePurchaseSharedDesign} user={user} onAuthRequired={() => setAppState('auth')} /> : <LoadingSpinner />;
        case 'shopify_customizing': return viewingShopifySessionId ? <ShopifyCustomizingPage sessionId={viewingShopifySessionId} onNavigateHome={() => setAppState('landing')} user={user} /> : <LoadingSpinner />;
        case 'about': return <AboutPage onClose={() => setAppState('landing')} />;
        case 'how_to_order': return <HowToOrderPage onClose={() => setAppState('landing')} />;
        case 'contact': return <ContactPage onClose={() => setAppState('landing')} />;
        case 'reviews': return <ReviewsPage onClose={() => setAppState('landing')} />;
        case 'pricing_sandbox': return <PricingSandboxPage onClose={() => setAppState('landing')} />;
        default: return <LandingPage user={user} onSearch={(q) => { setSearchInput(q); handleSearch(q); }} onUploadClick={() => setIsUploaderOpen(true)} setAppState={setAppState as React.Dispatch<React.SetStateAction<AppState>>} />;
    }
  }

  const mainContentPadding = useMemo(() => {
    switch (appState) {
        case 'landing': return 'p-4';
        case 'customizing': case 'shopify_customizing': return 'py-8 px-4';
        case 'searching': return 'py-8 px-4';
        case 'cart': case 'order_confirmation': case 'shared_design': case 'about': case 'how_to_order': case 'contact': case 'reviews': case 'pricing_sandbox': return 'py-20 px-4';
        // Let the AuthPage control its own centering without extra padding from the main container
        case 'auth': return 'p-4';
        case 'addresses': case 'orders': return 'py-12 px-4';
        default: return 'py-12 px-4';
    }
  }, [appState]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100">
      {/* Test component for Gemini API */}
      {showTest && <TestGemini />}
      
      <Toaster toastOptions={toastOptions} />
      <AnimatedBlobs />
      {authError && <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center p-4 text-center"><div className="max-w-md"><ErrorIcon className="w-16 h-16 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-slate-800 mb-2">Initialization Failed</h2><p className="text-slate-600 mb-6">{authError}</p><button onClick={() => window.location.reload()} className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all">Refresh Page</button></div></div>}
      {!authError && <>
          {appState === 'landing' && <div className="fixed top-4 right-4 z-20 flex items-center gap-2"><button onMouseEnter={() => import('./app/cart/page')} onClick={() => setAppState('cart')} className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors" aria-label={`View cart with ${itemCount} items`}><CartIcon />{itemCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">{itemCount}</span>}</button>{isAuthenticated && !user?.is_anonymous ? <div className="relative" ref={accountMenuRef}><button onClick={() => setIsAccountMenuOpen(prev => !prev)} className="p-2 text-slate-600 hover:text-purple-700 transition-colors" aria-label="Open account menu"><UserCircleIcon /></button>{isAccountMenuOpen && <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-fade-in"><div className="px-4 py-2 border-b border-slate-100"><p className="text-sm font-medium text-slate-800 truncate">{user?.email}</p></div><button onClick={() => { setAppState('addresses'); setIsAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><MapPinIcon className="w-4 h-4" />My Addresses</button><button onClick={() => { setAppState('orders'); setIsAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><PackageIcon className="w-4 h-4" />My Orders</button><button onClick={handleSignOut} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><LogOutIcon className="w-4 h-4" />Sign Out</button></div>}</div> : <button onClick={() => setAppState('auth')} className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-sm font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition-all shadow-sm">Login / Sign Up</button>}</div>}
          <main className={`relative w-full mx-auto transition-all duration-300 ease-in-out ${mainContentPadding} ${appState === 'landing' ? 'h-screen overflow-y-hidden' : ''}`}>
              <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
                  {isPreparingSharedDesign ? <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div> : renderAppState()}
              </Suspense>
          </main>
          <Suspense fallback={null}>
            <ImageUploader isOpen={isUploaderOpen} onClose={() => setIsUploaderOpen(false)} onImageSelect={(file) => { handleAppImageUpload(file).catch(err => console.error("Upload failed", err)); setIsUploaderOpen(false); }} />
          </Suspense>
          {appState === 'customizing' && <Suspense fallback={null}><ImageZoomModal isOpen={isMainZoomModalOpen} onClose={() => setIsMainZoomModalOpen(false)} originalImage={originalImagePreview} customizedImage={editedImage} initialTab={activeTab} /></Suspense>}
          <Suspense fallback={null}>
            <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onSubmit={handleReport} isSubmitting={isReporting} editedImage={editedImage} details={analysisResult ? buildCartItemDetails() : null} cakeInfo={cakeInfo} />
          </Suspense>
          {appState === 'customizing' && <StickyAddToCartBar price={finalPrice} isLoading={isFetchingBasePrice} isAdding={isAddingToCart} error={basePriceError} onAddToCartClick={handleAddToCart} onShareClick={handleShare} isSharing={isSavingDesign} canShare={!!analysisResult} isAnalyzing={isAnalyzing} cakeInfo={cakeInfo} warningMessage={toyWarningMessage} />}
          <Suspense fallback={null}>
            <ShareModal
              isOpen={isShareModalOpen}
              onClose={closeShareModal}
              shareData={shareData}
              onCreateLink={createShareLink}
              isSaving={isSavingDesign}
              finalPrice={finalPrice}
              imageUrl={editedImage || originalImagePreview || ''}
              user={user}
              onAuthRequired={() => setAppState('auth')}
              availability={availability}
            />
          </Suspense>
      </>}
    </div>
  );
}