# Codebase Export

## File: src/App.tsx

```tsx
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

// Build: v1.2.8 - Fixed .match() errors with defensive checks
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
        (result) => { // on analysis success (Phase 1: Fast features)
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
        {
          imageUrl,
          onCoordinatesEnriched: (enrichedResult) => {
            // Phase 2: Coordinates enriched - silently update the analysis
            console.log('🎯 Coordinates enriched! Updating markers...');
            setPendingAnalysisData(enrichedResult);
          }
        }
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

  const handleSignOut = useCallback(async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        showError('Failed to sign out: ' + error.message);
      } else {
        setIsAccountMenuOpen(false);
        setAppState('landing');
        showSuccess("You've been signed out.");
      }
    } catch (err) {
      console.error('Sign out exception:', err);
      showError('An error occurred while signing out');
    }
  }, [signOut, setAppState]);

  // --- RENDER LOGIC ---
  const toastOptions = { style: { borderRadius: '9999px', background: '#333', color: '#fff', boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)' } };

  const renderAppState = () => {
    switch(appState) {
        case 'landing': return <LandingPage user={user} onSearch={(q) => { setSearchInput(q); handleSearch(q); }} onUploadClick={() => setIsUploaderOpen(true)} setAppState={setAppState as React.Dispatch<React.SetStateAction<AppState>>} />;
        case 'searching': return <SearchingPage searchInput={searchInput} setSearchInput={setSearchInput} searchQuery={searchQuery} error={imageManagementError} isSearching={isSearching} isLoading={isLoading} onSearch={(query) => handleSearch(query)} onClose={() => setAppState('landing')} originalImageData={originalImageData} onUploadClick={() => setIsUploaderOpen(true)} />;
        case 'customizing': return <CustomizingPage 
            onClose={() => setAppState(previousAppState.current === 'searching' ? 'searching' : 'landing')} searchInput={searchInput} setSearchInput={setSearchInput} onSearch={(query) => handleSearch(query)} 
            setAppState={setAppState as React.Dispatch<React.SetStateAction<AppState>>} itemCount={itemCount} isAuthenticated={isAuthenticated} isAccountMenuOpen={isAccountMenuOpen} 
            setIsAccountMenuOpen={setIsAccountMenuOpen} accountMenuRef={accountMenuRef} user={user} onSignOut={handleSignOut} isCustomizationDirty={isCustomizationDirty}
            onOpenReportModal={() => setIsReportModalOpen(true)} editedImage={editedImage} isLoading={isLoading} isUpdatingDesign={isUpdatingDesign}
            isReporting={isReporting} reportStatus={reportStatus} mainImageContainerRef={mainImageContainerRef} activeTab={activeTab} 
            setActiveTab={setActiveTab} originalImagePreview={originalImagePreview} isAnalyzing={isAnalyzing} 
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
```

## File: src/main.tsx

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CartProvider } from './contexts/CartContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { GoogleMapsLoaderProvider } from './contexts/GoogleMapsLoaderContext';
import './index.css';

console.log('main.tsx: File loaded');

// Suppress the harmless "Multiple GoTrueClient instances" warning that occurs in development
// due to React.StrictMode double-invoking effects. This is not an issue in production.
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = function(...args: any[]) {
    if (args[0]?.includes?.('Multiple GoTrueClient instances')) {
      return; // Suppress this specific warning
    }
    originalWarn.apply(console, args);
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleMapsLoaderProvider>
        <CartProvider>
            <App />
        </CartProvider>
      </GoogleMapsLoaderProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

## File: src/metadata.json

```json
{
  "name": "Genie - Nov 10",
  "description": "Find any cake design with web search, then use AI to customize its decorations and get an instant, rule-based price estimate for the design.",
  "requestFramePermissions": []
}
```

## File: src/index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */

/* --- Progress Bar Animation --- */
.progress-bar-fill {
  width: 0%;
  animation: fillProgressBar 15s linear forwards;
}

@keyframes fillProgressBar {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}

/* --- Search Pagination Styles --- */
.gsc-cursor-box {
  display: block !important;
}
.gsc-cursor-area {
  display: flex !important;
  justify-content: center;
  padding: 20px 0;
  gap: 8px;
}
.gsc-cursor-page, .gsc-cursor-next, .gsc-cursor-prev {
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  font-weight: 600;
  color: #475569;
  background-color: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.gsc-cursor-page:hover, .gsc-cursor-next:hover, .gsc-cursor-prev:hover {
  background-color: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateY(-1px);
}
.gsc-cursor-current-page {
  background: linear-gradient(to right, #ec4899, #8b5cf6);
  color: white;
  border-color: transparent;
  font-weight: bold;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

/* --- Analysis Marker Styles --- */
.analysis-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease-out;
  z-index: 10;
  /* Smooth fade-in animation for markers when coordinates load */
  animation: markerFadeIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  opacity: 0;
}
@keyframes markerFadeIn {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
.analysis-marker .marker-dot {
  width: 18px;
  height: 18px;
  background-color: rgba(236, 72, 153, 0.1);
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  transition: all 0.2s ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  color: white;
  line-height: 1;
}
.analysis-marker .action-marker {
  background-color: rgba(34, 197, 94, 0.1);
  font-size: 16px;
  font-weight: bold;
  line-height: 0;
}
.analysis-marker:hover .marker-dot {
  transform: scale(1.3);
  background-color: rgba(139, 92, 246, 0.9);
}
.analysis-marker:hover .action-marker {
  background-color: rgba(22, 163, 74, 0.9);
}
.analysis-marker.selected .marker-dot {
  transform: scale(1.5);
  background-color: rgba(139, 92, 246, 1);
}
.analysis-marker.selected .action-marker {
  background-color: rgba(22, 163, 74, 1);
}
.analysis-marker.selected::before {
  content: '';
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid white;
  animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}
@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}
.marker-tooltip {
  position: absolute;
  bottom: 100%;
  margin-bottom: 8px;
  white-space: nowrap;
  background-color: rgba(30, 41, 59, 0.9);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  transform: translateX(-50%);
  left: 50%;
  animation: fadeInTooltip 0.2s ease-out;
}
@keyframes fadeInTooltip {
  from { opacity: 0; transform: translate(-50%, 5px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

/* Slide Down Animation for Icing Panel */
@keyframes slideDown {
  from {
    max-height: 0;
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    max-height: 500px;
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-slideDown {
  animation: slideDown 0.3s ease-out forwards;
}
.icing-toolbar-tooltip {
  position: absolute;
  left: 100%;
  top: 50%;
  margin-left: 12px;
  white-space: nowrap;
  background-color: rgba(30, 41, 59, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
  opacity: 0;
  transform: translate(-10px, -50%);
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
.group:hover .icing-toolbar-tooltip {
  opacity: 1;
  transform: translate(0, -50%);
}
.icing-toolbar-tooltip.force-show {
  opacity: 1;
  transform: translate(0, -50%);
}
```

## File: src/types.ts

```ts
// types.ts

// --- Base Types from Gemini Analysis ---
export type CakeType = '1 Tier' | '2 Tier' | '3 Tier' | '1 Tier Fondant' | '2 Tier Fondant' | '3 Tier Fondant' | 'Square' | 'Rectangle' | 'Bento';
export type CakeThickness = '2 in' | '3 in' | '4 in' | '5 in' | '6 in';
export type CakeSize = string; // e.g., '6" Round', '6"/8" Round'
export type CakeFlavor = 'Chocolate Cake' | 'Ube Cake' | 'Vanilla Cake' | 'Mocha Cake';

export type MainTopperType = 'edible_3d_complex' | 'edible_3d_ordinary' | 'printout' | 'toy' | 'figurine' | 'cardstock' | 'edible_photo' | 'candle' | 'icing_doodle' | 'icing_palette_knife' | 'icing_brush_stroke' | 'icing_splatter' | 'icing_minimalist_spread' | 'meringue_pop' | 'plastic_ball';
export type SupportElementType = 'edible_3d_support' | 'edible_2d_support' | 'chocolates' | 'sprinkles' | 'support_printout' | 'isomalt' | 'dragees' | 'edible_flowers' | 'edible_photo_side' | 'icing_doodle' | 'icing_palette_knife' | 'icing_brush_stroke' | 'icing_splatter' | 'icing_minimalist_spread';
export type CakeMessageType = 'gumpaste_letters' | 'icing_script' | 'printout' | 'cardstock';

export type Size = 'small' | 'medium' | 'large' | 'tiny' | 'mixed';
export type Coverage = 'large' | 'medium' | 'small' | 'tiny';

export interface Color {
  name: string;
  hex: string;
}

export interface MainTopper {
  type: MainTopperType;
  description: string;
  size: Size;
  quantity: number;
  group_id: string;
  classification: 'hero' | 'support' | 'hero + support';
  color?: string;
  colors?: (string | null)[];
  x?: number;
  y?: number;
}

export interface SupportElement {
  type: SupportElementType;
  description: string;
  coverage: Coverage;
  group_id: string;
  color?: string;
  colors?: (string | null)[];
  x?: number;
  y?: number;
}

export interface CakeMessage {
  type: CakeMessageType;
  text: string;
  position: 'top' | 'side' | 'base_board';
  color: string;
  x?: number;
  y?: number;
}

export interface IcingColorDetails {
  side?: string;
  top?: string;
  borderTop?: string;
  borderBase?: string;
  drip?: string;
  gumpasteBaseBoardColor?: string;
}

export interface IcingDesign {
  base: 'soft_icing' | 'fondant';
  color_type: 'single' | 'gradient_2' | 'gradient_3' | 'abstract';
  colors: IcingColorDetails;
  border_top: boolean;
  border_base: boolean;
  drip: boolean;
  gumpasteBaseBoard: boolean;
}

export interface DripEffect {
  description: string;
  x: number;
  y: number;
}

export interface IcingSurface {
  description: string;
  tier: number;
  position: 'top' | 'side';
  x: number;
  y: number;
}

export interface IcingBorder {
  description: string;
  tier: number;
  position: 'top' | 'base';
  x: number;
  y: number;
}

export interface BaseBoard {
  description: string;
  x: number;
  y: number;
}

export interface HybridAnalysisResult {
  cakeType: CakeType;
  cakeThickness: CakeThickness;
  main_toppers: MainTopper[];
  support_elements: SupportElement[];
  cake_messages: CakeMessage[];
  icing_design: IcingDesign;
  rejection?: {
    isRejected: boolean;
    message: string;
  };
  drip_effects?: DripEffect[];
  icing_surfaces?: IcingSurface[];
  icing_borders?: IcingBorder[];
  base_board?: BaseBoard[];
}

// --- UI-specific types (extended from base types) ---

export interface MainTopperUI extends MainTopper {
  id: string;
  isEnabled: boolean;
  price: number;
  original_type: MainTopperType;
  replacementImage?: { data: string; mimeType: string };
  original_color?: string;
  original_colors?: (string | null)[];
}

export interface SupportElementUI extends SupportElement {
  id: string;
  isEnabled: boolean;
  price: number;
  original_type: SupportElementType;
  replacementImage?: { data: string; mimeType: string };
  original_color?: string;
  original_colors?: (string | null)[];
}

export interface CakeMessageUI extends CakeMessage {
  id: string;
  isEnabled: boolean;
  price: number;
  originalMessage?: CakeMessage; // To track changes
  useDefaultColor?: boolean; // For Shopify flow
}

export interface IcingDesignUI extends IcingDesign {
  dripPrice: number;
  gumpasteBaseBoardPrice: number;
}

export interface CakeInfoUI {
  type: CakeType;
  thickness: CakeThickness;
  size: CakeSize;
  flavors: CakeFlavor[];
}


// --- Pricing & Cart Types ---

export interface CartItemDetails {
  flavors: string[];
  mainToppers: {
    description: string;
    type: string;
    size?: string;
  }[];
  supportElements: {
    description: string;
    type: string;
    coverage?: string;
  }[];
  cakeMessages: {
    text: string;
    color: string;
  }[];
  icingDesign: {
    drip: boolean;
    gumpasteBaseBoard: boolean;
    colors: Record<string, string>;
  };
  additionalInstructions: string;
}

export interface CartItem {
  id: string;
  image: string | null;
  status: 'pending' | 'complete' | 'error';
  type: string;
  thickness: string;
  size: string;
  totalPrice: number;
  details: CartItemDetails;
  errorMessage?: string;
}

export interface AddOnPricing {
  addOnPrice: number;
  breakdown: { item: string; price: number }[];
}

export interface BasePriceInfo {
  size: CakeSize;
  price: number;
}

// Pricing Rule from database
export interface SpecialConditions {
  bento_price?: number;
  allowance_eligible?: boolean;
  [key: string]: any; // Allow extensibility while enforcing known keys
}

export interface PricingRule {
  rule_id: number;
  item_key: string;
  item_type: string;
  classification: string | null;  // 'hero', 'support', 'special', 'message', 'icing'
  size: 'large' | 'medium' | 'small' | 'tiny' | null;
  coverage: 'large' | 'medium' | 'small' | 'tiny' | null;
  description: string;
  price: number;
  category: 'main_topper' | 'support_element' | 'special' | 'message' | 'icing_feature' | null;
  quantity_rule: 'per_piece' | 'per_3_pieces' | 'per_digit' | null;
  multiplier_rule: 'tier_count' | null;
  special_conditions: SpecialConditions | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountValidationResult {
  valid: boolean;
  discountAmount: number;
  codeId?: string;
  originalAmount: number;
  finalAmount: number;
  message?: string;
}

// --- Service Payloads ---

export interface ReportPayload {
  original_image: string;
  customized_image: string;
  prompt_sent_gemini: string;
  maintoppers: string;
  supportelements: string;
  cakemessages: string;
  icingdesign: string;
  addon_price: number;
  user_report?: string;
}

export interface AiPrompt {
  // This seems unused, define a placeholder
  id: string;
  prompt: string;
}

export interface PricingFeedback {
  original_image_url: string;
  ai_analysis: HybridAnalysisResult;
  corrections: Record<string, { ai_price: number, expert_price: number }>;
  ai_total_price: number;
  expert_total_price: number;
  notes?: string;
}

export interface AvailabilitySettings {
  setting_id: string;
  created_at: string;
  rush_to_same_day_enabled: boolean;
  rush_same_to_standard_enabled: boolean;
  minimum_lead_time_days: number;
}

// --- Google CSE Types ---
export interface GoogleCSEElement {
  execute: (query: string) => void;
  clearAllResults: () => void;
}

export interface GoogleCSE {
  search: {
    cse: {
      element: {
        render: (options: {
          div: string;
          tag: string;
          gname: string;
          attributes: Record<string, any>;
        }) => GoogleCSEElement;
      };
    };
  };
}
```

## File: src/vite-env.d.ts

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## File: src/constants.ts

```ts
import { Color, CakeType, CakeThickness, CakeSize, CakeFlavor } from './types';
import { SUPABASE_URL } from './config';

export const COLORS: Color[] = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Light Red', hex: '#FCA5A5' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Light Green', hex: '#4ADE80' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Light Blue', hex: '#93C5FD' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Light Purple', hex: '#C4B5FD' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Light Pink', hex: '#FBCFE8' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Light Brown', hex: '#B45309' },
  { name: 'Gray', hex: '#64748B' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
];

export const CAKE_TYPES: CakeType[] = [
  '1 Tier', '2 Tier', '3 Tier',
  '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant',
  'Square', 'Rectangle', 'Bento'
];

export const CAKE_THICKNESSES: CakeThickness[] = ['2 in', '3 in', '4 in', '5 in', '6 in'];

export const FLAVOR_OPTIONS: CakeFlavor[] = ['Chocolate Cake', 'Ube Cake', 'Vanilla Cake', 'Mocha Cake'];

export const DEFAULT_THICKNESS_MAP: Record<CakeType, CakeThickness> = {
  '1 Tier': '4 in',
  '2 Tier': '4 in',
  '3 Tier': '4 in',
  'Square': '4 in',
  'Rectangle': '4 in',
  '1 Tier Fondant': '5 in',
  '2 Tier Fondant': '5 in',
  '3 Tier Fondant': '5 in',
  'Bento': '2 in',
};

export const THICKNESS_OPTIONS_MAP: Record<CakeType, CakeThickness[]> = {
  '1 Tier': ['3 in', '4 in', '5 in', '6 in'],
  '2 Tier': ['4 in', '5 in'],
  '3 Tier': ['4 in', '5 in'],
  'Square': ['3 in', '4 in'],
  'Rectangle': ['3 in', '4 in'],
  '1 Tier Fondant': ['5 in', '6 in'],
  '2 Tier Fondant': ['5 in', '6 in'],
  '3 Tier Fondant': ['5 in', '6 in'],
  'Bento': ['2 in'],
};

export const ANALYSIS_PHRASES = [
  'Preheating the analysis engine',
  'Scanning for delicious details',
  'Slicing the image into digital layers',
  'Identifying icing colors and textures',
  'Consulting with our digital pastry chef',
  'Measuring the cake tiers',
  'Searching for the main toppers',
  'Deconstructing the design elements',
  'Translating pixels into pastry',
  'Counting the candles (just kidding!)',
  'Checking for fondant vs. soft icing',
  'Whipping up your customization options',
  'Uncovering the recipe for your design',
  'Identifying supporting decorations',
  'Getting the full scoop on your cake',
  'Finalizing the feature list',
  'Just a moment, our AI has a sweet tooth',
  'Preparing your design palette',
  'Sketching out the cake\'s blueprint',
  'Almost there, just adding the finishing touches',
];

const supabaseUrl = SUPABASE_URL;

if (!supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
  throw new Error("Supabase URL is required for asset paths. Please update it in the `config.ts` file.");
}

const storageBaseUrl = `${supabaseUrl}/storage/v1/object/public/cakegenie`;

export const FLAVOR_THUMBNAILS: Record<CakeFlavor, string> = {
  'Chocolate Cake': `${storageBaseUrl}/cakechocolate.webp`,
  'Ube Cake': `${storageBaseUrl}/cakeube.webp`,
  'Vanilla Cake': `${storageBaseUrl}/cakevanilla.webp`,
  'Mocha Cake': `${storageBaseUrl}/cakemocha.webp`,
};

export const TIER_THUMBNAILS: Record<number, string[]> = {
  1: [`${storageBaseUrl}/1-tier-highlight.webp`],
  2: [`${storageBaseUrl}/2tiertop.webp`, `${storageBaseUrl}/2tierbottom.webp`],
  3: [`${storageBaseUrl}/3tiertop.webp`, `${storageBaseUrl}/3tiermiddle.webp`, `${storageBaseUrl}/3tierbottom.webp`]
};

export const CAKE_TYPE_THUMBNAILS: Record<CakeType, string> = {
  '1 Tier': `${storageBaseUrl}/1tier.webp`,
  '2 Tier': `${storageBaseUrl}/2tier.webp`,
  '3 Tier': `${storageBaseUrl}/3tier.webp`,
  '1 Tier Fondant': `${storageBaseUrl}/1tier.webp`,
  '2 Tier Fondant': `${storageBaseUrl}/2tier.webp`,
  '3 Tier Fondant': `${storageBaseUrl}/3tier.webp`,
  'Square': `${storageBaseUrl}/square.webp`,
  'Rectangle': `${storageBaseUrl}/rectangle.webp`,
  'Bento': `${storageBaseUrl}/bento.webp`,
};

export const CAKE_SIZE_THUMBNAILS: Record<string, string> = {
  // 1 Tier
  '6" Round': `${storageBaseUrl}/1tier.webp`,
  '8" Round': `${storageBaseUrl}/1tier.webp`,
  '10" Round': `${storageBaseUrl}/1tier.webp`,
  // 2 Tier
  '6"/8" Round': `${storageBaseUrl}/2tier.webp`,
  '8"/10" Round': `${storageBaseUrl}/2tier.webp`,
  // 3 Tier
  '6"/8"/10" Round': `${storageBaseUrl}/3tier.webp`,
  // Square
  '6" Square': `${storageBaseUrl}/square.webp`,
  '8" Square': `${storageBaseUrl}/square.webp`,
  // Rectangle
  '9"x13" Rectangle': `${storageBaseUrl}/rectangle.webp`,
  // Bento
  '4" Round': `${storageBaseUrl}/bento.webp`,
};

export const DEFAULT_SIZE_MAP: Record<CakeType, CakeSize> = {
  '1 Tier': '8" Round',
  '2 Tier': '6"/8" Round',
  '3 Tier': '6"/8"/10" Round',
  'Square': '8" Square',
  'Rectangle': '9"x13" Rectangle',
  '1 Tier Fondant': '8" Round',
  '2 Tier Fondant': '6"/8" Round',
  '3 Tier Fondant': '6"/8"/10" Round',
  'Bento': '4" Round',
};

export const CAKE_THICKNESS_THUMBNAILS: Record<CakeThickness, string> = {
  '2 in': `${storageBaseUrl}/thickness_2in.webp`,
  '3 in': `${storageBaseUrl}/thickness_3in.webp`,
  '4 in': `${storageBaseUrl}/thickness_4in.webp`,
  '5 in': `${storageBaseUrl}/thickness_5in.webp`,
  '6 in': `${storageBaseUrl}/thickness_6in.webp`,
};

export const CITIES_AND_BARANGAYS: Record<string, string[]> = {
  "Cebu City": ["Adlaon", "Agsungot", "Apas", "Babag", "Bacayan", "Banilad", "Basak Pardo", "Basak San Nicolas", "Bonbon", "Budla-an", "Buhisan", "Bulacao", "Buot", "Busay", "Calamba", "Cambinocot", "Kamagayan", "Kamputhaw (Camputhaw)", "Capitol Site", "Carreta", "Cogon Pardo", "Cogon Ramos", "Day-as", "Duljo Fatima", "Ermita", "Guadalupe", "Guba", "Hipodromo", "Inayawan", "Kalubihan", "Kalunasan", "Kasambagan", "Kinasang-an Pardo", "Labangon", "Lahug", "Lorega San Miguel", "Lusaran", "Luz", "Mabini", "Mabolo", "Malubog", "Mambaling", "Pahina Central", "Pahina San Nicolas", "Pamutan", "Pari-an", "Paril", "Pasil", "Pit-os", "Poblacion Pardo", "Pulangbato", "Pung-ol Sibugay", "Punta Princesa", "Quiot", "Sambag I", "Sambag II", "San Antonio", "San Jose", "San Nicolas Proper", "San Roque", "Santa Cruz", "Sapangdaku", "Sawang Calero", "Sinsin", "Sirao", "Suba", "Sudlon I", "Sudlon II", "T. Padilla", "Tabunan", "Tagba-o", "Talamban", "Taptap", "Tejero", "Tinago", "Tisa", "To-ong", "Zapatera"],
  "Mandaue City": ["Alang-alang", "Bakilid", "Banilad", "Basak", "Cabancalan", "Cambaro", "Canduman", "Casili", "Casuntingan", "Centro", "Cubacub", "Guizo", "Ibabao-Estancia", "Jagobiao", "Labogon", "Looc", "Maguikay", "Mantuyong", "Opao", "Pagsabungan", "Paknaan", "Subangdaku", "Tabok", "Tawason", "Tingub", "Tipolo", "Umapad"],
  "Consolacion": ["Cabangahan", "Cansaga", "Danao", "Garing", "Jugan", "Lamac", "Lanipga", "Nangka", "Panas", "Panoypoy", "Pitogo", "Poblacion Occidental", "Poblacion Oriental", "Polog", "Pulpogan", "Sacsac", "Tayud", "Tilhaong", "Tugbongan"],
  "Lapu-lapu City": ["Agus", "Babag", "Bankal", "Baring", "Basak", "Buaya", "Calawisan", "Canjulao", "Caw-oy", "Cawhagan", "Caubian", "Gun-ob", "Ibo", "Looc", "Mactan", "Maribago", "Marigondon", "Pajac", "Pajo", "Pangan-an", "Poblacion", "Punta Engaño", "Sabang", "Santa Rosa", "Subabasbas", "Talima", "Tingo", "Tungasan", "San Vicente"],
  "Cordova": ["Alegria", "Bangbang", "Buagsong", "Catarman", "Cogon", "Dapitan", "Day-as", "Gabi", "Gilutongan", "Ibabao", "Pilipog", "Poblacion", "San Miguel"],
  "Talisay City": ["Biasong", "Bulacao", "Cadulawan", "Camp IV", "Cansojong", "Dapdap", "Jaclupan", "Lagtang", "Lawaan I", "Lawaan II", "Lawaan III", "Linao", "Maghaway", "Manipis", "Mohon", "Pooc", "Poblacion", "San Isidro", "San Roque", "Tabunok", "Tangke", "Tapul"],
};

export const SHOPIFY_TAGS = {
  TIER: 'tier',
  TYPE: 'type',
  FLAVOR: 'flavor',
};

export const DEFAULT_ICING_DESIGN = {
  base: 'soft_icing' as const,
  color_type: 'single' as const,
  colors: { side: '#FFFFFF' },
  border_top: false,
  border_base: false,
  drip: false,
  gumpasteBaseBoard: false,
  dripPrice: 100,
  gumpasteBaseBoardPrice: 100,
};
```

## File: src/config.ts

```ts
// config.ts

// Configuration variables are hardcoded here for this specific "buildless"
// browser environment. These are public keys and are secured by
// Supabase RLS and Google Cloud API restrictions.

export const FEATURE_FLAGS = {
  USE_DATABASE_PRICING: true, // Set to true to use the new database-driven pricing
};

export const SUPABASE_URL = "https://cqmhanqnfybyxezhobkx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhhbnFuZnlieXhlemhvYmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MjEwMTgsImV4cCI6MjA3NTE5NzAxOH0.7Et4dx3c8MXXpVVC5tXzM2nFZ203lx9WnAagWsakXks";
export const GOOGLE_MAPS_API_KEY = "AIzaSyDThtN_G7khUxdZy6rVPgI0zpsyPS30ryE";

// IMPORTANT: The Gemini API Key (process.env.API_KEY) is a special case.
// The execution environment (e.g., Google AI Studio) securely injects this
// one specific environment variable at runtime.
```

## File: src/contexts/CartContext.tsx

```tsx
// contexts/CartContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
  useRef,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient, User, PostgrestError } from '@supabase/supabase-js';
import debounce from 'lodash/debounce';
import { showError } from '../lib/utils/toast';

import { getSupabaseClient } from '../lib/supabase/client';
import { CakeGenieCartItem, CakeGenieAddress } from '../lib/database.types';
import {
  getCartPageData,
  addToCart as addToCartService,
  updateCartItemQuantity as updateQuantityService,
  removeCartItem as removeItemService,
} from '../services/supabaseService';
import { withTimeout } from '../lib/utils/timeout';

// --- NEW BATCHED LOCALSTORAGE WRITER ---
const queuedWrites: { [key: string]: string | null } = {};
let isFlushScheduled = false;

const flushWrites = () => {
  if (typeof window === 'undefined') return;
  try {
    for (const key in queuedWrites) {
      if (Object.prototype.hasOwnProperty.call(queuedWrites, key)) {
        const value = queuedWrites[key];
        if (value === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, value);
        }
        delete queuedWrites[key];
      }
    }
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.error("LocalStorage quota exceeded. Cannot save cart state.");
      showError("Could not save session. Browser storage might be full.");
    } else {
      console.error("Failed to write to localStorage:", e);
    }
  } finally {
    isFlushScheduled = false;
  }
};

// Debounce the flush operation to batch multiple writes within 100ms
const debouncedFlush = debounce(flushWrites, 100);

export const batchSaveToLocalStorage = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  const dataToStore = {
      value,
      timestamp: Date.now()
  };
  queuedWrites[key] = JSON.stringify(dataToStore);
  if (!isFlushScheduled) {
    isFlushScheduled = true;
    debouncedFlush();
  }
};

export const batchRemoveFromLocalStorage = (key: string) => {
  if (typeof window === 'undefined') return;
  queuedWrites[key] = null; // Use null as a sentinel for removal
  if (!isFlushScheduled) {
    isFlushScheduled = true;
    debouncedFlush();
  }
};

// --- NEW LOCALSTORAGE READ/CLEANUP UTILITIES ---

export const readFromLocalStorage = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  const item = localStorage.getItem(key);
  if (!item) return null;
  try {
    const data = JSON.parse(item);
    // Check for new format with timestamp
    if (data && typeof data.value === 'string' && typeof data.timestamp === 'number') {
      return data.value;
    }
    // It's a JSON but not our format, so ignore it
    return null;
  } catch (e) {
    // If parsing fails, it's the old plain string format. Return for backward compatibility.
    // The next save will convert it to the new format.
    return item;
  }
};

export const cleanupExpiredLocalStorage = () => {
    if (typeof window === 'undefined') return;
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cart_')) {
            try {
                const item = localStorage.getItem(key);
                if (item) {
                    const data = JSON.parse(item);
                    if (data.timestamp) {
                        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                        if (data.timestamp < sevenDaysAgo) {
                            keysToRemove.push(key);
                        }
                    }
                }
            } catch (e) {
                // Ignore items not in the new format or unparseable
            }
        }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
        // Removed console.log for production
    }
};


interface DeliveryDetails {
    eventDate: string;
    eventTime: string;
    addressId: string | null; // Null for guests
    addressData: Partial<CakeGenieAddress>;
    deliveryInstructions: string;
}

// --- NEW SPLIT CONTEXT TYPES ---

interface CartDataType {
  cartItems: CakeGenieCartItem[];
  addresses: CakeGenieAddress[];
  cartTotal: number;
  itemCount: number;
  isLoading: boolean;
  sessionId: string | null;
  deliveryDetails: DeliveryDetails | null;
  eventDate: string;
  eventTime: string;
  deliveryInstructions: string;
  selectedAddressId: string;
  authError: string | null;
}

interface CartActionsType {
  setDeliveryDetails: (details: DeliveryDetails | null) => void;
  setEventDate: (date: string) => void;
  setEventTime: (time: string) => void;
  setDeliveryInstructions: (instructions: string) => void;
  setSelectedAddressId: (id: string) => void;
  refreshCart: () => Promise<void>;
  addToCartOptimistic: (
    item: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
    options?: { skipOptimistic?: boolean }
  ) => Promise<void>;
  updateQuantityOptimistic: (cartItemId: string, quantity: number) => Promise<void>;
  removeItemOptimistic: (cartItemId: string) => Promise<void>;
  clearCart: () => void;
}

interface CartContextType extends CartDataType, CartActionsType {}

// --- NEW SPLIT CONTEXTS ---

const CartDataContext = createContext<CartDataType | undefined>(undefined);
const CartActionsContext = createContext<CartActionsType | undefined>(undefined);

const supabase: SupabaseClient = getSupabaseClient();

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  
  const [cartItems, setCartItems] = useState<CakeGenieCartItem[]>([]);
  const [addresses, setAddresses] = useState<CakeGenieAddress[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const prevUserIdRef = useRef<string | null>(null);

  const [eventDate, setEventDateState] = useState<string>(() => {
    return readFromLocalStorage('cart_event_date') || '';
  });

  const [eventTime, setEventTimeState] = useState<string>(() => {
    return readFromLocalStorage('cart_event_time') || '';
  });
  
  const [deliveryInstructions, setDeliveryInstructionsState] = useState<string>(() => {
    return readFromLocalStorage('cart_delivery_instructions') || '';
  });

  const [selectedAddressId, setSelectedAddressIdState] = useState<string>(() => {
      return readFromLocalStorage('cart_selected_address_id') || '';
  });

  const setEventDate = useCallback((date: string) => {
    batchSaveToLocalStorage('cart_event_date', date);
    setEventDateState(date);
  }, []);

  const setEventTime = useCallback((time: string) => {
    batchSaveToLocalStorage('cart_event_time', time);
    setEventTimeState(time);
  }, []);

  const setDeliveryInstructions = useCallback((instructions: string) => {
    batchSaveToLocalStorage('cart_delivery_instructions', instructions);
    setDeliveryInstructionsState(instructions);
  }, []);

  const setSelectedAddressId = useCallback((id: string) => {
    batchSaveToLocalStorage('cart_selected_address_id', id);
    setSelectedAddressIdState(id);
  }, []);

  const loadCartData = useCallback(async (user: User | null) => {
    setIsLoading(true);
    try {
      const isAnonymous = user?.is_anonymous ?? false;
      const userIdForQuery = isAnonymous ? null : user?.id;
      const sessionIdForQuery = isAnonymous ? user?.id : null;
      
      // Fix TypeScript error by ensuring proper types
      const pageDataPromise = getCartPageData(
        userIdForQuery !== undefined ? userIdForQuery : null, 
        sessionIdForQuery !== undefined ? sessionIdForQuery : null
      );
      const { cartData, addressesData } = await withTimeout(
        pageDataPromise,
        2000, // 2 second timeout
        "Cart loading timed out."
      );

      const { data: cartItemsData, error: cartError } = cartData;
      if (cartError) throw cartError;
      setCartItems(cartItemsData || []);

      const { data: userAddressesData, error: addressesError } = addressesData;
      if (addressesError) {
          console.error('Failed to load addresses:', addressesError);
          // Don't throw, allow cart to load without addresses
      }
      setAddresses(userAddressesData || []);
      
    } catch (error) {
      console.error('Failed to load cart data:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      setCartItems([]);
      setAddresses([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    const initialize = async () => {
        cleanupExpiredLocalStorage();
        setIsLoading(true); // Set loading at the very start.
        try {
            const { data: { session } } = await supabase.auth.getSession();
    
            let userToLoad: User | null = session?.user || null;
    
            if (!session) {
                const { data, error } = await supabase.auth.signInAnonymously();
    
                if (error) {
                    throw error; // Let the catch block handle it
                }
                userToLoad = data.user;
            } else {
                // Fix TypeScript error by checking if userToLoad is not null
                if (userToLoad) {
                } else {
                }
            }
    
            setCurrentUser(userToLoad);
            if (userToLoad?.is_anonymous) {
                setSessionId(userToLoad.id);
            } else {
                setSessionId(null);
            }
            prevUserIdRef.current = userToLoad?.id ?? null;
            
            await loadCartData(userToLoad); // This has its own try/catch/finally
            setAuthError(null); // Clear any previous errors on success

        } catch (error: any) {
            console.error('❌ Failed to initialize user session:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            if (error.message.includes("disabled")) {
                setAuthError("Guest sessions are currently disabled. Please ask the site administrator to enable Anonymous Sign-ins in the Supabase project's authentication settings.");
            } else {
                // A more user-friendly message
                setAuthError(`Could not connect to the service. Please check your internet connection and try again.`);
            }
            setIsLoading(false); // CRITICAL: Turn off loading on initialization failure.
        }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user ?? null;
        const currentUserId = user?.id ?? null;
        
        const isAnonymous = user?.is_anonymous;
        
        // Only reload the cart if the user has actually changed.
        if (currentUserId !== prevUserIdRef.current) {
            prevUserIdRef.current = currentUserId;
            setCurrentUser(user);
            
            if (user?.is_anonymous) {
                setSessionId(user.id);
            } else {
                setSessionId(null);
            }
            
            // If there's no auth error, load the cart for the new user.
            // This handles login/logout scenarios.
            if (!authError) {
                await loadCartData(user);
            }
        } else {
             // If user hasn't changed (e.g., token refresh), just update the user object.
            setCurrentUser(user);
        }
    });
        
    return () => {
        subscription?.unsubscribe();
    };
  }, [loadCartData, authError]);

  const addToCartOptimistic = useCallback(async (
    itemParams: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
    options?: { skipOptimistic?: boolean }
  ) => {
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const tempItem: CakeGenieCartItem = {
      ...itemParams,
      cart_item_id: tempId,
      created_at: now,
      updated_at: now,
      expires_at: expiresAt.toISOString(),
    };

    if (!options?.skipOptimistic) {
      setCartItems(prevItems => [tempItem, ...prevItems]);
    }

    try {
      // FIX: Fetch the user directly before the operation to avoid race conditions
      // with the state update, which was causing RLS violations.
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Could not verify user session. Please try again.");
      }

      const isAnonymous = user.is_anonymous;
      const itemToSend = {
        ...itemParams,
        user_id: isAnonymous ? null : user.id,
        session_id: isAnonymous ? user.id : null,
      };

      const { data: realItem, error } = await addToCartService(itemToSend);

      if (error || !realItem) {
        if (error) {
          const supabaseError = error as PostgrestError;
          console.error('🔴 Supabase error adding to cart:', JSON.stringify(supabaseError, null, 2));
        }
        throw error || new Error('Failed to add item to cart. No data returned from service.');
      }
      
      if (options?.skipOptimistic) {
        setCartItems(prev => [realItem, ...prev]);
      } else {
        setCartItems(prev => prev.map(item => item.cart_item_id === tempId ? realItem : item));
      }

    } catch (error: any) {
      console.error('🔴 Error in addToCartOptimistic, rolling back:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      if (!options?.skipOptimistic) {
        setCartItems(prev => prev.filter(item => item.cart_item_id !== tempId));
      }
      throw error;
    }
  }, []);

  const removeItemOptimistic = useCallback(async (cartItemId: string) => {
    const originalCart = [...cartItems];

    setCartItems(prev => prev.filter(item => item.cart_item_id !== cartItemId));

    try {
        const { error } = await removeItemService(cartItemId);
        if (error) throw error;
    } catch (error) {
        console.error('Error removing item, rolling back:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        setCartItems(originalCart);
        throw error;
    }
  }, [cartItems]);

  const debouncedUpdateQuantity = useMemo(
    () => debounce(async (cartItemId: string, quantity: number, originalCart: CakeGenieCartItem[]) => {
      try {
        const { error } = await updateQuantityService(cartItemId, quantity);
        if (error) {
          console.error('Error updating quantity:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
          setCartItems(originalCart);
          throw error;
        }
      } catch (error) {
        throw error;
      }
    }, 500),
    []
  );

  const updateQuantityOptimistic = useCallback(async (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItemOptimistic(cartItemId);
      return;
    }
    
    const originalCart = [...cartItems];
    const itemToUpdate = cartItems.find(item => item.cart_item_id === cartItemId);
    if (!itemToUpdate) return;
        
    setCartItems(prev =>
        prev.map(item => item.cart_item_id === cartItemId ? { ...item, quantity } : item)
    );
    
    try {
      await debouncedUpdateQuantity(cartItemId, quantity, originalCart);
    } catch (error) {
      throw error;
    }
  }, [cartItems, removeItemOptimistic, debouncedUpdateQuantity]);

  const refreshCart = useCallback(async () => {
    await loadCartData(currentUser);
  }, [loadCartData, currentUser]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setDeliveryDetails(null);
    if (typeof window !== 'undefined') {
      batchRemoveFromLocalStorage('cart_event_date');
      batchRemoveFromLocalStorage('cart_event_time');
      batchRemoveFromLocalStorage('cart_delivery_instructions');
      batchRemoveFromLocalStorage('cart_selected_address_id');
      batchRemoveFromLocalStorage('cart_discount_code');
      batchRemoveFromLocalStorage('cart_applied_discount');
    }
    setEventDateState('');
    setEventTimeState('');
    setDeliveryInstructionsState('');
    setSelectedAddressIdState('');
  }, []);
  
  const itemCount = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.final_price * item.quantity, 0);
  }, [cartItems]);

  const actionsValue = useMemo(() => ({
    refreshCart,
    addToCartOptimistic,
    updateQuantityOptimistic,
    removeItemOptimistic,
    clearCart,
    setDeliveryDetails,
    setEventDate,
    setEventTime,
    setDeliveryInstructions,
    setSelectedAddressId,
  }), [
    refreshCart,
    addToCartOptimistic,
    updateQuantityOptimistic,
    removeItemOptimistic,
    clearCart,
    setEventDate,
    setEventTime,
    setDeliveryInstructions,
    setSelectedAddressId,
  ]);

  const dataValue = useMemo(() => ({
    cartItems,
    addresses,
    cartTotal,
    itemCount,
    isLoading,
    sessionId,
    deliveryDetails,
    eventDate,
    eventTime,
    deliveryInstructions,
    selectedAddressId,
    authError,
  }), [
    cartItems,
    addresses,
    cartTotal,
    itemCount,
    isLoading,
    sessionId,
    deliveryDetails,
    eventDate,
    eventTime,
    deliveryInstructions,
    selectedAddressId,
    authError,
  ]);

  return (
    <CartActionsContext.Provider value={actionsValue}>
      <CartDataContext.Provider value={dataValue}>
        {children}
      </CartDataContext.Provider>
    </CartActionsContext.Provider>
  );
};

// --- NEW SPLIT HOOKS ---

/**
 * Custom hook to access only the cart data.
 * This hook will re-render when cart data (items, totals, loading state) changes.
 */
export const useCartData = (): CartDataType => {
  const context = useContext(CartDataContext);
  if (context === undefined) {
    throw new Error('useCartData must be used within a CartProvider');
  }
  return context;
};

/**
 * Custom hook to access only the cart actions.
 * This hook will NOT re-render when cart data changes, improving performance.
 */
export const useCartActions = (): CartActionsType => {
  const context = useContext(CartActionsContext);
  if (context === undefined) {
    throw new Error('useCartActions must be used within a CartProvider');
  }
  return context;
};

/**
 * Custom hook to access the full cart context (data and actions).
 * Kept for backward compatibility and convenience.
 * This hook will re-render on any cart data change.
 */
export const useCart = (): CartContextType => {
  return {
    ...useCartData(),
    ...useCartActions(),
  };
};
```

## File: src/contexts/GoogleMapsLoaderContext.tsx

```tsx
import React, { createContext, useContext, ReactNode } from 'react';
// Temporarily comment out Google Maps import to test if it's causing the issue
// import { useJsApiLoader, Libraries } from '@react-google-maps/api';
// import { GOOGLE_MAPS_API_KEY } from '../config';

// const LIBRARIES: Libraries = ['places', 'geocoding'];

interface GoogleMapsLoaderContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsLoaderContext = createContext<GoogleMapsLoaderContextType | undefined>(undefined);

export const GoogleMapsLoaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Temporarily bypass Google Maps loading
  // const { isLoaded, loadError } = useJsApiLoader({
  //   id: 'google-map-script', // Use a single, consistent ID for the whole app
  //   googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  //   libraries: LIBRARIES,
  // });
  
  // Temporarily return success values to bypass Google Maps
  const isLoaded = true;
  const loadError = undefined;

  const value = { isLoaded, loadError };

  return (
    <GoogleMapsLoaderContext.Provider value={value}>
      {children}
    </GoogleMapsLoaderContext.Provider>
  );
};

export const useGoogleMapsLoader = (): GoogleMapsLoaderContextType => {
  const context = useContext(GoogleMapsLoaderContext);
  if (context === undefined) {
    throw new Error('useGoogleMapsLoader must be used within a GoogleMapsLoaderProvider');
  }
  return context;
};
```

## File: src/app/design/page.tsx

```tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getSharedDesign, createContribution, getDesignContributions, BillContribution } from '../../services/shareService';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ArrowLeft, Edit, ShoppingCart, Share2, CopyIcon as Copy, CheckCircle, Users, CreditCard, Loader2, Heart, MessageCircle, Calendar, MapPin, User as UserIcon } from 'lucide-react';
import { showSuccess, showError, showInfo } from '../../lib/utils/toast';
import LazyImage from '../../components/LazyImage';
import { AvailabilityType } from '../../lib/utils/availability';
import { ContributionSuccessModal } from '../../components/ContributionSuccessModal';
import { useSEO, generateCakeStructuredData } from '../../hooks/useSEO';

interface SharedDesign {
  design_id: string;
  customized_image_url: string;
  title: string;
  description: string;
  alt_text: string;
  cake_type: string;
  cake_size: string;
  cake_flavor: string;
  cake_thickness: string;
  icing_colors: { name: string; hex: string }[];
  accessories: string[];
  base_price: number;
  final_price: number;
  availability_type: AvailabilityType;
  creator_name: string | null;
  bill_sharing_enabled?: boolean;
  bill_sharing_message?: string;
  suggested_split_count?: number;
  amount_collected?: number;
  url_slug?: string;
  payment_status?: string;
  auto_order_enabled: boolean;
  order_placed: boolean;
  order_id: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  event_date: string | null;
  event_time: string | null;
  recipient_name: string | null;
  created_by_user_id?: string;
  organizer?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

interface SharedDesignPageProps {
  designId: string;
  onStartWithDesign: (design: SharedDesign) => void;
  onNavigateHome: () => void;
  onPurchaseDesign: (design: SharedDesign) => void;
  user: any | null;
  onAuthRequired: () => void;
}

const AVAILABILITY_INFO: Record<AvailabilityType, { label: string; time: string; icon: string; bgColor: string; textColor: string }> = {
    rush: { label: 'Rush Order', time: 'Ready in 30 minutes', icon: '⚡', bgColor: 'bg-green-100', textColor: 'text-green-800' },
    'same-day': { label: 'Same-Day', time: 'Ready in 3 hours', icon: '🕐', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
    normal: { label: 'Standard Order', time: '1-day lead time', icon: '📅', bgColor: 'bg-slate-100', textColor: 'text-slate-800' },
};

const SharedDesignPage: React.FC<SharedDesignPageProps> = ({
  designId,
  onStartWithDesign,
  onNavigateHome,
  onPurchaseDesign,
  user,
  onAuthRequired,
}) => {
  const [design, setDesign] = useState<SharedDesign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // State for bill sharing
  const [contributorName, setContributorName] = useState('');
  const [contributorEmail, setContributorEmail] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
  const [contributions, setContributions] = useState<BillContribution[]>([]);
  const [isLoadingContributions, setIsLoadingContributions] = useState(true);
  const [showContributionForm, setShowContributionForm] = useState(false);

  // State for success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDiscountCode, setSuccessDiscountCode] = useState('');
  const [successAmount, setSuccessAmount] = useState(0);

  // State for payment verification
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');

  const amountCollected = useMemo(() => {
    const paidContributionsTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
    return Math.max(design?.amount_collected || 0, paidContributionsTotal);
  }, [contributions, design?.amount_collected]);

  const remainingAmount = (design?.final_price || 0) - amountCollected;
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
        setContributionAmount('');
        return;
    }

    // Allow only numbers and up to two decimal places
    if (!/^\d*\.?\d{0,2}$/.test(value)) {
        return;
    }

    const amount = parseFloat(value);
    
    if (isNaN(amount)) {
        return;
    }
    
    const clampedRemaining = parseFloat(remainingAmount.toFixed(2));
    // Check against a very small number to avoid floating point issues if remaining is e.g., 0.001
    if (clampedRemaining > 0.001 && amount > clampedRemaining) {
        setContributionAmount(clampedRemaining.toString());
        showInfo(`Amount capped at the remaining ₱${clampedRemaining.toFixed(2)}`);
    } else {
        setContributionAmount(value);
    }
  };

  useEffect(() => {
    const fetchDesign = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getSharedDesign(designId);
        if (!data) {
          throw new Error("Design not found or it may have been removed.");
        }
        setDesign(data as SharedDesign);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the design.");
        showError(err instanceof Error ? err.message : "Could not load the design.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDesign();
  }, [designId]);

  useEffect(() => {
    const fetchContributions = async () => {
      if (design?.bill_sharing_enabled) {
        setIsLoadingContributions(true);
        const contribs = await getDesignContributions(design.design_id);
        setContributions(contribs);
        setIsLoadingContributions(false);
      }
    };
    if (design) {
      fetchContributions();
    }
  }, [design]);

  // Dynamic SEO for better Google indexing
  useSEO({
    title: design ? `${design.title} | Genie.ph - Custom Cakes in Cebu` : 'Cake Design | Genie.ph',
    description: design
      ? `${design.description} - ${design.cake_type} ${design.cake_size} cake available for ${AVAILABILITY_INFO[design.availability_type]?.label || 'order'}. Starting at ₱${design.final_price.toFixed(2)}`
      : 'Beautiful custom cake design. Customize and order your dream cake with Genie.ph',
    image: design?.customized_image_url,
    url: design ? `https://genie.ph/designs/${design.url_slug || design.design_id}` : window.location.href,
    type: 'product',
    keywords: design
      ? `${design.cake_type}, ${design.cake_size}, custom cake, ${design.icing_colors.map(c => c.name).join(', ')}, ${AVAILABILITY_INFO[design.availability_type]?.label}, Cebu cake, birthday cake, custom cake design`
      : 'custom cake, cake design, birthday cake, Cebu',
    structuredData: design ? generateCakeStructuredData({
      title: design.title,
      description: design.description,
      image: design.customized_image_url,
      price: design.final_price,
      url: `https://genie.ph/designs/${design.url_slug || design.design_id}`,
      cakeType: design.cake_type,
      cakeSize: design.cake_size,
      availability: design.availability_type,
    }) : undefined,
  });

  const handlePaymentVerification = async (contributionId: string) => {
    setIsVerifyingPayment(true);
    setVerificationMessage('Verifying your payment...');
    
    try {
      const params = new URLSearchParams(window.location.hash.split('?')[1]);
      const amount = parseFloat(params.get('amount') || '0');
      const code = params.get('code') || 'FRIEND100';

      const { pollPaymentStatus } = await import('../../services/paymentVerificationService');
      
      const result = await pollPaymentStatus(contributionId);
      
      if (result.success && result.status === 'paid') {
        setVerificationMessage('✅ Payment confirmed! Thank you!');
        setSuccessAmount(amount);
        setSuccessDiscountCode(code);
        
        if (design?.bill_sharing_enabled) {
          const contribs = await getDesignContributions(design.design_id);
          setContributions(contribs);
        }
        
        setTimeout(() => {
          setIsVerifyingPayment(false);
          setShowSuccessModal(true);
          
          if(design?.url_slug || design?.design_id) {
            window.history.replaceState(null, '', `#/designs/${design.url_slug || design.design_id}`);
          }
        }, 2000);
      } else {
        setVerificationMessage('⏰ Payment verification is taking longer than expected. Please refresh the page in a moment.');
        setSuccessAmount(amount);
        setSuccessDiscountCode(code);
        
        setTimeout(() => {
          setIsVerifyingPayment(false);
          setShowSuccessModal(true);
        }, 3000);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationMessage('❌ Unable to verify payment automatically. Please refresh the page.');
      setIsVerifyingPayment(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    
    if (params.get('contribution') === 'success') {
      const contributionId = params.get('contribution_id');
      if (contributionId) {
        handlePaymentVerification(contributionId);
      }
    } else if (params.get('contribution') === 'failed') {
      showError('Your contribution failed. Please try again.');
      if(design?.url_slug || design?.design_id) {
        window.history.replaceState(null, '', `#/designs/${design.url_slug || design.design_id}`);
      }
    }
  }, [design]);
  
  useEffect(() => {
    if (user && !user.is_anonymous) {
      // Auto-fill name and email from user profile
      const name = user.user_metadata?.full_name || 
                   `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 
                   user.email?.split('@')[0] ||
                   '';
      setContributorName(name);
      setContributorEmail(user.email || '');
    }
  }, [user]);

  const handleCopyLink = () => {
    setIsCopying(true);
    navigator.clipboard.writeText(window.location.href).then(() => {
      showSuccess("Link copied to clipboard!");
      setTimeout(() => setIsCopying(false), 2000);
    }).catch(err => {
      showError("Failed to copy link.");
      setIsCopying(false);
    });
  };

  const handleContribute = async () => {
    if (!design) return;
    
    // Require authentication
    if (!user || user.is_anonymous) {
      showError('Please sign in to contribute');
      onAuthRequired();
      return;
    }
    
    // Validation
    if (!contributorName.trim()) {
      showError('Please enter your name');
      return;
    }
    if (!contributorEmail.trim() || !contributorEmail.includes('@')) {
      showError('Please enter a valid email');
      return;
    }
    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      showError('Please enter a valid amount');
      return;
    }
    const remaining = design.final_price - (amountCollected || 0);
    if (amount > remaining) {
      showError(`Amount cannot exceed remaining ₱${remaining.toFixed(2)}`);
      return;
    }
  
    setIsSubmittingContribution(true);
    
    const result = await createContribution(
      design.design_id,
      contributorName,
      contributorEmail,
      amount,
      user.id // pass user ID
    );
    
    setIsSubmittingContribution(false);
    
    if (result.success && result.paymentUrl) {
      window.location.href = result.paymentUrl;
    } else {
      showError(result.error || 'Failed to create contribution');
    }
  };

  const handlePurchaseClick = () => {
      if (!user || user.is_anonymous) {
          showInfo("Please sign in to purchase a design.");
          onAuthRequired();
      } else if (design) {
          onPurchaseDesign(design);
      }
  };

  const progress = design ? Math.min(100, (amountCollected / design.final_price) * 100) : 0;
  
  const suggestedSplits = useMemo(() => {
    if (!design || !design.suggested_split_count || remainingAmount <= 0) return [];
    const splits = [];
    for (let i = 2; i <= design.suggested_split_count; i++) {
        if (remainingAmount / i > 1) {
            splits.push({ count: i, amount: Math.ceil(remainingAmount / i) });
        }
    }
    return splits;
  }, [design, remainingAmount]);


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
  }

  if (error || !design) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
        <p className="text-slate-600 mb-6">{error || "This design could not be loaded."}</p>
        <button onClick={onNavigateHome} className="text-pink-600 font-semibold hover:underline">Return Home</button>
      </div>
    );
  }

  const availability = AVAILABILITY_INFO[design.availability_type] || AVAILABILITY_INFO.normal;
  const isFullyFunded = remainingAmount <= 0;

  return (
    <>
      <div className="flex items-center gap-4 text-center mb-6 justify-center">
        <img 
            src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20face%20logo.webp" 
            alt="Genie Logo"
            className="w-16 h-16 object-contain"
        />
        <div>
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
            Genie
          </h1>
          <p className="text-slate-500 text-sm mt-1">Your Cake Wish, Granted.</p>
        </div>
      </div>
      <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onNavigateHome} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
            <ArrowLeft />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text truncate">
            {design.title}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Image */}
          <div className="relative">
            <LazyImage src={design.customized_image_url} alt={design.alt_text} className="w-full aspect-square object-cover rounded-xl shadow-lg border border-slate-200" />
            <div className="absolute top-3 right-3 flex gap-2">
              <button onClick={handleCopyLink} className="p-2.5 bg-white/80 backdrop-blur-md rounded-full shadow-md hover:bg-white transition-colors">
                {isCopying ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-slate-600" />}
              </button>
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col">
            <p className="text-slate-600 leading-relaxed">{design.description}</p>
            
            {design.bill_sharing_enabled && design.event_date ? (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-3">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      Delivery Details
                  </h3>
                  <div className="space-y-1 text-sm text-slate-700 pl-6">
                      <p className="flex items-center"><UserIcon className="w-3.5 h-3.5 mr-2 text-slate-500" /><strong>For:</strong>&nbsp;{design.recipient_name}</p>
                      <p className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-2 text-slate-500" /><strong>On:</strong>&nbsp;{new Date(design.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {design.event_time}</p>
                      <p className="flex items-start"><MapPin className="w-3.5 h-3.5 mr-2 text-slate-500 mt-0.5" /><strong>To:</strong>&nbsp;{design.delivery_address}, {design.delivery_city}</p>
                  </div>
              </div>
            ) : (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${availability.bgColor} border border-transparent`}>
                <span className="text-2xl">{availability.icon}</span>
                <div>
                  <p className={`font-bold text-sm ${availability.textColor}`}>{availability.label}</p>
                  <p className={`text-xs ${availability.textColor.replace('800', '700')}`}>{availability.time}</p>
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Type:</span>
                <span className="text-slate-800 font-semibold">{design.cake_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Size:</span>
                <span className="text-slate-800 font-semibold">{design.cake_size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Flavor:</span>
                <span className="text-slate-800 font-semibold">{design.cake_flavor}</span>
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-slate-500 font-medium">Price:</span>
                <span className="text-3xl font-bold text-pink-600">₱{design.final_price.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-auto pt-6 space-y-3">
              {/* Bill Sharing Section */}
              {design.bill_sharing_enabled && (
                <div className="mb-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-5 h-5 text-pink-500" />
                    <h3 className="font-bold text-slate-800">Split the Bill!</h3>
                  </div>

                  {design.organizer && (design.organizer.email || design.organizer.phone) && (
                      <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200 text-sm">
                          <p className="font-semibold text-slate-700">Organized by: {design.organizer.full_name || design.creator_name}</p>
                          <div className="mt-2 space-y-1 text-xs text-slate-600">
                              {design.organizer.phone && <p><strong>Contact No:</strong> {design.organizer.phone}</p>}
                              {design.organizer.email && <p><strong>Email:</strong> {design.organizer.email}</p>}
                          </div>
                          <p className="text-xs text-slate-500 mt-2 italic">
                              Message them if you have any questions about this bill sharing request.
                          </p>
                      </div>
                  )}
                  
                  {/* Creator's Message */}
                  {design.bill_sharing_message && (
                    <div className="mb-3 p-3 bg-white rounded-lg border border-pink-100">
                      <div className="flex items-start gap-2">
                        <MessageCircle className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-700 italic">{design.bill_sharing_message}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Collected</span>
                      <span className="font-bold text-pink-600">
                        ₱{amountCollected.toLocaleString()} / ₱{design.final_price.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Contributors List */}
                  {design.bill_sharing_enabled && (
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <Users size={16} />
                        Contributions ({contributions.length})
                      </h3>
                      <button
                        onClick={async () => {
                          if (design) {
                            setIsLoadingContributions(true);
                            const contribs = await getDesignContributions(design.design_id);
                            setContributions(contribs);
                            setIsLoadingContributions(false);
                            showSuccess("Contributions list updated!");
                          }
                        }}
                        className="text-xs text-pink-600 hover:text-pink-800 font-medium flex items-center gap-1"
                        disabled={isLoadingContributions}
                      >
                        {isLoadingContributions ? <Loader2 size={14} className="animate-spin" /> : '🔄 Refresh'}
                      </button>
                    </div>
                  )}

                  {/* Show "Fully Paid & Order Placed" message */}
                  {isFullyFunded && design.order_placed && (
                    <div className="text-center py-3 px-4 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-400 rounded-xl mb-3">
                      <div className="text-3xl mb-2">✅</div>
                      <p className="font-bold text-green-800 mb-1">Fully Paid & Order Placed!</p>
                      <p className="text-sm text-green-700">
                        This cake has been automatically ordered and will be delivered on{' '}
                        {design.event_date && new Date(design.event_date + 'T00:00:00').toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                        {design.event_time && ` at ${design.event_time}`}
                      </p>
                      {design.recipient_name && (
                        <p className="text-sm text-green-600 mt-1">
                          🎂 For: {design.recipient_name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Show "Fully Paid - Order Processing" message */}
                  {isFullyFunded && !design.order_placed && design.auto_order_enabled && (
                    <div className="text-center py-3 px-4 bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-400 rounded-xl mb-3">
                      <div className="text-3xl mb-2">⏳</div>
                      <p className="font-bold text-blue-800 mb-1">Fully Paid!</p>
                      <p className="text-sm text-blue-700">
                        Your order is being processed automatically. You'll receive confirmation shortly!
                      </p>
                    </div>
                  )}
                  
                  {/* Hide contribution form if order is placed */}
                  {!design.order_placed && !isFullyFunded ? (
                    <>
                      {(!user || user.is_anonymous) && !design.order_placed && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm mb-3">
                          <p className="font-bold text-blue-800">💡 Sign in to contribute</p>
                          <p className="text-xs text-blue-700 mt-1">
                            Create a free account to help fund this cake and unlock the ability to design your own custom cakes!
                          </p>
                        </div>
                      )}

                      {!showContributionForm ? (
                        <button
                          onClick={() => {
                            if (!user || user.is_anonymous) {
                              showError('Please sign in to contribute');
                              onAuthRequired();
                              return;
                            }
                            setShowContributionForm(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
                        >
                          <CreditCard className="w-5 h-5" />
                          {(!user || user.is_anonymous) ? 'Sign In to Contribute' : 'Contribute Now'}
                        </button>
                      ) : (
                        <div className="space-y-3 mt-3">
                          {/* Suggested Amounts */}
                          {design.suggested_split_count && design.suggested_split_count > 0 && (
                            <div>
                              <p className="text-xs text-slate-600 mb-2">
                                Suggested amount (split between {design.suggested_split_count} people):
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                {(() => {
                                  const remaining = remainingAmount;
                                  const suggestedAmount = Math.ceil(design.final_price / design.suggested_split_count!);
                                  const halfAmount = Math.ceil(suggestedAmount / 2);
                                  
                                  return (
                                    <>
                                      {halfAmount > 0 && halfAmount <= remaining && (
                                        <button
                                          onClick={() => setContributionAmount(halfAmount.toString())}
                                          className="px-3 py-1.5 text-sm bg-white border-2 border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 font-medium"
                                        >
                                          ₱{halfAmount.toLocaleString()} (Half)
                                        </button>
                                      )}
                                      {suggestedAmount > 0 && suggestedAmount <= remaining && (
                                        <button
                                          onClick={() => setContributionAmount(suggestedAmount.toString())}
                                          className="px-3 py-1.5 text-sm bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:shadow-md font-medium"
                                        >
                                          ₱{suggestedAmount.toLocaleString()} (Equal)
                                        </button>
                                      )}
                                      {remaining > 0 && remaining <= suggestedAmount * 1.5 && (
                                        <button
                                          onClick={() => setContributionAmount(remaining.toString())}
                                          className="px-3 py-1.5 text-sm bg-white border-2 border-green-300 text-green-600 rounded-lg hover:bg-green-50 font-medium"
                                        >
                                          ₱{remaining.toLocaleString()} (All)
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                          
                          <input
                            type="text"
                            placeholder="Your name"
                            value={contributorName}
                            onChange={(e) => setContributorName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            readOnly={user && !user.is_anonymous}
                          />
                          <input
                            type="email"
                            placeholder="Your email"
                            value={contributorEmail}
                            onChange={(e) => setContributorEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            readOnly={user && !user.is_anonymous}
                          />

                          <input
                            type="number"
                            placeholder={`Custom amount (max ₱${remainingAmount.toFixed(2)})`}
                            value={contributionAmount}
                            onChange={handleAmountChange}
                            min="1"
                            max={remainingAmount.toFixed(2)}
                            step="0.01"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleContribute}
                              disabled={isSubmittingContribution}
                              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold py-2 px-4 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              {isSubmittingContribution ? 'Processing...' : `Pay ₱${parseFloat(contributionAmount || '0').toLocaleString()}`}
                            </button>
                            <button
                              onClick={() => setShowContributionForm(false)}
                              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}

                </div>
              )}

              {/* Only show purchase buttons if order not placed from bill sharing */}
              {!design.order_placed && (
                <>
                  {!design.bill_sharing_enabled && (
                    <button
                      onClick={handlePurchaseClick}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      Purchase This Design
                    </button>
                  )}
                  <button
                    onClick={() => onStartWithDesign(design)}
                    className="w-full flex items-center justify-center gap-2 text-center bg-white border-2 border-purple-500 text-purple-600 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-purple-50 transition-all text-base"
                  >
                    <Edit className="w-5 h-5" />
                    Customize This Design
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <ContributionSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        contributionAmount={successAmount}
        discountCode={successDiscountCode}
        onStartDesigning={() => {
          setShowSuccessModal(false);
          onNavigateHome(); // Takes them to design tool
        }}
      />
       {/* Payment Verification Overlay */}
      {isVerifyingPayment && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-scale-in">
              <div style={{animation: 'spin 1s linear infinite', borderBottomColor: '#ec4899'}} className="rounded-full h-16 w-16 border-4 border-t-pink-500 border-r-pink-500 border-l-pink-500 mx-auto mb-4"></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Verifying Payment
              </h3>
              <p className="text-slate-600 text-sm">
                {verificationMessage}
              </p>
              <p className="text-xs text-slate-500 mt-4">
                This usually takes just a few seconds...
              </p>
            </div>
          </div>
        </>
      )}
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
      `}</style>
    </>
  );
};

export default SharedDesignPage;
```

## File: src/app/landing/page.tsx

```tsx


import React, { useState, useEffect } from 'react';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import LazyImage from '../../components/LazyImage';
import { useCanonicalUrl } from '../../hooks';

type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation' | 'shared_design' | 'about' | 'how_to_order' | 'contact' | 'reviews' | 'pricing_sandbox';

interface LandingPageProps {
  onSearch: (query: string) => void;
  onUploadClick: () => void;
  setAppState: (state: AppState) => void;
  user: { email?: string } | null;
}

const quickLinks = [
    {
      name: 'Minimalist Cakes',
      imageUrls: [
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist1.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist2.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist3.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist5.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist6.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist7.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/minimalist8.jpg'
      ],
      searchTerm: 'minimalist cakes'
    },
    {
      name: 'Edible Photo',
      imageUrls: [
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep1.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep2.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep3.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep4.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep5.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/ep6.jpg'
      ],
      searchTerm: 'edible photo cakes'
    },
    {
      name: 'Bento Cakes',
      imageUrls: [
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/BENTO1.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento2.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento3.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento4.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento5.jpg',
        'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/landingpage/bento6.jpg'
      ],
      searchTerm: 'bento cakes'
    }
];

const LandingPage: React.FC<LandingPageProps> = ({
  onSearch,
  onUploadClick,
  setAppState,
  user,
}) => {
  // Add canonical URL for SEO
  useCanonicalUrl('/');
  
  const [localSearchInput, setLocalSearchInput] = React.useState('');
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setImageIndex(prevIndex => prevIndex + 1); // Cycle through images
    }, 2000); // Change image every 2 seconds

    return () => clearInterval(interval); // Cleanup on component unmount
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-between h-full w-full">
      <div className="text-center w-full max-w-2xl mx-auto flex flex-col items-center flex-1 justify-center transform sm:translate-y-0 translate-y-[15px]">
        <img 
            src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20face%20logo.webp" 
            alt="Genie Logo"
            className="w-36 h-36 -mb-4 object-contain"
        />
        <div className="relative inline-block">
          <h1 className="text-7xl md:text-7xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
            Genie
          </h1>
          <span className="absolute top-0 -right-5 transform -translate-y-1/2 translate-x-1/2 rotate-12 bg-yellow-300 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded-full shadow-md">ALPHA</span>
        </div>
        <p className="text-slate-600 mb-6 text-sm">Your Cake Wish, Granted.</p>
        
        <div className="w-full">
            <SearchAutocomplete 
              onSearch={onSearch}
              onUploadClick={onUploadClick}
              placeholder="Search for a design or upload an image" 
              value={localSearchInput}
              onChange={setLocalSearchInput}
            />
        </div>
        
        <p className="text-slate-500 text-sm mt-4">Upload or search any cake design, customize your cake and get instant pricing.</p>

        <div className="mt-8 w-full">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
            Available Cakes For Today
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-4 sm:gap-6">
            {quickLinks.map((link) => {
              const currentImageUrl = link.imageUrls[imageIndex % link.imageUrls.length];
              return (
                <button
                  key={link.name}
                  onClick={() => onSearch(link.searchTerm)}
                  className="group text-center focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 rounded-lg"
                >
                  <div className="aspect-square bg-white rounded-lg overflow-hidden border border-slate-200 shadow-md group-hover:shadow-xl transition-all duration-300 transform scale-90 group-hover:scale-95">
                    <LazyImage
                      key={link.name} 
                      src={currentImageUrl}
                      alt={link.name}
                      className="w-full h-full object-cover"
                      eager={true}
                      preventFlickerOnUpdate={true}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700 group-hover:text-pink-600 transition-colors">
                    {link.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <footer className="p-4 bg-transparent text-center">
        <div className="flex justify-center items-center gap-4 text-sm text-slate-500">
            <button onClick={() => setAppState('about')} className="hover:text-pink-600 transition-colors">About Us</button>
            <button onClick={() => setAppState('how_to_order')} className="hover:text-pink-600 transition-colors">How to Order</button>
            <button onClick={() => setAppState('contact')} className="hover:text-pink-600 transition-colors">Contact Us</button>
            <button onClick={() => setAppState('reviews')} className="hover:text-pink-600 transition-colors">Reviews</button>
            {user && user.email === 'apcaballes@gmail.com' && (
              <button onClick={() => setAppState('pricing_sandbox')} className="hover:text-pink-600 transition-colors">Pricing Sandbox</button>
            )}
        </div>
      </footer>
    </div>
  );
};

export default React.memo(LandingPage);
```

## File: src/app/how-to-order/page.tsx

```tsx
import React from 'react';
import { ArrowLeft, Search, Upload, Edit, Wand2, ShoppingCart, CheckCircle } from 'lucide-react';
import { useCanonicalUrl } from '../../hooks';

interface HowToOrderPageProps {
  onClose: () => void;
}

const Step: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-pink-100 text-pink-600 rounded-full border-2 border-pink-200">
      {icon}
    </div>
    <div>
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <div className="text-slate-600 mt-1 space-y-2">{children}</div>
    </div>
  </div>
);

const HowToOrderPage: React.FC<HowToOrderPageProps> = ({ onClose }) => {
  // Add canonical URL for SEO
  useCanonicalUrl('/how-to-order');
  
  return (
    <div className="w-full max-w-3xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">How to Order</h1>
      </div>

      <div className="space-y-8">
        <Step icon={<Search className="w-6 h-6" />} title="Step 1: Find Your Inspiration">
          <p>Your journey begins with a cake design. You have two easy options:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Search the Web:</strong> Type any idea into the search bar (e.g., "blue dinosaur cake," "elegant floral wedding cake") to find designs from across the internet.</li>
            <li><strong>Upload Your Own:</strong> Have a photo ready? Click the camera icon to upload an image directly from your device.</li>
          </ul>
        </Step>

        <Step icon={<Wand2 className="w-6 h-6" />} title="Step 2: Let the Genie Work Its Magic">
          <p>Once you select an image, our smart AI gets to work! In just a few seconds, it will analyze the entire design to identify:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The cake's structure (tiers, shape, height).</li>
            <li>All decorations, like toppers, flowers, and sprinkles.</li>
            <li>Icing colors, borders, and effects like drips.</li>
            <li>An initial price estimate based on the design's complexity.</li>
          </ul>
          <p>These details will automatically appear in the customization panel, ready for you to edit.</p>
        </Step>

        <Step icon={<Edit className="w-6 h-6" />} title="Step 3: Customize Your Masterpiece">
          <p>This is where you make the cake truly yours! Adjust any of the details identified by the AI:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Change Flavors, Size, & Shape:</strong> Pick your desired cake base, height, and flavor for each tier.</li>
            <li><strong>Modify Decorations:</strong> Toggle toppers on or off, change a 3D figure to a more affordable printout, or even upload a new image for a photo topper.</li>
            <li><strong>Recolor Anything:</strong> Use the color palette to change the icing, drip, borders, and even the color of gumpaste decorations.</li>
            <li><strong>Update Messages:</strong> Edit the text or color of any message on the cake.</li>
            <li><strong>Click "Update Design":</strong> After making your changes, click the big <strong>"Update Design"</strong> button. The AI will generate a new image preview reflecting your edits in just a few moments!</li>
          </ul>
        </Step>

        <Step icon={<ShoppingCart className="w-6 h-6" />} title="Step 4: Add to Cart & Checkout">
          <p>The price in the sticky bar at the bottom of the screen updates in real-time as you make changes.</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Once you're happy with your design and price, click <strong>"Add to Cart."</strong></li>
            <li>In your cart, you'll set the event date, time, and delivery address.</li>
            <li>Proceed to checkout to finalize your order. You'll receive payment instructions upon completion.</li>
          </ul>
        </Step>
        
        <div className="pt-4 border-t border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Tips for the Best Results</h2>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-600">
                <li><strong>Use Clear Images:</strong> For best results, start with a high-quality, well-lit photo where the cake is the main focus.</li>
                <li><strong>One Change at a Time:</strong> For complex edits, try making one or two changes and clicking "Update Design" to see the result before making more.</li>
                <li><strong>Use "Additional Instructions" for Clarifications:</strong> This box is perfect for telling the AI specific details, like "make the drip gold" or "put the message on the front." (Note: You cannot use this to add completely new items).</li>
            </ul>
        </div>
      </div>
    </div>
  );
};

export default HowToOrderPage;
```

## File: src/app/pricing-sandbox/page.tsx

```tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { calculatePriceFromDatabase } from '../../services/pricingService.database';
import type { MainTopperUI, SupportElementUI, AddOnPricing, CakeInfoUI, IcingDesignUI, CakeType } from '../../types';
import { ArrowLeft, Trash2, Loader2, FlaskConical } from 'lucide-react';
import { CAKE_TYPES, DEFAULT_SIZE_MAP, DEFAULT_THICKNESS_MAP } from '../../constants';
import { showError } from '../../lib/utils/toast';

interface PricingSandboxPageProps {
  onClose: () => void;
}

const testItemsToAdd = [
    { label: "Add 'icing_doodle' (Topper, M)", category: 'main_topper', type: 'icing_doodle', size: 'medium', description: 'Icing Doodle (Topper)' },
    { label: "Add 'icing_doodle' (Support, M)", category: 'support_element', type: 'icing_doodle', coverage: 'medium', description: 'Icing Doodle (Support)' },
    { label: "Add 'toy' (Topper, S)", category: 'main_topper', type: 'toy', size: 'small', description: 'Toy (Small)' },
    { label: "Add 'toy' (Topper, M)", category: 'main_topper', type: 'toy', size: 'medium', description: 'Toy (Medium)' },
    { label: "Add 'toy' (Topper, L)", category: 'main_topper', type: 'toy', size: 'large', description: 'Toy (Large)' },
    { label: "Add 'candle' (Topper, 2 digits)", category: 'main_topper', type: 'candle', size: 'small', description: 'Candle "25"', quantity: 1 },
    { label: "Add 'sprinkles' (Support, L)", category: 'support_element', type: 'sprinkles', coverage: 'large', description: 'Sprinkles (Large)' },
];

const PricingSandboxPage: React.FC<PricingSandboxPageProps> = ({ onClose }) => {
    const [mainToppers, setMainToppers] = useState<MainTopperUI[]>([]);
    const [supportElements, setSupportElements] = useState<SupportElementUI[]>([]);
    const [icingDesign, setIcingDesign] = useState<IcingDesignUI>({
        base: 'soft_icing', color_type: 'single', colors: {}, border_top: false, border_base: false, drip: false, gumpasteBaseBoard: false, dripPrice: 0, gumpasteBaseBoardPrice: 0
    });
    const [cakeType, setCakeType] = useState<CakeType>('1 Tier');

    const [pricingResult, setPricingResult] = useState<{ addOnPricing: AddOnPricing; itemPrices: Map<string, number> } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const cakeInfo: CakeInfoUI = useMemo(() => ({
        type: cakeType,
        size: DEFAULT_SIZE_MAP[cakeType],
        thickness: DEFAULT_THICKNESS_MAP[cakeType],
        flavors: ['Chocolate Cake']
    }), [cakeType]);

    const runCalculation = useCallback(async () => {
        console.clear();
        setIsLoading(true);
        try {
            const result = await calculatePriceFromDatabase({ mainToppers, supportElements, cakeMessages: [], icingDesign, cakeInfo });
            setPricingResult(result);
        } catch (e) {
            const error = e as Error;
            showError(`Calculation failed: ${error.message}`);
            console.error("❌ Calculation failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, [mainToppers, supportElements, icingDesign, cakeInfo]);

    useEffect(() => {
        runCalculation();
    }, [runCalculation]);

    const addTestItem = (itemConfig: any) => {
        const id = crypto.randomUUID();
        if (itemConfig.category === 'main_topper') {
            const newTopper: MainTopperUI = {
                id,
                type: itemConfig.type,
                description: itemConfig.description,
                size: itemConfig.size || 'medium',
                quantity: itemConfig.quantity || 1,
                isEnabled: true,
                price: 0, // will be calculated
                group_id: id,
                classification: 'hero',
                original_type: itemConfig.type,
            };
            setMainToppers(prev => [...prev, newTopper]);
        } else if (itemConfig.category === 'support_element') {
            const newElement: SupportElementUI = {
                id,
                type: itemConfig.type,
                description: itemConfig.description,
                coverage: itemConfig.coverage || 'medium',
                isEnabled: true,
                price: 0, // will be calculated
                group_id: id,
                original_type: itemConfig.type,
            };
            setSupportElements(prev => [...prev, newElement]);
        }
    };

    const removeItem = (id: string, category: 'main_topper' | 'support_element') => {
        if (category === 'main_topper') {
            setMainToppers(prev => prev.filter(item => item.id !== id));
        } else {
            setSupportElements(prev => prev.filter(item => item.id !== id));
        }
    };
    
    const toggleIcingFeature = (feature: 'drip' | 'gumpasteBaseBoard') => {
        setIcingDesign(prev => ({...prev, [feature]: !prev[feature]}));
    };

    const reset = () => {
        setMainToppers([]);
        setSupportElements([]);
        setIcingDesign(prev => ({...prev, drip: false, gumpasteBaseBoard: false}));
        setCakeType('1 Tier');
        setPricingResult(null);
    };

    const allItems = useMemo(() => [
        ...mainToppers.map(item => ({ ...item, category: 'main_topper' as const })),
        ...supportElements.map(item => ({ ...item, category: 'support_element' as const }))
    ], [mainToppers, supportElements]);

    return (
        <div className="w-full max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text flex items-center gap-2">
                        <FlaskConical size={28} /> Pricing Sandbox
                    </h1>
                    <p className="text-sm text-slate-500">Test and verify the database-driven pricing engine.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Controls & Current Items */}
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-3">Test Case Controls</h2>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {testItemsToAdd.map(item => (
                                <button key={item.label} onClick={() => addTestItem(item)} className="text-xs text-left p-2 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">{item.label}</button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                             <button onClick={() => toggleIcingFeature('drip')} className={`text-xs p-2 rounded-md transition-colors ${icingDesign.drip ? 'bg-pink-100 text-pink-800' : 'bg-slate-100 hover:bg-slate-200'}`}>Toggle Drip</button>
                             <button onClick={() => toggleIcingFeature('gumpasteBaseBoard')} className={`text-xs p-2 rounded-md transition-colors ${icingDesign.gumpasteBaseBoard ? 'bg-pink-100 text-pink-800' : 'bg-slate-100 hover:bg-slate-200'}`}>Toggle Base Board</button>
                        </div>
                        <div className="flex items-center gap-4">
                            <label htmlFor="cakeType" className="text-sm font-medium text-slate-600">Cake Type:</label>
                            <select id="cakeType" value={cakeType} onChange={e => setCakeType(e.target.value as CakeType)} className="flex-grow p-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500">
                                {CAKE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <button onClick={reset} className="mt-4 w-full text-sm font-semibold text-red-600 hover:bg-red-50 p-2 rounded-md transition-colors">Reset All</button>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-3">Current Items in Calculation</h2>
                        {allItems.length === 0 ? <p className="text-sm text-slate-500 text-center py-4">Add items to begin.</p> : (
                            <ul className="space-y-2">
                                {allItems.map(item => (
                                    <li key={item.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-md">
                                        <span className="text-sm text-slate-700">{item.description}</span>
                                        <button onClick={() => removeItem(item.id, item.category)} className="p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Right Column: Results */}
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                     <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                        Pricing Calculation Results
                        {isLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                    </h2>
                    {pricingResult ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-2">Price Breakdown</h3>
                                <table className="w-full table-auto">
                                    <thead className="text-left bg-slate-50">
                                        <tr>
                                            <th className="py-2 px-3 text-xs font-semibold text-slate-500">Item</th>
                                            <th className="py-2 px-3 text-xs font-semibold text-slate-500 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pricingResult.addOnPricing.breakdown.map((row, i) => (
                                            <tr key={i} className="border-b border-slate-100">
                                                <td className={`py-2 px-3 text-sm ${row.price < 0 ? 'text-green-600' : 'text-slate-700'}`}>{row.item}</td>
                                                <td className={`py-2 px-3 text-sm font-mono text-right ${row.price < 0 ? 'text-green-600' : 'text-slate-700'}`}>{row.price.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-300 font-bold">
                                            <td className="py-3 px-3 text-slate-800">Total Add-on Price</td>
                                            <td className="py-3 px-3 text-pink-600 text-right text-lg font-mono">₱{pricingResult.addOnPricing.addOnPrice.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                             <div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-2">Item Prices Map (Raw)</h3>
                                <pre className="text-xs bg-slate-800 text-white p-3 rounded-md overflow-x-auto">
                                    {JSON.stringify(Object.fromEntries(pricingResult.itemPrices), null, 2)}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16 text-slate-500">
                            <p>Results will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PricingSandboxPage;

```

## File: src/app/contact/page.tsx

```tsx
import React, { useState, FormEvent } from 'react';
import { ArrowLeft, Globe, Mail, Phone, MapPin, Clock, Send, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '../../lib/utils/toast';
import { useCanonicalUrl } from '../../hooks';

interface ContactPageProps {
  onClose: () => void;
}

const ContactInfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string; href?: string }> = ({ icon, label, value, href }) => (
    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
        <div className="flex-shrink-0 text-pink-500">{icon}</div>
        <div>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-slate-700 font-medium hover:text-pink-600 transition-colors break-words">{value}</a>
            ) : (
                <p className="text-slate-700 font-medium break-words">{value}</p>
            )}
        </div>
    </div>
);

const ContactPage: React.FC<ContactPageProps> = ({ onClose }) => {
    // Add canonical URL for SEO
    useCanonicalUrl('/contact');
    
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !contact.trim() || !email.trim() || !message.trim()) {
            showError("Please fill in all required fields.");
            return;
        }

        setIsSubmitting(true);
        // Simulate a submission since no backend endpoint is specified

        setTimeout(() => {
            setIsSubmitting(false);
            showSuccess("Thank you for your message! We'll get back to you soon.");
            // Reset form
            setName('');
            setContact('');
            setEmail('');
            setMessage('');
        }, 1000);
    };

    const inputStyle = "w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors";

    return (
        <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
            <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Contact Us</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Left side: Contact Info */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800">Get In Touch</h2>
                    <div className="space-y-4">
                        <ContactInfoItem icon={<Globe size={20} />} label="Website" value="genie.ph" href="https://genie.ph" />
                        <ContactInfoItem icon={<Mail size={20} />} label="Email" value="support@genie.ph" href="mailto:support@genie.ph" />
                        <ContactInfoItem icon={<Phone size={20} />} label="Contact" value="0908 940 8747" href="tel:09089408747" />
                        <ContactInfoItem icon={<MapPin size={20} />} label="Address" value="Skyview Park, Nivel Hills, Cebu City" />
                        <ContactInfoItem icon={<Clock size={20} />} label="Business Hours" value="Mon - Sat: 9:00 AM - 6:00 PM" />
                    </div>
                </div>

                {/* Right side: Form */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800">Leave Your Details</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-600 mb-1">Name <span className="text-red-500">*</span></label>
                            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className={inputStyle} required />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="contact" className="block text-sm font-medium text-slate-600 mb-1">Contact Number <span className="text-red-500">*</span></label>
                                <input id="contact" type="tel" value={contact} onChange={e => setContact(e.target.value)} className={inputStyle} required />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputStyle} required />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-slate-600 mb-1">Comment/Message <span className="text-red-500">*</span></label>
                            <textarea id="message" value={message} onChange={e => setMessage(e.target.value)} className={inputStyle} rows={4} required />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-75 disabled:cursor-not-allowed">
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5 mr-2" />
                            )}
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;

```

## File: src/app/searching/page.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { BackIcon } from '../../components/icons';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';

interface SearchingPageProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchQuery: string;
  error: string | null;
  isSearching: boolean;
  isLoading: boolean;
  onSearch: (query?: string) => void;
  onClose: () => void;
  originalImageData: { data: string; mimeType: string } | null;
  onUploadClick: () => void;
}

const SearchingPage: React.FC<SearchingPageProps> = ({
  searchInput,
  setSearchInput,
  searchQuery,
  error,
  isSearching,
  isLoading,
  onSearch,
  onClose,
  onUploadClick,
}) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingMessages = [
    '🔴 Fetching image from source...',
    '🟣 Processing for AI analysis...',
    '🔵 Preparing customization...'
  ];

  useEffect(() => {
    // FIX: Changed NodeJS.Timeout to ReturnType<typeof setInterval> for browser compatibility.
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => {
          if (prev >= loadingMessages.length - 1) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, loadingMessages.length]);

  return (
    <div className="w-full max-w-6xl mx-auto h-full flex flex-col">
      <div className="w-full flex items-center gap-2 md:gap-4 max-w-2xl mx-auto mb-6">
        <button
          onClick={onClose}
          className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0"
          aria-label="Go back"
        >
          <BackIcon />
        </button>
        <div className="relative flex-grow">
          <SearchAutocomplete
            value={searchInput}
            onChange={setSearchInput}
            onSearch={onSearch}
            onUploadClick={onUploadClick}
            placeholder="Search for cake designs..."
            inputClassName="w-full pl-5 pr-28 py-3 text-base border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
          />
        </div>
      </div>
      <p className="text-center text-slate-500 mb-4">
        Search results for: <span className="font-semibold text-slate-700">"{searchQuery}"</span>
      </p>
      {error && (
        <div className="text-center p-4 my-4 bg-red-50 rounded-lg max-w-md mx-auto">
          <p className="font-semibold text-red-600">Error</p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
      {isSearching && (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <LoadingSpinner />
          <p className="mt-4 text-slate-500">Searching for cakes...</p>
        </div>
      )}
      <div className="relative flex-grow">
        {isLoading && (
           <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-lg p-4">
             <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 text-center w-full max-w-xs">
               <LoadingSpinner />
               <p className="mt-4 text-slate-700 font-semibold text-lg">Working on it...</p>
               <div className="mt-4 text-left text-sm text-slate-600 space-y-2">
                 {loadingMessages.map((msg, index) => (
                   <div key={index} className={`transition-opacity duration-500 flex items-center gap-2 ${index <= loadingStep ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${index < loadingStep ? 'bg-green-500' : 'bg-slate-300 animate-pulse'}`}></div>
                      <span>{msg}</span>
                   </div>
                 ))}
               </div>
               <p className="mt-4 text-xs text-slate-500">Estimated time: 5-10 seconds</p>
             </div>
           </div>
        )}
        <div id="google-search-container" className="flex-grow min-h-[400px]"></div>
      </div>
    </div>
  );
};

export default React.memo(SearchingPage);
```

## File: src/app/payment/callback/page.tsx

```tsx

```

## File: src/app/customizing/page.tsx

```tsx
import React, { Dispatch, SetStateAction, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { X, Wand2 } from 'lucide-react';
import { FeatureList } from '../../components/FeatureList';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { MagicSparkleIcon, ErrorIcon, ImageIcon, ResetIcon, SaveIcon, CartIcon, BackIcon, ReportIcon, UserCircleIcon, LogOutIcon, Loader2, MapPinIcon, PackageIcon, SideIcingGuideIcon, TopIcingGuideIcon, TopBorderGuideIcon, BaseBorderGuideIcon, BaseBoardGuideIcon, TrashIcon } from '../../components/icons';
import { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, BasePriceInfo, CakeType, AvailabilitySettings, IcingColorDetails } from '../../types';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { AvailabilityType } from '../../lib/utils/availability';
import { FloatingResultPanel } from '../../components/FloatingResultPanel';
import { COLORS } from '../../constants';
import { ColorPalette } from '../../components/ColorPalette';
import { showSuccess } from '../../lib/utils/toast';
import { clearPromptCache } from '../../services/geminiService';

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


type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation';
type ImageTab = 'original' | 'customized';

// FIX: Redefined AnalysisItem as a discriminated union to improve type safety and enable better type narrowing.
export type AnalysisItem =
    (MainTopperUI & { itemCategory: 'topper' }) |
    (SupportElementUI & { itemCategory: 'element' }) |
    (CakeMessageUI & { itemCategory: 'message' }) |
    ({ id: string; description: string; x?: number; y?: number; cakeType?: CakeType } & { itemCategory: 'icing' }) |
    ({ id: string; description: string; x?: number; y?: number; } & { itemCategory: 'action' });

// Add a type for clustered markers
export type ClusteredMarker = {
    id: string;
    x: number;
    y: number;
    isCluster: true;
    items: AnalysisItem[];
} | (AnalysisItem & { isCluster?: false });

interface CustomizingPageProps {
    onClose: () => void;
    searchInput: string;
    setSearchInput: (value: string) => void;
    onSearch: (query?: string) => void;
    setAppState: (state: AppState) => void;
    itemCount: number;
    isAuthenticated: boolean;
    isAccountMenuOpen: boolean;
    setIsAccountMenuOpen: Dispatch<SetStateAction<boolean>>;
    accountMenuRef: React.RefObject<HTMLDivElement>;
    user: any;
    onSignOut: () => void;
    onOpenReportModal: () => void;
    editedImage: string | null;
    isLoading: boolean;
    isUpdatingDesign: boolean;
    isReporting: boolean;
    reportStatus: 'success' | 'error' | null;
    mainImageContainerRef: React.RefObject<HTMLDivElement>;
    activeTab: ImageTab;
    setActiveTab: (tab: ImageTab) => void;
    originalImagePreview: string | null;
    isAnalyzing: boolean;
    originalImageData: { data: string; mimeType: string } | null;
    onUpdateDesign: () => void;
    analysisResult: HybridAnalysisResult | null;
    analysisError: string | null;
    analysisId: string | null;
    cakeInfo: CakeInfoUI | null;
    basePriceOptions: BasePriceInfo[] | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    additionalInstructions: string;
    onCakeInfoChange: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
    removeMainTopper: (id: string) => void;
    updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
    removeSupportElement: (id: string) => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    onIcingDesignChange: (design: IcingDesignUI) => void;
    onAdditionalInstructionsChange: (instructions: string) => void;
    onTopperImageReplace: (topperId: string, file: File) => void;
    onSupportElementImageReplace: (elementId: string, file: File) => void;
    onSave: () => void;
    isSaving: boolean;
    onClearAll: () => void;
    error: string | null;
    isCustomizationDirty: boolean;
    itemPrices: Map<string, number>;
    availability: AvailabilityType;
    availabilitySettings: AvailabilitySettings | undefined;
    isLoadingAvailabilitySettings: boolean;
    availabilityWasOverridden: boolean;
    onCakeMessageChange: (messages: CakeMessageUI[]) => void;
}

// Simple toggle switch component for icing features
const SimpleToggle: React.FC<{ label: string; isEnabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean; }> = ({ label, isEnabled, onChange, disabled = false }) => (
    <div className={`flex justify-between items-center p-1 ${disabled ? 'opacity-50' : ''}`}>
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onChange(!isEnabled);
            }}
            disabled={disabled}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-slate-300'}`}
            aria-pressed={isEnabled}
        >
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const IcingToolbar: React.FC<{ onSelectItem: (item: AnalysisItem) => void; icingDesign: IcingDesignUI | null; cakeType: CakeType | null; isVisible: boolean; showGuide: boolean; selectedItem: ClusteredMarker | null }> = ({ onSelectItem, icingDesign, cakeType, isVisible, showGuide, selectedItem }) => {
    const [activeGuideIndex, setActiveGuideIndex] = useState<number>(-1);
    const isBento = cakeType === 'Bento';

    // Use default values if analysis hasn't completed yet
    const defaultIcingDesign = {
        drip: false,
        border_top: false,
        border_base: false,
        colors: { top: '#FFFFFF', side: '#FFFFFF' },
        gumpasteBaseBoard: false
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

    // Helper function to convert hex color to RGB
    const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };

    // Helper function to find closest color match
    const findClosestColor = (color: string, availableColors: { name: string; keywords: string[]; hex: string }[]): string => {
        // 1. Direct Map Check for known palette colors
        const DIRECT_COLOR_MAP: Record<string, string> = {
            '#EF4444': 'red',       // Red
            '#FCA5A5': 'red',       // Light Red
            '#F97316': 'orange',    // Orange
            '#EAB308': 'yellow',    // Yellow
            '#16A34A': 'green',     // Green
            '#4ADE80': 'green',     // Light Green
            '#14B8A6': 'green',     // Teal -> Green
            '#3B82F6': 'blue',      // Blue
            '#93C5FD': 'blue',      // Light Blue
            '#8B5CF6': 'purple',    // Purple
            '#C4B5FD': 'purple',    // Light Purple
            '#EC4899': 'pink',      // Pink
            '#FBCFE8': 'pink',      // Light Pink
            '#78350F': 'brown',     // Brown
            '#B45309': 'brown',     // Light Brown
            '#64748B': 'white',     // Gray -> White
            '#FFFFFF': 'white',     // White
            '#000000': 'black',     // Black
        };

        const normalizedColor = color.toUpperCase();
        if (DIRECT_COLOR_MAP[normalizedColor]) {
            return DIRECT_COLOR_MAP[normalizedColor];
        }

        const colorLower = color.toLowerCase().trim();

        // First, try exact keyword match (e.g., "red", "light red", "dark blue")
        // Check longer keywords first to avoid partial matches (e.g., "light blue" before "blue")
        for (const colorOption of availableColors) {
            // Sort keywords by length (longest first) to match "light blue" before "blue"
            const sortedKeywords = [...colorOption.keywords].sort((a, b) => b.length - a.length);
            for (const keyword of sortedKeywords) {
                if (colorLower.includes(keyword)) {
                    return colorOption.name;
                }
            }
        }

        // If it's a hex color, find closest match by RGB distance
        if (colorLower.startsWith('#')) {
            const inputRgb = hexToRgb(colorLower);
            if (inputRgb) {
                let closestColor = availableColors[0].name;
                let minDistance = Infinity;

                for (const colorOption of availableColors) {
                    const optionRgb = hexToRgb(colorOption.hex);
                    if (optionRgb) {
                        const distance = Math.sqrt(
                            Math.pow(inputRgb.r - optionRgb.r, 2) +
                            Math.pow(inputRgb.g - optionRgb.g, 2) +
                            Math.pow(inputRgb.b - optionRgb.b, 2)
                        );
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestColor = colorOption.name;
                        }
                    }
                }
                return closestColor;
            }
        }

        // Default to white if no match found
        return 'white';
    };

    // Helper function to get color-aware baseboard image
    const getBaseboardImage = (): string => {
        const baseboardColor = effectiveIcingDesign.colors?.gumpasteBaseBoardColor;
        const baseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/';

        if (!baseboardColor) {
            return baseUrl + 'baseboardwhite.webp';
        }

        const availableColors = [
            { name: 'black', keywords: ['black', 'dark'], hex: '#000000' },
            { name: 'white', keywords: ['white', 'light white', 'gray', 'grey'], hex: '#FFFFFF' },
            { name: 'red', keywords: ['light red', 'dark red', 'red'], hex: '#FF0000' },
            { name: 'blue', keywords: ['light blue', 'dark blue', 'blue'], hex: '#0000FF' },
            { name: 'purple', keywords: ['light purple', 'purple', 'violet'], hex: '#800080' },
            { name: 'green', keywords: ['light green', 'dark green', 'green'], hex: '#00FF00' },
            { name: 'yellow', keywords: ['light yellow', 'yellow'], hex: '#FFFF00' },
            { name: 'pink', keywords: ['light pink', 'pink'], hex: '#FFC0CB' },
        ];

        const matchedColor = findClosestColor(baseboardColor, availableColors);
        return baseUrl + `baseboard${matchedColor}.webp`;
    };

    // Helper function to get color-aware icing image
    const getIcingImage = (colorKey: 'top' | 'side', isTopSpecific: boolean = false): string => {
        const icingColor = effectiveIcingDesign.colors?.[colorKey];
        const baseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/';

        // Determine prefix based on colorKey and flag
        // Only use topicing_ prefix if it is explicitly the Top Icing tool in dual-color mode
        const useTopPrefix = colorKey === 'top' && isTopSpecific;
        const prefix = useTopPrefix ? 'topicing_' : 'icing_';
        const defaultImage = useTopPrefix ? 'topicing_white.webp' : 'icing_white.webp';

        if (!icingColor) {
            return baseUrl + defaultImage;
        }

        const availableColors = [
            { name: 'black', keywords: ['black', 'dark'], hex: '#000000' },
            { name: 'white', keywords: ['white', 'light white', 'gray', 'grey', 'silver'], hex: '#FFFFFF' },
            { name: 'white', keywords: [], hex: '#808080' }, // Gray anchor
            { name: 'white', keywords: [], hex: '#C0C0C0' }, // Silver anchor
            { name: 'blue', keywords: ['light blue', 'dark blue', 'blue', 'cyan', 'sky', 'azure', 'baby blue'], hex: '#0000FF' },
            { name: 'blue', keywords: [], hex: '#87CEEB' }, // Light Blue anchor
            { name: 'red', keywords: ['light red', 'dark red', 'red', 'maroon', 'crimson'], hex: '#FF0000' },
            { name: 'red', keywords: [], hex: '#FA8072' }, // Light Red anchor (Salmon)
            { name: 'red', keywords: [], hex: '#FFCCCB' }, // Light Red anchor (Pastel)
            { name: 'purple', keywords: ['light purple', 'purple', 'violet', 'lavender', 'lilac'], hex: '#800080' },
            { name: 'purple', keywords: [], hex: '#D8BFD8' }, // Light Purple anchor
            { name: 'green', keywords: ['light green', 'dark green', 'green', 'lime', 'mint'], hex: '#00FF00' },
            { name: 'green', keywords: [], hex: '#98FB98' }, // Light Green anchor
            { name: 'yellow', keywords: ['light yellow', 'yellow', 'gold'], hex: '#FFFF00' },
            { name: 'yellow', keywords: [], hex: '#FFFFE0' }, // Light Yellow anchor
            { name: 'orange', keywords: ['light orange', 'orange'], hex: '#FFA500' },
            { name: 'brown', keywords: ['brown', 'chocolate', 'tan'], hex: '#8B4513' },
            { name: 'pink', keywords: ['light pink', 'pink', 'rose', 'magenta', 'fuchsia'], hex: '#FFC0CB' },
        ];

        const matchedColor = findClosestColor(icingColor, availableColors);
        return baseUrl + `${prefix}${matchedColor}.webp`;
    };

    // Helper function to get color-aware drip image
    const getDripImage = (): string => {
        const dripColor = effectiveIcingDesign.colors?.drip;
        const baseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/';

        if (!dripColor) {
            return baseUrl + 'drip_black.webp';
        }

        const availableColors = [
            { name: 'black', keywords: ['black', 'dark'], hex: '#000000' },
            { name: 'white', keywords: ['white', 'light white', 'gray', 'grey'], hex: '#FFFFFF' },
            { name: 'red', keywords: ['light red', 'dark red', 'red'], hex: '#FF0000' },
            { name: 'blue', keywords: ['light blue', 'dark blue', 'blue'], hex: '#0000FF' },
            { name: 'purple', keywords: ['light purple', 'purple', 'violet'], hex: '#800080' },
            { name: 'green', keywords: ['light green', 'dark green', 'green'], hex: '#00FF00' },
            { name: 'yellow', keywords: ['light yellow', 'yellow'], hex: '#FFFF00' },
            { name: 'orange', keywords: ['light orange', 'orange'], hex: '#FFA500' },
            { name: 'brown', keywords: ['brown', 'chocolate', 'tan'], hex: '#8B4513' },
            { name: 'pink', keywords: ['light pink', 'pink'], hex: '#FFC0CB' },
        ];

        const matchedColor = findClosestColor(dripColor, availableColors);
        return baseUrl + `drip_${matchedColor}.webp`;
    };

    // Helper function to get color-aware top border image
    const getTopBorderImage = (): string => {
        const borderColor = effectiveIcingDesign.colors?.borderTop;
        const baseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/';

        if (!borderColor) {
            return baseUrl + 'top_black.webp';
        }

        const availableColors = [
            { name: 'black', keywords: ['black', 'dark'], hex: '#000000' },
            { name: 'white', keywords: ['white', 'light white', 'gray', 'grey'], hex: '#FFFFFF' },
            { name: 'red', keywords: ['light red', 'dark red', 'red'], hex: '#FF0000' },
            { name: 'blue', keywords: ['light blue', 'dark blue', 'blue'], hex: '#0000FF' },
            { name: 'purple', keywords: ['light purple', 'purple', 'violet'], hex: '#800080' },
            { name: 'green', keywords: ['light green', 'dark green', 'green'], hex: '#00FF00' },
            { name: 'yellow', keywords: ['light yellow', 'yellow'], hex: '#FFFF00' },
            { name: 'orange', keywords: ['light orange', 'orange'], hex: '#FFA500' },
            { name: 'brown', keywords: ['brown', 'chocolate', 'tan'], hex: '#8B4513' },
            { name: 'pink', keywords: ['light pink', 'pink'], hex: '#FFC0CB' },
        ];

        const matchedColor = findClosestColor(borderColor, availableColors);
        return baseUrl + `top_${matchedColor}.webp`;
    };

    // Helper function to get color-aware base border image
    const getBaseBorderImage = (): string => {
        const borderColor = effectiveIcingDesign.colors?.borderBase;
        const baseUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/icing_toolbar_colors/';

        if (!borderColor) {
            return baseUrl + 'baseborder_black.webp';
        }

        const availableColors = [
            { name: 'black', keywords: ['black', 'dark'], hex: '#000000' },
            { name: 'white', keywords: ['white', 'light white', 'gray', 'grey'], hex: '#FFFFFF' },
            { name: 'red', keywords: ['light red', 'dark red', 'red'], hex: '#FF0000' },
            { name: 'blue', keywords: ['light blue', 'dark blue', 'blue'], hex: '#0000FF' },
            { name: 'purple', keywords: ['light purple', 'purple', 'violet'], hex: '#800080' },
            { name: 'green', keywords: ['light green', 'dark green', 'green'], hex: '#00FF00' },
            { name: 'yellow', keywords: ['light yellow', 'yellow'], hex: '#FFFF00' },
            { name: 'orange', keywords: ['light orange', 'orange'], hex: '#FFA500' },
            { name: 'brown', keywords: ['brown', 'chocolate', 'tan'], hex: '#8B4513' },
            { name: 'pink', keywords: ['light pink', 'pink'], hex: '#FFC0CB' },
        ];

        const matchedColor = findClosestColor(borderColor, availableColors);
        return baseUrl + `baseborder_${matchedColor}.webp`;
    };

    // Check if top and side icing colors are the same
    const topColor = effectiveIcingDesign.colors?.top;
    const sideColor = effectiveIcingDesign.colors?.side;
    const icingColorsSame = topColor && sideColor && topColor.toUpperCase() === sideColor.toUpperCase();

    const tools = icingColorsSame ? [
        { id: 'drip', description: 'Drip', label: 'Drip', icon: <img src={getDripImage()} alt="Drip effect" />, featureFlag: effectiveIcingDesign.drip },
        { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <img src={getTopBorderImage()} alt="Top border" />, featureFlag: effectiveIcingDesign.border_top },
        { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <img src={getBaseBorderImage()} alt="Base border" />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
        { id: 'icing', description: 'Body Icing', label: 'Body Icing', icon: <img src={getIcingImage('top', false)} alt="Icing color" />, featureFlag: !!(effectiveIcingDesign.colors?.top || effectiveIcingDesign.colors?.side) },
        { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <img src={getBaseboardImage()} alt="Gumpaste baseboard" />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
    ] : [
        { id: 'drip', description: 'Drip', label: 'Drip', icon: <img src={getDripImage()} alt="Drip effect" />, featureFlag: effectiveIcingDesign.drip },
        { id: 'borderTop', description: 'Top', label: 'Top Border', icon: <img src={getTopBorderImage()} alt="Top border" />, featureFlag: effectiveIcingDesign.border_top },
        { id: 'borderBase', description: 'Bottom', label: 'Base Border', icon: <img src={getBaseBorderImage()} alt="Base border" />, featureFlag: effectiveIcingDesign.border_base, disabled: isBento },
        { id: 'top', description: 'Top Icing', label: 'Top Icing', icon: <img src={getIcingImage('top', true)} alt="Top icing" />, featureFlag: !!effectiveIcingDesign.colors?.top },
        { id: 'side', description: 'Side Icing', label: 'Body Icing', icon: <img src={getIcingImage('side', false)} alt="Side icing" />, featureFlag: !!effectiveIcingDesign.colors?.side },
        { id: 'gumpasteBaseBoard', description: 'Board', label: 'Board', icon: <img src={getBaseboardImage()} alt="Gumpaste baseboard" />, featureFlag: effectiveIcingDesign.gumpasteBaseBoard, disabled: isBento },
    ];

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
        <div className={`flex flex-row gap-3 justify-center transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {tools.map((tool, index) => {
                const isGuideActive = activeGuideIndex === index;
                const isSelected = selectedItem && 'id' in selectedItem && selectedItem.id === `icing-edit-${tool.id}`;
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
                            className={`relative w-14 h-14 p-2 rounded-full hover:bg-purple-100 transition-all ${isSelected ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-white/80'} backdrop-blur-md border border-slate-200 shadow-md ${tool.featureFlag ? '' : 'opacity-60'} ${isGuideActive ? 'ring-4 ring-pink-500 ring-offset-2 scale-110 shadow-xl' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
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


const CustomizingPage: React.FC<CustomizingPageProps> = ({
    onClose,
    searchInput, setSearchInput, onSearch,
    setAppState, itemCount, isAuthenticated, isAccountMenuOpen, setIsAccountMenuOpen, accountMenuRef, user, onSignOut,
    onOpenReportModal, editedImage, isLoading, isUpdatingDesign, isReporting, reportStatus, mainImageContainerRef, isCustomizationDirty,
    activeTab, setActiveTab, originalImagePreview, isAnalyzing, originalImageData,
    onUpdateDesign, analysisResult, analysisError, analysisId, cakeInfo, basePriceOptions,
    mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions,
    onCakeInfoChange,
    updateMainTopper, removeMainTopper,
    updateSupportElement, removeSupportElement,
    updateCakeMessage, removeCakeMessage,
    onIcingDesignChange, onCakeMessageChange,
    onAdditionalInstructionsChange, onTopperImageReplace, onSupportElementImageReplace, onSave, isSaving, onClearAll, error,
    itemPrices,
    availability: availabilityType,
    availabilitySettings,
    isLoadingAvailabilitySettings,
    availabilityWasOverridden,
}) => {

    const availability = AVAILABILITY_MAP[availabilityType];
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

            if (analysisResult && icingDesign) {
                if (icingDesign.drip && !analysisResult.icing_design.drip) {
                    specificMessages.push(`Adding ${colorName(icingDesign.colors.drip)} drip effect...`);
                }
                if (icingDesign.colors.side !== analysisResult.icing_design.colors.side) {
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

    const dominantMotif = useMemo(() => {
        if (!analysisResult) return null;

        const allColors: string[] = [];
        const neutralColors = ['#ffffff', '#000000', '#64748b']; // White, Black, Gray

        Object.values(analysisResult.icing_design.colors).forEach(color => {
            if (color) allColors.push(color.toLowerCase());
        });
        analysisResult.main_toppers.forEach(item => {
            if (item.color) allColors.push(item.color.toLowerCase());
            if (item.colors) item.colors.forEach(c => c && allColors.push(c.toLowerCase()));
        });
        analysisResult.support_elements.forEach(item => {
            if (item.color) allColors.push(item.color.toLowerCase());
            if (item.colors) item.colors.forEach(c => c && allColors.push(c.toLowerCase()));
        });
        analysisResult.cake_messages.forEach(item => {
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

    return (
        <div className="flex flex-col items-center gap-3 w-full max-w-7xl mx-auto pb-28"> {/* Added padding-bottom */}
            <div className="w-full flex items-center gap-2 md:gap-4">
                <button onClick={onClose} className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label="Go back">
                    <BackIcon />
                </button>
                <div className="relative flex-grow">
                    <SearchAutocomplete
                        value={searchInput}
                        onChange={setSearchInput}
                        onSearch={onSearch}
                        showUploadButton={false}
                        placeholder="Search for other designs..."
                        inputClassName="w-full pl-5 pr-12 py-3 text-sm bg-white border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                    />
                </div>
                <button onClick={() => setAppState('cart')} className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label={`View cart with ${itemCount} items`}>
                    <CartIcon />
                    {itemCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                            {itemCount}
                        </span>
                    )}
                </button>
                {isAuthenticated && !user?.is_anonymous ? (
                    <div className="relative" ref={accountMenuRef}>
                        <button onClick={() => setIsAccountMenuOpen(prev => !prev)} className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label="Open account menu">
                            <UserCircleIcon />
                        </button>
                        {isAccountMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-fade-in z-50">
                                <div className="px-4 py-2 border-b border-slate-100">
                                    <p className="text-sm font-medium text-slate-800 truncate">{user?.email}</p>
                                </div>
                                <button onClick={() => { setAppState('addresses'); setIsAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                    <MapPinIcon className="w-4 h-4" />
                                    My Addresses
                                </button>
                                <button onClick={() => { setAppState('orders'); setIsAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                    <PackageIcon className="w-4 h-4" />
                                    My Orders
                                </button>
                                <button onClick={onSignOut} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                                    <LogOutIcon className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button onClick={() => setAppState('auth')} className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-sm font-semibold text-slate-700 hover:bg-white hover:border-slate-300 transition-all shadow-sm flex-shrink-0">
                        Login
                    </button>
                )}
            </div>

            <button
                onClick={onOpenReportModal}
                disabled={!editedImage || isLoading || isReporting}
                className="w-full text-center bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm font-semibold px-4 py-2 rounded-xl shadow-sm mt-[18px] transition-colors hover:bg-yellow-200 disabled:bg-yellow-100/50 disabled:text-yellow-600 disabled:cursor-not-allowed disabled:hover:bg-yellow-100"
            >
                ALPHA TEST: Features are experimental. Click here to report any issues.
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
            <div className="w-full flex flex-col lg:flex-row gap-6 items-start">
                {/* LEFT COLUMN: Image and Update Design - Sticky on desktop */}
                <div className="w-full lg:w-1/2 flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
                    <div ref={mainImageContainerRef} className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
                        <div className="p-2 flex-shrink-0">
                            <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                                <button onClick={() => setActiveTab('original')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50'}`}>Original</button>
                                <button onClick={handleCustomizedTabClick} disabled={!editedImage} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'}`}>Customized</button>
                            </div>
                            {isAnalyzing && (
                                <div className="mt-3 w-full text-center animate-fade-in">
                                    <div className="w-full bg-slate-200 rounded-full h-2.5 relative overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-pink-500 to-purple-600 progress-bar-fill"></div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 font-medium">Analyzing design elements & pricing... You can start customizing below.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-2 pt-0 flex-grow">
                            <div
                                ref={markerContainerRef}
                                className="relative w-full min-h-[400px]"
                                onContextMenu={(e) => e.preventDefault()}
                                style={{
                                    aspectRatio: originalImageDimensions
                                        ? `${originalImageDimensions.width} / ${originalImageDimensions.height}`
                                        : '1 / 1'
                                }}
                            >
                                {isUpdatingDesign && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-2xl z-20"><LoadingSpinner /><p className="mt-4 text-slate-500 font-semibold">{dynamicLoadingMessage}</p></div>}
                                {error && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20 p-4"><ErrorIcon /><p className="mt-4 font-semibold text-red-600">Update Failed</p><p className="text-sm text-red-500 text-center">{error}</p></div>}
                                {!originalImagePreview && !isAnalyzing && <div className="absolute inset-0 flex items-center justify-center text-center text-slate-400 py-16"><ImageIcon /><p className="mt-2 font-semibold">Your creation will appear here</p></div>}

                                {(originalImagePreview) && (
                                    <>
                                        <img
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
                                            alt={activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"}
                                            className="w-full h-full object-contain rounded-lg"
                                        />
                                        {/* Action buttons in top right corner */}
                                        <div className="absolute top-3 right-3 z-10 flex gap-2">
                                            {/* Edit Messages button - always visible if messages exist */}
                                            {cakeMessages.length > 0 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedItem(null);
                                                        handleScrollToCakeMessages();
                                                    }}
                                                    className="bg-black/40 backdrop-blur-sm text-white rounded-full text-xs font-semibold hover:bg-black/60 transition-all shadow-md px-3 py-1.5"
                                                    aria-label="Edit messages"
                                                >
                                                    Edit Messages
                                                </button>
                                            )}
                                            {/* Edible Photo button - only for edible photo cakes */}
                                            {(mainToppers.some(t => t.isEnabled && t.type === 'edible_photo') ||
                                                supportElements.some(s => s.isEnabled && s.type === 'edible_photo_side')) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Find the edible photo item and select it
                                                            const ediblePhotoTopper = mainToppers.find(t => t.isEnabled && t.type === 'edible_photo');
                                                            const ediblePhotoSupport = supportElements.find(s => s.isEnabled && s.type === 'edible_photo_side');
                                                            const ediblePhotoItem = ediblePhotoTopper || ediblePhotoSupport;
                                                            if (ediblePhotoItem) {
                                                                setSelectedItem(ediblePhotoItem as any);
                                                            }
                                                        }}
                                                        className="bg-black/40 backdrop-blur-sm text-white rounded-full text-xs font-semibold hover:bg-black/60 transition-all shadow-md px-3 py-1.5"
                                                        aria-label="Edit edible photo"
                                                    >
                                                        Edible Photo
                                                    </button>
                                                )}
                                            {/* Cake Options button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleScrollToCakeBase();
                                                }}
                                                className="bg-black/40 backdrop-blur-sm text-white rounded-full text-xs font-semibold hover:bg-black/60 transition-all shadow-md px-3 py-1.5"
                                                aria-label="Scroll to cake options"
                                            >
                                                Cake Options
                                            </button>
                                        </div>
                                        {originalImageDimensions && containerDimensions && containerDimensions.height > 0 && areHelpersVisible && clusteredMarkers.map((item) => {
                                            if (item.x === undefined || item.y === undefined) return null;

                                            // Hide markers during Phase 1 (coordinates are 0,0)
                                            // They'll fade in during Phase 2 when real coordinates arrive
                                            if (item.x === 0 && item.y === 0) return null;

                                            const position = getMarkerPosition(item.x, item.y);
                                            const isSelected = selectedItem?.id === item.id;
                                            const isCluster = 'isCluster' in item && item.isCluster;
                                            const isAction = 'itemCategory' in item && item.itemCategory === 'action';

                                            // Handle click to detect overlapping markers
                                            const handleMarkerClick = (e: React.MouseEvent, clickedItem: ClusteredMarker) => {
                                                e.stopPropagation();
                                                setIsMotifPanelOpen(false);

                                                // Find all overlapping markers at this position
                                                const OVERLAP_THRESHOLD = 12; // 24px marker / 2 = 12px radius
                                                const clickedPos = getMarkerPosition(clickedItem.x!, clickedItem.y!);

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
                                                        id: `overlap-cluster-${clickedItem.id}`,
                                                        x: clickedItem.x!,
                                                        y: clickedItem.y!,
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
                                                    setSelectedItem(prev => prev?.id === clickedItem.id ? null : clickedItem);
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
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Icing Toolbar - Below image container */}
                    {originalImagePreview && (() => {
                        const hasIcingChanges = analysisResult?.icing_design && icingDesign && (
                            JSON.stringify(icingDesign.colors) !== JSON.stringify(analysisResult.icing_design.colors) ||
                            icingDesign.drip !== analysisResult.icing_design.drip ||
                            icingDesign.border_top !== analysisResult.icing_design.border_top ||
                            icingDesign.border_base !== analysisResult.icing_design.border_base ||
                            icingDesign.gumpasteBaseBoard !== analysisResult.icing_design.gumpasteBaseBoard
                        );

                        return (
                            <div className={`w-full bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200 px-4 pt-4 relative transition-all duration-200 ${hasIcingChanges || isUpdatingDesign ? 'pb-16' : 'pb-8'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-semibold text-slate-700">Change Icing Colors</h3>
                                    <button
                                        onClick={() => {
                                            if (analysisResult?.icing_design) {
                                                onIcingDesignChange(analysisResult.icing_design);
                                                setSelectedItem(null);
                                            }
                                        }}
                                        className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
                                    >
                                        <ResetIcon className="w-3 h-3" />
                                        Revert to Original
                                    </button>
                                </div>
                                <IcingToolbar
                                    onSelectItem={setSelectedItem}
                                    icingDesign={icingDesign}
                                    cakeType={cakeInfo?.type || null}
                                    isVisible={areHelpersVisible}
                                    showGuide={showIcingGuide}
                                    selectedItem={selectedItem}
                                />

                                {/* Inline Icing Editor Panel - Slides down below toolbar */}
                                {selectedItem && 'itemCategory' in selectedItem && selectedItem.itemCategory === 'icing' && (
                                    <div
                                        className="overflow-hidden transition-all duration-300 ease-in-out"
                                        style={{
                                            maxHeight: selectedItem ? '500px' : '0px',
                                        }}
                                    >
                                        <div className="mt-3 pt-3">
                                            {(() => {
                                                const description = selectedItem.description;
                                                const isBento = cakeInfo?.type === 'Bento';

                                                // Helper function for toggle + color picker (drip, borders, baseboard)
                                                const renderToggleAndColor = (
                                                    featureKey: 'drip' | 'border_top' | 'border_base' | 'gumpasteBaseBoard',
                                                    colorKey: keyof IcingColorDetails,
                                                    label: string
                                                ) => {
                                                    const originalColor = analysisResult?.icing_design.colors[colorKey];
                                                    const currentColor = icingDesign.colors[colorKey];
                                                    const canRevert = originalColor && currentColor !== originalColor;

                                                    const handleRevert = () => {
                                                        if (canRevert) {
                                                            onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: originalColor } });
                                                        }
                                                    };

                                                    const isEnabled = icingDesign[featureKey];
                                                    const isDisabled = (featureKey === 'border_base' || featureKey === 'gumpasteBaseBoard') && isBento;

                                                    return (
                                                        <>
                                                            <SimpleToggle
                                                                label={label}
                                                                isEnabled={isEnabled}
                                                                disabled={isDisabled}
                                                                onChange={(enabled) => {
                                                                    const newIcingDesign = { ...icingDesign, [featureKey]: enabled };
                                                                    if (enabled && !newIcingDesign.colors[colorKey]) {
                                                                        newIcingDesign.colors = { ...newIcingDesign.colors, [colorKey]: '#FFFFFF' };
                                                                    }
                                                                    onIcingDesignChange(newIcingDesign);
                                                                }}
                                                            />
                                                            <div className={`mt-2 ${!isEnabled && !isDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
                                                                <div className={`pb-2 ${!isEnabled && !isDisabled ? 'pointer-events-auto' : ''}`}>
                                                                    <ColorPalette
                                                                        selectedColor={icingDesign.colors[colorKey] || ''}
                                                                        onColorChange={(newHex) => {
                                                                            const newIcingDesign = {
                                                                                ...icingDesign,
                                                                                [featureKey]: true,
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
                                                    const originalColor = analysisResult?.icing_design.colors[colorKey];
                                                    const currentColor = icingDesign.colors[colorKey];
                                                    const canRevert = originalColor && currentColor !== originalColor;

                                                    const handleRevert = () => {
                                                        if (canRevert) {
                                                            onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: originalColor } });
                                                        }
                                                    };

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
                                                    const originalTopColor = analysisResult?.icing_design.colors.top;
                                                    const originalSideColor = analysisResult?.icing_design.colors.side;
                                                    const currentColor = icingDesign.colors.top || icingDesign.colors.side || '#FFFFFF';

                                                    const canRevertTop = originalTopColor && icingDesign.colors.top !== originalTopColor;
                                                    const canRevertSide = originalSideColor && icingDesign.colors.side !== originalSideColor;
                                                    const canRevert = canRevertTop || canRevertSide;

                                                    const handleRevert = () => {
                                                        const newColors = { ...icingDesign.colors };
                                                        if (canRevertTop && originalTopColor) newColors.top = originalTopColor;
                                                        if (canRevertSide && originalSideColor) newColors.side = originalSideColor;
                                                        onIcingDesignChange({ ...icingDesign, colors: newColors });
                                                    };

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
                                                        return renderToggleAndColor('drip', 'drip', 'Enable Drip Effect');
                                                    case 'Top':
                                                        return renderToggleAndColor('border_top', 'borderTop', 'Enable Top Border');
                                                    case 'Bottom':
                                                        return renderToggleAndColor('border_base', 'borderBase', 'Enable Base Border');
                                                    case 'Board':
                                                        return renderToggleAndColor('gumpasteBaseBoard', 'gumpasteBaseBoardColor', 'Enable Covered Board');
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
                                    </div>
                                )}

                                {/* Small Apply button in lower right corner - only show when there are changes */}
                                {(() => {
                                    const hasIcingChanges = analysisResult?.icing_design && icingDesign && (
                                        JSON.stringify(icingDesign.colors) !== JSON.stringify(analysisResult.icing_design.colors) ||
                                        icingDesign.drip !== analysisResult.icing_design.drip ||
                                        icingDesign.border_top !== analysisResult.icing_design.border_top ||
                                        icingDesign.border_base !== analysisResult.icing_design.border_base ||
                                        icingDesign.gumpasteBaseBoard !== analysisResult.icing_design.gumpasteBaseBoard
                                    );

                                    if (!hasIcingChanges && !isUpdatingDesign) return null;

                                    return (
                                        <button
                                            onClick={onUpdateDesign}
                                            disabled={isUpdatingDesign || !originalImageData}
                                            className="absolute bottom-4 right-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-1.5 px-3.5 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-1.5 text-sm"
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
                                    );
                                })()}
                            </div>
                        );
                    })()}


                    {/* Report/Save/Reset buttons - shown below Update Design in 2-column layout */}
                    <div className="w-full hidden lg:flex items-center justify-end gap-4">
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    clearPromptCache();
                                    showSuccess("AI prompt cache cleared!");
                                }}
                                className="flex items-center justify-center text-sm text-yellow-600 hover:text-yellow-800 hover:bg-yellow-200 py-2 px-4 rounded-lg transition-colors"
                                aria-label="Clear AI prompt cache"
                            >
                                Clear Prompt Cache
                            </button>
                        )}
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

                {/* RIGHT COLUMN: Availability at top, then Feature List */}
                <div className="w-full lg:w-1/2 flex flex-col gap-3">
                    {/* Availability Section - at top of right column */}
                    {analysisResult && cakeInfo && icingDesign && (
                        <>
                            <div className={`w-full p-4 rounded-xl border-2 flex items-start gap-4 transition-all duration-300 animate-fade-in ${availability.bgColor} ${availability.borderColor}`}>
                                <div className="text-3xl flex-shrink-0 mt-1">
                                    {availability.icon}
                                </div>
                                <div className="flex-grow">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <h4 className={`text-lg font-bold ${availability.textColor}`}>
                                            {availability.label}
                                        </h4>
                                        <span className={`
                            px-2 py-0.5 text-xs font-semibold rounded-full
                            ${availability.type === 'rush' ? 'bg-green-200 text-green-800' : ''}
                            ${availability.type === 'same-day' ? 'bg-blue-200 text-blue-800' : ''}
                            ${availability.type === 'normal' ? 'bg-slate-200 text-slate-700' : ''}
                        `}>
                                            {availability.time}
                                        </span>
                                    </div>

                                    <p className={`text-sm mt-1 ${availability.textColor.replace('800', '700')}`}>
                                        {availability.description}
                                    </p>

                                    {availability.type === 'rush' && (
                                        <p className="text-xs mt-2 text-green-600">
                                            💨 Perfect for last-minute celebrations!
                                        </p>
                                    )}

                                    {availability.type === 'same-day' && (
                                        <p className="text-xs mt-2 text-blue-600">
                                            ⏰ Order before 12 PM for same-day pickup!
                                        </p>
                                    )}

                                    {availability.type === 'normal' && (
                                        <p className="text-xs mt-2 text-slate-600">
                                            🎨 Complex designs take time - but they're worth the wait!
                                        </p>
                                    )}
                                </div>
                            </div>

                            {!isLoadingAvailabilitySettings && (
                                (availabilitySettings && availabilitySettings.minimum_lead_time_days > 0 && availabilityType === 'normal') ? (
                                    <div className="w-full p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 animate-fade-in text-center">
                                        <strong>Note:</strong> We are observing a minimum lead time of <strong>{availabilitySettings.minimum_lead_time_days} day(s)</strong>. Available delivery dates will be adjusted in your cart.
                                    </div>
                                ) : availabilityWasOverridden ? (
                                    <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 animate-fade-in text-center">
                                        <strong>Note:</strong> Due to high demand, availability has been adjusted. Your order will now be processed as a <strong>'{availability.type.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}'</strong> order.
                                    </div>
                                ) : null
                            )}
                        </>
                    )}

                    <div className="w-full bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200">
                        {(cakeInfo || analysisError) ? (
                            <FeatureList
                                analysisError={analysisError}
                                analysisId={analysisId}
                                cakeInfo={cakeInfo}
                                basePriceOptions={basePriceOptions}
                                mainToppers={mainToppers}
                                supportElements={supportElements}
                                cakeMessages={cakeMessages}
                                icingDesign={icingDesign}
                                additionalInstructions={additionalInstructions}
                                onCakeInfoChange={onCakeInfoChange}
                                updateMainTopper={updateMainTopper}
                                removeMainTopper={removeMainTopper}
                                updateSupportElement={updateSupportElement}
                                removeSupportElement={removeSupportElement}
                                updateCakeMessage={updateCakeMessage}
                                removeCakeMessage={removeCakeMessage}
                                addCakeMessage={addCakeMessage}
                                onIcingDesignChange={onIcingDesignChange}
                                onAdditionalInstructionsChange={onAdditionalInstructionsChange}
                                onTopperImageReplace={onTopperImageReplace}
                                onSupportElementImageReplace={onSupportElementImageReplace}
                                isAnalyzing={isAnalyzing}
                                itemPrices={itemPrices}
                                user={user}
                                cakeBaseSectionRef={cakeBaseSectionRef}
                                cakeMessagesSectionRef={cakeMessagesSectionRef}
                                onItemClick={handleListItemClick}
                                markerMap={markerMap}
                            />
                        ) : <div className="text-center p-8 text-slate-500"><p>Upload an image to get started.</p></div>}
                    </div>
                </div>
            </div>

            {/* Report/Save/Reset buttons - shown below 2-column layout on mobile/single column */}
            {originalImageData && (
                <div className="w-full lg:hidden flex flex-col items-center gap-3">
                    <div className="w-full flex items-center justify-end gap-4">
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    clearPromptCache();
                                    showSuccess("AI prompt cache cleared!");
                                }}
                                className="flex items-center justify-center text-sm text-yellow-600 hover:text-yellow-800 hover:bg-yellow-200 py-2 px-4 rounded-lg transition-colors"
                                aria-label="Clear AI prompt cache"
                            >
                                Clear Prompt Cache
                            </button>
                        )}
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
            )}
            {/* FloatingResultPanel - Only show for non-icing items */}
            {selectedItem && !('itemCategory' in selectedItem && selectedItem.itemCategory === 'icing') && (
                <FloatingResultPanel
                    selectedItem={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    mainToppers={mainToppers}
                    updateMainTopper={updateMainTopper}
                    removeMainTopper={removeMainTopper}
                    onTopperImageReplace={onTopperImageReplace}
                    supportElements={supportElements}
                    updateSupportElement={updateSupportElement}
                    removeSupportElement={removeSupportElement}
                    onSupportElementImageReplace={onSupportElementImageReplace}
                    cakeMessages={cakeMessages}
                    updateCakeMessage={updateCakeMessage}
                    removeCakeMessage={removeCakeMessage}
                    addCakeMessage={addCakeMessage}
                    onCakeMessageChange={onCakeMessageChange}
                    icingDesign={icingDesign}
                    onIcingDesignChange={onIcingDesignChange}
                    analysisResult={analysisResult}
                    itemPrices={itemPrices}
                    isAdmin={isAdmin}
                    onUpdateDesign={onUpdateDesign}
                    isUpdatingDesign={isUpdatingDesign}
                />
            )}
            {/* Messages Panel */}
            {showMessagesPanel && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMessagesPanel(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center rounded-t-xl">
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
                        <div className="p-4 space-y-4">
                            {/* List all messages */}
                            {cakeMessages.map((message) => (
                                <div key={message.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
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
                                        <span>Font: {message.font}</span>
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
            )}
            {dominantMotif && (
                <MotifPanel
                    isOpen={isMotifPanelOpen}
                    onClose={() => setIsMotifPanelOpen(false)}
                    dominantMotif={dominantMotif}
                    onColorChange={handleMotifColorChange}
                />
            )}
        </div>
    );
};

export default React.memo(CustomizingPage);
```

## File: src/app/about/page.tsx

```tsx
import React, { useState } from 'react';
import { ArrowLeft, Award, Target, Rocket, Users, Handshake, Search, Upload, Edit, Wand2, ShoppingCart, CheckCircle, X } from 'lucide-react';
import LazyImage from '../../components/LazyImage';
import { useCanonicalUrl } from '../../hooks';

interface AboutPageProps {
  onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`pt-6 border-t border-slate-200 ${className}`}>
    <h2 className="text-2xl font-bold text-slate-800 mb-4">{title}</h2>
    <div className="space-y-4 text-slate-600 leading-relaxed">
      {children}
    </div>
  </div>
);

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-2">
            <div className="text-pink-500">{icon}</div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        </div>
        <p className="text-slate-600">{children}</p>
    </div>
);

const ListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
        <span>{children}</span>
    </li>
);

const PermitThumbnail: React.FC<{ src: string; alt: string; onClick: () => void }> = ({ src, alt, onClick }) => (
    <button onClick={onClick} className="group text-center focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 rounded-lg">
        <div className="aspect-w-3 aspect-h-4 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
            <LazyImage 
                src={src} 
                alt={alt} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            />
        </div>
        <p className="mt-2 text-sm font-medium text-slate-700 group-hover:text-pink-600 transition-colors">{alt}</p>
    </button>
);


const AboutPage: React.FC<AboutPageProps> = ({ onClose }) => {
  // Add canonical URL for SEO
  useCanonicalUrl('/about');
  
  const [zoomedPermit, setZoomedPermit] = useState<string | null>(null);

  const permits = [
    { name: 'BIR Certificate of Registration', url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/BIR%20Certificate%20of%20Registration%202303.jpg' },
    { name: 'BIR Receipt Permit', url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/20250808_145451.jpg' },
    { name: 'DTI Permit', url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/DTI%20Alalai%20ITS.jpg' },
  ];

  return (
    <>
      <div className="w-full max-w-4xl mx-auto bg-white/80 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200 animate-fade-in">
        <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
            <ArrowLeft />
          </button>
          <div className="flex-grow">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">About Us</h1>
            <p className="text-slate-500 font-medium mt-1">Your Cake Wish, Granted.</p>
          </div>
        </div>

        <div className="space-y-8">
          <Section title="Our Story">
            <p>Genie was founded by Alan Paris Caballes with a vision to revolutionize the made-to-order economy. What began as a solution to the frustrations of ordering custom cakes—the long waits for replies, tedious back-and-forth conversations, and unclear pricing—has evolved into a cutting-edge platform that bridges the gap between artisans and their customers through innovative AI-powered technology.</p>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
            <InfoCard icon={<Rocket className="w-6 h-6"/>} title="Our Vision">
              To become the leading platform for customizing made-to-order products, transforming the way people create and purchase personalized items by bringing the made-to-order economy into the modern digital age.
            </InfoCard>
            <InfoCard icon={<Target className="w-6 h-6"/>} title="Our Mission">
              To empower both customers and artisans with intuitive AI-driven customization tools that provide instant visualization, transparent pricing, and seamless transactions—making the process of ordering custom products as delightful as receiving them.
            </InfoCard>
          </div>

          <Section title="What We Do">
            <p>Genie is an online cakeshop with true customization features powered by AI. Our platform transforms the custom cake ordering experience.</p>
            <div className="mt-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-pink-500" /> For Customers</h3>
                    <ul className="space-y-3">
                        <ListItem><strong>Infinite Design Possibilities</strong> - Access unlimited cake designs with just one click, all fully customizable.</ListItem>
                        <ListItem><strong>Real-Time Visualization</strong> - See your custom creation come to life instantly as you personalize every detail.</ListItem>
                        <ListItem><strong>Instant Price Feedback</strong> - Know exactly what your design will cost with transparent, immediate pricing.</ListItem>
                        <ListItem><strong>Seamless Purchasing</strong> - Complete your order directly through our web and mobile platform.</ListItem>
                    </ul>
                </div>
            </div>
          </Section>

          <Section title="The Problem We're Solving">
            <p>While we can order almost anything online today—from band-aids to cars to houses—highly customizable products like decorated cakes remain stuck in Web 1.0. Customers still rely on messaging apps, food delivery platforms, and lengthy conversations with unclear outcomes.</p>
            <p>Not all custom cakes are created equal. Simple, minimalist designs can be prepared in 5-10 minutes, competing directly with mass-market cakes from large chains. Yet the industry treats all custom orders the same way—through slow, manual processes. <strong>Genie changes that.</strong></p>
          </Section>

          <Section title="Recognition & Achievement">
            <div className="bg-gradient-to-br from-yellow-50 to-amber-100 p-6 rounded-xl border-2 border-yellow-200">
                <h3 className="text-lg font-bold text-amber-800 mb-2 flex items-center gap-2"><Award className="w-5 h-5" /> 1st Place Winner - Startup Innovation Summit, Mandaue City</h3>
                <p className="text-amber-700">We are proud to have won first place at the Startup Innovation Summit – Innovative Business Start-Up Prototype Competition held during the Mandaue City Charter Anniversary Celebration. This prestigious recognition validates our commitment to innovation and our mission to provide technology solutions that make life better for communities.</p>
                <p className="text-amber-700 mt-2">Organized by the Mandaue Investment Promotions and Tourism Action Center (MIPTAC) in partnership with the Mandaue Chamber of Commerce and Industry (MCCI), the competition brought together the region's most promising innovators and entrepreneurs. Our victory demonstrates the value and potential of Genie in transforming not just the custom cake industry, but the entire made-to-order economy.</p>
            </div>
          </Section>

          <Section title="Business Permits">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {permits.map((permit) => (
                    <PermitThumbnail 
                        key={permit.name}
                        src={permit.url} 
                        alt={permit.name}
                        onClick={() => setZoomedPermit(permit.url)}
                    />
                ))}
            </div>
          </Section>

        </div>
      </div>

      {/* Permit Zoom Modal */}
      {zoomedPermit && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setZoomedPermit(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white p-2 bg-black/30 rounded-full hover:bg-black/50 transition-colors z-10"
            onClick={() => setZoomedPermit(null)}
          >
            <X size={24} />
          </button>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <LazyImage 
              src={zoomedPermit} 
              alt="Permit document"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AboutPage;
```

## File: src/app/checkout/page.tsx

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../contexts/CartContext';
import { useAddresses } from '../../hooks/useAddresses';
import { BackIcon, Loader2 } from '../../components/icons';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { showSuccess, showError } from '../../lib/utils/toast';
import { createOrderFromCart } from '../../services/supabaseService';
import { createXenditPayment } from '../../services/xenditService';
import { useCanonicalUrl } from '../../hooks';

type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation';

interface CheckoutPageProps {
  onBackToCart: () => void;
  onOrderPlaced: (orderId: string) => void;
  setAppState: (state: AppState) => void;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  onBackToCart,
  onOrderPlaced,
  setAppState,
}) => {
  // Add canonical URL for SEO
  useCanonicalUrl('/checkout');
  
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { 
    cartItems, 
    cartTotal, 
    eventDate, 
    eventTime, 
    deliveryInstructions,
    selectedAddressId,
    clearCart,
  } = useCart();
  
  const { data: addresses, isLoading: addressesLoading } = useAddresses(user?.id);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  // Redirect if not authenticated or if auth check is pending
  useEffect(() => {
    if (authLoading) {
        return; // Wait for auth status to resolve
    }
    if (!isAuthenticated) {
      setAppState('auth');
    }
  }, [authLoading, isAuthenticated, setAppState]);

  const deliveryFee = 150;
  const total = cartTotal + deliveryFee;

  const selectedAddress = useMemo(() => {
    return addresses?.find(a => a.address_id === selectedAddressId);
  }, [addresses, selectedAddressId]);


  const handleSubmitOrder = async () => {
    try {
      // Validation
      if (!selectedAddress) {
        showError('Please select a delivery address');
        return;
      }
  
      if (!eventDate || !eventTime) {
        showError('Please select delivery date and time');
        return;
      }
  
      // Create the order first
      setIsLoading(true);
      
      const orderResult = await createOrderFromCart({
        cartItems,
        eventDate,
        eventTime,
        deliveryInstructions,
        deliveryAddressId: selectedAddressId,
      });
  
      if (!orderResult.success || !orderResult.order) {
        throw new Error(orderResult.error?.message || 'Failed to create order');
      }
  
      // Order created successfully - now create payment link
      const orderId = orderResult.order.order_id;
      
      showSuccess('Order created! Redirecting to payment...');
      
      // Prepare payment items from cart
      const paymentItems = cartItems.map(item => ({
        name: `${item.cake_type} - ${item.cake_size}`,
        quantity: item.quantity,
        price: item.final_price,
      }));
  
      // Create Xendit payment link
      setIsCreatingPayment(true);
      
      const paymentResult = await createXenditPayment({
        orderId: orderId,
        amount: total,
        customerEmail: user?.email,
        customerName: user?.user_metadata?.first_name || user?.email?.split('@')[0],
        items: paymentItems,
      });
  
      if (paymentResult.success && paymentResult.paymentUrl) {
        // Redirect to Xendit payment page
        window.location.href = paymentResult.paymentUrl;
      } else {
        throw new Error(paymentResult.error || 'Failed to create payment link');
      }
  
    } catch (error: any) {
      console.error('Order/Payment error:', error);
      showError(error.message || 'Failed to process order. Please try again.');
      setIsLoading(false);
      setIsCreatingPayment(false);
    }
  };

  if (authLoading || addressesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBackToCart}
            className="p-2 rounded-full bg-white/80 backdrop-blur hover:bg-white transition-colors shadow-md"
            aria-label="Back to cart"
          >
            <BackIcon className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
            Checkout
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Payment Method</h2>
              <p className="text-sm text-gray-600">
                You will be redirected to our secure payment page to complete your purchase using GCash, Maya, GrabPay, or Card.
              </p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-6 border-b pb-4">
                 <div className="space-y-3 mb-4">
                    <h3 className="text-sm font-semibold text-gray-500">Items in your order</h3>
                    {cartItems.map(item => (
                        <div key={item.cart_item_id} className="flex items-center gap-3">
                        <img src={item.customized_image_url} alt={item.cake_type} className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                        <div className="flex-grow">
                            <p className="text-xs font-medium text-slate-700">{item.cake_type}</p>
                            <p className="text-xs text-slate-500">{item.cake_size}</p>
                        </div>
                        <p className="text-xs font-semibold text-slate-600">₱{item.final_price.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Delivery Details</h3>
                    <div className="text-sm text-gray-700 space-y-1">
                        <p><span className="font-medium">Date:</span> {eventDate ? new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}</p>
                        <p><span className="font-medium">Time:</span> {eventTime || 'Not set'}</p>
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Delivery Address</h3>
                    {selectedAddress ? (
                         <div className="text-sm text-gray-700">
                            <p className="font-medium">{selectedAddress.recipient_name}</p>
                            <p>{selectedAddress.street_address}</p>
                            <p>{selectedAddress.barangay}, {selectedAddress.city}</p>
                            <p>{selectedAddress.recipient_phone}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-red-600">No address selected. Please go back to the cart.</p>
                    )}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({cartItems.length} items)</span>
                  <span>₱{cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Fee</span>
                  <span>₱{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t pt-3 mt-2">
                  <div className="flex justify-between text-lg font-bold text-gray-800">
                    <span>Total</span>
                    <span className="text-purple-600">₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={isLoading || isCreatingPayment || !selectedAddress || !eventDate || !eventTime}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-full font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingPayment ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Redirecting to Payment...
                  </span>
                ) : isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating Order...
                  </span>
                ) : (
                  `Place Order - ₱${total.toFixed(2)}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
```

## File: src/app/order-confirmation/page.tsx

```tsx
import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase/client';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { CakeGenieOrder, CakeGenieOrderItem } from '../../lib/database.types';
import { getPaymentStatus, verifyXenditPayment } from '../../services/xenditService';

interface OrderConfirmationPageProps {
  orderId: string;
  onContinueShopping: () => void;
  onGoToOrders: () => void;
}

// Declare gtag for Google Analytics event tracking
declare const gtag: (...args: any[]) => void;

const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  orderId,
  onContinueShopping,
  onGoToOrders,
}) => {
  const [order, setOrder] = useState<(CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();
  
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'paid' | 'pending' | 'expired' | 'failed'>('loading');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      };
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cakegenie_orders')
          .select('*, cakegenie_order_items(*)')
          .eq('order_id', orderId)
          .single();

        if (error) throw error;
        setOrder(data);

        // Analytics: Track purchase event for the funnel
        if (typeof gtag === 'function' && data) {
            const orderItems = (data.cakegenie_order_items || []).map(item => ({
                item_id: `${item.cake_type}_${item.cake_size}`,
                item_name: `Custom Cake - ${item.cake_type}`,
                price: item.final_price,
                quantity: item.quantity
            }));

            gtag('event', 'purchase', {
                transaction_id: data.order_number,
                value: data.total_amount,
                currency: 'PHP',
                items: orderItems
            });
        }
      } catch (error) {
        console.error('[OrderConfirmationPage] Error fetching order:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, supabase]);

  // Proactive verification on page load
  useEffect(() => {
    const verifyOnLoad = async () => {
        if (!orderId) return;

        const result = await verifyXenditPayment(orderId);

        if (result.success && result.status) {
            setPaymentStatus(result.status.toLowerCase() as any);
        } else {
            // If verification fails, the polling mechanism below will take over.
        }
    };

    verifyOnLoad();
  }, [orderId]);

  // Polling mechanism as a fallback
  useEffect(() => {
    const checkPayment = async () => {
      if (!orderId) return;
      
      try {
        const paymentData = await getPaymentStatus(orderId);
        
        if (paymentData) {
          setPaymentStatus(paymentData.status.toLowerCase() as any);
          setPaymentMethod(paymentData.payment_method);
        } else {
          setPaymentStatus('pending');
        }
      } catch (error) {
        console.error('Error checking payment status during poll:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        setPaymentStatus('pending');
      }
    };
    
    // Don't start polling immediately; wait for the initial verification to attempt first.
    // The interval will start after a short delay.
    const intervalId = setInterval(() => {
        if (paymentStatus === 'pending' || paymentStatus === 'loading') {
            checkPayment();
        }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [orderId, paymentStatus]);
  
  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto flex justify-center items-center p-10 min-h-[400px]">
          <LoadingSpinner />
      </div>
    );
  }
  
  if (!order) {
     return (
      <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 text-center animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Order Not Found</h2>
        <p className="text-gray-600 mb-6">We couldn't find the requested order. It may have been cancelled or there was an issue.</p>
        <button
          onClick={onGoToOrders}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all"
        >
          Back to My Orders
        </button>
      </div>
    );
  }

  const displayId = order.order_number || (typeof order.order_id === 'string' ? order.order_id.split('-')[0].toUpperCase() : 'N/A');

  return (
    <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 text-center animate-fade-in">
      <div className="mx-auto w-16 h-16 flex items-center justify-center bg-green-100 rounded-full">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mt-4">Order Placed Successfully!</h1>
      <p className="text-slate-600 mt-2">Your order is now being processed.</p>
      
      <div className="mt-4 bg-slate-100 p-3 rounded-lg">
        <p className="text-sm text-slate-500">Your Order Number is:</p>
        <p className="text-lg font-mono font-bold text-slate-800 tracking-wider">{displayId}</p>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 text-left">
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Payment Status</h3>
        
        {paymentStatus === 'loading' && (
          <div className="flex items-center gap-3 text-slate-600">
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <div>
              <p className="font-medium">Verifying payment...</p>
              <p className="text-sm text-slate-500">Please wait</p>
            </div>
          </div>
        )}
        
        {paymentStatus === 'paid' && (
          <div className="flex items-center gap-3 text-green-600 bg-green-50 p-4 rounded-lg">
            <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-semibold text-lg">Payment Confirmed! 🎉</p>
              <p className="text-sm text-green-700">
                Your payment has been successfully processed
                {paymentMethod && ` via ${paymentMethod}`}.
              </p>
              <p className="text-sm text-green-700 mt-1">
                We'll start preparing your custom cake right away!
              </p>
            </div>
          </div>
        )}
        
        {paymentStatus === 'pending' && (
          <div className="flex items-center gap-3 text-yellow-600 bg-yellow-50 p-4 rounded-lg">
            <svg className="w-8 h-8 flex-shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-semibold text-lg">Awaiting Payment</p>
              <p className="text-sm text-yellow-700">
                We're waiting for confirmation from the payment provider.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                This page will update automatically.
              </p>
            </div>
          </div>
        )}
        
        {paymentStatus === 'expired' && (
          <div className="flex items-center gap-3 text-orange-600 bg-orange-50 p-4 rounded-lg">
            <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-semibold text-lg">Payment Link Expired</p>
              <p className="text-sm text-orange-700">
                Your payment link has expired.
              </p>
              <p className="text-sm text-orange-700 mt-1">
                Please go to "My Orders" to try paying again or contact support.
              </p>
            </div>
          </div>
        )}
        
        {paymentStatus === 'failed' && (
          <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-lg">
            <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-semibold text-lg">Payment Failed</p>
              <p className="text-sm text-red-700">
                There was an issue processing your payment.
              </p>
              <p className="text-sm text-red-700 mt-1">
                Please try again from "My Orders" or contact support.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row-reverse gap-3 mt-8">
        <button onClick={onGoToOrders} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base">
          Check My Orders
        </button>
        <button onClick={onContinueShopping} className="w-full text-center bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-base">
          Shop for More Cakes
        </button>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
```

## File: src/app/shopify-customizing/prompt.ts

```ts
// app/shopify-customizing/prompt.ts

import { COLORS } from '../../constants';
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI } from '../../types';

const colorName = (hex: string | undefined) => {
    if (!hex) return 'not specified';
    const foundColor = COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    return foundColor ? `${foundColor.name} (${hex})` : hex;
};

/**
 * Creates a specialized prompt for editing a professional Shopify product photo.
 * This prompt emphasizes photorealism and preserving the original image's quality.
 */
export const createShopifyEditPrompt = (
    originalAnalysis: HybridAnalysisResult | null,
    newCakeInfo: CakeInfoUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    additionalInstructions: string
): string => {
    if (!originalAnalysis) return ""; // Guard clause

    let prompt = `---
### **List of Changes to Apply**
---
`;

    const changes: string[] = [];

    // --- Note: Structural changes like type/thickness are omitted for the Shopify flow ---
    // The size is noted for context.
    changes.push(`- The cake's **size** is "${newCakeInfo.size}". This is for context; do not change the visual proportions unless other instructions imply it.`);

    // --- Topper, Support Element, Icing, and Message changes (logic is largely the same) ---
    mainToppers.forEach(t => {
        if (!t.isEnabled) {
            changes.push(`- **Remove the main topper** described as: "${t.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (t.type !== t.original_type) itemChanges.push(`change its material to **${t.type}**`);
            
            if (t.replacementImage) {
                const isFigure = t.description.toLowerCase().includes('person') || 
                                 t.description.toLowerCase().includes('character') || 
                                 t.description.toLowerCase().includes('human') ||
                                 t.description.toLowerCase().includes('figure');

                if (t.type === 'icing_doodle' && isFigure) {
                    itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **piped icing doodle style**. Capture the likeness from the reference photo but render it as a simple, elegant line art portrait using piped icing.`);
                } else if (t.type === 'icing_palette_knife' && isFigure) {
                    itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **painterly palette knife style**. Capture the likeness from the reference photo but render it as a textured, abstract portrait using palette knife strokes.`);
                } else if ((t.type === 'edible_3d_complex' || t.type === 'edible_3d_ordinary') && isFigure) {
                    itemChanges.push(`**re-sculpt this 3D gumpaste figure based on the new reference image provided**. The new figure must be in the same **3D gumpaste style**. Capture the likeness, pose, and details from the reference photo but render it as a hand-sculpted, edible gumpaste figure.`);
                } else if (t.type === 'printout') {
                    itemChanges.push(`replace its image with the new one provided. The printout topper should be **standing vertically** on the top surface of the cake, as if supported by a small stick from behind.`);
                } else {
                    itemChanges.push(`replace its image with the new one provided`);
                }
            }
            
            if (t.color && t.original_color && t.color !== t.original_color) itemChanges.push(`recolor it to **${colorName(t.color)}**`);
            if (itemChanges.length > 0) changes.push(`- For the main topper "${t.description}": ${itemChanges.join(' and ')}.`);
        }
    });

    supportElements.forEach(s => {
        if (!s.isEnabled) {
            changes.push(`- **Remove the support element** described as: "${s.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (s.type !== s.original_type) itemChanges.push(`change its material to **${s.type}**`);
            if (s.replacementImage) {
                const isFigure = s.description.toLowerCase().includes('person') || 
                                 s.description.toLowerCase().includes('character') || 
                                 s.description.toLowerCase().includes('human') || 
                                 s.description.toLowerCase().includes('figure');
                if (s.type === 'edible_3d_support' && isFigure) {
                    itemChanges.push(`**re-sculpt this small 3D gumpaste item based on the new reference image provided**. The new item must be in the same **3D gumpaste style** as the original cake. Capture the likeness, pose, and details from the reference photo but render it as a small, hand-sculpted, edible gumpaste figure.`);
                } else {
                    itemChanges.push(`replace its image with the new one provided`);
                }
            }
            if (s.color && s.original_color && s.color !== s.original_color) itemChanges.push(`recolor it to **${colorName(s.color)}**`);
            if (itemChanges.length > 0) changes.push(`- For the support element "${s.description}": ${itemChanges.join(' and ')}.`);
        }
    });
    
    // Icing Design Changes
    const originalIcing = originalAnalysis.icing_design;
    const newIcing = icingDesign;

    if (newIcing.drip && !originalIcing.drip) {
        changes.push(`- **Add a drip effect**. Make it look realistic on the existing cake texture. The drip color should be **${colorName(newIcing.colors.drip)}**.`);
    } else if (!newIcing.drip && originalIcing.drip) {
        changes.push(`- **Remove the drip effect**.`);
    } else if (newIcing.drip && originalIcing.drip && newIcing.colors.drip !== originalIcing.colors.drip) {
        changes.push(`- **Recolor the drip** to **${colorName(newIcing.colors.drip!)}**. Preserve all other details.`);
    }
    
    // Handle Gumpaste Base Board
    if (newIcing.gumpasteBaseBoard && !originalIcing.gumpasteBaseBoard) {
        let instruction = `- **let's cover the whole base board with a colored gumpaste covered base board**. Preserve any existing decorations on the base area.`;
        if (newIcing.colors.gumpasteBaseBoardColor) {
            instruction += ` The GUMPASTE COVERED BASE BOARD color should be **${colorName(newIcing.colors.gumpasteBaseBoardColor)}**.`;
        }
        changes.push(instruction);
    } else if (!newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard) {
        changes.push(`- **Remove the gumpaste-covered base board**.`);
    } else if (newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard && newIcing.colors.gumpasteBaseBoardColor !== originalIcing.colors.gumpasteBaseBoardColor) {
        changes.push(`- **Recolor the gumpaste base board** to **${colorName(newIcing.colors.gumpasteBaseBoardColor!)}**. Preserve all other details.`);
    }

    // Core icing colors
    if (newIcing.colors.side !== undefined && newIcing.colors.side !== originalIcing.colors.side) {
        changes.push(`- **Recolor the side icing** to **${colorName(newIcing.colors.side)}**. Preserve all original textures and decorations on this surface.`);
    }
    if (newIcing.colors.top !== undefined && newIcing.colors.top !== originalIcing.colors.top) {
        changes.push(`- **Recolor the top icing** to **${colorName(newIcing.colors.top)}**. Preserve all original textures and decorations on this surface.`);
    }
    // ... (other icing features like borders can be added here if needed)

    // Cake Message Changes
    cakeMessages.forEach(uiMsg => {
        if (uiMsg.isEnabled && uiMsg.text.trim()) {
            // A color is considered "customized" by the user if they've explicitly turned off the default toggle.
            const isColorCustomizedByUser = uiMsg.useDefaultColor === false;

            if (uiMsg.position === 'base_board') {
                let instruction = `- **On the cake's base board, add or replace any existing text** with the message: "${uiMsg.text}".`;

                if (isColorCustomizedByUser) {
                    instruction += ` The text should be written in an 'icing_script' style with the color ${colorName(uiMsg.color)}.`;
                } else { // useDefaultColor is true or undefined
                    instruction += ` If replacing existing text, match the original style and color. If adding new text to a blank board, use an 'icing_script' style in a color that contrasts well with the board.`;
                }
                changes.push(instruction);
            } else { // 'top' or 'side'
                let styleInstruction: string;
                if (isColorCustomizedByUser) {
                    styleInstruction = `using the **exact same style** as the original message, but change the **color to ${colorName(uiMsg.color)}**.`;
                } else { // useDefaultColor is true or undefined
                    styleInstruction = "using the **exact same style (e.g., piped icing, gumpaste letters) and color** as the original message.";
                }

                changes.push(`- **Find the primary message on the cake (e.g., "Happy Birthday [Name]" or just a name). Identify its style and color, then completely replace the text** with "${uiMsg.text}", ${styleInstruction} Preserve the original text's general location and size.`);
            }
        }
    });

    if (additionalInstructions.trim()) {
        changes.push(`- **Special Instructions:** ${additionalInstructions.trim()}`);
    }

    if (changes.length === 0) {
        prompt += "- No changes were requested. The image should remain exactly the same.";
    } else {
        prompt += changes.join('\n');
    }
    
    return prompt;
};
```

## File: src/app/shopify-customizing/page.tsx

```tsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
        properties[`${tierLabel}Flavor`] = flavor;
    });

    mainToppers.filter(t => t.isEnabled).forEach((topper, i) => {
        let topperString = `${topper.description} (${topper.size})`;
        // Check if color was customized
        // FIX: Add type guard for topper.color to ensure it's a string before calling string methods.
        if (topper.color && typeof topper.color === 'string' && topper.color !== topper.original_color) {
            const colorName = HEX_TO_COLOR_NAME_MAP[topper.color.toLowerCase()] || '';
            const colorString = `${topper.color.toUpperCase()} ${colorName.toUpperCase()}`.trim();
            topperString += ` (Color: ${colorString})`;
        }
        properties[`Topper ${i + 1}`] = topperString;
    });

    cakeMessages.filter(m => m.isEnabled && m.text.trim()).forEach((msg, i) => {
        let messageString = `"${msg.text}"`;
        // Check if color was customized by user
        if (msg.useDefaultColor === false) {
             const colorName = HEX_TO_COLOR_NAME_MAP[msg.color.toLowerCase()] || '';
             const colorString = `${msg.color.toUpperCase()} ${colorName.toUpperCase()}`.trim();
             messageString += ` (Color: ${colorString})`;
        }
        properties[`Message ${i + 1}`] = messageString;
    });

    if (icingDesign.drip) properties['Icing Drip'] = 'Yes';
    Object.entries(icingDesign.colors).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
            const keyName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const colorName = HEX_TO_COLOR_NAME_MAP[value.toLowerCase()] || '';
            const colorString = `${value.toUpperCase()} ${colorName.toUpperCase()}`.trim();
            properties[`${keyName} Color`] = colorString;
        }
    });

    if (additionalInstructions.trim()) {
        properties['Instructions'] = additionalInstructions.trim();
    }
    
    properties['Add-on Cost'] = `₱${totalAddOnPrice.toLocaleString()}`;

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
        const cartUrl = new URL(`${shopifyDomain}/cart/add`);

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
        if(cartDetails) {
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
                      <button onClick={() => setActiveTab('original')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50'}`}>Original</button>
                      <button onClick={handleCustomizedTabClick} disabled={(!editedImage && !isCustomizationDirty) || isUpdatingDesign} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'}`}>Customized</button>
                  </div>
              </div>
              <div className="relative flex-grow flex items-center justify-center p-2 pt-0 min-h-0">
                  {(isUpdatingDesign) && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20"><LoadingSpinner /><p className="mt-4 text-slate-500 font-semibold">Updating Design...</p></div>}
                  <button
                    type="button"
                    onClick={() => setIsMainZoomModalOpen(true)}
                    className="w-full h-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-lg"
                  >
                    <img key={activeTab} src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview} alt={activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"} className="w-full h-full object-contain rounded-lg"/>
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
                      group_id: `new-${Date.now()}`,
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
      />
    </>
  );
};

export default ShopifyCustomizingPage;
```

## File: src/app/cart/page.tsx

```tsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCart, useCartActions, readFromLocalStorage, batchSaveToLocalStorage, batchRemoveFromLocalStorage } from '../../contexts/CartContext';
import { useAddresses } from '../../hooks/useAddresses';
import { showSuccess, showError, showInfo } from '../../lib/utils/toast';
import { Loader2, CloseIcon, TrashIcon } from '../../components/icons';
import { MapPin, Search, X } from 'lucide-react';
import { CartItem, CartItemDetails, CakeType } from '../../types';
import { CakeGenieAddress } from '../../lib/database.types';
import { CartSkeleton } from '../../components/LoadingSkeletons';
import { CITIES_AND_BARANGAYS } from '../../constants';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import DetailItem from '../../components/UI/DetailItem';
import { createOrderFromCart, getAvailableDeliveryDates, getBlockedDatesInRange, AvailableDate, BlockedDateInfo } from '../../services/supabaseService';
import { createXenditPayment } from '../../services/xenditService';
import AddressForm, { StaticMap } from '../../components/AddressForm';
import { useGoogleMapsLoader } from '../../contexts/GoogleMapsLoaderContext';
import { calculateCartAvailability, AvailabilityType } from '../../lib/utils/availability';
import CartItemCard from '../../components/CartItemCard';
import { useQuery } from '@tanstack/react-query';
import { useAvailabilitySettings } from '../../hooks/useAvailabilitySettings';
import { validateDiscountCode, getUserDiscountCodes } from '../../services/discountService';
import type { DiscountValidationResult } from '../../types';
import { useCanonicalUrl } from '../../hooks';


// FIX: Declare the global 'google' object to satisfy TypeScript.
declare const google: any;

interface CartPageProps {
  pendingItems: CartItem[];
  isLoading: boolean;
  onRemoveItem: (id: string) => void;
  onClose: () => void;
  onContinueShopping: () => void;
  onAuthRequired: () => void;
}

const EVENT_TIME_SLOTS_MAP: { slot: string; startHour: number; endHour: number }[] = [
    { slot: "10AM - 12NN", startHour: 10, endHour: 12 },
    { slot: "12NN - 2PM", startHour: 12, endHour: 14 },
    { slot: "2PM - 4PM", startHour: 14, endHour: 16 },
    { slot: "4PM - 6PM", startHour: 16, endHour: 18 },
    { slot: "6PM - 8PM", startHour: 18, endHour: 20 },
];
const EVENT_TIME_SLOTS = EVENT_TIME_SLOTS_MAP.map(item => item.slot);

const paymentMethods = [
  { name: 'GCash', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/gcash.jpg' },
  { name: 'Maya', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/maya.jpg' },
  { name: 'ShopeePay', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/shopeepay.jpg' },
  { name: 'Visa', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/visa.jpg' },
  { name: 'Mastercard', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/mastercard.jpg' },
  { name: 'BPI', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/bpi.jpg' },
  { name: 'BDO', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/bdo.jpg' },
  { name: 'Palawan', logoUrl: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/payment_logos/palawan.jpg' },
];


const CartPage: React.FC<CartPageProps> = ({ pendingItems, isLoading: isCartLoading, onRemoveItem, onClose, onContinueShopping, onAuthRequired }) => {
    // Add canonical URL for SEO
    useCanonicalUrl('/cart');
    
    const { user } = useAuth();
    const isRegisteredUser = !!(user && !user.is_anonymous);
    const {
        cartItems,
        eventDate,
        eventTime,
        deliveryInstructions,
        selectedAddressId,
        cartTotal: subtotal,
    } = useCart();
    const {
        setEventDate,
        setEventTime,
        setDeliveryInstructions,
        setSelectedAddressId,
        clearCart,
    } = useCartActions();
    
    const { data: savedAddresses = [], isLoading: isAddressesLoading } = useAddresses(user?.id);
    const { settings: availabilitySettings, loading: isLoadingSettings } = useAvailabilitySettings();

    const allItems = useMemo<CartItem[]>(() => {
        const mappedSupabaseItems: CartItem[] = cartItems.map(item => ({
            id: item.cart_item_id,
            image: item.customized_image_url,
            status: 'complete',
            type: item.cake_type,
            thickness: item.cake_thickness,
            size: item.cake_size,
            totalPrice: item.final_price * item.quantity,
            details: item.customization_details as CartItemDetails,
        }));
        return [...pendingItems, ...mappedSupabaseItems];
    }, [pendingItems, cartItems]);
    
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [isCreatingPayment, setIsCreatingPayment] = useState(false);
    const [partiallyBlockedSlots, setPartiallyBlockedSlots] = useState<BlockedDateInfo[]>([]);
    const [tooltip, setTooltip] = useState<{ date: string; reason: string; } | null>(null);

    // State for discount
    const [discountCode, setDiscountCode] = useState<string>(() => readFromLocalStorage('cart_discount_code') || '');
    const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(() => {
        const savedDiscount = readFromLocalStorage('cart_applied_discount');
        try {
            return savedDiscount ? JSON.parse(savedDiscount) : null;
        } catch (e) {
            console.error("Failed to parse saved discount", e);
            return null;
        }
    });
    const [isValidatingCode, setIsValidatingCode] = useState(false);

    const { data: userDiscountCodes = [] } = useQuery({
        queryKey: ['user-discounts', user?.id],
        queryFn: () => getUserDiscountCodes(),
        enabled: isRegisteredUser,
    });
    
    const handleRemoveDiscount = useCallback(() => {
        setAppliedDiscount(null);
        setDiscountCode('');
        batchRemoveFromLocalStorage('cart_discount_code');
        batchRemoveFromLocalStorage('cart_applied_discount');
        showSuccess('Discount removed');
    }, []);

    const handleApplyDiscount = useCallback(async (codeToApply?: string, options?: { silent?: boolean }) => {
        const code = (codeToApply || discountCode).trim().toUpperCase();
        if (!code) {
          if (appliedDiscount) handleRemoveDiscount(); // Clear if user erases the code
          return;
        }
      
        setIsValidatingCode(true);
        const result = await validateDiscountCode(code, subtotal);
        setIsValidatingCode(false);
      
        if (result.valid) {
          setAppliedDiscount(result);
          setDiscountCode(code); // Set code state only on success
          batchSaveToLocalStorage('cart_discount_code', code);
          batchSaveToLocalStorage('cart_applied_discount', JSON.stringify(result));
          if(!options?.silent) { showSuccess(result.message || 'Discount applied!'); }
        } else {
          setAppliedDiscount(null);
          batchRemoveFromLocalStorage('cart_applied_discount');
          if(!options?.silent) { showError(result.message || 'Invalid discount code'); }
        }
    }, [discountCode, subtotal, appliedDiscount, handleRemoveDiscount]);
    
    const { 
      isLoaded: isMapsLoaded, 
      loadError: mapsLoadError 
    } = useGoogleMapsLoader();

    useEffect(() => {
        if (mapsLoadError) {
            showError('Could not load map services. Please refresh the page.');
            console.error('Google Maps Load Error:', mapsLoadError);
        }
    }, [mapsLoadError]);

    const deliveryFee = 150;
    const discountAmount = appliedDiscount?.discountAmount || 0;
    const total = subtotal + deliveryFee - discountAmount;

    const baseCartAvailability = useMemo(() => {
        if (isCartLoading || allItems.length === 0) return 'normal';
        return calculateCartAvailability(allItems);
    }, [allItems, isCartLoading]);

    const cartAvailability = useMemo(() => {
        if (!availabilitySettings) return baseCartAvailability;

        if (availabilitySettings.rush_same_to_standard_enabled) {
            if (baseCartAvailability === 'rush' || baseCartAvailability === 'same-day') {
                return 'normal';
            }
        }
        
        if (availabilitySettings.rush_to_same_day_enabled) {
            if (baseCartAvailability === 'rush') {
                return 'same-day';
            }
        }

        return baseCartAvailability;
    }, [baseCartAvailability, availabilitySettings]);

    const availabilityWasOverridden = cartAvailability !== baseCartAvailability;

    const { data: availableDates = [], isLoading: isLoadingDates } = useQuery<AvailableDate[]>({
        queryKey: ['available-dates', availabilitySettings?.minimum_lead_time_days],
        queryFn: () => {
            const startDate = new Date(); // Always start from today
            const year = startDate.getFullYear();
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            const day = String(startDate.getDate()).padStart(2, '0');
            return getAvailableDeliveryDates(`${year}-${month}-${day}`, 30);
        },
        enabled: !isLoadingSettings, // Only run when settings are loaded
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const { data: blockedDatesMap, isLoading: isLoadingBlockedDates } = useQuery({
        queryKey: ['blocked-dates-range'],
        queryFn: () => {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 30);
            
            const format = (d: Date) => d.toISOString().split('T')[0];
    
            return getBlockedDatesInRange(format(startDate), format(endDate));
        },
        staleTime: 5 * 60 * 1000,
    });
    
    // Effect to re-validate discount when cart total changes
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            // On initial load, if a discount code is loaded from localStorage,
            // revalidate it against the current cart total.
            if (discountCode) {
                 handleApplyDiscount(discountCode, { silent: true });
            }
            return;
        }

        // On subsequent subtotal changes, if a code is applied, re-validate it silently.
        if (appliedDiscount) {
            handleApplyDiscount(discountCode, { silent: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subtotal]);

    const correctedDates = useMemo(() => {
        if (isLoadingDates || !availabilitySettings) return availableDates;

        if (cartAvailability === 'normal') {
            return availableDates;
        }
        
        const leadTimeDays = availabilitySettings.minimum_lead_time_days || 0;
        if (leadTimeDays === 0) {
            return availableDates;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return availableDates.map(dateInfo => {
            const date = new Date(dateInfo.available_date + 'T00:00:00');
            const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays < leadTimeDays) {
                const isFullyBlockedByBackend = !dateInfo.is_rush_available && !dateInfo.is_same_day_available && !dateInfo.is_standard_available;
                if (isFullyBlockedByBackend && diffDays > 0) {
                    return { ...dateInfo, is_rush_available: true, is_same_day_available: true };
                }
            }
            return dateInfo;
        });
    }, [availableDates, isLoadingDates, cartAvailability, availabilitySettings]);
    
    const handleDateSelect = useCallback((date: string) => {
        setEventDate(date);
        const blocks = blockedDatesMap?.[date] || [];
        const partials = blocks.filter(b => !b.is_all_day);
        setPartiallyBlockedSlots(partials);
    }, [setEventDate, blockedDatesMap]);

    const getDateStatus = useCallback((dateInfo: AvailableDate) => {
        const date = dateInfo.available_date;
        const blocksOnDate = blockedDatesMap?.[date];
        const isFullyBlocked = blocksOnDate?.some(block => block.is_all_day) ?? false;

        if (isFullyBlocked) {
            return {
                isDisabled: true,
                reason: blocksOnDate?.find(b => b.is_all_day)?.closure_reason || 'Fully Booked / Holiday'
            };
        }

        // Enforce minimum lead time for standard orders based on settings
        if (cartAvailability === 'normal' && availabilitySettings && availabilitySettings.minimum_lead_time_days > 0) {
            const leadTimeDays = availabilitySettings.minimum_lead_time_days;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(dateInfo.available_date + 'T00:00:00');
            const diffDays = Math.ceil((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays < leadTimeDays) {
                const plural = leadTimeDays > 1 ? 's' : '';
                return {
                    isDisabled: true,
                    reason: `Requires a ${leadTimeDays} day${plural} lead time.`
                };
            }
        }

        // Check availability flags from the RPC, but *only* for rush and same-day.
        // The client-side logic above is the source of truth for 'normal' orders.
        let leadTimeDisabledByRpc = false;
        if (cartAvailability === 'rush') {
            leadTimeDisabledByRpc = !dateInfo.is_rush_available;
        } else if (cartAvailability === 'same-day') {
            leadTimeDisabledByRpc = !dateInfo.is_same_day_available;
        }

        if (leadTimeDisabledByRpc) {
            let reason = "Date unavailable for this order's lead time.";
            return { isDisabled: true, reason };
        }

        return { isDisabled: false, reason: null };
    }, [blockedDatesMap, cartAvailability, availabilitySettings]);

    const disabledSlots = useMemo(() => {
        const newDisabledSlots: string[] = [];
        const now = new Date();
        const todayString = now.toISOString().split('T')[0];
        
        if (eventDate === todayString) {
            let readyTime: Date | null = null;
            if (cartAvailability === 'same-day') {
                readyTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // +3 hours
            } else if (cartAvailability === 'rush') {
                readyTime = new Date(now.getTime() + 30 * 60 * 1000); // +30 mins
            }
    
            if (readyTime) {
                EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                    const slotEndDate = new Date(eventDate);
                    slotEndDate.setHours(timeSlot.endHour, 0, 0, 0);
                    if (slotEndDate < readyTime) {
                        newDisabledSlots.push(timeSlot.slot);
                    }
                });
            } else {
                const currentHour = now.getHours();
                EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                    if (timeSlot.endHour <= currentHour) {
                        newDisabledSlots.push(timeSlot.slot);
                    }
                });
            }
        }

        if (partiallyBlockedSlots.length > 0) {
            const parseTime = (timeStr: string): number => parseInt(timeStr.split(':')[0], 10);
    
            partiallyBlockedSlots.forEach(blockedSlot => {
                if (blockedSlot.blocked_time_start && blockedSlot.blocked_time_end) {
                    const blockStartHour = parseTime(blockedSlot.blocked_time_start);
                    const blockEndHour = parseTime(blockedSlot.blocked_time_end);
    
                    EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                        // Check for overlap: (slot.start < block.end) and (slot.end > block.start)
                        if (timeSlot.startHour < blockEndHour && timeSlot.endHour > blockStartHour) {
                            newDisabledSlots.push(timeSlot.slot);
                        }
                    });
                }
            });
        }
        
        return [...new Set(newDisabledSlots)];
    }, [cartAvailability, eventDate, partiallyBlockedSlots]);

    useEffect(() => {
        if (eventTime && disabledSlots.includes(eventTime)) {
            setEventTime('');
        }
    }, [eventTime, disabledSlots, setEventTime]);
    
    useEffect(() => {
        if (isRegisteredUser && !isAddressesLoading) {
            const persistedIdIsValid = savedAddresses.some(addr => addr.address_id === selectedAddressId);
            
            if (persistedIdIsValid) {
                // All good
            } else if (savedAddresses.length > 0) {
                const defaultAddress = savedAddresses.find(addr => addr.is_default);
                setSelectedAddressId(defaultAddress ? defaultAddress.address_id : savedAddresses[0].address_id);
            }
        }
    }, [isRegisteredUser, savedAddresses, isAddressesLoading, selectedAddressId, setSelectedAddressId]);
    
    const selectedAddress = useMemo(() => {
        return isRegisteredUser && selectedAddressId ? savedAddresses.find(a => a.address_id === selectedAddressId) : null;
    }, [isRegisteredUser, selectedAddressId, savedAddresses]);

    const handleNewAddressSuccess = (newAddress?: CakeGenieAddress) => {
        if (newAddress) {
            setSelectedAddressId(newAddress.address_id);
        }
        setIsAddingAddress(false);
    };

    const handleSubmitOrder = async () => {
        if (!isRegisteredUser) {
            showError('Please sign in or create an account to place an order.');
            onAuthRequired();
            return;
        }
        try {
          if (!selectedAddress) {
            showError('Please select a delivery address');
            return;
          }
          if (!eventDate || !eventTime) {
            showError('Please select delivery date and time');
            return;
          }
      
          setIsPlacingOrder(true);
          
          const orderResult = await createOrderFromCart({
            cartItems,
            eventDate,
            eventTime,
            deliveryInstructions,
            deliveryAddressId: selectedAddressId,
            discountAmount: appliedDiscount?.discountAmount,
            discountCodeId: appliedDiscount?.codeId,
          });
      
          if (!orderResult.success || !orderResult.order) {
            throw new Error(orderResult.error?.message || 'Failed to create order');
          }
      
          const orderId = orderResult.order.order_id;
          
          showSuccess('Order created! Redirecting to payment...');
          
          const paymentItems = cartItems.map(item => ({
            name: `${item.cake_type} - ${item.cake_size}`,
            quantity: item.quantity,
            price: item.final_price,
          }));
      
          setIsCreatingPayment(true);
          
          const paymentResult = await createXenditPayment({
            orderId: orderId,
            amount: total,
            customerEmail: user?.email,
            customerName: user?.user_metadata?.first_name || user?.email?.split('@')[0],
            items: paymentItems,
          });
      
          if (paymentResult.success && paymentResult.paymentUrl) {
            clearCart();
            setAppliedDiscount(null);
            setDiscountCode('');
            window.location.href = paymentResult.paymentUrl;
          } else {
            throw new Error(paymentResult.error || 'Failed to create payment link');
          }
      
        } catch (error: any) {
          console.error('Order/Payment error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
          showError(error.message || 'Failed to process order. Please try again.');
          setIsPlacingOrder(false);
          setIsCreatingPayment(false);
        }
    };

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50 disabled:cursor-not-allowed";
    
    const AddressAutocomplete = ({ onPlaceSelect, initialValue }: { onPlaceSelect: (place: any) => void, initialValue: string }) => {
        const inputRef = useRef<HTMLInputElement>(null);
    
        useEffect(() => {
            if (!inputRef.current) return;
    
            const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
                componentRestrictions: { country: "ph" },
                fields: ["address_components", "geometry", "icon", "name"],
            });
    
            autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                onPlaceSelect(place);
            });
        }, [onPlaceSelect]);
    
        return (
            <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                    ref={inputRef}
                    type="text"
                    defaultValue={initialValue}
                    className={`${inputStyle} pl-10`}
                    placeholder="Search for your address..."
                />
            </div>
        );
    };

    return (
        <>
        <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
             <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out; } @keyframes fadeInFast { from { opacity: 0; } to { opacity: 1; } }`}</style>
            
            {zoomedImage && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-fast"
                    onClick={() => setZoomedImage(null)}
                    aria-modal="true"
                    role="dialog"
                >
                    <button
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors z-10"
                        aria-label="Close zoomed image"
                    >
                        <CloseIcon />
                    </button>
                    <img
                        src={zoomedImage}
                        alt="Zoomed cake design"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Your Cart</h1>
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close cart">
                    <CloseIcon />
                </button>
            </div>

            {isCartLoading ? (
                <div className="py-4"><CartSkeleton count={2} /></div>
            ) : allItems.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-500">Your cart is empty.</p>
                    <button onClick={onContinueShopping} className="mt-4 text-purple-600 font-semibold hover:underline">
                        Continue Shopping
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                        {allItems.map(item => (
                            <CartItemCard 
                                key={item.id}
                                item={item}
                                onRemove={onRemoveItem}
                                onZoom={setZoomedImage}
                            />
                        ))}
                    </div>

                    <div className="pt-6 border-t border-slate-200 space-y-6">
                        <h2 className="text-lg font-semibold text-slate-700">Delivery Details</h2>

                        {!isLoadingSettings && (
                            (availabilitySettings && availabilitySettings.minimum_lead_time_days > 0 && cartAvailability === 'normal') ? (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 animate-fade-in">
                                    <strong>Note:</strong> We are observing a minimum lead time of <strong>{availabilitySettings.minimum_lead_time_days} day(s)</strong>. The first available date has been adjusted.
                                </div>
                            ) : availabilityWasOverridden ? (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 animate-fade-in">
                                    <strong>Note:</strong> Due to high demand, availability has been adjusted. Your order will now be processed as a <strong>'{cartAvailability.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}'</strong> order.
                                </div>
                            ) : null
                        )}
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label htmlFor="eventDate" className="block text-sm font-medium text-slate-600 mb-1">Date of Event</label>
                                    {isLoadingDates || isLoadingBlockedDates ? (
                                        <div className="h-16 flex items-center"><Loader2 className="animate-spin text-slate-400"/></div>
                                    ) : (
                                        <div className="relative overflow-visible">
                                            <div className="flex gap-2 overflow-x-auto pt-16 -mt-16 pb-2 -mb-2 scrollbar-hide" style={{ overflowY: 'visible' }}>
                                                {correctedDates.slice(0, 14).map((dateInfo, index) => {
                                                    const { isDisabled, reason } = getDateStatus(dateInfo);
                                                    const isSelected = eventDate === dateInfo.available_date;
                                                    const dateObj = new Date(dateInfo.available_date + 'T00:00:00');
                                                    const day = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
                                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });

                                                    // Determine tooltip position based on index
                                                    const totalDates = correctedDates.slice(0, 14).length;
                                                    let tooltipPositionClass = 'left-1/2 -translate-x-1/2'; // center (default)
                                                    let arrowPositionClass = 'left-1/2 -translate-x-1/2'; // center arrow

                                                    if (index === 0) {
                                                        // First date: align tooltip to left
                                                        tooltipPositionClass = 'left-0';
                                                        arrowPositionClass = 'left-8';
                                                    } else if (index === totalDates - 1) {
                                                        // Last date: align tooltip to right
                                                        tooltipPositionClass = 'right-0';
                                                        arrowPositionClass = 'right-8';
                                                    }

                                                    return (
                                                        <div key={dateInfo.available_date} className="relative flex-shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => !isDisabled && handleDateSelect(dateInfo.available_date)}
                                                                onMouseEnter={() => isDisabled && reason && setTooltip({ date: dateInfo.available_date, reason })}
                                                                onMouseLeave={() => setTooltip(null)}
                                                                className={`w-16 text-center rounded-lg p-2 border-2 transition-all duration-200
                                                                    ${isSelected ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'border-slate-200 bg-white'}
                                                                    ${isDisabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-pink-400'}
                                                                `}
                                                            >
                                                                <span className="block text-xs font-semibold text-slate-500">{month}</span>
                                                                <span className="block text-xl font-bold text-slate-800">{day}</span>
                                                                <span className="block text-[10px] font-medium text-slate-500">{dateInfo.day_of_week.substring(0, 3)}</span>
                                                            </button>
                                                            {tooltip && tooltip.date === dateInfo.available_date && (
                                                                <div className={`absolute bottom-full mb-2 ${tooltipPositionClass} w-max max-w-[200px] px-3 py-1.5 bg-slate-800 text-white text-xs text-center font-semibold rounded-md z-[100] animate-fade-in-fast shadow-lg pointer-events-none whitespace-normal`}>
                                                                    {tooltip.reason}
                                                                    <div className={`absolute ${arrowPositionClass} top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800`}></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="eventTime" className="block text-sm font-medium text-slate-600 mb-1">Time of Event</label>
                                    <div className="relative">
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                            {EVENT_TIME_SLOTS.map(slot => {
                                                const isDisabled = disabledSlots.includes(slot);
                                                const isSelected = eventTime === slot;
                                                return (
                                                    <button
                                                        key={slot}
                                                        type="button"
                                                        onClick={() => !isDisabled && setEventTime(slot)}
                                                        disabled={isDisabled}
                                                        className={`flex-shrink-0 text-center rounded-lg p-2 border-2 transition-all duration-200
                                                            ${isSelected ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'border-slate-200 bg-white'}
                                                            ${isDisabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-pink-400'}
                                                        `}
                                                    >
                                                        <span className="block text-xs font-semibold text-slate-800 px-2">{slot}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {cartAvailability === 'normal' && <p className="text-xs text-slate-500 -mt-2">Your cart items require a 1-day lead time. Order by 3 PM for next-day delivery.</p>}
                            {cartAvailability === 'same-day' && <p className="text-xs text-slate-500 -mt-2">Your cart contains items available for same-day delivery (3-hour lead time).</p>}
                            {cartAvailability === 'rush' && <p className="text-xs text-slate-500 -mt-2">All items in your cart are available for rush delivery (30-min lead time).</p>}

                            
                            {isAddressesLoading ? (
                                <div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
                            ) : isRegisteredUser ? (
                                <>
                                    {savedAddresses.length > 0 && !isAddingAddress && (
                                        <div className="space-y-2">
                                            <div>
                                                <label htmlFor="addressSelect" className="block text-sm font-medium text-slate-600 mb-1">Delivery Address</label>
                                                <select id="addressSelect" value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} className={inputStyle}>
                                                    <option value="" disabled>-- Select a saved address --</option>
                                                    {savedAddresses.map(addr => (
                                                        <option key={addr.address_id} value={addr.address_id}>
                                                            {addr.address_label ? `${addr.address_label} (${addr.street_address})` : addr.street_address}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            {selectedAddress && (
                                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                                                    <p className="font-semibold text-slate-700">{selectedAddress.recipient_name}</p>
                                                    <p className="text-slate-500">{selectedAddress.recipient_phone}</p>
                                                    <p className="text-slate-500 mt-1">{selectedAddress.street_address}</p>
                                                    {selectedAddress.latitude && selectedAddress.longitude && (
                                                        <StaticMap latitude={selectedAddress.latitude} longitude={selectedAddress.longitude} />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isAddingAddress && user ? (
                                        <div className="mt-4">
                                            <AddressForm userId={user.id} onSuccess={handleNewAddressSuccess} onCancel={() => setIsAddingAddress(false)} />
                                        </div>
                                    ) : (
                                        <div className="mt-2">
                                            <button type="button" onClick={() => setIsAddingAddress(true)} className="w-full text-center text-sm font-semibold text-pink-600 hover:text-pink-700 py-2 rounded-lg hover:bg-pink-50 transition-colors">
                                                + Add a New Address
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-4 bg-slate-100 rounded-lg text-center space-y-3">
                                    <div>
                                        <p className="text-sm text-slate-600 font-medium">Please sign in to select or add a delivery address.</p>
                                        <p className="text-xs text-slate-500 mt-1">Your cart will be saved upon login.</p>
                                    </div>
                                    <button 
                                        onClick={onAuthRequired}
                                        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-2 px-6 rounded-full shadow-md hover:shadow-lg transition-all text-sm"
                                    >
                                        Sign In / Create Account
                                    </button>
                                </div>
                            )}
                            
                            <div>
                                <label htmlFor="deliveryInstructions" className="block text-sm font-medium text-slate-600 mb-1">Delivery Instructions (Optional)</label>
                                <textarea id="deliveryInstructions" value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} className={inputStyle} placeholder="e.g., landmark, contact person" rows={2}></textarea>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-200 space-y-4">
                            {/* Discount Code Section */}
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                Have a Discount Code?
                                </h3>

                                {userDiscountCodes.length > 0 && !appliedDiscount && (
                                    <div className="mb-3">
                                        <p className="text-xs text-slate-600 mb-2">Your available codes:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {userDiscountCodes.map(code => (
                                            <button
                                                key={code.code_id}
                                                onClick={() => handleApplyDiscount(code.code)}
                                                className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-pink-100 hover:text-pink-700 border border-slate-200 transition-colors font-mono"
                                            >
                                                {code.code} 
                                                {code.discount_amount && ` (₱${code.discount_amount} off)`}
                                                {code.discount_percentage && ` (${code.discount_percentage}% off)`}
                                            </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!appliedDiscount ? (
                                <div className="flex gap-2">
                                    <input
                                    type="text"
                                    value={discountCode}
                                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                                    placeholder="Enter code"
                                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg uppercase font-mono focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    maxLength={20}
                                    />
                                    <button
                                    onClick={() => handleApplyDiscount()}
                                    disabled={isValidatingCode || !discountCode.trim()}
                                    className="px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                    {isValidatingCode ? <Loader2 className="animate-spin w-4 h-4"/> : 'Apply'}
                                    </button>
                                </div>
                                ) : (
                                <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-green-800">
                                        ✅ Code Applied: <span className="font-mono">{discountCode}</span>
                                        </p>
                                        <p className="text-xs text-green-700 mt-1">
                                        Saving ₱{appliedDiscount.discountAmount?.toFixed(2)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleRemoveDiscount}
                                        className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                                    >
                                        Remove
                                    </button>
                                    </div>
                                </div>
                                )}
                            </div>

                            {/* Price Breakdown with Discount */}
                            <div className="space-y-2 mt-4">
                                <div className="flex justify-between text-sm text-gray-600">
                                <span>Subtotal:</span>
                                <span>₱{subtotal.toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between text-sm text-gray-600">
                                <span>Delivery Fee:</span>
                                <span>₱{deliveryFee.toFixed(2)}</span>
                                </div>

                                {appliedDiscount && (
                                <div className="flex justify-between text-sm text-green-600 font-semibold">
                                    <span>Discount ({discountCode}):</span>
                                    <span>-₱{discountAmount.toFixed(2)}</span>
                                </div>
                                )}

                                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2 mt-2">
                                <span>Total:</span>
                                <span>₱{total.toFixed(2)}</span>
                                </div>
                            </div>
                            
                            <div className="pt-4">
                                <h3 className="text-sm font-semibold text-gray-500 mb-3 text-center">We Accept</h3>
                                <div className="flex flex-wrap gap-2 items-center justify-center">
                                    {paymentMethods.map(method => (
                                        <img key={method.name} src={method.logoUrl} alt={method.name} title={method.name} className="h-10 w-16 object-contain rounded-md bg-white p-1 border border-slate-200 shadow-sm" />
                                    ))}
                                </div>
                            </div>

                            <p className="text-xs text-center text-slate-500 pt-1">
                                For the safety of your cake, all deliveries are made via <strong>Lalamove Car</strong> to ensure it arrives in perfect condition.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button onClick={onContinueShopping} className="w-full text-center bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-base">
                                    Continue Shopping
                                </button>
                                <button
                                    onClick={handleSubmitOrder}
                                    disabled={isPlacingOrder || isCreatingPayment || !selectedAddress || !eventDate || !eventTime}
                                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-full font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isCreatingPayment ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Redirecting to Payment...
                                    </span>
                                    ) : isPlacingOrder ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating Order...
                                    </span>
                                    ) : (
                                    `Place Order - ₱${total.toFixed(2)}`
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

export default React.memo(CartPage);
```

## File: src/app/api/bux/webhook/route.ts

```ts

```

## File: src/app/api/bux/create-payment/route.ts

```ts

```

## File: src/app/account/addresses/page.tsx

```tsx


'use client';

import React, { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { showSuccess, showError } from '../../../lib/utils/toast';
import { CakeGenieAddress } from '../../../lib/database.types';
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '../../../hooks/useAddresses';
import { Loader2, Trash2, Plus, MapPin, Star, Home, Building2, ArrowLeft, Pencil } from 'lucide-react';
import { AddressesSkeleton, Skeleton } from '../../../components/LoadingSkeletons';
import { GOOGLE_MAPS_API_KEY } from '../../../config';
import AddressForm, { StaticMap } from '../../../components/AddressForm';


// --- Address Card Component ---
interface AddressCardProps {
  address: CakeGenieAddress;
  onSetDefault: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isDeleting: boolean;
  isSettingDefault: boolean;
}

const AddressCard: React.FC<AddressCardProps> = ({ address, onSetDefault, onDelete, onEdit, isDeleting, isSettingDefault }) => {
  const isDefault = address.is_default;
  const cardId = `address-card-${address.address_id}`;

  return (
    <div
      id={cardId}
      className={`relative p-5 bg-white rounded-xl border-2 transition-all duration-300 ${isDefault ? 'border-pink-500 shadow-lg' : 'border-slate-200'}`}
    >
      {isDefault && (
        <div className="absolute -top-3 -right-3 flex items-center bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          <Star className="w-3 h-3 mr-1.5" fill="currentColor" />
          DEFAULT
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
            {address.address_label?.toLowerCase() === 'home' ? <Home className="w-6 h-6 text-slate-400" /> :
             address.address_label?.toLowerCase() === 'work' ? <Building2 className="w-6 h-6 text-slate-400" /> :
             <MapPin className="w-6 h-6 text-slate-400" />}
        </div>
        <div className="flex-grow">
          {address.address_label && <p className="text-sm font-bold text-slate-800">{address.address_label}</p>}
          <p className="text-sm font-semibold text-slate-600 mt-1">{address.recipient_name} &middot; {address.recipient_phone}</p>
          <p className="text-xs text-slate-500 mt-1">{address.street_address}</p>
          {address.landmark && <p className="text-xs text-slate-500 mt-1">Landmark: {address.landmark}</p>}
        </div>
      </div>
      {address.latitude && address.longitude && (
        <StaticMap latitude={address.latitude} longitude={address.longitude} />
      )}
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
        <button
            onClick={onEdit}
            className="flex items-center justify-center text-xs font-semibold text-slate-600 hover:text-pink-600 disabled:opacity-50 transition-colors px-3 py-1.5"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
        </button>
        {!isDefault && (
          <button
            onClick={onSetDefault}
            disabled={isSettingDefault}
            className="flex items-center justify-center text-xs font-semibold text-slate-600 hover:text-pink-600 disabled:opacity-50 transition-colors px-3 py-1.5"
          >
             {isSettingDefault ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
            Set as Default
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex items-center justify-center text-xs font-semibold text-slate-600 hover:text-red-600 disabled:opacity-50 transition-colors px-3 py-1.5"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
          Delete
        </button>
      </div>
    </div>
  );
};


// --- Main Page Component ---
interface AddressesPageProps {
  onClose: () => void;
}

export default function AddressesPage({ onClose }: AddressesPageProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: addresses = [], isLoading: dataLoading, error } = useAddresses(user?.id);
  
  const deleteAddressMutation = useDeleteAddress();
  const setDefaultAddressMutation = useSetDefaultAddress();
  
  const [formState, setFormState] = useState<{ mode: 'add' | 'edit'; address?: CakeGenieAddress } | null>(null);
  
  useEffect(() => {
    if (error) {
        showError(error instanceof Error ? error.message : "Could not fetch addresses.");
    }
  }, [error]);

  const handleSetDefault = (addressId: string) => {
    if (!user) return;
    setDefaultAddressMutation.mutate({ userId: user.id, addressId }, {
        onSuccess: () => showSuccess("Default address updated."),
        onError: () => showError("Failed to set default address."),
    });
  };

  const handleDelete = (addressId: string) => {
    if (!user) return;
    deleteAddressMutation.mutate({ userId: user.id, addressId }, {
        onSuccess: () => showSuccess("Address deleted."),
        onError: () => showError("Failed to delete address."),
    });
  };
  
  const handleFormSuccess = () => {
      setFormState(null);
  };
  
  const pageIsLoading = authLoading || (dataLoading && !addresses.length);

  if (pageIsLoading) {
    return (
        <div className="w-full max-w-3xl mx-auto py-8 px-4">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
            <AddressesSkeleton count={2} />
        </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-3xl mx-auto py-8 px-4 text-center">
        <p className="text-slate-600">You must be logged in to manage your addresses.</p>
        <button onClick={onClose} className="mt-4 text-pink-600 font-semibold hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                <ArrowLeft />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text whitespace-nowrap">My Addresses</h1>
        </div>
        {formState === null && (
            <button
                onClick={() => setFormState({ mode: 'add' })}
                className="flex items-center justify-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm flex-shrink-0"
            >
                <Plus className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">Add Address</span>
            </button>
        )}
      </div>

      {formState !== null ? (
        <AddressForm 
            userId={user.id} 
            initialData={formState.mode === 'edit' ? formState.address : undefined}
            onSuccess={handleFormSuccess} 
            onCancel={() => setFormState(null)} 
        />
      ) : (
        <div className="space-y-4">
          {addresses.length > 0 ? (
            addresses.map(addr => (
              <AddressCard
                key={addr.address_id}
                address={addr}
                onSetDefault={() => handleSetDefault(addr.address_id)}
                onDelete={() => handleDelete(addr.address_id)}
                onEdit={() => setFormState({ mode: 'edit', address: addr })}
                isDeleting={deleteAddressMutation.isPending && deleteAddressMutation.variables?.addressId === addr.address_id}
                isSettingDefault={setDefaultAddressMutation.isPending && setDefaultAddressMutation.variables?.addressId === addr.address_id}
              />
            ))
          ) : (
            <div className="text-center py-16 bg-white/50 rounded-2xl">
                <MapPin className="w-12 h-12 mx-auto text-slate-400" />
                <p className="text-slate-500 mt-4">You haven't added any addresses yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

```

## File: src/app/account/orders/page.tsx

```tsx
'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { showSuccess, showError } from '../../../lib/utils/toast';
import { CakeGenieOrder, CakeGenieOrderItem, PaymentStatus, OrderStatus } from '../../../lib/database.types';
import { useOrders, useUploadPaymentProof, useOrderDetails, useCancelOrder } from '../../../hooks/useOrders';
import { Loader2, ArrowLeft, ChevronDown, Package, Clock, CreditCard, CheckCircle, UploadCloud, Trash2, X } from 'lucide-react';
import { OrdersSkeleton, Skeleton } from '../../../components/LoadingSkeletons';
import { ImageZoomModal } from '../../../components/ImageZoomModal';
import DetailItem from '../../../components/UI/DetailItem';
import LazyImage from '../../../components/LazyImage';
import BillShareCard from '../../../components/BillShareCard';

interface EnrichedOrder extends CakeGenieOrder {
  cakegenie_order_items?: any[]; // Can be items or count object
  cakegenie_addresses?: any;
}

// Combined type for the unified list
type CreationItem = (EnrichedOrder & { type: 'order' }) | (any & { type: 'bill_sharing' });

// --- Status Badge Component ---
const statusStyles: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  ready_for_delivery: "bg-purple-100 text-purple-800",
  out_for_delivery: "bg-cyan-100 text-cyan-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
    pending: "bg-orange-100 text-orange-800",
    verifying: "bg-purple-100 text-purple-800",
    paid: "bg-green-100 text-green-800",
    partial: "bg-blue-100 text-blue-800",
    refunded: "bg-gray-100 text-gray-800",
    failed: "bg-red-100 text-red-800"
};

const orderStatusTextMap: Partial<Record<OrderStatus, string>> = {
  pending: "Order Pending",
  confirmed: "Order Confirmed",
  in_progress: "In Progress",
  ready_for_delivery: "Ready for Delivery",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const paymentStatusTextMap: Partial<Record<PaymentStatus, string>> = {
  pending: "Payment Pending",
  verifying: "Payment Verifying",
  paid: "Paid",
  partial: "Partial Payment",
  refunded: "Refunded",
  failed: "Payment Failed",
};

const StatusBadge: React.FC<{ status: OrderStatus | PaymentStatus; type: 'order' | 'payment' }> = ({ status, type }) => {
    const styles = type === 'order' ? statusStyles : paymentStatusStyles;
    let text: string;

    if (type === 'order' && orderStatusTextMap[status as OrderStatus]) {
        text = orderStatusTextMap[status as OrderStatus]!;
    } else if (type === 'payment' && paymentStatusTextMap[status as PaymentStatus]) {
        text = paymentStatusTextMap[status as PaymentStatus]!;
    } else {
        text = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
            {text}
        </span>
    );
};

// --- Payment Upload Form ---
const PaymentUploadForm: React.FC<{ order: EnrichedOrder; onUploadSuccess: (updatedOrder: CakeGenieOrder) => void }> = ({ order, onUploadSuccess }) => {
    const { user } = useAuth();
    const uploadMutation = useUploadPaymentProof();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
                showError("File is too large. Maximum size is 5MB.");
                return;
            }
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!file || !user) {
            showError("Please select a file to upload.");
            return;
        }
        uploadMutation.mutate({ orderId: order.order_id, userId: user.id, file }, {
            onSuccess: (updatedOrder) => {
                showSuccess("Payment proof uploaded successfully!");
                if (updatedOrder) {
                    onUploadSuccess(updatedOrder);
                }
            },
            onError: (err: any) => {
                showError(err.message || "Failed to upload payment proof.");
            }
        });
    };

    return (
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-800">Upload Payment Proof (Manual)</h4>
            <p className="text-xs text-slate-500 mt-1">For manual bank transfers, submit a clear image of your receipt.</p>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                <div className="flex items-center gap-4">
                    <label htmlFor={`file-upload-${order.order_id}`} className="flex-grow cursor-pointer">
                        <div className="flex items-center justify-center w-full px-4 py-3 text-sm text-slate-600 bg-white border-2 border-dashed border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">
                            <UploadCloud className="w-5 h-5 mr-2 text-slate-400" />
                            <span>{file ? file.name : 'Choose a file...'}</span>
                        </div>
                        <input id={`file-upload-${order.order_id}`} type="file" className="hidden" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleFileChange} />
                    </label>
                    {preview && <LazyImage src={preview} alt="Preview" className="w-12 h-12 object-cover rounded-md" />}
                </div>
                <button type="submit" disabled={!file || uploadMutation.isPending} className="w-full flex justify-center items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-all text-sm disabled:opacity-50">
                    {uploadMutation.isPending ? <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Submitting...</> : 'Submit Proof'}
                </button>
            </form>
        </div>
    );
};


// --- Order Details Expansion ---
const OrderDetails: React.FC<{ order: EnrichedOrder; onOrderUpdate: (updatedOrder: EnrichedOrder) => void; }> = ({ order, onOrderUpdate }) => {
    const { user } = useAuth();
    const { data: details, isLoading } = useOrderDetails(order.order_id, user?.id, true);
    const [zoomedItem, setZoomedItem] = useState<CakeGenieOrderItem | null>(null);

    if (isLoading) {
        return <div className="p-4"><Skeleton className="h-24 w-full" /></div>;
    }

    if (!details) {
        return <div className="p-4 text-center text-sm text-red-600">Could not load order details.</div>;
    }
    
    const deliveryDate = new Date(details.delivery_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const colorLabelMap: Record<string, string> = {
        side: 'Side', top: 'Top', borderTop: 'Top Border', borderBase: 'Base Border', drip: 'Drip', gumpasteBaseBoardColor: 'Base Board'
    };

    return (
        <>
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Items</h4>
                    <div className="space-y-4">
                        {details.cakegenie_order_items?.map(item => {
                            const details = item.customization_details;
                            const tierLabels = details.flavors.length === 2 
                                ? ['Top Tier', 'Bottom Tier'] 
                                : details.flavors.length === 3
                                ? ['Top Tier', 'Middle Tier', 'Bottom Tier']
                                : ['Flavor'];
                            
                            return (
                                <div key={item.item_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => setZoomedItem(item)}
                                            className="w-24 h-24 flex-shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-transform hover:scale-105"
                                            aria-label="Enlarge cake image"
                                        >
                                            <LazyImage src={item.customized_image_url} alt={item.cake_type} className="w-full h-full object-cover" />
                                        </button>
                                        <div className="flex-grow">
                                            <p className="font-semibold text-slate-800">{item.cake_type}</p>
                                            <p className="text-sm text-slate-500">{item.cake_size}</p>
                                            <p className="text-lg font-bold text-pink-600 mt-1">₱{item.final_price.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    {details && (
                                        <details className="mt-3">
                                            <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                                            <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                                                <DetailItem label="Type" value={`${item.cake_type}, ${item.cake_thickness}, ${item.cake_size}`} />
                                                {details.flavors.length <= 1 ? (
                                                    <DetailItem label="Flavor" value={details.flavors[0] || 'N/A'} />
                                                ) : (
                                                    details.flavors.map((flavor, idx) => (
                                                        <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                                                    ))
                                                )}
                                                {details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={details.mainToppers.map(t => t.description).join(', ')} />}
                                                {details.supportElements.length > 0 && <DetailItem label="Support" value={details.supportElements.map(s => s.description).join(', ')} />}
                                                {details.cakeMessages.map((msg, idx) => (
                                                    <DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />
                                                ))}
                                                {details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                                                {details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                                                {Object.entries(details.icingDesign.colors).map(([loc, color]) => (
                                                    <DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />
                                                ))}
                                                {details.additionalInstructions && <DetailItem label="Instructions" value={details.additionalInstructions} />}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div>
                     <h4 className="text-sm font-semibold text-slate-800 mb-2">Delivery Details</h4>
                     <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                        <p><span className="font-semibold text-slate-600">Date:</span> {deliveryDate} ({details.delivery_time_slot})</p>
                        {details.cakegenie_addresses && (
                            <>
                                <p><span className="font-semibold text-slate-600">To:</span> {details.cakegenie_addresses.recipient_name}</p>
                                <p className="text-slate-500">{`${details.cakegenie_addresses.street_address}, ${details.cakegenie_addresses.barangay}, ${details.cakegenie_addresses.city}`}</p>
                            </>
                        )}
                     </div>
                </div>
                
                {details.payment_status === 'pending' && (
                    <PaymentUploadForm order={details} onUploadSuccess={onOrderUpdate} />
                )}

                {details.payment_status === 'verifying' && (
                    <div className="p-3 text-center bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                        <CheckCircle className="w-5 h-5 mx-auto mb-1 text-blue-600"/>
                        <p className="font-semibold">Payment proof submitted.</p>
                        <p>We are currently reviewing your payment. Please wait for confirmation.</p>
                    </div>
                )}
                {details.payment_proof_url && details.payment_status !== 'pending' && (
                   <a href={details.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-600 hover:underline text-center block mt-2">View Submitted Proof</a>
                )}
            </div>
             <ImageZoomModal
                isOpen={!!zoomedItem}
                onClose={() => setZoomedItem(null)}
                originalImage={zoomedItem?.original_image_url || null}
                customizedImage={zoomedItem?.customized_image_url || null}
            />
        </>
    );
};


// --- Order Card Component ---
interface OrderCardProps {
    order: EnrichedOrder;
    onOrderUpdate: (updatedOrder: EnrichedOrder) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onOrderUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { user } = useAuth();
    const cancelMutation = useCancelOrder();
    
    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // The query now returns the full items array, so we use .length for the count.
    const itemCount = order.cakegenie_order_items?.length ?? 0;

    const handleCancelOrder = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) {
            showError("You must be logged in to cancel orders.");
            return;
        }
        
        cancelMutation.mutate({ orderId: order.order_id, userId: user.id }, {
            onSuccess: (updatedOrder) => {
                if (updatedOrder) {
                    onOrderUpdate(updatedOrder as EnrichedOrder);
                }
            }
        });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-mono text-sm font-bold text-slate-800">#{order.order_number}</p>
                        <p className="text-xs text-slate-500 mt-1">Placed on {orderDate}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-pink-600">₱{order.total_amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">{itemCount} item(s)</p>
                    </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <StatusBadge status={order.order_status} type="order" />
                            <StatusBadge status={order.payment_status} type="payment" />
                        </div>
                        <div className="flex items-center gap-3">
                            {order.order_status === 'pending' && (
                                <button
                                    onClick={handleCancelOrder}
                                    disabled={cancelMutation.isPending}
                                    title="Cancel Order"
                                    type="button"
                                    className="p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {cancelMutation.isPending && cancelMutation.variables?.orderId === order.order_id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="hidden sm:inline">Cancelling...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" />
                                            <span className="hidden sm:inline">Cancel</span>
                                        </>
                                    )}
                                </button>
                            )}
                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-200 animate-fade-in">
                    <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                    <OrderDetails order={order} onOrderUpdate={onOrderUpdate} />
                </div>
            )}
        </div>
    );
};


// --- Main Page Component ---
interface OrdersPageProps {
  onClose: () => void;
}

export default function OrdersPage({ onClose }: OrdersPageProps) {
    const { user, loading: authLoading } = useAuth();
    const userId = user?.id;
    const [currentPage, setCurrentPage] = useState(1);
    const [allOrders, setAllOrders] = useState<EnrichedOrder[]>([]);
    const [billShareDesigns, setBillShareDesigns] = useState<any[]>([]);
    const ORDERS_PER_PAGE = 5;

    const { data: pageData, isLoading: pageLoading, isFetching, error } = useOrders(userId, {
        limit: ORDERS_PER_PAGE,
        offset: (currentPage - 1) * ORDERS_PER_PAGE,
        includeItems: true,
    });

    useEffect(() => {
        if (error) {
            showError(error instanceof Error ? error.message : "Could not fetch your orders.");
        }
    }, [error]);

    const totalOrderCount = pageData?.totalOrderCount || 0;
    const totalItemCount = (pageData?.totalOrderCount || 0) + (pageData?.designs?.length || 0);
    
    useEffect(() => {
        if (pageData) {
            if (currentPage === 1) {
                setAllOrders(pageData.orders);
                setBillShareDesigns(pageData.designs); // Only set designs on first page load
            } else {
                setAllOrders(prevOrders => {
                    const existingOrderIds = new Set(prevOrders.map(o => o.order_id));
                    const newOrders = pageData.orders.filter(o => !existingOrderIds.has(o.order_id));
                    return [...prevOrders, ...newOrders];
                });
            }
        }
    }, [pageData, currentPage]);
    
    const combinedItems = useMemo<CreationItem[]>(() => {
      const ordersWithType: CreationItem[] = allOrders.map(o => ({ ...o, type: 'order' }));
      const designsWithType: CreationItem[] = billShareDesigns.map(d => ({ ...d, type: 'bill_sharing' }));
      return [...ordersWithType, ...designsWithType].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [allOrders, billShareDesigns]);
    
    useEffect(() => {
        setCurrentPage(1);
        setAllOrders([]);
        setBillShareDesigns([]);
    }, [userId]);

    const handleLoadMore = () => {
        if (!isFetching && allOrders.length < totalOrderCount) {
            setCurrentPage(p => p + 1);
        }
    };

    const handleOrderUpdate = useCallback((updatedOrder: EnrichedOrder) => {
        setAllOrders(currentOrders => 
            currentOrders.map(order => 
                order.order_id === updatedOrder.order_id ? { ...order, ...updatedOrder } : order
            )
        );
    }, []);

    const handleDesignUpdate = useCallback((updatedDesign: any) => {
      setBillShareDesigns(currentDesigns =>
        currentDesigns.map(design =>
          design.design_id === updatedDesign.design_id ? { ...design, ...updatedDesign } : design
        )
      );
    }, []);
    
    const initialLoading = authLoading || (pageLoading && combinedItems.length === 0);

    if (initialLoading) {
        return (
            <div className="w-full max-w-3xl mx-auto py-8 px-4">
                <div className="flex items-center gap-4 mb-6">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-40" />
                </div>
                <OrdersSkeleton count={3} />
            </div>
        );
    }
    
    if (!user) {
        return (
            <div className="w-full max-w-3xl mx-auto py-8 px-4 text-center">
                <p className="text-slate-600">You must be logged in to view your orders.</p>
                <button onClick={onClose} className="mt-4 text-pink-600 font-semibold hover:underline">Go Back</button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto py-8 px-4">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">My Orders</h1>
            </div>

            <div className="space-y-4">
                {combinedItems.length > 0 ? (
                    combinedItems.map(item => {
                        if (item.type === 'order') {
                            return <OrderCard key={item.order_id} order={item} onOrderUpdate={handleOrderUpdate} />;
                        }
                        if (item.type === 'bill_sharing') {
                            return <BillShareCard key={item.design_id} design={item} onDesignUpdate={handleDesignUpdate} />;
                        }
                        return null;
                    })
                ) : (
                    <div className="text-center py-16 bg-white/50 rounded-2xl">
                        <Package className="w-12 h-12 mx-auto text-slate-400" />
                        <p className="text-slate-500 mt-4">You haven't placed any orders or created any designs yet.</p>
                        <button onClick={onClose} className="mt-4 text-pink-600 font-semibold hover:underline">Start Designing</button>
                    </div>
                )}
            </div>
            
            <div className="mt-6 text-center">
                 <p className="text-sm text-slate-500 mb-4">Showing {combinedItems.length} of {totalItemCount} items.</p>
                 {allOrders.length < totalOrderCount && (
                    <button
                        onClick={handleLoadMore}
                        disabled={isFetching}
                        className="flex items-center justify-center mx-auto bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-75"
                    >
                        {isFetching ? (
                            <>
                                <Loader2 className="animate-spin mr-2 w-4 h-4" />
                                Loading...
                            </>
                        ) : (
                            'Load More Orders'
                        )}
                    </button>
                 )}
            </div>

        </div>
    );
}
```

## File: src/app/account/orders/auth/callback/route.ts

```ts

```

## File: src/app/(auth)/AuthPage.tsx

```tsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { showSuccess, showError } from '../../lib/utils/toast';
import { BackIcon, Loader2 } from '../../components/icons';
import { getSupabaseClient } from '../../lib/supabase/client';

const supabase = getSupabaseClient();

interface AuthPageProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onClose, onSuccess }) => {
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const { signIn, signUp } = useAuth();
  
  // --- Login Form State ---
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingLogin(true);
    
    try {
      // Get current anonymous user ID BEFORE logging in
      const { data: { user: anonymousUser } } = await supabase.auth.getUser();
      const anonymousUserId = anonymousUser?.id;
      const wasAnonymous = anonymousUser?.is_anonymous || false;
      
      // Perform login
      const { data, error } = await signIn({ 
        email: emailLogin, 
        password: passwordLogin 
      });
      
      if (error) throw error;
      
      // If user was anonymous and had a session, merge their cart
      if (wasAnonymous && anonymousUserId && data.user) {
        // Import the merge function
        const { mergeAnonymousCartToUser } = await import('../../services/supabaseService');
        
        const mergeResult = await mergeAnonymousCartToUser(anonymousUserId, data.user.id);
        
        if (mergeResult.success) {
          showSuccess('Welcome back! Your cart has been restored.');
        } else {
          showSuccess('Welcome back!');
        }
      } else {
        showSuccess('Welcome back!');
      }
      
      onSuccess();
    } catch (error: any) {
      showError(error.message || 'An unknown error occurred.');
    } finally {
      setLoadingLogin(false);
    }
  };

  // --- SignUp Form State ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailSignUp, setEmailSignUp] = useState('');
  const [passwordSignUp, setPasswordSignUp] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingSignUp, setLoadingSignUp] = useState(false);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (passwordSignUp !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }
    
    setLoadingSignUp(true);
    try {
      const { data, error } = await signUp({
        email: emailSignUp,
        password: passwordSignUp
      }, {
        first_name: firstName,
        last_name: lastName
      });
      if (error) throw error;
      showSuccess('Account created successfully! Please check your email to verify your account.');
      onSuccess();
    } catch (error: any) {
      showError(error.message || 'An unknown error occurred.');
    } finally {
      setLoadingSignUp(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-6 left-6 p-2 rounded-full bg-white/80 backdrop-blur hover:bg-white transition-colors shadow-md z-10"
        aria-label="Go back"
      >
        <BackIcon className="w-6 h-6 text-gray-700" />
      </button>

      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mb-6">
          {authTab === 'login' ? 'Welcome Back!' : 'Create Account'}
        </h2>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setAuthTab('login')}
            className={`flex-1 py-2 rounded-md font-medium transition-all ${
              authTab === 'login'
                ? 'bg-white shadow text-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setAuthTab('signup')}
            className={`flex-1 py-2 rounded-md font-medium transition-all ${
              authTab === 'signup'
                ? 'bg-white shadow text-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Login Form */}
        {authTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loadingLogin}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingLogin ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>
        )}

        {/* Signup Form */}
        {authTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={emailSignUp}
                onChange={(e) => setEmailSignUp(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={passwordSignUp}
                onChange={(e) => setPasswordSignUp(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loadingSignUp}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingSignUp ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
```

## File: src/app/(auth)/signup/page.tsx

```tsx

```

## File: src/app/(auth)/login/page.tsx

```tsx

```

## File: src/app/reviews/page.tsx

```tsx
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useCanonicalUrl } from '../../hooks';

interface ReviewsPageProps {
  onClose: () => void;
}

const ReviewsPage: React.FC<ReviewsPageProps> = ({ onClose }) => {
  // Add canonical URL for SEO
  useCanonicalUrl('/reviews');
  
  return (
    <div className="w-full max-w-3xl mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Reviews</h1>
      </div>
      <div className="space-y-4 text-slate-600">
        <p>See what our customers are saying about us! This section will soon feature testimonials and reviews from our happy clients.</p>
        <p>Your feedback is important to us and helps us grow. Thank you for your support!</p>
        <p className="italic text-slate-500 mt-6">(Content for this page is coming soon.)</p>
      </div>
    </div>
  );
};

export default ReviewsPage;

```

## File: src/constants/searchKeywords.ts

```ts
// ============================================================================
// COMPREHENSIVE CAKE SEARCH KEYWORDS DATABASE
// Updated: 2024-2025 Trends
// Total: 500+ Keywords
// ============================================================================

export const CAKE_SEARCH_KEYWORDS = [
  
  // ========== OCCASIONS (Most Popular) ==========
  'birthday cake',
  'wedding cake',
  'anniversary cake',
  'graduation cake',
  'baby shower cake',
  'bridal shower cake',
  'retirement cake',
  'engagement cake',
  'christening cake',
  'baptism cake',
  'first communion cake',
  'confirmation cake',
  'gender reveal cake',
  
  // ========== POPULAR CHARACTERS & CLASSIC THEMES ==========
  'unicorn cake',
  'dinosaur cake',
  'princess cake',
  'spiderman cake',
  'batman cake',
  'frozen cake',
  'elsa cake',
  'anna cake',
  'paw patrol cake',
  'cocomelon cake',
  'minecraft cake',
  'roblox cake',
  'among us cake',
  'pokemon cake',
  'pikachu cake',
  'hello kitty cake',
  'barbie cake',
  'disney princess cake',
  'avengers cake',
  'iron man cake',
  'captain america cake',
  'hulk cake',
  'mermaid cake',
  'fairy cake',
  'superhero cake',
  'mickey mouse cake',
  'minnie mouse cake',
  'peppa pig cake',
  'bluey cake',
  
  // ========== ANIME & MANGA ==========
  'naruto cake',
  'luffy cake',
  'one piece cake',
  'goku cake',
  'dragon ball cake',
  'demon slayer cake',
  'tanjiro cake',
  'nezuko cake',
  'jujutsu kaisen cake',
  'gojo cake',
  'sukuna cake',
  'attack on titan cake',
  'spy family cake',
  'anya cake',
  'my hero academia cake',
  'deku cake',
  'sailor moon cake',
  'totoro cake',
  'ghibli cake',
  'spirited away cake',
  'hunter x hunter cake',
  'haikyuu cake',
  'tokyo ghoul cake',
  'My Neighbor Totoro cake',
  'No Face cake',
  
  // ========== VIDEO GAMES ==========
  'fortnite cake',
  'call of duty cake',
  'valorant cake',
  'apex legends cake',
  'overwatch cake',
  'league of legends cake',
  'genshin impact cake',
  'sonic cake',
  'mario cake',
  'zelda cake',
  'animal crossing cake',
  'splatoon cake',
  'gaming cake',
  'video game cake',
  
  // ========== MUSIC & CELEBRITIES ==========
  'taylor swift cake',
  'eras tour cake',
  'swiftie cake',
  'beyonce cake',
  'ariana grande cake',
  'billie eilish cake',
  'olivia rodrigo cake',
  'sabrina carpenter cake',
  'bad bunny cake',
  'drake cake',
  'the weeknd cake',
  'bruno mars cake',
  'post malone cake',
  'travis scott cake',
  'music note cake',
  'record player cake',
  'vinyl cake',
  'microphone cake',
  'concert cake',
  'festival cake',
  'rock band cake',
  'music cake',
  'guitar cake',
  'piano cake',
  
  // ========== K-POP ==========
  'bts cake',
  'bangtan cake',
  'blackpink cake',
  'twice cake',
  'stray kids cake',
  'seventeen cake',
  'txt cake',
  'enhypen cake',
  'ateez cake',
  'nct cake',
  'exo cake',
  'newjeans cake',
  'aespa cake',
  'itzy cake',
  'red velvet cake design',
  'le sserafim cake',
  'jimin cake',
  'jungkook cake',
  'v cake',
  'rm cake',
  'jin cake',
  'suga cake',
  'jhope cake',
  'kpop cake',
  'kpop birthday cake',
  'lightstick cake',
  'finger heart cake',
  'ARMY cake',
  'BT21 cake',
  'borahae cake',
  'purple whale cake',
  'Blink cake',
  'black and pink cake',
  'SKZ cake',
  'SKZOO cake',
  'sajaboys cake',
  'ATINY cake',
  'Carat cake',
  'NewJeans bunny cake',
  'kpop demon hunter cake',
  'dark concept kpop cake',
  'fantasy kpop cake',
  'Dreamcatcher cake',
  'photocard cake',
  
  // ========== SPORTS ==========
  'football cake',
  'soccer cake',
  'basketball cake',
  'baseball cake',
  'nfl cake',
  'football team cake',
  'patriots cake',
  'cowboys cake',
  'chiefs cake',
  'lakers cake',
  'warriors cake',
  'bulls cake',
  'yankees cake',
  'dodgers cake',
  'red sox cake',
  'real madrid cake',
  'barcelona cake',
  'manchester united cake',
  'formula 1 cake',
  'f1 cake',
  'nascar cake',
  'ufc cake',
  'mma cake',
  'wrestling cake',
  'wwe cake',
  'cricket cake',
  'tennis cake',
  'golf cake',
  'hole in one cake',
  'hockey cake',
  'volleyball cake',
  'rugby cake',
  'boxing cake',
  'skateboard cake',
  'bmx cake',
  'surfing cake',
  'snowboard cake',
  
  // ========== TRAVEL & DESTINATIONS ==========
  'eiffel tower cake',
  'paris cake',
  'new york cake',
  'statue of liberty cake',
  'london cake',
  'big ben cake',
  'tokyo cake',
  'dubai cake',
  'burj khalifa cake',
  'las vegas cake',
  'hollywood cake',
  'beach cake',
  'tropical cake',
  'island cake',
  'mountain cake',
  'passport cake',
  'airplane cake',
  'plane cake',
  'luggage cake',
  'suitcase cake',
  'world map cake',
  'globe cake',
  'cruise ship cake',
  'hot air balloon cake',
  'travel cake',
  'adventure cake',
  
  // ========== BRANDS & LOGOS ==========
  'chanel cake',
  'gucci cake',
  'louis vuitton cake',
  'prada cake',
  'versace cake',
  'tiffany cake',
  'tiffany blue cake',
  'dior cake',
  'hermes cake',
  'starbucks cake',
  'mcdonalds cake',
  'coca cola cake',
  'pepsi cake',
  'dunkin cake',
  'krispy kreme cake',
  'in n out cake',
  'apple cake',
  'iphone cake',
  'nike cake',
  'adidas cake',
  'supreme cake',
  'tesla cake',
  'amazon cake',
  
  // ========== YOUTUBERS & INFLUENCERS ==========
  'mrbeast cake',
  'pewdiepie cake',
  'markiplier cake',
  'jacksepticeye cake',
  'dude perfect cake',
  'preston cake',
  'aphmau cake',
  'sssniperwolf cake',
  'dantdm cake',
  'ishowspeed cake',
  'ninja cake',
  'pokimane cake',
  'valkyrae cake',
  'dream cake',
  'technoblade cake',
  'tommyinnit cake',
  
  // ========== TV SHOWS & MOVIES ==========
  'wednesday cake',
  'wednesday addams cake',
  'stranger things cake',
  'the bear cake',
  'squid game cake',
  'bridgerton cake',
  'house of dragon cake',
  'the last of us cake',
  'succession cake',
  'yellowstone cake',
  'euphoria cake',
  'encanto cake',
  'moana cake',
  'turning red cake',
  'elemental cake',
  'wish cake',
  'inside out cake',
  'star wars cake',
  'harry potter cake',
  'hogwarts cake',
  'lord of the rings cake',
  'game of thrones cake',
  'marvel cake',
  'dc comics cake',
  'disney villain cake',
  'movie theme cake',
  'Barbie movie cake',
  'Golden Snitch cake',
  'Gryffindor cake',
  'Captain America shield cake',
  'Darth Vader cake',
  'Baby Yoda cake',
  'lightsaber cake',
  'Up movie cake',
  'Dune cake',
  'sandworm cake',
  'Netflix cake',
  'Hellfire Club cake',
  'Upside Down cake',
  'Eggo waffle cake',
  'Nevermore cake',
  'wisteria cake',
  'dalgona candy cake',
  'Money Heist cake',
  'La Casa de Papel cake',
  'The Queen\'s Gambit cake',
  'chessboard cake',
  'Disney cake',
  
  // ========== AGE-SPECIFIC ==========
  'baby cake',
  'kids cake',
  'toddler cake',
  'teenager cake',
  'adult birthday cake',
  '1st birthday cake',
  '18th birthday cake',
  '21st birthday cake',
  '30th birthday cake',
  '40th birthday cake',
  '50th birthday cake',
  
  // ========== ANIMALS ==========
  'cat cake',
  'dog cake',
  'puppy cake',
  'kitten cake',
  'bunny cake',
  'rabbit cake',
  'elephant cake',
  'lion cake',
  'tiger cake',
  'panda cake',
  'bear cake',
  'butterfly cake',
  'ladybug cake',
  
  // ========== STYLES & AESTHETICS ==========
  'simple cake',
  'elegant cake',
  'minimalist cake',
  'modern cake',
  'vintage cake',
  'rustic cake',
  'boho cake',
  'glamorous cake',
  'luxury cake',
  'cute cake',
  'funny cake',
  'unique cake',
  'creative cake',
  'aesthetic cake',
  'y2k cake',
  'cottagecore cake',
  'dark academia cake',
  'barbiecore cake',
  'coquette cake',
  'grunge cake',
  'indie cake',
  'retro cake',
  '80s cake',
  '90s cake',
  'neon cake',
  'holographic cake',
  'chrome cake',
  'cottagecore aesthetic cake',
  'fairycore cake',
  'goblincore cake',
  'dark feminine cake',
  'clean girl cake',
  'that girl cake',
  'korean minimalist cake',
  'doodle cake',
  'korean drawing cake',
  'vintage heart cake',
  'cherry on top cake',
  'korean style cake',
  
  // ========== COLORS & DECORATIONS ==========
  'pink cake',
  'blue cake',
  'purple cake',
  'gold cake',
  'rose gold cake',
  'rainbow cake',
  'pastel cake',
  'ombre cake',
  'drip cake',
  'floral cake',
  'rose cake',
  'flower cake',
  'heart cake',
  'star cake',
  'mirror glaze cake',
  'monochrome cake',
  'black and white cake',
  
  // ========== CURRENT TRENDS (2024-2025) ==========
  'money pulling cake',
  'pinata cake',
  'surprise inside cake',
  'explosion cake',
  'number cake',
  'letter cake',
  'geode cake',
  'marble cake design',
  'candle cake',
  'melting candle cake',
  'dome cake',
  'money cake',
  'pistachio cake',
  'bento cake',
  'lunchbox cake',
  'lambeth cake',
  
  // ========== HOBBIES & INTERESTS ==========
  'book cake',
  'book lover cake',
  'reading cake',
  'camera cake',
  'photography cake',
  'artist cake',
  'paint palette cake',
  'easel cake',
  'sewing cake',
  'sewing machine cake',
  'knitting cake',
  'yarn cake',
  'scrapbook cake',
  'writing cake',
  'typewriter cake',
  'gardening cake',
  'garden cake',
  'flower pot cake',
  'fishing cake',
  'camping cake',
  'tent cake',
  'hiking cake',
  'birdwatching cake',
  'chef cake',
  'cooking cake',
  'baking cake',
  'mixer cake',
  'wine cake',
  'sommelier cake',
  'coffee cake design',
  'foodie cake',
  'beach lover cake',
  'gym cake',
  'fitness cake',
  'weightlifting cake',
  'yoga cake',
  'meditation cake',
  'dance cake',
  'ballet cake',
  'art cake',
  
  // ========== PROFESSIONS ==========
  'doctor cake',
  'nurse cake',
  'teacher cake',
  'police cake',
  'firefighter cake',
  'construction cake',
  'engineer cake',
  'lawyer cake',
  'architect cake',
  'scientist cake',
  'pilot cake',
  'flight attendant cake',
  'photographer cake',
  'realtor cake',
  'dentist cake',
  'vet cake',
  'veterinarian cake',
  'pharmacist cake',
  'accountant cake',
  'mechanic cake',
  'hairdresser cake',
  'salon cake',
  
  // ========== FOOD THEMES ==========
  'fruit cake',
  'strawberry cake',
  'chocolate cake design',
  'vanilla cake design',
  'red velvet cake design',
  
  // ========== GENDER-SPECIFIC ==========
  'cake for boy',
  'cake for girl',
  'cake for men',
  'cake for women',
  'cake for boys',
  'cake for girls',
  
  // ========== INTERNET CULTURE ==========
  'meme cake',
  'tiktok cake',
  'instagram cake',
  'emoji cake',
  'viral cake',
  'trending cake',
  
  // ========== ZODIAC & SPIRITUAL ==========
  'zodiac cake',
  'astrology cake',
  'aries cake',
  'taurus cake',
  'gemini cake',
  'cancer cake',
  'leo cake',
  'virgo cake',
  'libra cake',
  'scorpio cake',
  'sagittarius cake',
  'capricorn cake',
  'aquarius cake',
  'pisces cake',
  'moon cake',
  'celestial cake',
  'crystal cake',
  'tarot cake',
  
  // ========== SEASONS & NATURE ==========
  'fall aesthetic cake',
  'autumn cake',
  'spring cake',
  'cherry blossom cake',
  'summer cake',
  'winter wonderland cake',
  'forest cake',
  'woodland cake',
  'ocean cake',
  'underwater cake',
  'space cake',
  'galaxy cake',
  'astronaut cake',
];

// ============================================================================
// CATEGORIZED KEYWORDS (For filtered search/suggestions)
// ============================================================================

export const KEYWORD_CATEGORIES = {
  occasions: [
    'birthday', 'wedding', 'anniversary', 'graduation', 
    'baby shower', 'bridal shower', 'retirement', 'engagement',
    'gender reveal', 'christening', 'baptism'
  ],
  
  characters: [
    'unicorn', 'dinosaur', 'princess', 'spiderman', 'batman',
    'frozen', 'elsa', 'paw patrol', 'minecraft', 'pokemon',
    'barbie', 'hello kitty', 'mickey mouse', 'peppa pig'
  ],
  
  anime: [
    'naruto', 'one piece', 'demon slayer', 'goku', 'dragon ball',
    'jujutsu kaisen', 'attack on titan', 'sailor moon', 'totoro'
  ],
  
  videogames: [
    'fortnite', 'minecraft', 'roblox', 'mario', 'sonic',
    'valorant', 'genshin impact', 'pokemon', 'zelda'
  ],
  
  kpop: [
    'bts', 'blackpink', 'twice', 'stray kids', 'seventeen',
    'txt', 'enhypen', 'newjeans', 'aespa', 'jimin', 'jungkook'
  ],
  
  celebrities: [
    'taylor swift', 'beyonce', 'ariana grande', 'billie eilish',
    'olivia rodrigo', 'bad bunny', 'drake'
  ],
  
  sports: [
    'football', 'soccer', 'basketball', 'baseball', 'tennis',
    'golf', 'hockey', 'cricket', 'f1', 'nfl', 'nba'
  ],
  
  brands: [
    'chanel', 'gucci', 'louis vuitton', 'starbucks', 'nike',
    'adidas', 'supreme', 'apple', 'tiffany'
  ],
  
  animals: [
    'cat', 'dog', 'bunny', 'elephant', 'lion', 'panda', 
    'butterfly', 'unicorn', 'dinosaur'
  ],
  
  styles: [
    'simple', 'elegant', 'minimalist', 'modern', 'vintage', 
    'rustic', 'glamorous', 'cute', 'aesthetic', 'y2k',
    'cottagecore', 'dark academia'
  ],
  
  colors: [
    'pink', 'blue', 'purple', 'gold', 'rainbow', 'pastel',
    'rose gold', 'black and white', 'monochrome'
  ],
  
  trends: [
    'bento', 'money pulling', 'drip', 'geode', 'number',
    'letter', 'mirror glaze', 'pinata', 'dome'
  ],
  
  hobbies: [
    'book', 'reading', 'photography', 'art', 'music',
    'gaming', 'travel', 'fitness', 'cooking', 'baking'
  ],
  
  travel: [
    'paris', 'new york', 'london', 'tokyo', 'dubai',
    'beach', 'tropical', 'airplane', 'passport'
  ],
  
  professions: [
    'doctor', 'nurse', 'teacher', 'lawyer', 'chef',
    'pilot', 'photographer', 'scientist', 'engineer'
  ]
};

// ============================================================================
// POPULAR COMBINATIONS (For smart suggestions)
// ============================================================================

export const POPULAR_COMBINATIONS = [
  'simple birthday cake',
  'elegant wedding cake',
  'cute baby shower cake',
  'unicorn birthday cake',
  'dinosaur birthday cake',
  'football birthday cake',
  'princess birthday cake',
  'pink unicorn cake',
  'blue dinosaur cake',
  'rainbow unicorn cake',
  'chocolate drip cake',
  'gold elegant cake',
  'pastel rainbow cake',
  'aesthetic birthday cake',
  'minimalist wedding cake',
  'vintage wedding cake',
  'boho wedding cake',
  'bts birthday cake',
  'blackpink birthday cake',
  'taylor swift birthday cake',
  'fortnite birthday cake',
  'minecraft birthday cake',
  'starbucks cake design',
  'tiktok birthday cake',
  'minimalist BTS cake',
  'vintage heart Barbie cake',
  'bento cake Totoro',
  'pastel Stray Kids cake',
  'lunchbox cake Harry Potter',
  'black and pink Wednesday cake',
  'doodle style BT21 cake',
];

// ============================================================================
// SEARCH HELPERS
// ============================================================================

/**
 * Get trending keywords (most popular/searched)
 */
export const TRENDING_KEYWORDS = [
  'bts cake',
  'taylor swift cake',
  'bento cake',
  'minimalist cake',
  'money pulling cake',
  'aesthetic cake',
  'blackpink cake',
  'fortnite cake',
  'minecraft cake',
  'unicorn cake',
  'dinosaur cake',
  'mrbeast cake',
  'wednesday cake',
  'stranger things cake',
  'demon slayer cake',
  'genshin impact cake',
];

/**
 * Quick search categories for UI
 */
export const QUICK_SEARCH_CATEGORIES = [
  { emoji: '🎂', label: 'Birthday', keywords: ['birthday cake', 'birthday'] },
  { emoji: '💒', label: 'Wedding', keywords: ['wedding cake', 'wedding'] },
  { emoji: '🦄', label: 'Unicorn', keywords: ['unicorn cake'] },
  { emoji: '🦕', label: 'Dinosaur', keywords: ['dinosaur cake'] },
  { emoji: '⚽', label: 'Sports', keywords: ['football', 'soccer', 'basketball'] },
  { emoji: '🎮', label: 'Gaming', keywords: ['fortnite', 'minecraft', 'roblox'] },
  { emoji: '🎵', label: 'K-Pop', keywords: ['bts', 'blackpink', 'kpop'] },
  { emoji: '✨', label: 'Aesthetic', keywords: ['aesthetic', 'cottagecore', 'y2k'] },
];
```

## File: src/components/ReportModal.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { CloseIcon, Loader2 } from './icons';
import { CartItemDetails, CakeInfoUI, CakeType } from '../types';
import DetailItem from './UI/DetailItem';
import LazyImage from './LazyImage';

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)',
    '2 Tier': '2 Tier (Soft icing)',
    '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant',
    '2 Tier Fondant': '2 Tier Fondant',
    '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square',
    'Rectangle': 'Rectangle',
    'Bento': 'Bento',
};

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (feedback: string) => Promise<void>;
    isSubmitting: boolean;
    editedImage: string | null;
    details: CartItemDetails | null;
    cakeInfo: CakeInfoUI | null;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onSubmit, isSubmitting, editedImage, details, cakeInfo }) => {
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setFeedback(''); // Clear feedback when modal closes
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        onSubmit(feedback);
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200 animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 flex justify-between items-center border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800">Report an Issue</h2>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close">
                        <CloseIcon />
                    </button>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">
                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Generated Image</p>
                        {editedImage ? (
                            <LazyImage src={editedImage} alt="Customized Cake" className="w-full h-auto object-contain rounded-lg border border-slate-200" />
                        ) : (
                            <div className="aspect-square bg-slate-100 flex items-center justify-center rounded-lg">
                                <span className="text-slate-400 text-sm">No image generated</span>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Customization Details</p>
                        <div className="space-y-1.5 p-3 bg-slate-50 rounded-md border border-slate-200">
                            {cakeInfo && details && (
                                <>
                                    <DetailItem label="Type" value={`${cakeTypeDisplayMap[cakeInfo.type]}, ${cakeInfo.thickness}, ${cakeInfo.size}`} />
                                    {details.flavors.map((flavor, idx) => (
                                        <DetailItem key={idx} label={`Tier ${idx + 1} Flavor`} value={flavor} />
                                    ))}
                                    {details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={details.mainToppers.map(t => t.description).join(', ')} />}
                                    {details.supportElements.length > 0 && <DetailItem label="Support" value={details.supportElements.map(s => s.description).join(', ')} />}
                                    {details.cakeMessages.map((msg, idx) => (
                                      <DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />
                                   ))}
                                   {details.icingDesign.drip && <DetailItem label="Design" value="Has Drip Effect" />}
                                    {details.icingDesign.gumpasteBaseBoard && <DetailItem label="Design" value="Gumpaste Base Board" />}
                                    {Object.entries(details.icingDesign.colors).map(([loc, color]) => {
                                        const colorLabelMap: Record<string, string> = {
                                            side: 'Side', top: 'Top', borderTop: 'Top Border', borderBase: 'Base Border', drip: 'Drip', gumpasteBaseBoardColor: 'Base Board'
                                        };
                                        return <DetailItem key={loc} label={`${colorLabelMap[loc] || loc} Color`} value={color} />;
                                    })}
                                    {details.additionalInstructions && <DetailItem label="Instructions" value={details.additionalInstructions} />}
                                </>
                            )}
                        </div>
                        <div>
                             <label htmlFor="report-feedback" className="text-sm font-semibold text-slate-700 mb-2 block">Your Feedback</label>
                             <textarea
                                 id="report-feedback"
                                 value={feedback}
                                 onChange={(e) => setFeedback(e.target.value)}
                                 className="w-full p-3 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                                 placeholder="Please describe the issue. For example: 'The topper was removed instead of changed', 'The drip color is wrong', etc."
                                 rows={4}
                             />
                        </div>
                    </div>
                </div>
                <div className="p-5 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center"
                    >
                        {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending...</> : 'Send Report'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportModal;
```

## File: src/components/CartDisplay.tsx

```tsx

```

## File: src/components/PricingDisplay.tsx

```tsx

```

## File: src/components/AccessoryList.tsx

```tsx

```

## File: src/components/ImageUploader.tsx

```tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CloseIcon, Loader2 } from './icons';
import { compressImage, validateImageFile } from '../lib/utils/imageOptimization';
import { showError } from '../lib/utils/toast';

export interface ImageUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (file: File) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ isOpen, onClose, onImageSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File | null) => {
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid && validation.error) {
      showError(validation.error);
      return;
    }

    setIsProcessing(true);
    try {
      let fileToProcess = file;
      // Conditionally compress if file is larger than 500KB
      if (file.size > 500 * 1024) {
        fileToProcess = await compressImage(file, {
          maxSizeMB: 1, // Compress to a max of 1MB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
      }
      onImageSelect(fileToProcess);
    } catch (error) {
      console.error('Error processing image:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      showError('Failed to process image.');
      onImageSelect(file); // fallback to original file
    } finally {
      setIsProcessing(false);
    }
  }, [onImageSelect]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen || isProcessing) return;

      if (e.clipboardData?.files?.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          handleFileSelect(file);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, isProcessing, handleFileSelect]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragging(true);
  }, [isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [isProcessing, handleFileSelect]);

  const [show, setShow] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setShow(true), 10);
    } else {
      setShow(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isProcessing) return;
    setShow(false);
    setTimeout(onClose, 200);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      aria-modal="true" role="dialog"
    >
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center flex flex-col items-center gap-4 transition-all duration-200 ${show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <button onClick={handleClose} disabled={isProcessing} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50" aria-label="Close">
          <CloseIcon />
        </button>

        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-2xl z-10">
            <Loader2 className="animate-spin w-8 h-8 text-purple-500" />
            <span className="mt-4 font-semibold text-slate-600">Optimizing image...</span>
          </div>
        )}

        <div className={`w-full border-2 border-dashed rounded-lg p-10 transition-colors ${isDragging ? 'border-purple-500 bg-purple-50' : 'border-slate-300'}`}>
          <div className="flex flex-col items-center text-slate-500">
            <svg className="w-16 h-16 text-slate-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-slate-800">Upload Your Cake Design</h2>
            <p className="mt-2">Drag & drop, paste, or click to upload an image.</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="mt-6 bg-purple-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              Browse Files
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/webp,image/png,image/jpeg"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Supports: WEBP, PNG, JPG. You can also paste an image from your clipboard.</p>
      </div>
    </div>
  );
};
```

## File: src/components/CartItemCard.tsx

```tsx
import React from 'react';
import { CartItem } from '../types';
import DetailItem from './UI/DetailItem';
import { LoadingSpinner } from './LoadingSpinner';
import { TrashIcon } from './icons';
import LazyImage from './LazyImage';

interface CartItemCardProps {
  item: CartItem;
  onRemove: (id: string) => void;
  onZoom: (image: string) => void;
}

const CartItemCard: React.FC<CartItemCardProps> = ({ item, onRemove, onZoom }) => {
  const tierLabels = item.details.flavors.length === 2 
      ? ['Top Tier', 'Bottom Tier'] 
      : item.details.flavors.length === 3
      ? ['Top Tier', 'Middle Tier', 'Bottom Tier']
      : ['Flavor'];
      
  const colorLabelMap: Record<string, string> = {
      side: 'Side',
      top: 'Top',
      borderTop: 'Top Border',
      borderBase: 'Base Border',
      drip: 'Drip',
      gumpasteBaseBoardColor: 'Base Board'
  };

  if (item.status === 'pending') {
      return (
          <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex gap-4 w-full">
                  <div className="relative w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-md bg-slate-100 overflow-hidden">
                      <LazyImage 
                          src={item.image!} 
                          alt="Original cake design" 
                          className="absolute inset-0 w-full h-full object-cover opacity-40" 
                      />
                      <div className="absolute inset-0 bg-slate-900/30 flex flex-col items-center justify-center p-2">
                          <LoadingSpinner />
                          <p className="text-xs text-white font-semibold mt-2 text-center shadow-sm">Updating design...</p>
                      </div>
                  </div>
                  <div className="flex-grow">
                      <div className="flex justify-between items-start">
                          <div>
                              <h2 className="font-semibold text-slate-800">{item.size}</h2>
                              <p className="text-lg font-bold text-purple-600 mt-1">₱{item.totalPrice.toLocaleString()}</p>
                          </div>
                          <button onClick={() => onRemove(item.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors" aria-label="Remove item">
                              <TrashIcon className="w-5 h-5" />
                          </button>
                      </div>
                  </div>
              </div>
              <details className="w-full">
                  <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                  <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                     <DetailItem label="Type" value={`${item.type}, ${item.thickness}, ${item.size}`} />
                      {item.details.flavors.length === 1 ? (
                          <DetailItem label="Flavor" value={item.details.flavors[0]} />
                      ) : (
                          item.details.flavors.map((flavor, idx) => (
                              <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                          ))
                      )}
                     {item.details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={item.details.mainToppers.map(t => t.description).join(', ')} />}
                     {item.details.supportElements.length > 0 && <DetailItem label="Support" value={item.details.supportElements.map(s => s.description).join(', ')} />}
                     {item.details.cakeMessages.map((msg, idx) => (
                        <DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />
                     ))}
                     {item.details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                     {item.details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                     {Object.entries(item.details.icingDesign.colors).map(([loc, color]) => (
                         <DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />
                     ))}
                     {item.details.additionalInstructions && <DetailItem label="Instructions" value={item.details.additionalInstructions} />}
                  </div>
              </details>
          </div>
      );
  }
  
  if (item.status === 'error') {
      return (
           <div className="flex flex-col gap-3 p-4 bg-red-50 rounded-lg border border-red-200 text-red-800">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="font-semibold">Design Update Failed</p>
                      <p className="text-xs mt-1">{item.errorMessage}</p>
                  </div>
                  <button onClick={() => onRemove(item.id)} className="p-1.5 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" aria-label="Remove item">
                      <TrashIcon className="w-5 h-5" />
                  </button>
              </div>
          </div>
      );
  }

  return (
   <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
      <div className="flex gap-4 w-full">
          <button
              type="button"
              onClick={() => item.image && onZoom(item.image)}
              className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md transition-transform hover:scale-105"
              aria-label="Enlarge cake image"
          >
              <LazyImage src={item.image!} alt="Cake Design" className="w-full h-full object-cover rounded-md" />
          </button>
          <div className="flex-grow">
              <div className="flex justify-between items-start">
                  <div>
                      <h2 className="font-semibold text-slate-800">{item.size}</h2>
                      <p className="text-lg font-bold text-purple-600 mt-1">₱{item.totalPrice.toLocaleString()}</p>
                  </div>
                  <button onClick={() => onRemove(item.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors" aria-label="Remove item">
                      <TrashIcon className="w-5 h-5" />
                  </button>
              </div>
          </div>
      </div>
      <details className="w-full">
          <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
          <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
             <DetailItem label="Type" value={`${item.type}, ${item.thickness}, ${item.size}`} />
              {item.details.flavors.length === 1 ? (
                  <DetailItem label="Flavor" value={item.details.flavors[0]} />
              ) : (
                  item.details.flavors.map((flavor, idx) => (
                      <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                  ))
              )}
             {item.details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={item.details.mainToppers.map(t => t.description).join(', ')} />}
             {item.details.supportElements.length > 0 && <DetailItem label="Support" value={item.details.supportElements.map(s => s.description).join(', ')} />}
             {item.details.cakeMessages.map((msg, idx) => (
                <DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />
             ))}
             {item.details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
             {item.details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
             {Object.entries(item.details.icingDesign.colors).map(([loc, color]) => (
                 <DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />
             ))}
             {item.details.additionalInstructions && <DetailItem label="Instructions" value={item.details.additionalInstructions} />}
          </div>
      </details>
  </div>
  );
};

export default React.memo(CartItemCard);
```

## File: src/components/AddressForm.tsx

```tsx
'use client';

import React, { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import { useAddAddress, useUpdateAddress } from '../hooks/useAddresses';
import { showSuccess, showError } from '../lib/utils/toast';
import { CakeGenieAddress } from '../lib/database.types';
import { Loader2, MapPin, Search, X, Pencil } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '../config';
import { GoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoader } from '../contexts/GoogleMapsLoaderContext';
import LazyImage from './LazyImage';

declare const google: any;

// --- Static Map Component ---
export const StaticMap: React.FC<{ latitude: number; longitude: number }> = ({ latitude, longitude }) => {
  if (!GOOGLE_MAPS_API_KEY || !latitude || !longitude) return null;
  const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=300x150&markers=color:0xf472b6%7C${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
  return (
    <div className="mt-4 rounded-lg overflow-hidden border border-slate-200">
      <LazyImage src={imageUrl} alt="Map location" className="w-full h-auto object-cover" />
    </div>
  );
};

// --- Address Form's Map Picker Modal Component ---
const AddressPickerModal = ({ isOpen, onClose, onLocationSelect, initialCoords, initialStreetAddress }: { isOpen: boolean, onClose: () => void, onLocationSelect: (details: any) => void, initialCoords?: { lat: number, lng: number } | null, initialStreetAddress?: string | null }) => {
    const { isLoaded } = useGoogleMapsLoader();

    const [map, setMap] = useState<any | null>(null);
    const [center, setCenter] = useState(initialCoords || { lat: 10.3157, lng: 123.8854 });
    const [completeAddress, setCompleteAddress] = useState(''); // User-controlled input
    const [suggestedAddress, setSuggestedAddress] = useState(''); // Geocoding output
    const [isGeocoding, setIsGeocoding] = useState(false);

    const autocompleteRef = useRef<any | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    
    useEffect(() => {
        if(isOpen && initialStreetAddress) {
            setCompleteAddress(initialStreetAddress);
        }
    }, [isOpen, initialStreetAddress]);

    const handleReverseGeocode = useCallback((lat: number, lng: number) => {
        if (!isLoaded || !window.google) return;
        setIsGeocoding(true);
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                setSuggestedAddress(results[0].formatted_address);
            } else {
                console.error("Reverse geocoding failed:", status);
                setSuggestedAddress('Could not determine address from map.');
            }
            setIsGeocoding(false);
        });
    }, [isLoaded]);

    const onMapIdle = useCallback(() => {
        if (map) {
            const newCenter = map.getCenter();
            if (newCenter) {
                handleReverseGeocode(newCenter.lat(), newCenter.lng());
                // Update autocomplete bounds when user pans the map
                if (autocompleteRef.current) {
                    const circle = new google.maps.Circle({
                        center: newCenter,
                        radius: 7000, // 7km
                    });
                    autocompleteRef.current.setBounds(circle.getBounds());
                }
            }
        }
    }, [map, handleReverseGeocode]);

    useEffect(() => {
        // We need the map to be loaded to set the initial bounds for autocomplete
        if (isLoaded && inputRef.current && map && !autocompleteRef.current) {
            const circle = new google.maps.Circle({
                center: map.getCenter(),
                radius: 7000, // 7km in meters
            });
    
            const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                // Remove 'types: ['geocode']' to allow searching for establishments (shops, places)
                componentRestrictions: { country: "ph" },
                bounds: circle.getBounds(),
                strictBounds: true, // Restrict results to within the 7km radius
            });
            autocompleteRef.current = autocomplete;
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry?.location) {
                    map?.panTo(place.geometry.location);
                    map?.setZoom(17);
                }
            });
        }
    }, [isLoaded, map]);

    const handleSubmit = () => {
        if (map && completeAddress.trim()) {
            const finalCenter = map.getCenter();
            if (finalCenter) {
                onLocationSelect({
                    latitude: finalCenter.lat(),
                    longitude: finalCenter.lng(),
                    street_address: completeAddress.trim(),
                });
            }
        } else {
            showError("Please enter your complete address.");
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Set Delivery Location</h3>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-grow relative">
                    {!isLoaded ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-pink-500 w-8 h-8"/></div>
                    ) : (
                        <>
                            <GoogleMap
                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                center={center}
                                zoom={15}
                                onLoad={setMap}
                                onIdle={onMapIdle}
                                options={{
                                    disableDefaultUI: true,
                                    zoomControl: true,
                                    mapTypeControl: false,
                                    streetViewControl: false
                                }}
                            />
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none">
                                 <MapPin className="text-pink-500 w-10 h-10" fill="currentColor" />
                             </div>
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-lg">
                                 <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Search for a building or street..."
                                        className="w-full pl-10 pr-4 py-3 bg-white rounded-full shadow-lg border border-slate-300 focus:ring-2 focus:ring-pink-500 focus:outline-none"
                                    />
                                 </div>
                             </div>
                        </>
                    )}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <label htmlFor="completeAddress" className="block text-sm font-medium text-slate-600 mb-1">Complete Address (Unit No., Building, Street) <span className="text-red-500">*</span></label>
                    <textarea 
                        id="completeAddress"
                        value={completeAddress}
                        onChange={e => setCompleteAddress(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                        rows={3}
                        placeholder="e.g., Unit 5B, The Padgett Place, Molave St..."
                        required
                    />
                    {suggestedAddress && !isGeocoding && (
                        <div className="text-xs text-slate-500 mt-1 p-2 bg-slate-100 rounded-md">
                            <strong>Suggested Location:</strong> {suggestedAddress}
                        </div>
                    )}
                    <button 
                        onClick={handleSubmit} 
                        disabled={!completeAddress.trim() || isGeocoding}
                        className="w-full mt-3 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                         {isGeocoding ? <><Loader2 className="w-5 h-5 mr-2 animate-spin"/> Locating...</> : 'Confirm Location'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Address Form Component ---
interface AddressFormProps {
  userId: string;
  initialData?: CakeGenieAddress | null;
  onSuccess: (newAddress?: CakeGenieAddress) => void;
  onCancel: () => void;
}

const AddressForm: React.FC<AddressFormProps> = ({ userId, initialData, onSuccess, onCancel }) => {
    const addAddressMutation = useAddAddress();
    const updateAddressMutation = useUpdateAddress();
    const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
    
    // Form state
    const [recipientName, setRecipientName] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    const [streetAddress, setStreetAddress] = useState('');
    const [addressLabel, setAddressLabel] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    
    const isEditing = !!initialData;
    const isSubmitting = addAddressMutation.isPending || updateAddressMutation.isPending;

    useEffect(() => {
        if (initialData) {
            setRecipientName(initialData.recipient_name || '');
            setRecipientPhone(initialData.recipient_phone || '');
            setStreetAddress(initialData.street_address || '');
            setAddressLabel(initialData.address_label || '');
            setIsDefault(initialData.is_default || false);
            setLatitude(initialData.latitude || null);
            setLongitude(initialData.longitude || null);
        } else {
            // Reset for "add new" mode
            setRecipientName(''); setRecipientPhone(''); setStreetAddress('');
            setAddressLabel(''); setIsDefault(false); setLatitude(null); setLongitude(null);
        }
    }, [initialData]);

    const handleLocationSelect = useCallback((details: any) => {
        setLatitude(details.latitude);
        setLongitude(details.longitude);
        setStreetAddress(details.street_address);
        setIsPickerModalOpen(false);
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!recipientName || !recipientPhone || !streetAddress || !latitude || !longitude) {
            showError("Please fill in recipient details and set a location on the map.");
            return;
        }

        const newAddressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'> = {
            recipient_name: recipientName, recipient_phone: recipientPhone, street_address: streetAddress,
            barangay: '', city: '', province: 'Cebu', postal_code: '',
            address_label: addressLabel || null, landmark: null, is_default: isDefault,
            country: 'Philippines', latitude, longitude
        };

        if (isEditing && initialData) {
            updateAddressMutation.mutate({ userId, addressId: initialData.address_id, addressData: newAddressData }, {
                onSuccess: (updatedAddress) => { 
                    showSuccess("Address updated successfully!"); 
                    onSuccess(updatedAddress ?? undefined); 
                },
                onError: (error: any) => { showError(error.message || "Failed to update address."); }
            });
        } else {
            addAddressMutation.mutate({ userId, addressData: newAddressData }, {
                onSuccess: (newAddress) => { 
                    if(newAddress) {
                        showSuccess("Address added successfully!"); 
                        onSuccess(newAddress); 
                    }
                },
                onError: (error: any) => { showError(error.message || "Failed to add address."); }
            });
        }
    };

    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500 disabled:bg-slate-50";

    return (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 mt-6 animate-fade-in">
            <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <h3 className="text-lg font-bold text-slate-800 mb-4">{isEditing ? 'Edit Address' : 'Add a New Address'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="recipientName" className="block text-sm font-medium text-slate-600 mb-1">Recipient Name <span className="text-red-500">*</span></label>
                        <input id="recipientName" type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} className={inputStyle} required />
                    </div>
                    <div>
                        <label htmlFor="recipientPhone" className="block text-sm font-medium text-slate-600 mb-1">Phone Number <span className="text-red-500">*</span></label>
                        <input id="recipientPhone" type="tel" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} className={inputStyle} required />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Address <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => setIsPickerModalOpen(true)} className={`${inputStyle} text-left`}>
                        {streetAddress ? (
                            <div className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-800">{streetAddress}</span>
                            </div>
                        ) : (
                            <span className="text-slate-400">Set delivery location on map</span>
                        )}
                    </button>
                    {latitude && longitude && <StaticMap latitude={latitude} longitude={longitude} />}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="addressLabel" className="block text-sm font-medium text-slate-600 mb-1">Address Label</label>
                        <input id="addressLabel" type="text" value={addressLabel} onChange={e => setAddressLabel(e.target.value)} className={inputStyle} placeholder="e.g., Home, Work" />
                    </div>
                </div>

                <div className="flex items-center pt-2">
                    <input id="isDefault" type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 text-pink-600 border-slate-300 rounded focus:ring-pink-500" />
                    <label htmlFor="isDefault" className="ml-2 block text-sm text-slate-800">Set as default address</label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                    <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-slate-50 transition-all text-sm">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="flex justify-center items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-75">
                         {isSubmitting && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                        {isEditing ? 'Save Changes' : 'Save Address'}
                    </button>
                </div>
            </form>
            <AddressPickerModal 
                isOpen={isPickerModalOpen} 
                onClose={() => setIsPickerModalOpen(false)} 
                onLocationSelect={handleLocationSelect} 
                initialCoords={latitude && longitude ? { lat: latitude, lng: longitude } : null}
                initialStreetAddress={streetAddress}
            />
        </div>
    );
};

export default AddressForm;
```

## File: src/components/ImageZoomModal.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { CloseIcon } from './icons';
import LazyImage from './LazyImage';

type ImageTab = 'original' | 'customized';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: string | null;
  customizedImage: string | null;
  initialTab?: ImageTab;
}

export const ImageZoomModal = React.memo<ImageZoomModalProps>(({
  isOpen,
  onClose,
  originalImage,
  customizedImage,
  initialTab = 'original',
}) => {
  const [activeTab, setActiveTab] = useState<ImageTab>(initialTab);

  useEffect(() => {
    // Reset to initialTab whenever the modal is opened
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !originalImage) {
    return null;
  }
  
  const currentImage = activeTab === 'customized' ? (customizedImage || originalImage) : originalImage;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 transition-opacity duration-200 animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <style>{`.animate-fadeIn { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors z-20"
        aria-label="Close zoomed image"
      >
        <CloseIcon />
      </button>
      
      <div 
        className="relative w-full h-full flex items-center justify-center secure-image-container" 
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
          <LazyImage
            key={activeTab} // To force re-render with animation on tab change
            src={currentImage}
            alt={`${activeTab} cake preview`}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl animate-fadeIn"
            placeholderClassName="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
          />
      </div>

      <div className="absolute bottom-6 z-20" onClick={(e) => e.stopPropagation()}>
          <div className="bg-black/40 p-1.5 rounded-full flex space-x-2 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('original')}
              className={`px-6 py-2 text-sm font-semibold rounded-full transition-colors ${
                activeTab === 'original'
                  ? 'bg-white text-black'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setActiveTab('customized')}
              disabled={!customizedImage}
              className={`px-6 py-2 text-sm font-semibold rounded-full transition-colors ${
                activeTab === 'customized'
                  ? 'bg-white text-black'
                  : 'text-white hover:bg-white/20 disabled:text-gray-400 disabled:hover:bg-transparent'
              }`}
            >
              Customized
            </button>
          </div>
      </div>
    </div>
  );
});
ImageZoomModal.displayName = 'ImageZoomModal';
```

## File: src/components/BillShareCard.tsx

```tsx
// components/BillShareCard.tsx

import React, { useState, useMemo } from 'react';
import { Share2, Link as LinkIcon, CheckCircle, Users, ChevronDown, Calendar, MapPin, User as UserIcon } from 'lucide-react';
import LazyImage from './LazyImage';
import { showSuccess } from '../lib/utils/toast';
import DetailItem from './UI/DetailItem';
import { ImageZoomModal } from './ImageZoomModal';
import { CartItemDetails } from '../types';

interface BillShareCardProps {
    design: any;
    onDesignUpdate: (updatedDesign: any) => void;
}

const BillShareCard: React.FC<BillShareCardProps> = ({ design, onDesignUpdate }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [zoomState, setZoomState] = useState<{ isOpen: boolean; initialTab: 'original' | 'customized' }>({
        isOpen: false,
        initialTab: 'customized',
    });

    const { amountCollected, contributorCount } = useMemo(() => {
        if (!design || !design.contributions || !Array.isArray(design.contributions)) {
            return { amountCollected: design?.amount_collected || 0, contributorCount: 0 };
        }
        const paidContributions = design.contributions.filter((c: any) => c.status === 'paid');
        const totalFromContributions = paidContributions.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
        return {
            amountCollected: Math.max(totalFromContributions, design.amount_collected || 0),
            contributorCount: paidContributions.length
        };
    }, [design]);
    
    const progress = design.final_price > 0 ? Math.min(100, (amountCollected / design.final_price) * 100) : 0;
    const remainingAmount = design.final_price - amountCollected;
    const isFullyFunded = remainingAmount <= 0;

    const shareUrl = `${window.location.origin}/#/designs/${design.url_slug}`;

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(shareUrl).then(() => {
            setIsCopied(true);
            showSuccess("Share link copied!");
            setTimeout(() => setIsCopied(false), 2000);
        });
    };
    
    const getStatusInfo = () => {
        if (design.order_placed) {
            return { text: "Order Placed", style: "bg-green-100 text-green-800" };
        }
        if (isFullyFunded) {
            return { text: "Fully Funded", style: "bg-blue-100 text-blue-800" };
        }
        return { text: "Funding in Progress", style: "bg-yellow-100 text-yellow-800" };
    };

    const { text: statusText, style: statusStyle } = getStatusInfo();
    const designDate = new Date(design.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const details = design.customization_details as CartItemDetails | undefined;
    const tierLabels = details?.flavors?.length === 2 ? ['Top Tier', 'Bottom Tier'] : details?.flavors?.length === 3 ? ['Top Tier', 'Middle Tier', 'Bottom Tier'] : ['Flavor'];
    const colorLabelMap: Record<string, string> = { side: 'Side', top: 'Top', borderTop: 'Top Border', borderBase: 'Base Border', drip: 'Drip', gumpasteBaseBoardColor: 'Base Board' };
    const deliveryDate = design.event_date ? new Date(design.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : null;


    return (
        <>
            <details className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group">
                <summary className="p-4 cursor-pointer list-none">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-slate-800 leading-tight">{design.title}</p>
                            <p className="text-xs text-slate-500 mt-1">Created on {designDate}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                            <p className="text-lg font-bold text-pink-600">₱{design.final_price.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">1 item</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-600">
                                ₱{amountCollected.toLocaleString()} raised
                            </span>
                            <span className="text-slate-500">
                                {progress.toFixed(0)}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div 
                                className="bg-gradient-to-r from-pink-500 to-purple-500 h-2.5 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyle}`}>
                                {statusText}
                            </span>
                            {contributorCount > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                    <Users size={14} />
                                    <span>{contributorCount} contributor{contributorCount > 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleCopyLink} title="Copy Share Link" className="p-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                                {isCopied ? <CheckCircle size={16} className="text-green-600" /> : <Share2 size={16} />}
                            </button>
                            <a href={shareUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="View Page" className="p-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                                <LinkIcon size={16} />
                            </a>
                            <ChevronDown className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" />
                        </div>
                    </div>
                </summary>

                <div className="px-4 pb-4 border-t border-slate-200 animate-fade-in">
                    <div className="space-y-4 pt-4">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-800 mb-2">Item</h4>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex gap-4">
                                    <button onClick={() => setZoomState({ isOpen: true, initialTab: 'customized' })} className="w-24 h-24 flex-shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-transform hover:scale-105" aria-label="Enlarge cake image">
                                        <LazyImage src={design.customized_image_url} alt={design.title} className="w-full h-full object-cover" />
                                    </button>
                                    <div className="flex-grow">
                                        <p className="font-semibold text-slate-800">{design.cake_type}</p>
                                        <p className="text-sm text-slate-500">{design.cake_size}</p>
                                        <p className="text-lg font-bold text-pink-600 mt-1">₱{design.final_price.toLocaleString()}</p>
                                    </div>
                                </div>
                                <details className="mt-3">
                                    <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                                    <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                                        {details ? (
                                            <>
                                                <DetailItem label="Type" value={`${design.cake_type}, ${design.cake_thickness}, ${design.cake_size}`} />
                                                {details.flavors && details.flavors.length > 0 && (
                                                    details.flavors.length <= 1 
                                                        ? <DetailItem label="Flavor" value={details.flavors[0] || 'N/A'} /> 
                                                        : details.flavors.map((flavor, idx) => (<DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />))
                                                )}
                                                {details.mainToppers?.length > 0 && <DetailItem label="Main Toppers" value={details.mainToppers.map(t => t.description).join(', ')} />}
                                                {details.supportElements?.length > 0 && <DetailItem label="Support" value={details.supportElements.map(s => s.description).join(', ')} />}
                                                {details.cakeMessages?.map((msg, idx) => (<DetailItem key={idx} label={`Message #${idx+1}`} value={`'${msg.text}' (${msg.color})`} />))}
                                                {details.icingDesign?.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                                                {details.icingDesign?.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                                                {details.icingDesign?.colors && Object.entries(details.icingDesign.colors).map(([loc, color]) => (<DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />))}
                                                {details.additionalInstructions && <DetailItem label="Instructions" value={details.additionalInstructions} />}
                                            </>
                                        ) : ( <p className="text-slate-500 text-xs italic">Detailed customization data not available for this older shared design.</p> )}
                                    </div>
                                </details>
                            </div>
                        </div>
                        {deliveryDate && (
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 mb-2">Delivery Details</h4>
                                <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5">
                                    <p className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-2 text-slate-500" /> <span className="font-semibold text-slate-600">Date:</span>&nbsp;{deliveryDate} ({design.event_time})</p>
                                    <p className="flex items-center"><UserIcon className="w-3.5 h-3.5 mr-2 text-slate-500" /> <span className="font-semibold text-slate-600">To:</span>&nbsp;{design.recipient_name}</p>
                                    <p className="flex items-start"><MapPin className="w-3.5 h-3.5 mr-2 text-slate-500 mt-0.5" /> <span className="font-semibold text-slate-600">Address:</span>&nbsp;{`${design.delivery_address}, ${design.delivery_city}`}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </details>
            <ImageZoomModal
                isOpen={zoomState.isOpen}
                onClose={() => setZoomState({ isOpen: false, initialTab: 'customized' })}
                originalImage={design.original_image_url || null}
                customizedImage={design.customized_image_url || null}
                initialTab={zoomState.initialTab}
            />
             <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </>
    );
};

export default BillShareCard;
```

## File: src/components/ErrorFallback.tsx

```tsx
import React from 'react';
import { ErrorIcon } from './icons';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  message?: string;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetError,
  title = 'Something went wrong',
  message = 'We encountered an unexpected error. Please try again.'
}) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <ErrorIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        
        {error && (
          <details className="text-left bg-gray-50 rounded p-3 mb-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Error Details
            </summary>
            <pre className="text-xs text-red-600 mt-2 overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        
        {resetError && (
          <button
            onClick={resetError}
            className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-2 rounded-full font-semibold hover:shadow-lg transition-all"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};
```

## File: src/components/AddToCartButton.tsx

```tsx

```

## File: src/components/ColorPalette.tsx

```tsx
import React from 'react';
import { COLORS } from '../constants';

interface ColorPaletteProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

export const ColorPalette: React.FC<ColorPaletteProps> = React.memo(({ selectedColor, onColorChange }) => {
  const ringClass = 'ring-2 ring-offset-2 ring-offset-slate-50';

  return (
    <div className={`flex flex-wrap gap-2 justify-center`}>
      {COLORS.map((color) => (
        <button
          key={color.name}
          type="button"
          onClick={() => onColorChange(color.hex)}
          className={`rounded-full transition-transform transform hover:scale-110 focus:outline-none w-8 h-8 ${
            selectedColor.toLowerCase() === color.hex.toLowerCase()
              ? `ring-purple-500 ${ringClass}`
              : 'ring-2 ring-transparent'
          }`}
          style={{ backgroundColor: color.hex }}
          aria-label={`Select ${color.name} color`}
          title={color.name}
        >
          {color.hex.toLowerCase() === '#ffffff' && (
            <span className="block w-full h-full rounded-full border border-slate-300"></span>
          )}
        </button>
      ))}
    </div>
  );
});
ColorPalette.displayName = 'ColorPalette';

```

## File: src/components/IcingColorEditor.tsx

```tsx

```

## File: src/components/FeatureList.tsx

```tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, CakeType, CakeThickness, CakeFlavor, BasePriceInfo } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { ChevronDownIcon } from './icons';
import { CAKE_TYPES, THICKNESS_OPTIONS_MAP, CAKE_TYPE_THUMBNAILS, CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, FLAVOR_OPTIONS, FLAVOR_THUMBNAILS, TIER_THUMBNAILS } from '../constants';
import { CakeBaseSkeleton } from './LoadingSkeletons';
import { AnalysisItem } from '../app/customizing/page';


interface FeatureListProps {
  analysisError: string | null;
  analysisId: string | null;
  cakeInfo: CakeInfoUI | null;
  basePriceOptions: BasePriceInfo[] | null;
  mainToppers: MainTopperUI[];
  supportElements: SupportElementUI[];
  cakeMessages: CakeMessageUI[];
  icingDesign: IcingDesignUI | null;
  additionalInstructions: string;
  onCakeInfoChange: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
  updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
  removeMainTopper: (id: string) => void;
  updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
  removeSupportElement: (id: string) => void;
  updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
  removeCakeMessage: (id: string) => void;
  addCakeMessage: (position: 'top' | 'side' | 'base_board') => void;
  onIcingDesignChange: (design: IcingDesignUI) => void;
  onAdditionalInstructionsChange: (instructions: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => void;
  onSupportElementImageReplace: (elementId: string, file: File) => void;
  isAnalyzing: boolean;
  itemPrices: Map<string, number>;
  user?: { email?: string } | null;
  hideBaseOptions?: boolean;
  hideSupportElements?: boolean;
  onAddPrintoutTopper?: () => void;
  onSetPrimaryMessage?: (update: { text?: string, color?: string, useDefaultColor?: boolean }) => void;
  primaryMessage?: CakeMessageUI;
  onSetBaseBoardMessage?: (update: { text?: string, color?: string, useDefaultColor?: boolean }) => void;
  baseBoardMessage?: CakeMessageUI;
  defaultOpenInstructions?: boolean;
  shopifyFixedSize?: string;
  shopifyBasePrice?: number;
  cakeBaseSectionRef?: React.RefObject<HTMLDivElement>;
  cakeMessagesSectionRef?: React.RefObject<HTMLDivElement>;
  // New props for interaction
  onItemClick: (item: AnalysisItem) => void;
  markerMap: Map<string, string>;
}

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)', '2 Tier': '2 Tier (Soft icing)', '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant', '2 Tier Fondant': '2 Tier Fondant', '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square', 'Rectangle': 'Rectangle', 'Bento': 'Bento',
};

const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number; analysisText?: string }> = ({ title, children, defaultOpen = true, count, analysisText }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    useEffect(() => {
        setIsOpen(defaultOpen);
    }, [defaultOpen]);

    return (
        <div className="bg-slate-50 rounded-lg border border-slate-200">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-700">{title}</h3>
                    {analysisText && <span className="text-xs text-slate-500 animate-pulse">{analysisText}</span>}
                    {count !== undefined && count > 0 && (
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
                    )}
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="p-4 pt-0 space-y-3">{children}</div>}
        </div>
    );
};

const ListItem: React.FC<{ item: AnalysisItem; marker?: string; onClick: (item: AnalysisItem) => void }> = React.memo(({ item, marker, onClick }) => {
    const description = 'text' in item ? `"${item.text}"` : item.description;
    
    return (
        <button
            onClick={() => onClick(item)}
            className="w-full flex items-center gap-3 p-3 text-left bg-white rounded-md border border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
            {marker && (
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-600 text-xs font-bold rounded-full">
                    {marker}
                </div>
            )}
            <div className="flex-grow text-sm font-medium text-slate-800">
                {description}
            </div>
        </button>
    );
});
ListItem.displayName = 'ListItem';


export const FeatureList = React.memo<FeatureListProps>(({
    analysisError, analysisId, cakeInfo, basePriceOptions, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions,
    onCakeInfoChange, onAdditionalInstructionsChange, updateCakeMessage, removeCakeMessage, addCakeMessage, isAnalyzing, shopifyFixedSize, shopifyBasePrice, cakeBaseSectionRef, cakeMessagesSectionRef,
    onItemClick, markerMap
}) => {
    const cakeTypeScrollContainerRef = useRef<HTMLDivElement>(null);
    const cakeThicknessScrollContainerRef = useRef<HTMLDivElement>(null);
    const cakeSizeScrollContainerRef = useRef<HTMLDivElement>(null);
    const [showAdditionalInstructions, setShowAdditionalInstructions] = useState(!!additionalInstructions);
    const prevAnalysisIdRef = useRef(analysisId);

    const mainToppersCount = mainToppers.reduce((sum, topper) => sum + topper.quantity, 0);
    const supportElementsCount = supportElements.length;

    useEffect(() => {
        if (analysisId !== prevAnalysisIdRef.current) {
            setShowAdditionalInstructions(false);
            prevAnalysisIdRef.current = analysisId;
        }
    }, [analysisId]);

    // Determine which message positions are missing
    const existingPositions = useMemo(() => {
        return new Set(cakeMessages.map(msg => msg.position));
    }, [cakeMessages]);

    const missingTopMessage = !existingPositions.has('top');
    const missingSideMessage = !existingPositions.has('side');
    const missingBaseBoardMessage = !existingPositions.has('base_board');

    if (analysisError) return <div className="text-center p-4 bg-red-50 rounded-lg text-red-700"><p className="font-semibold">Analysis Failed</p><p className="text-sm">{analysisError}</p></div>;
    if (!icingDesign || !cakeInfo) return null;

    const currentThicknessOptions = THICKNESS_OPTIONS_MAP[cakeInfo.type] || [];
    const tierCount = cakeInfo.flavors.length;
    const tierLabels = tierCount === 2 ? ['Top Tier Flavor', 'Bottom Tier Flavor'] : tierCount === 3 ? ['Top Tier Flavor', 'Middle Tier Flavor', 'Bottom Tier Flavor'] : ['Cake Flavor'];

    return (
        <div className="space-y-4">
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } .animate-fade-in-fast { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <h2 className="text-xl font-bold text-slate-800 text-center">Customize Your Cake</h2>
            
            <div ref={cakeBaseSectionRef}>
                <Section title="Cake Base" defaultOpen={!isAnalyzing} analysisText={isAnalyzing ? 'analyzing base...' : undefined}>
                    {isAnalyzing ? <CakeBaseSkeleton /> : (
                    <div className="space-y-4">
                        {shopifyFixedSize && shopifyBasePrice !== undefined && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Size & Base Price</label>
                                <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg flex items-center justify-between">
                                    <span className="text-sm font-semibold text-purple-800">{shopifyFixedSize}</span>
                                    <span className="text-sm font-bold text-purple-800">₱{shopifyBasePrice.toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                        {!shopifyFixedSize && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Cake Type</label>
                                    <div className="relative"><div ref={cakeTypeScrollContainerRef} className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">{CAKE_TYPES.map(type => (<button key={type} data-caketype={type} type="button" onClick={() => onCakeInfoChange({ type })} className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"><div className={`w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.type === type ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}><img src={CAKE_TYPE_THUMBNAILS[type]} alt={cakeTypeDisplayMap[type]} className="w-full h-full object-cover" /></div><span className="mt-2 text-xs font-medium text-slate-700 leading-tight">{cakeTypeDisplayMap[type]}</span></button>))}</div></div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Cake Height (All tiers)</label>
                                    <div className="relative"><div ref={cakeThicknessScrollContainerRef} className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">{currentThicknessOptions.map(thickness => (<button key={thickness} data-cakethickness={thickness} type="button" onClick={() => onCakeInfoChange({ thickness })} className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"><div className={`relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.thickness === thickness ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}><img src={CAKE_THICKNESS_THUMBNAILS[thickness]} alt={`${thickness} height`} className="w-full h-full object-cover" /></div><span className="mt-2 text-xs font-semibold text-slate-800 leading-tight">{thickness}</span></button>))}</div></div>
                                </div>
                            </>
                        )}
                        {basePriceOptions && basePriceOptions.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Size (Diameter)</label>
                                {basePriceOptions.length === 1 ? (
                                    <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg flex items-center justify-between"><span className="text-sm font-semibold text-purple-800">{basePriceOptions[0].size}</span><span className="text-sm font-bold text-purple-800">₱{basePriceOptions[0].price.toLocaleString()}</span></div>
                                ) : (
                                    <div className="relative"><div ref={cakeSizeScrollContainerRef} className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">{basePriceOptions.map(option => (<button key={option.size} data-cakesize={option.size} type="button" onClick={() => onCakeInfoChange({ size: option.size })} className="group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"><div className={`relative w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.size === option.size ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}><img src={CAKE_SIZE_THUMBNAILS[option.size] || CAKE_TYPE_THUMBNAILS[cakeInfo.type]} alt={option.size} className="w-full h-full object-cover" /><div className="absolute inset-x-0 top-0 pt-4 text-black text-[10px] font-bold text-center leading-tight">{(() => { const sizePart = option.size?.split(' ')[0] || ''; const tiers = sizePart?.match(/\d+"/g) || []; return (<div>{tiers.map((tier, index) => (<React.Fragment key={index}><span>&lt;- {tier} -&gt;</span><br /></React.Fragment>))}</div>);})()}</div></div><span className="mt-2 text-xs font-semibold text-slate-800 leading-tight">{option.size}</span></button>))}</div></div>
                                )}
                            </div>
                        )}
                        <div className="space-y-4 pt-4 border-t border-slate-200">{tierLabels.map((label, index) => { return (<div key={index}><div className="flex items-center gap-3"><span className="text-sm font-medium text-slate-800">{label}</span></div><div className="mt-3"><div className="relative"><div className="flex gap-4 overflow-x-auto pb-3 -mb-3 scrollbar-hide">{FLAVOR_OPTIONS.map(flavor => { const isBento = cakeInfo.type === 'Bento'; const isFlavorDisabled = isBento && (flavor === 'Ube Cake' || flavor === 'Mocha Cake'); return (<button key={flavor} type="button" disabled={isFlavorDisabled} onClick={() => { if (isFlavorDisabled) return; const newFlavors = [...cakeInfo.flavors]; newFlavors[index] = flavor; onCakeInfoChange({ flavors: newFlavors }); }} className={`group flex-shrink-0 w-24 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-opacity ${isFlavorDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}><div className={`w-full aspect-[5/4] rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.flavors[index] === flavor ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}><img src={FLAVOR_THUMBNAILS[flavor]} alt={flavor} className={`w-full h-full object-cover transition-all ${isFlavorDisabled ? 'filter grayscale' : ''}`} /></div><span className="mt-2 text-xs font-medium text-slate-700 leading-tight">{flavor}</span></button>);})}</div></div></div></div>);})}</div>
                    </div>
                    )}
                </Section>
            </div>

            <Section title="Main Toppers" count={isAnalyzing && mainToppers.length === 0 ? undefined : mainToppersCount} defaultOpen={!isAnalyzing} analysisText={isAnalyzing && mainToppers.length === 0 ? 'analyzing toppers...' : undefined}>
                {mainToppers.length > 0 ? (
                    <div className="space-y-2">
                        {mainToppers.map((topper) => (
                            <ListItem
                                key={topper.id}
                                item={{ ...topper, itemCategory: 'topper' }}
                                marker={markerMap.get(topper.id)}
                                onClick={onItemClick}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No main toppers detected.</p>
                )}
            </Section>
            
            <Section title="Support Elements" count={isAnalyzing && supportElements.length === 0 ? undefined : supportElementsCount} defaultOpen={!isAnalyzing} analysisText={isAnalyzing && supportElements.length === 0 ? 'analyzing elements...' : undefined}>
                {supportElements.length > 0 ? (
                    <div className="space-y-2">
                        {supportElements.map((element) => (
                            <ListItem
                                key={element.id}
                                item={{ ...element, itemCategory: 'element' }}
                                marker={markerMap.get(element.id)}
                                onClick={onItemClick}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No support elements detected.</p>
                )}
            </Section>

            <div ref={cakeMessagesSectionRef}>
                <Section title="Cake Messages" defaultOpen={!isAnalyzing} analysisText={isAnalyzing && cakeMessages.length === 0 ? 'analyzing messages...' : undefined}>
                    <div className="space-y-2">
                    {cakeMessages.length > 0 && cakeMessages.map((message) => (
                        <ListItem
                            key={message.id}
                            item={{ ...message, itemCategory: 'message' }}
                            marker={markerMap.get(message.id)}
                            onClick={onItemClick}
                        />
                    ))}

                    {/* Add Message buttons for missing positions */}
                    {missingTopMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage('top')}
                            className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2.5 px-4 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-sm flex items-center gap-2"
                        >
                            <span className="text-lg">+</span> Add Message (Cake Top Side)
                        </button>
                    )}

                    {missingSideMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage('side')}
                            className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2.5 px-4 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-sm flex items-center gap-2"
                        >
                            <span className="text-lg">+</span> Add Message (Cake Front Side)
                        </button>
                    )}

                    {missingBaseBoardMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage('base_board')}
                            className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2.5 px-4 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-sm flex items-center gap-2"
                        >
                            <span className="text-lg">+</span> Add Message (Base Board)
                        </button>
                    )}

                    {cakeMessages.length === 0 && missingTopMessage && missingSideMessage && missingBaseBoardMessage && (
                        <p className="text-sm text-slate-500 text-center py-2">No messages detected.</p>
                    )}
                </div>
            </Section>
            </div>

             <Section title="Additional Instructions" defaultOpen={true}>
                {showAdditionalInstructions ? (
                    <div className="relative animate-fade-in-fast">
                        <textarea
                            value={additionalInstructions}
                            onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
                            className="w-full p-3 pr-10 text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Provide specific notes here, e.g., 'Make the unicorn horn gold,' 'Position the message on the left side.' IMPORTANT: Do not use this to add new items."
                            rows={4}
                        />
                        <button
                            type="button"
                            onClick={() => { onAdditionalInstructionsChange(''); setShowAdditionalInstructions(false); }}
                            className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                            aria-label="Remove instructions"
                        >
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.144-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.057-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                        </button>
                        <p className="text-xs text-slate-500 mt-2">
                            <strong>Note:</strong> Use this field for clarifications on existing items (color, position, etc.). Instructions to <strong>add new toppers</strong> will be ignored.
                        </p>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowAdditionalInstructions(true)}
                        className="w-full text-center bg-white border border-dashed border-slate-400 text-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                        + Add Additional Instructions
                    </button>
                )}
             </Section>
        </div>
    );
});
FeatureList.displayName = 'FeatureList';

```

## File: src/components/LazyImage.tsx

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from './LoadingSkeletons';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholderClassName?: string;
  eager?: boolean;
  preventFlickerOnUpdate?: boolean;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholderClassName,
  onLoad,
  eager = false,
  preventFlickerOnUpdate = false,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(eager);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (eager || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '200px 0px' }
    );

    const currentContainerRef = containerRef.current;
    if (currentContainerRef) {
      observer.observe(currentContainerRef);
    }

    return () => {
      if (currentContainerRef) {
        observer.unobserve(currentContainerRef);
      }
    };
  }, [src, eager]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) {
      onLoad(e);
    }
  };

  useEffect(() => {
    // When the src changes, reset the loaded state, but only if we want the flicker.
    if (!preventFlickerOnUpdate) {
        setIsLoaded(false);
    }
    if (eager) {
      setIsInView(true);
    }
  }, [src, eager, preventFlickerOnUpdate]);

  return (
    // The container should take up the space defined by className to prevent layout shift
    <div ref={containerRef} className={`relative overflow-hidden ${className} ${placeholderClassName || ''}`}>
      {!isLoaded && (
        // The skeleton is absolutely positioned to fill the container
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      {isInView && src && (
        <img
          src={src}
          alt={alt}
          // The image also takes the className to fill the container
          className={`${className} transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;
```

## File: src/components/LoadingSpinner.tsx

```tsx
import React from 'react';

export const LoadingSpinner: React.FC = React.memo(() => {
  return (
    <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-purple-500"></div>
  );
});
LoadingSpinner.displayName = 'LoadingSpinner';

```

## File: src/components/FloatingImagePreview.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { MagicSparkleIcon, Loader2 } from './icons';
import { HybridAnalysisResult } from '../types';
import { ImageZoomModal } from './ImageZoomModal';
import LazyImage from './LazyImage';

type ImageTab = 'original' | 'customized';

interface FloatingImagePreviewProps {
  isVisible: boolean;
  originalImage: string | null;
  customizedImage: string | null;
  isLoading: boolean;
  isUpdatingDesign: boolean;
  activeTab: ImageTab;
  onTabChange: (tab: ImageTab) => void;
  onUpdateDesign: () => void;
  isAnalyzing: boolean;
  analysisResult: HybridAnalysisResult | null;
  isCustomizationDirty: boolean;
}

export const FloatingImagePreview: React.FC<FloatingImagePreviewProps> = React.memo(({
  isVisible,
  originalImage,
  customizedImage,
  isLoading,
  isUpdatingDesign,
  activeTab,
  onTabChange,
  onUpdateDesign,
  isAnalyzing,
  analysisResult,
  isCustomizationDirty,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const show = isVisible && originalImage;

  const handleCustomizedTabClick = () => {
    if (isCustomizationDirty) {
      onUpdateDesign();
    } else {
      onTabChange('customized');
    }
  };

  return (
    <>
      <div
        className={`fixed top-4 left-4 w-[43vw] max-w-xl md:w-[24vw] md:max-w-xs z-30 transition-all duration-300 ease-in-out ${
          show ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        }`}
        aria-hidden={!show}
        role="region"
        aria-label="Floating Image Preview"
      >
        <div className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
          <div className="p-1.5 flex-shrink-0">
            <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
              <button
                onClick={() => onTabChange('original')}
                className={`w-1/2 py-1 text-xs font-semibold rounded-md transition-all duration-200 ease-in-out ${
                  activeTab === 'original'
                    ? 'bg-white shadow text-purple-700'
                    : 'text-slate-600 hover:bg-white/50'
                }`}
              >
                Original
              </button>
              <button
                onClick={handleCustomizedTabClick}
                disabled={(!customizedImage && !isCustomizationDirty) || isUpdatingDesign}
                className={`w-1/2 py-1 text-xs font-semibold rounded-md transition-all duration-200 ease-in-out ${
                  activeTab === 'customized'
                    ? 'bg-white shadow text-purple-700'
                    : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'
                }`}
              >
                Customized
              </button>
            </div>
          </div>
          <div className="relative flex-grow flex items-center justify-center p-2 pt-0 aspect-square">
            {isUpdatingDesign && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20">
                <LoadingSpinner />
              </div>
            )}
            {originalImage && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full h-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-lg secure-image-container"
                aria-label="Enlarge image"
                onContextMenu={(e) => e.preventDefault()}
              >
                <LazyImage
                  key={activeTab}
                  src={activeTab === 'customized' ? (customizedImage || originalImage) : originalImage}
                  alt={activeTab === 'customized' && customizedImage ? "Customized Cake" : "Original Cake"}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  placeholderClassName="w-full h-full object-contain rounded-lg"
                />
              </button>
            )}
          </div>
          <div className="p-2 pt-0">
            <button
              onClick={onUpdateDesign}
              disabled={isUpdatingDesign}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center text-xs"
            >
              {isUpdatingDesign ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <MagicSparkleIcon className="w-4 h-4 mr-2" />
                  Update Design
                </>
              )}
            </button>
            {isAnalyzing && (
                <div className="w-full bg-slate-200 rounded-full h-1.5 relative overflow-hidden mt-2">
                    <div className="absolute h-full w-1/2 bg-gradient-to-r from-pink-500 to-purple-600 animate-progress-slide"></div>
                </div>
            )}
          </div>
        </div>
      </div>
      <ImageZoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        originalImage={originalImage}
        customizedImage={customizedImage}
        initialTab={activeTab}
      />
    </>
  );
});
FloatingImagePreview.displayName = 'FloatingImagePreview';
```

## File: src/components/ImageUploader.optimized.tsx

```tsx
import React, { lazy, Suspense } from 'react';
import { Skeleton } from './LoadingSkeletons';

const ImageUploaderCore = lazy(() => import('./ImageUploader').then(module => ({ default: module.ImageUploader })));

import { ImageUploaderProps } from './ImageUploader';

export const ImageUploader: React.FC<ImageUploaderProps> = (props) => (
  <Suspense fallback={<Skeleton className="w-full h-64" />}>
    <ImageUploaderCore {...props} />
  </Suspense>
);
```

## File: src/components/ShareButton.tsx

```tsx
'use client';

import React from 'react';
import { Share2Icon, Loader2 } from './icons';

interface ShareButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ 
  onClick, 
  isLoading = false,
  disabled = false,
  className = '' 
}) => {
  const isEffectivelyDisabled = isLoading || disabled;
  const tooltipText = "Customize design to share";
  const showTooltip = disabled && !isLoading;

  return (
    <div className={`relative group ${className}`}>
      <button
        onClick={onClick}
        disabled={isEffectivelyDisabled}
        className={`
          w-full flex items-center justify-center gap-2
          px-4 py-3 h-full
          bg-white border-2 border-pink-500 
          text-pink-600 font-bold text-sm
          rounded-xl shadow-sm
          hover:bg-pink-50 hover:shadow-md
          transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label={isLoading ? "Generating share link" : "Share your cake design"}
        type="button"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Sharing...</span>
          </>
        ) : (
          <>
            <Share2Icon className="w-5 h-5" />
            <span>Share</span>
          </>
        )}
      </button>
      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs px-3 py-1.5 bg-slate-800 text-white text-xs rounded-md invisible group-hover:visible transition-opacity opacity-0 group-hover:opacity-100 pointer-events-none z-10 text-center">
          {tooltipText}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};
```

## File: src/components/icons.tsx

```tsx
import React from 'react';
import { LazyImage } from './LazyImage';

export const UploadIcon: React.FC = () => (
    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
);


export const MagicSparkleIcon: React.FC<{className?: string}> = ({className = "w-6 h-6 mr-3"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
);

// FIX: Update ErrorIcon to accept a className prop to allow for style overrides.
export const ErrorIcon: React.FC<{className?: string}> = ({className = "w-16 h-16 text-red-500"}) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const ImageIcon: React.FC = () => (
    <svg className="w-16 h-16 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

export const ResetIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
);

export const SaveIcon: React.FC = () => (
    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

export const TrashIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.144-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.057-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

export const PriceTagIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-2 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
);

export const SearchIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
);

export const CameraIcon: React.FC<{className?: string}> = ({className = "w-6 h-6"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.776 48.776 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
);

export const CloseIcon: React.FC<{className?: string}> = ({className = "w-6 h-6"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);

export const BackIcon: React.FC<{className?: string}> = ({className = "w-6 h-6"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
);

export const PhotoIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
);


export const ChevronDownIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
);

export const CartIcon: React.FC<{className?: string}> = ({className = "w-6 h-6"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c.51 0 .962-.344 1.087-.849l1.858-6.443a.75.75 0 0 0-.7-1.028H5.613" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
);

export const UserCircleIcon: React.FC<{className?: string}> = ({className = "w-6 h-6"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

export const LogOutIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
);

export const Loader2: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

export const MapPinIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
    </svg>
);

export const PackageIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7.5 4.27 9 5.15"/>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.27 6.96 8.73 5.05 8.73-5.05"/>
        <path d="M12 22.08V12"/>
    </svg>
);


// --- Icing Guide Icons ---
const GuideIconBase: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className = "w-8 h-8 text-slate-400 shrink-0" }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 15H35V35H5V15Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M5 15C5 10 10 10 15 10H25C30 10 35 10 35 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {children}
    </svg>
);

export const DripGuideIcon: React.FC<{className?: string}> = ({className = "w-8 h-8 shrink-0"}) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="drip-icon-cake-body-grad" x1="50" y1="45" x2="50" y2="95" gradientUnits="userSpaceOnUse">
                <stop stopColor="#EAE4F2"/>
                <stop offset="1" stopColor="#DCD6E8"/>
            </linearGradient>
            <linearGradient id="drip-icon-drip-grad" x1="50" y1="25" x2="50" y2="70" gradientUnits="userSpaceOnUse">
                <stop stopColor="#9B4DFF"/>
                <stop offset="1" stopColor="#8A2BE2"/>
            </linearGradient>
            <filter id="drip-icon-soft-shadow" x="-10" y="-10" width="120" height="120" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="1" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.15"/>
            </filter>
        </defs>
        <g filter="url(#drip-icon-soft-shadow)">
            {/* Cake Body */}
            <path d="M10 90 C 5 90, 5 85, 10 85 L 10 45 C 5 45, 5 40, 10 40 L 90 40 C 95 40, 95 45, 90 45 L 90 85 C 95 85, 95 90, 90 90 Z" fill="url(#drip-icon-cake-body-grad)"/>
            {/* Drip */}
            <path d="M10 45 C 5 45, 5 40, 10 40 L 90 40 C 95 40, 95 45, 90 45 C 92 53, 88 56, 85 53 C 82 50, 80 56, 77 63 C 74 70, 70 71, 67 64 C 64 57, 60 60, 57 68 C 54 76, 50 75, 47 67 C 44 59, 40 56, 37 53 C 34 50, 32 56, 29 60 C 26 64, 22 63, 20 56 C 18 49, 14 51, 10 45 Z" fill="url(#drip-icon-drip-grad)"/>
            {/* Highlight on drip top */}
            <path d="M18 42 C 12 42, 12 38, 18 38 L 82 38 C 88 38, 88 42, 82 42 Z" fill="white" fillOpacity="0.5" style={{filter: 'blur(1.5px)'}} />
        </g>
    </svg>
);

export const SideIcingGuideIcon: React.FC<{className?: string}> = ({className = "w-8 h-8 shrink-0"}) => (
    <LazyImage src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/side%20icing.webp" alt="Side icing guide" className={className} />
);

export const TopIcingGuideIcon: React.FC<{className?: string}> = ({className = "w-8 h-8 shrink-0"}) => (
    <LazyImage src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/topicing.webp" alt="Top icing guide" className={className} />
);

export const TopBorderGuideIcon: React.FC<{className?: string}> = ({className = "w-8 h-8 shrink-0"}) => (
    <LazyImage src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/top%20border.webp" alt="Top border guide" className={className} />
);

export const BaseBorderGuideIcon: React.FC<{className?: string}> = ({className = "w-8 h-8 shrink-0"}) => (
    <LazyImage src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/baseborder.webp" alt="Base border guide" className={className} />
);

export const BaseBoardGuideIcon: React.FC<{className?: string}> = ({className = "w-8 h-8 shrink-0"}) => (
    <LazyImage src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/baseboard.webp" alt="Base board guide" className={className} />
);

export const PencilIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);

export const ReportIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
);

export const Share2Icon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
    </svg>
);

export const CopyIcon: React.FC<{className?: string}> = ({className = "w-6 h-6"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
);

export const CheckCircleIcon: React.FC<{className?: string}> = ({className = "w-6 h-6"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
);

export const AlertTriangleIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <path d="M12 9v4"/>
        <path d="M12 17h.01"/>
    </svg>
);
```

## File: src/components/LoadingSkeletons.tsx

```tsx
import React from 'react';

// Generic skeleton component
export const Skeleton: React.FC<{ className?: string }> = React.memo(({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
));
Skeleton.displayName = 'Skeleton';


// Cart item skeleton
export const CartItemSkeleton: React.FC = React.memo(() => (
  <div className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200">
    <Skeleton className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-md" />
    <div className="flex-grow space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-6 w-1/4" />
      <div className="pt-4">
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  </div>
));
CartItemSkeleton.displayName = 'CartItemSkeleton';

// Cart loading skeleton (multiple items)
export const CartSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 2 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <CartItemSkeleton key={i} />
    ))}
    <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
      <Skeleton className="h-8 w-1/2" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  </div>
));
CartSkeleton.displayName = 'CartSkeleton';

// Order card skeleton
export const OrderCardSkeleton: React.FC = React.memo(() => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-6 w-20 ml-auto" />
        <Skeleton className="h-4 w-12 ml-auto" />
      </div>
    </div>
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-4">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="w-5 h-5" />
    </div>
  </div>
));
OrderCardSkeleton.displayName = 'OrderCardSkeleton';


// Orders list skeleton
export const OrdersSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <OrderCardSkeleton key={i} />
    ))}
  </div>
));
OrdersSkeleton.displayName = 'OrdersSkeleton';

// Address card skeleton
export const AddressCardSkeleton: React.FC = React.memo(() => (
  <div className="relative p-5 bg-white rounded-xl border-2 border-slate-200">
      <div className="flex items-start gap-4">
        <Skeleton className="w-6 h-6 rounded-full" />
        <div className="flex-grow space-y-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
));
AddressCardSkeleton.displayName = 'AddressCardSkeleton';

export const AddressesSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 2 }) => (
    <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
            <AddressCardSkeleton key={i} />
        ))}
    </div>
));
AddressesSkeleton.displayName = 'AddressesSkeleton';


// New skeleton for FeatureList Toggle items
export const ToggleSkeleton: React.FC = React.memo(() => (
    <div className="bg-white p-3 rounded-md border border-slate-200">
        <div className="flex justify-between items-center animate-pulse">
            <div className="flex items-center gap-3 w-3/4">
                <div className="h-4 bg-slate-200 rounded w-full"></div>
            </div>
            <div className="w-11 h-6 bg-slate-200 rounded-full"></div>
        </div>
    </div>
));
ToggleSkeleton.displayName = 'ToggleSkeleton';

// New skeleton for thumbnail lists
const ThumbnailSkeleton: React.FC = () => (
    <div className="flex-shrink-0 w-24 flex flex-col items-center text-center gap-2">
        <Skeleton className="w-full aspect-[5/4] rounded-lg" />
        <Skeleton className="h-3 w-16" />
    </div>
);

export const ThumbnailListSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 3 }) => (
    <div className="flex gap-4 overflow-x-hidden px-1">
        {Array.from({ length: count }).map((_, i) => (
            <ThumbnailSkeleton key={i} />
        ))}
    </div>
));
ThumbnailListSkeleton.displayName = 'ThumbnailListSkeleton';

const FlavorTierSkeleton: React.FC = () => (
    <div className="bg-white p-3 rounded-md border border-slate-200 space-y-3">
        <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-md" />
            <Skeleton className="h-5 w-2/4" />
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200">
            <ThumbnailListSkeleton />
        </div>
    </div>
);


export const CakeBaseSkeleton: React.FC = React.memo(() => (
    <div className="bg-white p-3 rounded-md border border-slate-200 space-y-4 animate-pulse">
        <div>
            <Skeleton className="h-4 w-1/4 mb-2" />
            <ThumbnailListSkeleton />
        </div>
    </div>
));
CakeBaseSkeleton.displayName = 'CakeBaseSkeleton';
```

## File: src/components/FloatingResultPanel.tsx

```tsx
// components/FloatingResultPanel.tsx
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { MainTopperUI, SupportElementUI, CakeMessageUI, MainTopperType, SupportElementType, IcingDesignUI, IcingColorDetails, CakeType, HybridAnalysisResult } from '../types';
// FIX: Changed import from non-existent ArrowLeft to BackIcon.
import { PencilIcon, PhotoIcon, TrashIcon, BackIcon, Loader2, ResetIcon, MagicSparkleIcon } from './icons';
import { ColorPalette } from './ColorPalette';
import { MultiColorEditor } from './MultiColorEditor';
import { ClusteredMarker, AnalysisItem } from '../app/customizing/page';

// --- Constants copied from FeatureList.tsx for self-containment ---
const topperTypeDisplayMap: Record<MainTopperType, string> = {
  'edible_3d_complex': 'Gumpaste (Complex)', 'edible_3d_ordinary': 'Gumpaste (Ordinary)', 'printout': 'Printout', 'edible_photo': 'Printout (Edible)',
  'toy': 'Toy', 'figurine': 'Figurine (Simpler)', 'plastic_ball': 'Plastic Ball', 'cardstock': 'Cardstock', 'candle': 'Candle',
  'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish', 'icing_brush_stroke': 'Brush Stroke Finish',
  'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread', 'meringue_pop': 'Meringue Pop',
};
const originalTypeLabelMap: Record<MainTopperType, string> = {
    'edible_3d_complex': '3D Complex', 'edible_3d_ordinary': '3D Ordinary', 'figurine': 'Figurine', 'toy': 'Toy', 'plastic_ball': 'Plastic Ball', 'cardstock': 'Cardstock',
    'edible_photo': 'Edible Photo', 'printout': 'Printout', 'candle': 'Candle',
    'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish', 'icing_brush_stroke': 'Brush Stroke Finish',
    'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread', 'meringue_pop': 'Meringue Pop',
};
const supportTypeDisplayMap: Record<SupportElementType, string> = {
    'edible_3d_support': 'Gumpaste (3D)', 'edible_2d_support': 'Gumpaste (2D)', 'chocolates': 'Chocolates',
    'sprinkles': 'Sprinkles', 'dragees': 'Dragees (Pearls)', 'support_printout': 'Printout', 'edible_photo_side': 'Printout (Edible)',
    'isomalt': 'Isomalt (Sugar Glass)', 'edible_flowers': 'Edible Flowers', 'icing_doodle': 'Piped Doodles', 'icing_palette_knife': 'Palette Knife Finish',
    'icing_brush_stroke': 'Brush Stroke Finish', 'icing_splatter': 'Splatter Finish', 'icing_minimalist_spread': 'Minimalist Spread',
};
const COLORABLE_ITEM_TYPES: Array<MainTopperType | SupportElementType> = [
    'edible_3d_complex', 'edible_3d_ordinary', 'edible_3d_support', 'edible_2d_support', 'edible_flowers', 'icing_doodle',
    'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop',
];
// --- End of copied constants ---

interface FloatingResultPanelProps {
  selectedItem: ClusteredMarker | null;
  onClose: () => void;
  mainToppers: MainTopperUI[];
  updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
  removeMainTopper: (id: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => void;
  supportElements: SupportElementUI[];
  updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
  removeSupportElement: (id: string) => void;
  onSupportElementImageReplace: (elementId: string, file: File) => void;
  cakeMessages: CakeMessageUI[];
  updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
  removeCakeMessage: (id: string) => void;
  addCakeMessage: (position: 'top' | 'side' | 'base_board') => void;
  onCakeMessageChange: (messages: CakeMessageUI[]) => void;
  icingDesign: IcingDesignUI | null;
  onIcingDesignChange: (design: IcingDesignUI) => void;
  analysisResult: HybridAnalysisResult | null;
  itemPrices: Map<string, number>;
  isAdmin?: boolean;
  onUpdateDesign: () => void;
  isUpdatingDesign: boolean;
}

const SimpleToggle: React.FC<{ label: string; isEnabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean; }> = ({ label, isEnabled, onChange, disabled=false }) => (
    <div className={`flex justify-between items-center p-1 ${disabled ? 'opacity-50' : ''}`}>
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <button
            type="button"
            onClick={() => !disabled && onChange(!isEnabled)}
            disabled={disabled}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out ${isEnabled ? 'bg-purple-600' : 'bg-slate-300'}`}
            aria-pressed={isEnabled}
        >
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const PanelToggle: React.FC<{ label: React.ReactNode; isEnabled: boolean; onChange: (enabled: boolean) => void; price?: number; children?: React.ReactNode; onDelete?: () => void; disabled?: boolean; }> = ({ label, isEnabled, onChange, price, children, onDelete, disabled = false }) => (
    <div className={`p-2 rounded-md transition-opacity duration-200 ${isEnabled ? 'opacity-100' : 'opacity-60'} ${disabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : ''}`}>
        <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className={`text-xs font-medium transition-colors duration-200 ${isEnabled ? 'text-slate-800' : 'text-slate-500 line-through'} ${disabled ? 'text-slate-400' : ''}`}>{label}</div>
            </div>
            <div className="flex items-center space-x-2">
                {price !== undefined && price > 0 && <span className={`text-xs font-semibold transition-colors duration-200 ${isEnabled ? 'text-green-600' : 'text-slate-400 line-through'}`}>₱{price}</span>}
                {onDelete && (
                    <button type="button" onClick={!disabled ? onDelete : undefined} disabled={disabled} className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors duration-200 disabled:opacity-50" aria-label="Remove item">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
                <button type="button" onClick={() => !disabled && onChange(!isEnabled)} disabled={disabled} className={`relative inline-flex items-center h-5 w-9 transition-colors duration-200 ease-in-out rounded-full ${isEnabled ? 'bg-purple-600' : 'bg-slate-300'} ${disabled ? 'cursor-not-allowed' : ''}`} aria-pressed={isEnabled}>
                    <span className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${isEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
        {isEnabled && !disabled && children && <div className="mt-2 pt-2 border-t border-slate-100">{children}</div>}
    </div>
);


export const FloatingResultPanel: React.FC<FloatingResultPanelProps> = ({
    selectedItem,
    onClose,
    mainToppers, updateMainTopper, removeMainTopper, onTopperImageReplace,
    supportElements, updateSupportElement, removeSupportElement, onSupportElementImageReplace,
    cakeMessages, updateCakeMessage, removeCakeMessage, addCakeMessage, onCakeMessageChange,
    icingDesign, onIcingDesignChange,
    analysisResult,
    itemPrices, isAdmin,
    onUpdateDesign, isUpdatingDesign
}) => {
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = dragStartX !== null;
  const [editingColorForItemId, setEditingColorForItemId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isUploadingImageFor, setIsUploadingImageFor] = useState<string | null>(null);


  const upToDateItem = useMemo(() => {
    if (!selectedItem) return null;
    
    if ('isCluster' in selectedItem && selectedItem.isCluster) {
        const updatedItems = selectedItem.items.map(item => {
            let foundItem;
            switch (item.itemCategory) {
                case 'topper':
                    foundItem = mainToppers.find(t => t.id === item.id);
                    break;
                case 'element':
                    foundItem = supportElements.find(e => e.id === item.id);
                    break;
                case 'message':
                    foundItem = cakeMessages.find(m => m.id === item.id);
                    break;
                default:
                    return item; // For 'icing'
            }
            // Return null if item was deleted, so it can be filtered out
            return foundItem ? { ...item, ...foundItem } : null; 
        }).filter((item): item is AnalysisItem => item !== null);

        // If all items in cluster were deleted, the whole cluster is gone
        if (updatedItems.length === 0) return null;

        return { ...selectedItem, items: updatedItems };
    }

    // Handle single items
    const item = selectedItem as AnalysisItem;
    let foundItem;
    switch (item.itemCategory) {
        case 'topper':
            foundItem = mainToppers.find(t => t.id === item.id);
            break;
        case 'element':
            foundItem = supportElements.find(e => e.id === item.id);
            break;
        case 'message':
            foundItem = cakeMessages.find(m => m.id === item.id);
            break;
        default:
            return item;
    }
    return foundItem ? { ...item, ...foundItem } : null;
  }, [selectedItem, mainToppers, supportElements, cakeMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (selectedItem) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [selectedItem, onClose]);

  useEffect(() => {
      if (selectedItem && !upToDateItem) {
          onClose();
      }
  }, [selectedItem, upToDateItem, onClose]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setDragStartX('touches' in e ? e.touches[0].clientX : e.clientX);
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (dragStartX === null) return;
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = currentX - dragStartX;
    if (delta > 0) {
      setDragDeltaX(delta);
    }
  }, [dragStartX]);

  const handleDragEnd = useCallback(() => {
    if (panelRef.current) panelRef.current.style.transition = 'transform 0.3s ease-out';
    if (dragDeltaX > 100) {
      onClose();
    }
    setDragStartX(null);
    setDragDeltaX(0);
  }, [dragDeltaX, onClose]);
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    setEditingColorForItemId(null);
  }, [selectedItem]);

    const handleImageReplace = async (itemCategory: 'topper' | 'element', itemId: string, file: File) => {
        setIsUploadingImageFor(itemId);
        try {
            if (itemCategory === 'topper') {
                await onTopperImageReplace(itemId, file);
            } else {
                await onSupportElementImageReplace(itemId, file);
            }
        } catch (error) {
            console.error("Image replacement failed in panel:", error);
        } finally {
            setIsUploadingImageFor(null);
        }
    };

    const handleTopperColorArrayChange = (topperId: string, colorIndex: number, newHex: string) => {
        const topper = mainToppers.find(t => t.id === topperId);
        if (topper && topper.colors) {
            const newColors = [...topper.colors];
            newColors[colorIndex] = newHex;
            updateMainTopper(topperId, { colors: newColors });
        }
    };

    const handleSupportColorArrayChange = (elementId: string, colorIndex: number, newHex: string) => {
        const element = supportElements.find(e => e.id === elementId);
        if (element && element.colors) {
            const newColors = [...element.colors];
            newColors[colorIndex] = newHex;
            updateSupportElement(elementId, { colors: newColors });
        }
    };

  const inViewClass = 'translate-x-0';
  const outOfViewClass = 'translate-x-[calc(100%+2rem)]';

  // Check if there are any changes in the current item(s) compared to original
  const hasChanges = useMemo(() => {
    if (!upToDateItem || !analysisResult) return false;

    const checkItemChanges = (item: AnalysisItem): boolean => {
      if (item.itemCategory === 'topper') {
        const topper = item as MainTopperUI;
        const original = analysisResult.main_toppers?.find(t => t.id === topper.id);
        if (!original) return false;
        return (
          topper.type !== original.type ||
          topper.color !== original.color ||
          topper.isEnabled !== original.isEnabled ||
          JSON.stringify(topper.colors) !== JSON.stringify(original.colors) ||
          !!topper.replacementImage
        );
      }

      if (item.itemCategory === 'element') {
        const element = item as SupportElementUI;
        const original = analysisResult.support_elements?.find(e => e.id === element.id);
        if (!original) return false;
        return (
          element.type !== original.type ||
          element.color !== original.color ||
          element.isEnabled !== original.isEnabled ||
          JSON.stringify(element.colors) !== JSON.stringify(original.colors) ||
          !!element.replacementImage
        );
      }

      if (item.itemCategory === 'message') {
        const message = item as CakeMessageUI;
        const original = analysisResult.cake_messages?.find(m => m.id === message.id);
        if (!original) return true; // New message
        return (
          message.text !== original.text ||
          message.color !== original.color ||
          message.isEnabled !== original.isEnabled
        );
      }

      return false;
    };

    if ('isCluster' in upToDateItem && upToDateItem.isCluster) {
      return upToDateItem.items.some(item => checkItemChanges(item));
    }

    return checkItemChanges(upToDateItem as AnalysisItem);
  }, [upToDateItem, analysisResult]);

  const renderSingleItemEditor = (itemToRender: AnalysisItem) => {
    if (itemToRender.itemCategory === 'topper' || itemToRender.itemCategory === 'element') {
        const item = itemToRender as MainTopperUI | SupportElementUI;
        const isTopper = itemToRender.itemCategory === 'topper';
        
        const descriptionString = String(item.description || '');

        // Centralized human figure check
        const isHumanFigure = descriptionString.toLowerCase().includes('person') || 
                              descriptionString.toLowerCase().includes('character') || 
                              descriptionString.toLowerCase().includes('human') || 
                              descriptionString.toLowerCase().includes('figure') || 
                              descriptionString.toLowerCase().includes('silhouette');

        // Material Options Flags
        const isNumberTopper = isTopper && descriptionString.toLowerCase().includes('number') && ['edible_3d_complex', 'edible_3d_ordinary', 'candle', 'printout'].includes(item.original_type);
        const is3DFlower = isTopper && ['edible_3d_complex', 'edible_3d_ordinary'].includes(item.original_type) && descriptionString.toLowerCase().includes('flower');
        const isOriginalPrintoutTopper = isTopper && item.original_type === 'printout';
        const canBeSwitchedToPrintoutTopper = isTopper && ['edible_3d_complex', 'edible_3d_ordinary', 'edible_photo'].includes(item.original_type) && !is3DFlower;
        const isCardstock = isTopper && item.original_type === 'cardstock';
        const isToyOrFigurine = isTopper && ['toy', 'figurine', 'plastic_ball'].includes(item.original_type);
        const isWrapSwitchable = !isTopper && item.original_type === 'edible_photo_side';
        const isGumpasteSwitchable = !isTopper && ['edible_3d_support', 'edible_2d_support'].includes(item.original_type);
        const isOriginalPrintoutElement = !isTopper && item.original_type === 'support_printout';
        const hasMaterialOptions = isNumberTopper || isOriginalPrintoutTopper || canBeSwitchedToPrintoutTopper || isCardstock || isToyOrFigurine || isWrapSwitchable || isGumpasteSwitchable || isOriginalPrintoutElement;

        // Other Options Flags
        const isPrintoutOrPhoto = item.type === 'printout' || item.type === 'edible_photo' || item.type === 'support_printout' || item.type === 'edible_photo_side';
        const isDoodle = item.original_type === 'icing_doodle';
        const canChangeColor = isDoodle || (COLORABLE_ITEM_TYPES.includes(item.original_type) && 'original_color' in item && item.original_color);
        const isReplaceableIcingFigure = (item.type === 'icing_doodle' || item.type === 'icing_palette_knife') && isHumanFigure;
        const isReplaceableGumpasteFigure = (item.type === 'edible_3d_complex' || item.type === 'edible_3d_ordinary' || item.type === 'edible_3d_support') && isHumanFigure;
        const isPaletteKnife = item.type === 'icing_palette_knife';
        const canChangeMultipleColors = isPaletteKnife && 'colors' in item && item.colors && item.colors.length > 0;
        
        const hasOptions = hasMaterialOptions || isPrintoutOrPhoto || canChangeColor || isReplaceableIcingFigure || isReplaceableGumpasteFigure || canChangeMultipleColors;
        
        const materialLabel = isTopper ? topperTypeDisplayMap[item.type as MainTopperType] : supportTypeDisplayMap[item.type as SupportElementType];
        const itemLabel = (
            <div className="flex flex-col items-start">
                <span className="leading-tight text-xs">{`${descriptionString} (${'size' in item ? item.size : 'coverage' in item ? item.coverage : ''})`}</span>
                <span className="text-[10px] text-purple-600 font-semibold bg-purple-100 px-1.5 py-0.5 rounded-md mt-1">{materialLabel}</span>
            </div>
        );

        return (
            <PanelToggle
                label={itemLabel}
                isEnabled={item.isEnabled}
                price={isAdmin ? itemPrices.get(item.id) : undefined}
                onChange={(isEnabled) => (isTopper ? updateMainTopper : updateSupportElement)(item.id, { isEnabled })}
            >
                {hasOptions && (
                     <div className="mt-2 pt-2 border-t border-slate-100 space-y-3">
                        {hasMaterialOptions && (
                            <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">Material Type</label>
                                <div className="flex space-x-1 bg-slate-100 p-0.5 rounded-md">
                                    {isNumberTopper && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: (item as MainTopperUI).original_type })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${['edible_3d_complex', 'edible_3d_ordinary'].includes(item.type) ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'candle' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'candle' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Candle</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                    {isOriginalPrintoutTopper && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Paper Printout</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'edible_photo' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'edible_photo' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible Image</button>
                                        </>
                                    )}
                                    {canBeSwitchedToPrintoutTopper && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: (item as MainTopperUI).original_type })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === (item as MainTopperUI).original_type ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>{originalTypeLabelMap[(item as MainTopperUI).original_type]}</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                    {isCardstock && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'cardstock' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'cardstock' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Cardstock</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                    {isToyOrFigurine && (
                                        <>
                                            <button onClick={() => updateMainTopper(item.id, { type: (item as MainTopperUI).original_type })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === (item as MainTopperUI).original_type ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>{topperTypeDisplayMap[(item as MainTopperUI).original_type]}</button>
                                            <button onClick={() => updateMainTopper(item.id, { type: 'printout' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                    {isWrapSwitchable && (
                                        <>
                                            <button onClick={() => updateSupportElement(item.id, { type: 'edible_photo_side' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'edible_photo_side' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Edible Photo Wrap</button>
                                            <button onClick={() => updateSupportElement(item.id, { type: 'support_printout' })} className={`px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout Wrap</button>
                                        </>
                                    )}
                                    {(isGumpasteSwitchable || isOriginalPrintoutElement) && !isWrapSwitchable && (
                                        <>
                                            <button onClick={() => { const newType = isOriginalPrintoutElement ? 'edible_2d_support' : (item as SupportElementUI).original_type; updateSupportElement(item.id, { type: newType }); }} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type !== 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Gumpaste</button>
                                            <button onClick={() => updateSupportElement(item.id, { type: 'support_printout' })} className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded ${item.type === 'support_printout' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Printout</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        {(isPrintoutOrPhoto || isReplaceableIcingFigure || isReplaceableGumpasteFigure) && (
                            <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">
                                    {isReplaceableIcingFigure ? 'Replace Icing Figure' : isReplaceableGumpasteFigure ? 'Replace Gumpaste Figure' : 'Replacement Image'}
                                </label>
                                <div className="flex items-center">
                                    <button type="button" onClick={() => fileInputRefs.current[item.id]?.click()} disabled={isUploadingImageFor === item.id} className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded-md hover:bg-slate-300 transition-colors flex items-center disabled:opacity-50 disabled:cursor-wait">
                                        {isUploadingImageFor === item.id ? (
                                            <>
                                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <PhotoIcon className="w-3 h-3 mr-1"/>
                                                {item.replacementImage ? 'Change' : 'Upload'}
                                            </>
                                        )}
                                    </button>
                                    {item.replacementImage && isUploadingImageFor !== item.id && <span className="text-[10px] ml-2 text-green-600 font-medium">Image selected</span>}
                                    <input type="file" ref={el => { fileInputRefs.current[item.id] = el; }} className="hidden" accept="image/*" onChange={(e) => {
                                        if (e.target.files?.[0]) { handleImageReplace(isTopper ? 'topper' : 'element', item.id, e.target.files[0]); }
                                    }}/>
                                </div>
                                {isReplaceableIcingFigure && <p className="text-[10px] text-slate-500 mt-1">Upload a photo to convert into an icing-style portrait.</p>}
                                {isReplaceableGumpasteFigure && <p className="text-[10px] text-slate-500 mt-1">Upload a photo to convert into a gumpaste-style figure.</p>}
                                {isTopper && item.type === 'edible_photo' && item.replacementImage && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newMessage: CakeMessageUI = {
                                                id: crypto.randomUUID(),
                                                type: 'icing_script',
                                                text: 'Your Text Here',
                                                position: 'top',
                                                color: '#000000',
                                                isEnabled: true,
                                                price: 0,
                                            };
                                            onCakeMessageChange([...cakeMessages, newMessage]);
                                        }}
                                        className="mt-2 w-full text-center text-xs font-semibold text-purple-600 hover:text-purple-800 py-1.5 rounded-lg hover:bg-purple-50 transition-colors border border-dashed border-purple-300"
                                    >
                                        + Add Message On Photo
                                    </button>
                                )}
                            </div>
                        )}
                        {canChangeColor && (() => {
                            const currentColor = item.color;
                            const originalColor = item.original_color;
                            const canRevert = originalColor && currentColor !== originalColor;

                            const handleRevert = () => {
                                if (canRevert) {
                                    (isTopper ? updateMainTopper : updateSupportElement)(item.id, { color: originalColor });
                                }
                            };

                            return (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[10px] font-medium text-slate-600">Color</label>
                                        {canRevert && (
                                            <button onClick={handleRevert} className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                                <ResetIcon className="w-3 h-3" />
                                                Revert
                                            </button>
                                        )}
                                    </div>
                                    <div className="animate-fade-in-fast">
                                        <ColorPalette selectedColor={currentColor || ''} onColorChange={(newHex) => { (isTopper ? updateMainTopper : updateSupportElement)(item.id, { color: newHex }); }} />
                                    </div>
                                </div>
                            );
                        })()}
                        {canChangeMultipleColors && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                                <MultiColorEditor colors={(item as any).colors!} onColorChange={(index, newHex) => {
                                    isTopper ? handleTopperColorArrayChange(item.id, index, newHex) : handleSupportColorArrayChange(item.id, index, newHex);
                                }} />
                            </div>
                        )}
                    </div>
                )}
            </PanelToggle>
        );
    }
    if (itemToRender.itemCategory === 'message') {
        const message = itemToRender as CakeMessageUI;
        return (
             <PanelToggle
                label={`Message: "${message.text}"`}
                isEnabled={message.isEnabled}
                price={isAdmin ? itemPrices.get(message.id) : undefined}
                onChange={(isEnabled) => updateCakeMessage(message.id, { isEnabled })}
            >
                <div className="space-y-3">
                    <div>
                        <label htmlFor={`msg-text-${message.id}`} className="block text-[10px] font-medium text-slate-600 mb-1">Text</label>
                        <input id={`msg-text-${message.id}`} type="text" value={message.text} onChange={(e) => updateCakeMessage(message.id, { text: e.target.value })} className="w-full px-2 py-1 text-xs border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-slate-600 mb-1">Color</label>
                        <div className="animate-fade-in-fast">
                            <ColorPalette selectedColor={message.color} onColorChange={(hex) => { updateCakeMessage(message.id, { color: hex }); }} />
                        </div>
                    </div>
                </div>
            </PanelToggle>
        );
    }
    
    if (itemToRender.itemCategory === 'icing') {
        if (!icingDesign || !itemToRender) return null;

        const description = itemToRender.description;
        const cakeType = (itemToRender as any).cakeType || '1 Tier'; // Default to avoid crash
        const isBento = cakeType === 'Bento';
        
        const renderToggleAndColor = (
            featureKey: 'drip' | 'border_top' | 'border_base' | 'gumpasteBaseBoard',
            colorKey: keyof IcingColorDetails,
            label: string
        ) => {
            const originalColor = analysisResult?.icing_design.colors[colorKey];
            const currentColor = icingDesign.colors[colorKey];
            const canRevert = originalColor && currentColor !== originalColor;

            const handleRevert = () => {
                if (canRevert) {
                    onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: originalColor } });
                }
            };
            
            const isEnabled = icingDesign[featureKey];
            const isDisabled = (featureKey === 'border_base' || featureKey === 'gumpasteBaseBoard') && isBento;

            return (
                <>
                    <SimpleToggle
                        label={label}
                        isEnabled={isEnabled}
                        disabled={isDisabled}
                        onChange={(enabled) => {
                            const newIcingDesign = { ...icingDesign, [featureKey]: enabled };
                            if (enabled && !newIcingDesign.colors[colorKey]) {
                                newIcingDesign.colors = { ...newIcingDesign.colors, [colorKey]: '#FFFFFF' };
                            }
                            onIcingDesignChange(newIcingDesign);
                        }}
                    />
                    {/* Always show color picker, but grey it out when disabled */}
                    <div className={`mt-2 pt-2 border-t border-slate-100 pl-1 transition-opacity ${!isEnabled ? 'opacity-40' : ''}`}>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-slate-600">Color</label>
                            {canRevert && isEnabled && (
                                <button onClick={handleRevert} className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                    <ResetIcon className="w-3 h-3" />
                                    Revert to Original
                                </button>
                            )}
                        </div>
                        <ColorPalette
                            selectedColor={icingDesign.colors[colorKey] || ''}
                            onColorChange={(newHex) => {
                                // Automatically enable the feature when color is changed
                                const newIcingDesign = {
                                    ...icingDesign,
                                    [featureKey]: true,
                                    colors: { ...icingDesign.colors, [colorKey]: newHex }
                                };
                                onIcingDesignChange(newIcingDesign);
                            }}
                        />
                    </div>
                </>
            );
        };

        const renderColorOnly = (colorKey: keyof IcingColorDetails, label: string) => {
            const originalColor = analysisResult?.icing_design.colors[colorKey];
            const currentColor = icingDesign.colors[colorKey];
            const canRevert = originalColor && currentColor !== originalColor;

            const handleRevert = () => {
                if (canRevert) {
                    onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: originalColor } });
                }
            };

            // Determine message position and check if message exists
            let messagePosition: 'top' | 'side' | null = null;
            let messageButtonLabel = '';

            if (label === 'Top Icing Color') {
                messagePosition = 'top';
                messageButtonLabel = '+ Add Message (Cake Top Side)';
            } else if (label === 'Side Icing Color') {
                messagePosition = 'side';
                messageButtonLabel = '+ Add Message (Cake Front Side)';
            }

            const hasMessage = messagePosition ? cakeMessages.some(msg => msg.position === messagePosition) : false;

            return (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-slate-800">{label}</label>
                         {canRevert && (
                            <button onClick={handleRevert} className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                <ResetIcon className="w-3 h-3" />
                                Revert to Original
                            </button>
                        )}
                    </div>
                    <ColorPalette selectedColor={icingDesign.colors[colorKey] || ''} onColorChange={(newHex) => {
                        onIcingDesignChange({ ...icingDesign, colors: { ...icingDesign.colors, [colorKey]: newHex } });
                    }} />

                    {/* Add Message button */}
                    {messagePosition && !hasMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage(messagePosition as 'top' | 'side')}
                            className="w-full mt-3 text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                        >
                            <span className="text-base">+</span> {messageButtonLabel}
                        </button>
                    )}
                </div>
            );
        };

        // Helper function for rendering combined icing color picker
        const renderCombinedIcingColor = () => {
            const originalTopColor = analysisResult?.icing_design.colors.top;
            const originalSideColor = analysisResult?.icing_design.colors.side;
            const currentColor = icingDesign.colors.top || icingDesign.colors.side || '#FFFFFF';

            const canRevertTop = originalTopColor && icingDesign.colors.top !== originalTopColor;
            const canRevertSide = originalSideColor && icingDesign.colors.side !== originalSideColor;
            const canRevert = canRevertTop || canRevertSide;

            const handleRevert = () => {
                const newColors = { ...icingDesign.colors };
                if (canRevertTop && originalTopColor) newColors.top = originalTopColor;
                if (canRevertSide && originalSideColor) newColors.side = originalSideColor;
                onIcingDesignChange({ ...icingDesign, colors: newColors });
            };

            // Check if messages exist for top or side
            const hasTopMessage = cakeMessages.some(msg => msg.position === 'top');
            const hasSideMessage = cakeMessages.some(msg => msg.position === 'side');

            return (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-slate-800">Icing Color</label>
                        {canRevert && (
                            <button onClick={handleRevert} className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50">
                                <ResetIcon className="w-3 h-3" />
                                Revert to Original
                            </button>
                        )}
                    </div>
                    <ColorPalette
                        selectedColor={currentColor}
                        onColorChange={(newHex) => {
                            // Update both top and side colors
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

                    {/* Add Message buttons for both positions */}
                    {!hasTopMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage('top')}
                            className="w-full mt-3 text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                        >
                            <span className="text-base">+</span> + Add Message (Cake Top Side)
                        </button>
                    )}
                    {!hasSideMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage('side')}
                            className="w-full mt-3 text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                        >
                            <span className="text-base">+</span> + Add Message (Cake Front Side)
                        </button>
                    )}
                </div>
            );
        };

        switch (description) {
            case 'Drip':
                return renderToggleAndColor('drip', 'drip', 'Enable Drip Effect');
            case 'Top':
                return renderToggleAndColor('border_top', 'borderTop', 'Enable Top Border');
            case 'Bottom':
                return renderToggleAndColor('border_base', 'borderBase', 'Enable Base Border');
            case 'Board':
                return renderToggleAndColor('gumpasteBaseBoard', 'gumpasteBaseBoardColor', 'Enable Covered Board');
            case 'Icing':
                // Check if top and side colors are the same
                const topColor = icingDesign.colors?.top;
                const sideColor = icingDesign.colors?.side;
                const sameColors = topColor && sideColor && topColor.toUpperCase() === sideColor.toUpperCase();

                if (sameColors) {
                    // Show combined color picker
                    return renderCombinedIcingColor();
                } else {
                    // Determine which color to show based on item id if available
                    const itemId = (itemToRender as any).id || '';
                    if (itemId.includes('top')) {
                        return renderColorOnly('top', 'Top Icing Color');
                    } else {
                        return renderColorOnly('side', 'Side Icing Color');
                    }
                }
            default:
                return <p className="p-2 text-xs text-slate-500">Select an icing feature to edit.</p>;
        }
    }
    
    return <p className="p-2 text-xs text-slate-500">No editable properties for this item.</p>;
  }


  return (
    <div
      ref={panelRef}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      className={`fixed bottom-28 right-4 w-80 max-w-[90vw] bg-white/90 backdrop-blur-lg shadow-2xl border border-slate-200 z-50 flex flex-col transform rounded-xl ${selectedItem && !isDragging ? 'transition-transform duration-300 ease-out' : ''} ${selectedItem ? inViewClass : outOfViewClass}`}
      style={isDragging ? { transform: `translateX(${dragDeltaX}px)` } : {}}
    >
        <div className="relative flex-1 flex flex-col">
            <div className={`p-3 flex-grow overflow-y-auto space-y-3 max-h-[calc(100vh-12rem)] transition-all duration-200 ${hasChanges || isUpdatingDesign ? 'pb-14' : 'pb-3'}`}>
                {(() => {
                    if (!upToDateItem) return null;

                    if ('isCluster' in upToDateItem && upToDateItem.isCluster) {
                        return (
                            <div>
                                <h3 className="text-xs font-semibold text-slate-500 mb-2">{upToDateItem.items.length} Items Found Here</h3>
                                <div className="space-y-2">
                                    {upToDateItem.items.map(item => (
                                        <div key={item.id} className="border border-slate-200 rounded-lg bg-white">
                                            {renderSingleItemEditor(item)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    }

                    // It's a single item
                    return renderSingleItemEditor(upToDateItem as AnalysisItem);
                })()}
            </div>

            {/* Apply button in lower right corner - only show when there are changes */}
            {(hasChanges || isUpdatingDesign) && (
                <button
                    onClick={onUpdateDesign}
                    disabled={isUpdatingDesign}
                    className="absolute bottom-2 right-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-1.5 px-3.5 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-1.5 text-sm"
                    title="Apply changes to design"
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
        </div>
    </div>
  );
};
```

## File: src/components/MultiColorEditor.tsx

```tsx
import React, { useState } from 'react';
import { ColorPalette } from './ColorPalette';
import { PencilIcon } from './icons';

interface MultiColorEditorProps {
  colors: (string | null)[];
  onColorChange: (index: number, newHex: string) => void;
}

export const MultiColorEditor: React.FC<MultiColorEditorProps> = ({ colors, onColorChange }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">Palette Colors</label>
      {editingIndex !== null ? (
        <div className="animate-fade-in-fast">
          <ColorPalette
            selectedColor={colors[editingIndex] || ''}
            onColorChange={(newHex) => {
              onColorChange(editingIndex, newHex);
              setEditingIndex(null);
            }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          {colors.map((color, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full border border-slate-300" style={{ backgroundColor: color || '#FFFFFF' }}></div>
              <button
                type="button"
                onClick={() => setEditingIndex(index)}
                className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50"
              >
                <PencilIcon className="w-3 h-3" />
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## File: src/components/EnvVarTest.tsx

```tsx
// EnvVarTest.tsx - Component to verify environment variables
import React from 'react';

const EnvVarTest: React.FC = () => {
  // These will be available at build time
  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
    VITE_GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY ? 'SET' : 'NOT SET',
    VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'SET' : 'NOT SET',
    VITE_GOOGLE_CSE_ID: import.meta.env.VITE_GOOGLE_CSE_ID ? 'SET' : 'NOT SET',
  };

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Environment Variables Check</h2>
      <div className="space-y-2">
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} className="flex justify-between items-center">
            <span className="font-mono text-sm">{key}:</span>
            <span className={`font-mono text-sm px-2 py-1 rounded ${value !== 'NOT SET' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {typeof value === 'string' && value.length > 50 ? `${value.substring(0, 50)}...` : String(value)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-600">
        Note: For security reasons, sensitive values are masked in the display above.
      </p>
    </div>
  );
};

export default EnvVarTest;
```

## File: src/components/ContributionSuccessModal.tsx

```tsx
import React from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';

interface ContributionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  contributionAmount: number;
  discountCode: string;
  onStartDesigning: () => void;
}

export const ContributionSuccessModal: React.FC<ContributionSuccessModalProps> = ({
  isOpen,
  onClose,
  contributionAmount,
  discountCode,
  onStartDesigning,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-scale-in">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">
            Thank You! 🎉
          </h2>
          <p className="text-slate-600 mt-2">
            Your ₱{contributionAmount.toLocaleString()} contribution was successful!
          </p>

          <div className="mt-6 p-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border-2 border-pink-200">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              <h3 className="font-bold text-pink-800">Here's ₱100 OFF Your First Cake!</h3>
            </div>
            <div className="my-3 py-2 px-4 bg-white border-2 border-dashed border-purple-400 rounded-lg text-purple-700 font-mono text-lg font-bold">
              {discountCode}
            </div>
            <p className="text-xs text-slate-500">
              Valid for 30 days on orders over ₱500
            </p>
          </div>

          <p className="text-sm text-slate-600 mt-6">
            ✨ You can design your own AI-powered custom cakes too!
          </p>

          <div className="mt-6 space-y-3">
            <button
              onClick={onStartDesigning}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
            >
              Start Designing Your Cake
            </button>
            <button
              onClick={onClose}
              className="w-full text-center bg-transparent text-slate-600 font-bold py-2 px-4 rounded-xl hover:bg-slate-100 transition-all text-sm"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
      `}</style>
    </>
  );
};
```

## File: src/components/SearchAutocomplete.tsx

```tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, CameraIcon, Loader2 } from './icons'; 
import { CAKE_SEARCH_KEYWORDS } from '../constants/searchKeywords';
import { getSuggestedKeywords, getPopularKeywords } from '../services/supabaseService';

interface SearchAutocompleteProps {
  onSearch: (query: string) => void;
  onUploadClick?: () => void;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
  showUploadButton?: boolean;
}

// Helper to highlight matching text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1 || query.length === 0) return <>{text}</>;

  return (
    <>
      {text.substring(0, index)}
      <span className="font-bold text-pink-600">
        {text.substring(index, index + query.length)}
      </span>
      {text.substring(index + query.length)}
    </>
  );
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  onSearch,
  onUploadClick,
  placeholder = 'Search designs or upload an image...',
  value: query,
  onChange: setQuery,
  inputClassName = "w-full pl-5 pr-32 py-4 text-sm border-slate-200 border rounded-full shadow-lg focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow",
  showUploadButton = true
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- State for suggested and popular keywords ---
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const hasFetchedSuggestions = useRef(false);

  const sameDayKeywords = [
    'minimalist cakes',
    'bento cakes',
    'edible photo cakes',
    'birthday cakes printout only',
  ];

  // Autocomplete filtering effect when user types
  useEffect(() => {
    if (query.trim().length > 0) {
      const lowerQuery = query.toLowerCase();
      const matches = CAKE_SEARCH_KEYWORDS
        .filter(keyword => keyword.toLowerCase().includes(lowerQuery))
        .slice(0, 8); // Show max 8 suggestions
      setSuggestions(matches);
    } else {
      setSuggestions([]); // Clear autocomplete if input is empty
    }
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key separately to ensure it always works
    if (e.key === 'Enter') {
      e.preventDefault();
      // If a suggestion is highlighted, select it. Otherwise, perform a search.
      if (showSuggestions && selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        handleSearch();
      }
      return; // Stop further execution for Enter key
    }
    
    // Guard for other navigation keys (Arrows, Escape)
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim());
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Fetch suggested & popular keywords on focus ---
  const handleFocus = () => {
    setShowSuggestions(true);
    if (hasFetchedSuggestions.current || query.trim().length > 0) return;

    setIsLoadingSuggestions(true);
    hasFetchedSuggestions.current = true; // Prevent re-fetching on subsequent focus events
    
    Promise.all([
      getSuggestedKeywords(),
      Promise.resolve([]) // Popular keywords disabled - RPC function doesn't exist
    ]).then(([suggested, popular]) => {
        if (suggested && suggested.length > 0) {
          setSuggestedKeywords(suggested);
        }
        if (popular && popular.length > 0) {
          setPopularKeywords(popular);
        }
    }).catch(err => {
        console.error("Failed to fetch keywords:", err);
    }).finally(() => {
        setIsLoadingSuggestions(false);
    });
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!showSuggestions) setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            {showUploadButton && onUploadClick && (
                <button
                    type="button"
                    onClick={onUploadClick}
                    className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
                    aria-label="Upload an image"
                >
                    <CameraIcon className="w-5 h-5" />
                </button>
            )}
            <button
            type="button"
            onClick={handleSearch}
            className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors"
            aria-label="Search"
            >
                <SearchIcon />
            </button>
        </div>
      </div>

      {showSuggestions && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
           <style>{`.animate-fade-in { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          
          {query.trim().length === 0 ? (
            // Show suggested and popular keywords when input is empty
            <div>
              {isLoadingSuggestions ? (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {suggestedKeywords.length > 0 && (
                    <div className="p-3">
                      <h3 className="px-1 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Popular Searches</h3>
                      <div className="flex flex-wrap gap-2">
                        {suggestedKeywords.map(keyword => (
                          <button
                            key={`sugg-${keyword}`}
                            onClick={() => handleSelectSuggestion(keyword)}
                            className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-full hover:bg-pink-100 hover:text-pink-700 transition-colors"
                          >
                            {keyword}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {popularKeywords.length > 0 && (
                    <div className={`p-3 ${suggestedKeywords.length > 0 ? 'border-t border-slate-100' : ''}`}>
                       <h3 className="px-1 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Popular Searches</h3>
                       <div className="flex flex-wrap gap-2">
                         {popularKeywords.map(keyword => (
                           <button
                             key={`pop-${keyword}`}
                             onClick={() => handleSelectSuggestion(keyword)}
                             className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-full hover:bg-pink-100 hover:text-pink-700 transition-colors"
                           >
                             {keyword}
                           </button>
                         ))}
                       </div>
                    </div>
                  )}
                   <div className={`p-3 ${(suggestedKeywords.length > 0 || popularKeywords.length > 0) ? 'border-t border-slate-100' : ''}`}>
                    <h3 className="px-1 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Available for same-day deliveries</h3>
                    <div className="flex flex-wrap gap-2">
                      {sameDayKeywords.map(keyword => (
                        <button
                          key={`sameday-${keyword}`}
                          onClick={() => handleSelectSuggestion(keyword)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-full hover:bg-pink-100 hover:text-pink-700 transition-colors"
                        >
                          {keyword}
                        </button>
                      ))}
                    </div>
                  </div>
                   {suggestedKeywords.length === 0 && popularKeywords.length === 0 && !isLoadingSuggestions && (
                      <div className="p-4 text-center text-sm text-slate-500">
                          Start typing to search for a cake design.
                      </div>
                  )}
                </>
              )}
            </div>
          ) : (
            // Show autocomplete list when user is typing
            suggestions.length > 0 && (
              <ul className="max-h-80 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion}>
                    <button
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-purple-50 transition-colors ${index === selectedIndex ? 'bg-purple-50' : ''}`}
                    >
                      <SearchIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-700 text-sm">
                        <HighlightMatch text={suggestion} query={query} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
};
```

## File: src/components/ShareModal.tsx

```tsx
// components/ShareModal.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
// FIX: Removed MapPin and Plus from icons import and added Plus from lucide-react.
import { CloseIcon, CopyIcon, CheckCircleIcon, Loader2 } from './icons';
import { Plus } from 'lucide-react';
import {
  ShareResult,
  generateSocialShareUrl,
  incrementShareCount,
  SOCIAL_MESSAGES,
} from '../services/shareService';
// FIX: Moved delivery date related imports from shareService to supabaseService.
import {
  getAvailableDeliveryDates,
  getBlockedDatesInRange,
  AvailableDate,
  BlockedDateInfo,
} from '../services/supabaseService';
import { showSuccess, showError } from '../lib/utils/toast';
import LazyImage from './LazyImage';
import { AvailabilityType } from '../lib/utils/availability';
import { useAddresses } from '../hooks/useAddresses';
import { useAvailabilitySettings } from '../hooks/useAvailabilitySettings';
import { CakeGenieAddress } from '../lib/database.types';
import AddressForm, { StaticMap } from './AddressForm';

const EVENT_TIME_SLOTS_MAP: { slot: string; startHour: number; endHour: number }[] = [
    { slot: "10AM - 12NN", startHour: 10, endHour: 12 },
    { slot: "12NN - 2PM", startHour: 12, endHour: 14 },
    { slot: "2PM - 4PM", startHour: 14, endHour: 16 },
    { slot: "4PM - 6PM", startHour: 16, endHour: 18 },
    { slot: "6PM - 8PM", startHour: 18, endHour: 20 },
];
const EVENT_TIME_SLOTS = EVENT_TIME_SLOTS_MAP.map(item => item.slot);


interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  shareData: ShareResult | null;
  onCreateLink: (config: {
    billSharingEnabled: boolean;
    billSharingMessage?: string;
    suggestedSplitCount?: number;
    deliveryAddress?: string;
    deliveryCity?: string;
    deliveryPhone?: string;
    eventDate?: string;
    eventTime?: string;
    recipientName?: string;
  }) => void;
  isSaving: boolean;
  finalPrice: number | null;
  user: any | null;
  onAuthRequired: () => void;
  availability: AvailabilityType;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  shareData,
  onCreateLink,
  isSaving,
  finalPrice,
  user,
  onAuthRequired,
  availability,
}) => {
  const [copied, setCopied] = useState(false);
  const [billSharingEnabled, setBillSharingEnabled] = useState(false);
  const [billSharingMessage, setBillSharingMessage] = useState('');
  const [suggestedSplitCount, setSuggestedSplitCount] = useState('');
  
  // New state for delivery details, mirroring cart page
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [partiallyBlockedSlots, setPartiallyBlockedSlots] = useState<BlockedDateInfo[]>([]);
  const [tooltip, setTooltip] = useState<{ date: string; reason: string; } | null>(null);

  const isRegisteredUser = user && !user.is_anonymous;
  const { data: savedAddresses = [], isLoading: isAddressesLoading } = useAddresses(user?.id);
  const { settings: availabilitySettings, loading: isLoadingSettings } = useAvailabilitySettings();

  const { data: availableDates = [], isLoading: isLoadingDates } = useQuery<AvailableDate[]>({
      queryKey: ['available-dates', availabilitySettings?.minimum_lead_time_days],
      queryFn: () => {
          const startDate = new Date();
          const year = startDate.getFullYear();
          const month = String(startDate.getMonth() + 1).padStart(2, '0');
          const day = String(startDate.getDate()).padStart(2, '0');
          return getAvailableDeliveryDates(`${year}-${month}-${day}`, 30);
      },
      enabled: !isLoadingSettings && isOpen && billSharingEnabled,
      staleTime: 5 * 60 * 1000,
  });

  const { data: blockedDatesMap, isLoading: isLoadingBlockedDates } = useQuery({
      queryKey: ['blocked-dates-range'],
      queryFn: () => {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(startDate.getDate() + 30);
          const format = (d: Date) => d.toISOString().split('T')[0];
          return getBlockedDatesInRange(format(startDate), format(endDate));
      },
      enabled: isOpen && billSharingEnabled,
      staleTime: 5 * 60 * 1000,
  });
  
  const correctedDates = useMemo(() => {
    if (isLoadingDates || !availabilitySettings) return availableDates;

    if (availability === 'normal') {
        return availableDates;
    }
    
    const leadTimeDays = availabilitySettings.minimum_lead_time_days || 0;
    if (leadTimeDays === 0) {
        return availableDates;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return availableDates.map(dateInfo => {
        const date = new Date(dateInfo.available_date + 'T00:00:00');
        const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < leadTimeDays) {
            const isFullyBlockedByBackend = !dateInfo.is_rush_available && !dateInfo.is_same_day_available && !dateInfo.is_standard_available;
            if (isFullyBlockedByBackend && diffDays > 0) {
                return { ...dateInfo, is_rush_available: true, is_same_day_available: true };
            }
        }
        return dateInfo;
    });
  }, [availableDates, isLoadingDates, availability, availabilitySettings]);

  const handleDateSelect = useCallback((date: string) => {
      setEventDate(date);
      const blocks = blockedDatesMap?.[date] || [];
      const partials = blocks.filter(b => !b.is_all_day);
      setPartiallyBlockedSlots(partials);
  }, [setEventDate, blockedDatesMap]);

  const getDateStatus = useCallback((dateInfo: AvailableDate) => {
      const date = dateInfo.available_date;
      const blocksOnDate = blockedDatesMap?.[date];
      const isFullyBlocked = blocksOnDate?.some(block => block.is_all_day) ?? false;

      if (isFullyBlocked) {
          return {
              isDisabled: true,
              reason: blocksOnDate?.find(b => b.is_all_day)?.closure_reason || 'Fully Booked / Holiday'
          };
      }

      let leadTimeDisabled = false;
      if (availability === 'rush') leadTimeDisabled = !dateInfo.is_rush_available;
      else if (availability === 'same-day') leadTimeDisabled = !dateInfo.is_same_day_available;
      else leadTimeDisabled = !dateInfo.is_standard_available;

      if (leadTimeDisabled) {
          let leadTimeReason = "Date unavailable for this order's lead time.";
          if (availabilitySettings && availabilitySettings.minimum_lead_time_days > 0 && availability === 'normal') {
              const plural = availabilitySettings.minimum_lead_time_days > 1 ? 's' : '';
              leadTimeReason = `Requires a ${availabilitySettings.minimum_lead_time_days} day${plural} lead time.`;
          }
          return { isDisabled: true, reason: leadTimeReason };
      }

      return { isDisabled: false, reason: null };
  }, [blockedDatesMap, availability, availabilitySettings]);

  const disabledSlots = useMemo(() => {
    const newDisabledSlots: string[] = [];
    const now = new Date();
    const todayString = now.toISOString().split('T')[0];
    
    if (eventDate === todayString) {
        let readyTime: Date | null = null;
        if (availability === 'same-day') {
            readyTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // +3 hours
        } else if (availability === 'rush') {
            readyTime = new Date(now.getTime() + 30 * 60 * 1000); // +30 mins
        }

        if (readyTime) {
            EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                const slotEndDate = new Date(eventDate);
                slotEndDate.setHours(timeSlot.endHour, 0, 0, 0);
                if (slotEndDate < readyTime) {
                    newDisabledSlots.push(timeSlot.slot);
                }
            });
        }
    }

    if (partiallyBlockedSlots.length > 0) {
        const parseTime = (timeStr: string): number => parseInt(timeStr.split(':')[0], 10);
        partiallyBlockedSlots.forEach(blockedSlot => {
            if (blockedSlot.blocked_time_start && blockedSlot.blocked_time_end) {
                const blockStartHour = parseTime(blockedSlot.blocked_time_start);
                const blockEndHour = parseTime(blockedSlot.blocked_time_end);
                EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                    if (timeSlot.startHour < blockEndHour && timeSlot.endHour > blockStartHour) {
                        newDisabledSlots.push(timeSlot.slot);
                    }
                });
            }
        });
    }
    
    return [...new Set(newDisabledSlots)];
  }, [availability, eventDate, partiallyBlockedSlots]);

  useEffect(() => {
    if (eventTime && disabledSlots.includes(eventTime)) {
        setEventTime('');
    }
  }, [eventTime, disabledSlots, setEventTime]);

  useEffect(() => {
    if (isRegisteredUser && !isAddressesLoading && savedAddresses.length > 0 && !selectedAddressId) {
        const defaultAddress = savedAddresses.find(addr => addr.is_default);
        setSelectedAddressId(defaultAddress ? defaultAddress.address_id : savedAddresses[0].address_id);
    }
  }, [isRegisteredUser, savedAddresses, isAddressesLoading, selectedAddressId]);
  
  const selectedAddress = useMemo(() => {
    return isRegisteredUser && selectedAddressId ? savedAddresses.find(a => a.address_id === selectedAddressId) : null;
  }, [isRegisteredUser, selectedAddressId, savedAddresses]);
  
  const handleNewAddressSuccess = (newAddress?: CakeGenieAddress) => {
    if (newAddress) {
        setSelectedAddressId(newAddress.address_id);
    }
    setIsAddingAddress(false);
  };
  
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setBillSharingEnabled(false);
      setBillSharingMessage('');
      setSuggestedSplitCount('');
      setEventDate('');
      setEventTime('');
      setSelectedAddressId('');
      setIsAddingAddress(false);
    }
  }, [isOpen]);

  const handleCreateLinkClick = () => {
    const currentSelectedAddress = savedAddresses.find(a => a.address_id === selectedAddressId);
    
    if (billSharingEnabled) {
      if (!eventDate || !eventTime) {
        showError('Please select a delivery date and time.');
        return;
      }
      if (!currentSelectedAddress) {
        showError('Please select or add a delivery address.');
        return;
      }
    }
  
    onCreateLink({
      billSharingEnabled,
      billSharingMessage: billSharingMessage.trim() || undefined,
      suggestedSplitCount: suggestedSplitCount ? parseInt(suggestedSplitCount) : undefined,
      deliveryAddress: billSharingEnabled ? currentSelectedAddress?.street_address : undefined,
      deliveryCity: billSharingEnabled ? currentSelectedAddress?.city : undefined,
      deliveryPhone: billSharingEnabled ? currentSelectedAddress?.recipient_phone : undefined,
      eventDate: billSharingEnabled ? eventDate : undefined,
      eventTime: billSharingEnabled ? eventTime : undefined,
      recipientName: billSharingEnabled ? currentSelectedAddress?.recipient_name : undefined,
    });
  };

  if (!isOpen) return null;

  const urlToShare = shareData?.botShareUrl || shareData?.shareUrl;

  const handleCopyLink = async () => {
    if (!urlToShare || !shareData) return;
    try {
      await navigator.clipboard.writeText(urlToShare);
      setCopied(true);
      showSuccess('Link copied to clipboard!');
      incrementShareCount(shareData.designId);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSocialShare = (platform: 'facebook' | 'messenger' | 'twitter') => {
    if (!urlToShare || !shareData) return;
    const message = SOCIAL_MESSAGES[platform];
    const url = generateSocialShareUrl(platform, urlToShare, message);
    incrementShareCount(shareData.designId);
    window.open(url, '_blank', 'width=600,height=400');
  };

  const handleInstagramCopy = async () => {
    if (!urlToShare || !shareData) return;
    try {
      const instagramText = `${SOCIAL_MESSAGES.instagram}\n\n${urlToShare}`;
      await navigator.clipboard.writeText(instagramText);
      showSuccess('Caption and link copied! Paste in Instagram.');
      incrementShareCount(shareData.designId);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50 disabled:cursor-not-allowed";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
          <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-slate-800">
              {shareData ? '🎉 Share Your Cake!' : 'Configure & Share'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors" type="button">
              <CloseIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {shareData ? (
            // VIEW 2: Display Link
            <div className="p-6 space-y-4">
              <LazyImage src={imageUrl} alt="Your cake design" className="w-full aspect-square object-cover rounded-xl border-2 border-slate-200" />
              {shareData.botShareUrl && (
                <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-1">✨ Enhanced Social Sharing Active!</p>
                  <p className="text-xs text-blue-700">Your design will show rich previews on Facebook, Twitter & WhatsApp.</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Share this link:</p>
                <div className="flex gap-2">
                  <input value={urlToShare} readOnly className="flex-1 w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none" />
                  <button onClick={handleCopyLink} className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors">
                    {copied ? <CheckCircleIcon className="w-5 h-5 text-green-600" /> : <CopyIcon className="w-5 h-5 text-slate-600" />}
                  </button>
                </div>
              </div>
              <button onClick={() => handleSocialShare('facebook')} type="button" className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl transition-colors group">
                <div className="text-left"><p className="font-semibold text-blue-900">Share on Facebook</p><p className="text-xs text-blue-700">"Check out my custom cake! 🎂"</p></div><span className="text-2xl group-hover:scale-110 transition-transform">📘</span>
              </button>
              <button onClick={() => handleSocialShare('messenger')} type="button" className="w-full flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-xl transition-colors group">
                <div className="text-left"><p className="font-semibold text-indigo-900">Share on Messenger</p><p className="text-xs text-indigo-700">"What do you think? 😍"</p></div><span className="text-2xl group-hover:scale-110 transition-transform">💬</span>
              </button>
              <button onClick={() => handleSocialShare('twitter')} type="button" className="w-full flex items-center justify-between p-4 bg-sky-50 hover:bg-sky-100 border-2 border-sky-200 rounded-xl transition-colors group">
                <div className="text-left"><p className="font-semibold text-sky-900">Share on Twitter/X</p><p className="text-xs text-sky-700">"I designed the perfect cake! 🎂✨"</p></div><span className="text-2xl group-hover:scale-110 transition-transform">🐦</span>
              </button>
              <button onClick={handleInstagramCopy} type="button" className="w-full flex items-center justify-between p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-pink-200 rounded-xl transition-colors group">
                <div className="text-left"><p className="font-semibold text-pink-900">Copy for Instagram</p><p className="text-xs text-pink-700">Link for bio + caption</p></div><span className="text-2xl group-hover:scale-110 transition-transform">📸</span>
              </button>
            </div>
          ) : (
            // VIEW 1: Configuration
            <div className="p-6 space-y-4">
              <LazyImage src={imageUrl} alt="Your cake design" className="w-full aspect-square object-cover rounded-xl border-2 border-slate-200" />
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billSharingEnabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (!user || user.is_anonymous) {
                            e.preventDefault();
                            showError('Please sign in to organize bill sharing');
                            onAuthRequired();
                            return;
                          }
                        }
                        setBillSharingEnabled(e.target.checked);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="font-medium">Enable Bill Sharing</span>
                  </label>

                  {(!user || user.is_anonymous) && !billSharingEnabled && (
                    <div className="pl-6 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                      ℹ️ <strong>Sign in required</strong> to organize a bill sharing order.
                    </div>
                  )}

                  {billSharingEnabled && user && !user.is_anonymous && (
                    <div className="pl-6 space-y-4 animate-fade-in">
                      <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                        ✅ You're organizing this bill share. Your email: <strong>{user.email}</strong>
                      </div>
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                        ⚠️ <strong>Important:</strong> When fully funded, the order will be <strong>automatically placed</strong> with the details below.
                      </div>
                      
                      {/* --- NEW DELIVERY UI --- */}
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Date of Event</label>
                        {isLoadingDates || isLoadingBlockedDates ? <div className="h-16 flex items-center"><Loader2 className="animate-spin text-slate-400"/></div> : (
                            <div className="relative">
                              <div className="flex gap-2 overflow-x-auto overflow-y-visible pt-12 -mt-12 pb-2 -mb-2 scrollbar-hide">
                                  {correctedDates.slice(0, 14).map(dateInfo => {
                                      const { isDisabled, reason } = getDateStatus(dateInfo);
                                      const isSelected = eventDate === dateInfo.available_date;
                                      const dateObj = new Date(dateInfo.available_date + 'T00:00:00');
                                      return (
                                          <div key={dateInfo.available_date} className="relative flex-shrink-0">
                                              <button type="button" onClick={() => !isDisabled && handleDateSelect(dateInfo.available_date)} onMouseEnter={() => isDisabled && reason && setTooltip({ date: dateInfo.available_date, reason })} onMouseLeave={() => setTooltip(null)}
                                                  className={`w-16 text-center rounded-lg p-2 border-2 transition-all duration-200 ${isSelected ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'border-slate-200 bg-white'} ${isDisabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-pink-400'}`}>
                                                  <span className="block text-xs font-semibold text-slate-500">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                  <span className="block text-xl font-bold text-slate-800">{dateObj.toLocaleDateString('en-US', { day: 'numeric' })}</span>
                                                  <span className="block text-[10px] font-medium text-slate-500">{dateInfo.day_of_week.substring(0, 3)}</span>
                                              </button>
                                              {tooltip && tooltip.date === dateInfo.available_date && (<div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[200px] px-3 py-1.5 bg-slate-800 text-white text-xs text-center font-semibold rounded-md z-10 animate-fade-in shadow-lg">{tooltip.reason}<div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div></div>)}
                                          </div>
                                      )
                                  })}
                              </div>
                            </div>
                        )}
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Time of Event</label>
                          <div className="relative"><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {EVENT_TIME_SLOTS.map(slot => (<button key={slot} type="button" onClick={() => !disabledSlots.includes(slot) && setEventTime(slot)} disabled={disabledSlots.includes(slot)}
                                className={`flex-shrink-0 text-center rounded-lg p-2 border-2 transition-all duration-200 ${eventTime === slot ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'border-slate-200 bg-white'} ${disabledSlots.includes(slot) ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-pink-400'}`}>
                                <span className="block text-xs font-semibold text-slate-800 px-2">{slot}</span></button>))}
                          </div></div>
                      </div>

                      {isAddressesLoading ? <div className="h-24 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400"/></div> : (
                        <>
                          {isAddingAddress ? (
                            <AddressForm userId={user.id} onSuccess={handleNewAddressSuccess} onCancel={() => setIsAddingAddress(false)} />
                          ) : (
                            <div>
                                <label htmlFor="addressSelect" className="block text-sm font-medium text-slate-600 mb-1">Delivery Address</label>
                                {savedAddresses.length > 0 ? (
                                    <select id="addressSelect" value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} className={inputStyle}>
                                        <option value="" disabled>-- Select a saved address --</option>
                                        {savedAddresses.map(addr => (<option key={addr.address_id} value={addr.address_id}>{addr.address_label ? `${addr.address_label} (${addr.street_address})` : addr.street_address}</option>))}
                                    </select>
                                ) : <p className="text-xs text-slate-500">No saved addresses. Please add one.</p>}
                                
                                {selectedAddress && (
                                    <div className="mt-2 p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                                        <p className="font-semibold text-slate-700">{selectedAddress.recipient_name}</p>
                                        <p className="text-slate-500">{selectedAddress.recipient_phone}</p>
                                        <p className="text-slate-500 mt-1">{selectedAddress.street_address}</p>
                                        {selectedAddress.latitude && selectedAddress.longitude && <StaticMap latitude={selectedAddress.latitude} longitude={selectedAddress.longitude} />}
                                    </div>
                                )}
                                <button type="button" onClick={() => setIsAddingAddress(true)} className="mt-2 w-full flex items-center justify-center gap-2 text-center text-sm font-semibold text-pink-600 hover:text-pink-700 py-2 rounded-lg hover:bg-pink-50 transition-colors">
                                    <Plus size={16} /> Add a New Address
                                </button>
                            </div>
                          )}
                        </>
                      )}

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Message to Contributors (optional)</label>
                        <textarea value={billSharingMessage} onChange={(e) => setBillSharingMessage(e.target.value)} placeholder="e.g., Hey everyone! Let's chip in for Sarah's birthday cake 🎂" rows={2} maxLength={200} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none" />
                        <p className="text-xs text-slate-500 mt-1">{billSharingMessage.length}/200 characters</p>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">How many people will split this? (optional)</label>
                        <input type="number" value={suggestedSplitCount} onChange={(e) => setSuggestedSplitCount(e.target.value)} placeholder="e.g., 4" min="2" max="20" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                        {suggestedSplitCount && finalPrice && parseInt(suggestedSplitCount, 10) > 0 && (
                          <p className="text-xs text-purple-600 mt-1 font-medium">≈ ₱{Math.ceil(finalPrice / parseInt(suggestedSplitCount, 10)).toLocaleString()} per person</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCreateLinkClick}
                disabled={isSaving}
                className="w-full flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Share Link'}
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
      `}</style>
    </>
  );
};

export default ShareModal;

```

## File: src/components/ErrorBoundary.tsx

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    // FIX: Correctly access props via `this.props` in a class component.
    const { onError } = this.props;
    if (onError) {
      onError(error, errorInfo);
    }
  }

  public render() {
    const { hasError } = this.state;
    
    // FIX: Correctly access props via `this.props` in a class component.
    const { fallback, children } = this.props;

    if (hasError) {
      // Use custom fallback if provided, otherwise use default
      return fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops! Something went wrong</h2>
            <p className="text-gray-600 mb-6">
              We encountered an unexpected error. Don't worry, your cart is safe!
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

```

## File: src/components/StickyAddToCartBar.tsx

```tsx
import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangleIcon } from './icons';
import { ShareButton } from './ShareButton';
import { CakeInfoUI } from '../types';

// --- Sticky Add to Cart Bar ---
interface StickyAddToCartBarProps {
  price: number | null;
  isLoading: boolean;
  isAdding: boolean;
  error: string | null;
  onAddToCartClick: () => void;
  onShareClick: () => void;
  isSharing: boolean;
  canShare: boolean;
  isAnalyzing?: boolean;
  cakeInfo?: CakeInfoUI | null;
  warningMessage?: string | null;
}

const StickyAddToCartBar: React.FC<StickyAddToCartBarProps> = React.memo(({ price, isLoading, isAdding, error, onAddToCartClick, onShareClick, isSharing, canShare, isAnalyzing, cakeInfo, warningMessage }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (price !== null || error || isAnalyzing || warningMessage) {
            setShow(true);
        } else {
            setShow(false);
        }
    }, [price, error, isAnalyzing, warningMessage]);


    const renderPrice = () => {
        if (isAnalyzing) {
            return (
                <div className="flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    <div className="text-left">
                        <span className="text-sm font-semibold text-slate-700">Analyzing...</span>
                        <span className="text-xs text-slate-500 block">Getting Price</span>
                    </div>
                </div>
            );
        }
        if (isLoading) return <span className="text-sm text-slate-500">Calculating...</span>;
        if (error) return <span className="text-sm font-semibold text-red-600">Pricing Error</span>;
        if (price !== null) {
            return (
                <div className="text-left">
                    <span className="text-lg font-bold text-slate-800">₱{price.toLocaleString()}</span>
                    {cakeInfo && cakeInfo.size && cakeInfo.thickness ? (
                        <span className="text-xs text-slate-500 block whitespace-nowrap">{`${cakeInfo.size} ${cakeInfo.thickness.replace(' in', '" Height')}`}</span>
                    ) : (
                        <span className="text-xs text-slate-500 block">Final Price</span>
                    )}
                </div>
            );
        }
        return null;
    };
    
    return (
        <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'}`}>
            {warningMessage && (
                <div className="bg-yellow-100 border-b border-yellow-200">
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-yellow-800 text-xs sm:text-sm font-semibold p-2">
                        <AlertTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                        <span>{warningMessage}</span>
                    </div>
                </div>
            )}
            <div className="bg-white/80 backdrop-blur-lg p-3 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
                <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                    <div className="min-w-[100px]">{renderPrice()}</div>
                    <div className="flex flex-1 gap-3">
                        <ShareButton 
                            onClick={onShareClick}
                            isLoading={isSharing}
                            disabled={!canShare}
                            className="flex-1"
                        />
                        <button 
                            onClick={onAddToCartClick}
                            disabled={isLoading || !!error || price === null || isAdding || isAnalyzing}
                            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md flex justify-center items-center"
                        >
                            {isAdding ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Adding...</> : 'Add to Cart'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

StickyAddToCartBar.displayName = 'StickyAddToCartBar';

export default StickyAddToCartBar;
```

## File: src/components/UI/DetailItem.tsx

```tsx
import React from 'react';

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between items-start text-xs">
        <span className="text-slate-500 shrink-0 pr-2">{label}:</span>
        <span className="text-slate-700 font-medium text-right">{value}</span>
    </div>
);

export default DetailItem;

```

## File: src/components/UI/AnimatedBlobs.tsx

```tsx
import React from 'react';

const AnimatedBlobs = () => (
    <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute w-96 h-96 bg-pink-200/50 rounded-full blur-3xl opacity-70 top-1/4 left-1/4 blob-animation-1"></div>
        <div className="absolute w-80 h-80 bg-purple-200/50 rounded-full blur-3xl opacity-70 bottom-1/4 right-1/4 blob-animation-2"></div>
        <div className="absolute w-72 h-72 bg-indigo-200/50 rounded-full blur-3xl opacity-70 bottom-1/2 left-1/3 blob-animation-3"></div>
    </div>
);

export default AnimatedBlobs;

```

## File: src/hooks/useSEO.ts

```ts
import { useEffect } from 'react';

interface SEOConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  keywords?: string;
  author?: string;
  structuredData?: object;
}

/**
 * Hook to dynamically update SEO meta tags for better Google indexing
 * This is crucial for SPAs to have proper SEO on different routes
 */
export const useSEO = (config: SEOConfig) => {
  useEffect(() => {
    // Update document title
    document.title = config.title;

    // Helper function to update or create meta tag
    const updateMetaTag = (selector: string, content: string, attribute: 'name' | 'property' = 'name') => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, selector.replace(`[${attribute}="`, '').replace('"]', ''));
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Update basic meta tags
    updateMetaTag('[name="description"]', config.description);
    if (config.keywords) {
      updateMetaTag('[name="keywords"]', config.keywords);
    }
    if (config.author) {
      updateMetaTag('[name="author"]', config.author);
    }

    // Update Open Graph tags
    updateMetaTag('[property="og:title"]', config.title, 'property');
    updateMetaTag('[property="og:description"]', config.description, 'property');
    updateMetaTag('[property="og:type"]', config.type || 'website', 'property');

    if (config.url) {
      updateMetaTag('[property="og:url"]', config.url, 'property');

      // Update canonical URL
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = config.url;
    }

    if (config.image) {
      updateMetaTag('[property="og:image"]', config.image, 'property');
      updateMetaTag('[name="twitter:image"]', config.image);
    }

    // Update Twitter Card tags
    updateMetaTag('[name="twitter:title"]', config.title);
    updateMetaTag('[name="twitter:description"]', config.description);

    // Update structured data (JSON-LD)
    if (config.structuredData) {
      let script = document.querySelector('script[type="application/ld+json"][data-dynamic]');
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-dynamic', 'true');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(config.structuredData);
    }

    // Cleanup function to restore default values if needed
    return () => {
      // Optional: You can restore default meta tags here if needed
    };
  }, [config]);
};

/**
 * Generate structured data for a cake product
 */
export const generateCakeStructuredData = (design: {
  title: string;
  description: string;
  image: string;
  price: number;
  url: string;
  cakeType: string;
  cakeSize: string;
  availability: string;
}) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: design.title,
    description: design.description,
    image: design.image,
    offers: {
      '@type': 'Offer',
      price: design.price.toFixed(2),
      priceCurrency: 'PHP',
      availability: `https://schema.org/${design.availability === 'rush' ? 'InStock' : 'PreOrder'}`,
      url: design.url,
    },
    brand: {
      '@type': 'Brand',
      name: 'Genie.ph',
    },
    category: 'Custom Cakes',
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Cake Type',
        value: design.cakeType,
      },
      {
        '@type': 'PropertyValue',
        name: 'Size',
        value: design.cakeSize,
      },
    ],
  };
};

```

## File: src/hooks/useCanonicalUrl.ts

```ts
import { useEffect } from 'react';

/**
 * Hook to manage canonical URL meta tag in the document head
 * Helps prevent duplicate content issues in SEO
 * 
 * @param path - The canonical path for this page (without hash)
 * @example
 * useCanonicalUrl('/about') // Sets canonical to https://genie.ph/about
 */
export const useCanonicalUrl = (path: string) => {
  useEffect(() => {
    const canonicalUrl = `https://genie.ph${path}`;
    
    // Remove existing canonical tag if any
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    if (existingCanonical) {
      existingCanonical.remove();
    }

    // Create and add new canonical tag
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonicalUrl;
    document.head.appendChild(link);

    // Cleanup on unmount
    return () => {
      const canonical = document.querySelector(`link[rel="canonical"][href="${canonicalUrl}"]`);
      if (canonical) {
        canonical.remove();
      }
    };
  }, [path]);
};

```

## File: src/hooks/useCakeCustomization.ts

```ts
import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI,
    CakeType,
    CakeFlavor,
    IcingColorDetails,
} from '../types';
import { DEFAULT_THICKNESS_MAP, DEFAULT_SIZE_MAP, COLORS, CAKE_TYPES, SHOPIFY_TAGS, DEFAULT_ICING_DESIGN, FLAVOR_OPTIONS } from '../constants';
import { showSuccess } from '../lib/utils/toast';
import { ShopifyCustomizationRequest } from '../services/supabaseService';
import { calculateCustomizingAvailability, AvailabilityType } from '../lib/utils/availability';

// 'icingDesign' is now handled with granular dot-notation strings
type DirtyField = 'cakeInfo' | 'mainToppers' | 'supportElements' | 'cakeMessages' | 'additionalInstructions';

export const useCakeCustomization = () => {
    // --- State ---
    const [cakeInfo, setCakeInfo] = useState<CakeInfoUI | null>(null);
    const [mainToppers, setMainToppers] = useState<MainTopperUI[]>([]);
    const [supportElements, setSupportElements] = useState<SupportElementUI[]>([]);
    const [cakeMessages, setCakeMessages] = useState<CakeMessageUI[]>([]);
    const [icingDesign, setIcingDesign] = useState<IcingDesignUI | null>(null);
    const [additionalInstructions, setAdditionalInstructions] = useState<string>('');

    const [analysisResult, setAnalysisResult] = useState<HybridAnalysisResult | null>(null);
    const [analysisId, setAnalysisId] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [pendingAnalysisData, setPendingAnalysisData] = useState<HybridAnalysisResult | null>(null);

    const [isCustomizationDirty, setIsCustomizationDirty] = useState(false);
    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
    const [availability, setAvailability] = useState<AvailabilityType>('normal');

    // --- Effect to calculate availability ---
    useEffect(() => {
        if (cakeInfo && icingDesign) {
            const newAvailabilityType = calculateCustomizingAvailability(
                cakeInfo,
                icingDesign,
                mainToppers,
                supportElements
            );
            setAvailability(newAvailabilityType);
        }
    }, [cakeInfo, icingDesign, mainToppers, supportElements]);


    // --- Logic and Handlers ---

    const initializeDefaultState = useCallback(() => {
        const defaultCakeType: CakeType = '1 Tier';
        setCakeInfo({
            type: defaultCakeType,
            thickness: DEFAULT_THICKNESS_MAP[defaultCakeType],
            flavors: ['Chocolate Cake'],
            size: DEFAULT_SIZE_MAP[defaultCakeType]
        });
        setMainToppers([]);
        setSupportElements([]);
        setCakeMessages([]);
        setIcingDesign(DEFAULT_ICING_DESIGN);
        setAdditionalInstructions('');
        setIsCustomizationDirty(false);
        setDirtyFields(new Set());
    }, []);

    const initializeFromShopify = useCallback((requestData: ShopifyCustomizationRequest) => {
        let cakeType: CakeType = '1 Tier';
        let flavor: CakeFlavor = 'Chocolate Cake';

        requestData.shopify_product_tags.forEach(tag => {
            const [key, value] = tag.split(':').map(s => s.trim());
            if (key === SHOPIFY_TAGS.TIER) {
                const tierNum = parseInt(value, 10);
                if (tierNum === 2) cakeType = '2 Tier';
                if (tierNum === 3) cakeType = '3 Tier';
            }
            if (key === SHOPIFY_TAGS.TYPE) {
                if ((CAKE_TYPES as readonly string[]).includes(value)) {
                    cakeType = value as CakeType;
                }
            }
            if (key === SHOPIFY_TAGS.FLAVOR && FLAVOR_OPTIONS.includes(value as CakeFlavor)) {
                flavor = value as CakeFlavor;
            }
        });

        const getFlavorCount = (type: CakeType): number => {
            if (type.includes('2 Tier')) return 2;
            if (type.includes('3 Tier')) return 3;
            return 1;
        };
        const flavorCount = getFlavorCount(cakeType);
        const initialFlavors: CakeFlavor[] = Array(flavorCount).fill(flavor);

        setCakeInfo({
            type: cakeType,
            thickness: DEFAULT_THICKNESS_MAP[cakeType],
            flavors: initialFlavors,
            size: requestData.shopify_variant_title
        });

        // For Shopify flow, we assume a simple base without detected elements
        setMainToppers([]);
        setSupportElements([]);
        setCakeMessages([]);
        setIcingDesign({
            ...DEFAULT_ICING_DESIGN,
            base: cakeType.includes('Fondant') ? 'fondant' : 'soft_icing',
        });
        setAdditionalInstructions('');
        setIsCustomizationDirty(false);
        setDirtyFields(new Set());

        // Mock a minimal analysis result so pricing logic can function
        setAnalysisResult({
            cakeType: cakeType,
            cakeThickness: DEFAULT_THICKNESS_MAP[cakeType],
            main_toppers: [],
            support_elements: [],
            cake_messages: [],
            icing_design: {
                base: cakeType.includes('Fondant') ? 'fondant' : 'soft_icing',
                color_type: 'single',
                colors: { side: '#FFFFFF' },
                border_top: false, border_base: false, drip: false, gumpasteBaseBoard: false
            }
        });
        setAnalysisId(`shopify-${Date.now()}`);

    }, []);

    const handleCakeInfoChange = useCallback((
        updates: Partial<CakeInfoUI>,
        options?: { isSystemCorrection?: boolean }
    ) => {
        setCakeInfo(prev => {
            if (!prev) return null;

            const newState = { ...prev, ...updates };

            if (updates.type && updates.type !== prev.type) {
                const newType = updates.type;

                newState.thickness = DEFAULT_THICKNESS_MAP[newType];
                newState.size = DEFAULT_SIZE_MAP[newType];

                const getFlavorCount = (type: CakeType): number => {
                    if (type.includes('2 Tier')) return 2;
                    if (type.includes('3 Tier')) return 3;
                    return 1;
                };
                const newFlavorCount = getFlavorCount(newType);
                const newFlavors: CakeFlavor[] = Array(newFlavorCount).fill('Chocolate Cake');
                newState.flavors = newFlavors;
            }

            return newState;
        });

        // Side effects for switching to Bento type
        if (updates.type === 'Bento') {
            setIcingDesign(prevIcing => {
                if (!prevIcing) return null;
                // Only update if changes are needed to prevent re-renders
                if (prevIcing.gumpasteBaseBoard || prevIcing.border_base) {
                    return { ...prevIcing, gumpasteBaseBoard: false, border_base: false };
                }
                return prevIcing;
            });
            setCakeMessages(prevMessages => {
                // Only update if there are base_board messages to remove
                if (prevMessages.some(m => m.position === 'base_board')) {
                    return prevMessages.filter(m => m.position !== 'base_board');
                }
                return prevMessages;
            });
        }

        if (!options?.isSystemCorrection) {
            setIsCustomizationDirty(true);
            setDirtyFields(prev => new Set(prev).add('cakeInfo'));
        }
    }, [setIsCustomizationDirty]);

    // --- NEW ROBUST STATE UPDATERS ---
    const markDirty = (field: DirtyField) => {
        setIsCustomizationDirty(true);
        setDirtyFields(prev => new Set(prev).add(field));
    };

    const updateMainTopper = useCallback((id: string, updates: Partial<MainTopperUI>) => {
        setMainToppers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        markDirty('mainToppers');
    }, []);

    const removeMainTopper = useCallback((id: string) => {
        setMainToppers(prev => prev.filter(t => t.id !== id));
        markDirty('mainToppers');
    }, []);

    const onMainTopperChange = useCallback((toppers: MainTopperUI[]) => {
        setMainToppers(toppers);
        markDirty('mainToppers');
    }, []);

    const updateSupportElement = useCallback((id: string, updates: Partial<SupportElementUI>) => {
        setSupportElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
        markDirty('supportElements');
    }, []);

    const removeSupportElement = useCallback((id: string) => {
        setSupportElements(prev => prev.filter(e => e.id !== id));
        markDirty('supportElements');
    }, []);

    const updateCakeMessage = useCallback((id: string, updates: Partial<CakeMessageUI>) => {
        setCakeMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
        markDirty('cakeMessages');
    }, []);

    const removeCakeMessage = useCallback((id: string) => {
        setCakeMessages(prev => prev.filter(m => m.id !== id));
        markDirty('cakeMessages');
    }, []);

    const onCakeMessageChange = useCallback((messages: CakeMessageUI[]) => {
        setCakeMessages(messages);
        markDirty('cakeMessages');
    }, []);

    // --- END NEW ROBUST STATE UPDATERS ---

    const onIcingDesignChange = useCallback((newDesign: IcingDesignUI) => {
        setIcingDesign(prevIcing => {
            if (!prevIcing) return newDesign;

            setDirtyFields(prevDirty => {
                const newDirtyFields = new Set(prevDirty);

                // Compare all boolean and string fields
                if (newDesign.drip !== prevIcing.drip) newDirtyFields.add('icingDesign.drip');
                if (newDesign.gumpasteBaseBoard !== prevIcing.gumpasteBaseBoard) newDirtyFields.add('icingDesign.gumpasteBaseBoard');
                if (newDesign.border_top !== prevIcing.border_top) newDirtyFields.add('icingDesign.border_top');
                if (newDesign.border_base !== prevIcing.border_base) newDirtyFields.add('icingDesign.base');
                if (newDesign.color_type !== prevIcing.color_type) newDirtyFields.add('icingDesign.color_type');

                // Compare color fields
                const allColorKeys = new Set([
                    ...Object.keys(prevIcing.colors),
                    ...Object.keys(newDesign.colors)
                ]) as Set<keyof typeof newDesign.colors>;

                for (const key of allColorKeys) {
                    // FIX: Explicitly cast key to avoid symbol conversion error in strict mode.
                    const k = key as keyof IcingColorDetails;
                    if (prevIcing.colors[k] !== newDesign.colors[k]) {
                        newDirtyFields.add(`icingDesign.colors.${k}`);
                    }
                }
                return newDirtyFields;
            });

            return newDesign;
        });

        setIsCustomizationDirty(true);
    }, [setIsCustomizationDirty]);

    const onAdditionalInstructionsChange = useCallback((instructions: string) => {
        setAdditionalInstructions(instructions);
        markDirty('additionalInstructions');
    }, []);

    const clearCustomization = useCallback(() => {
        setAnalysisResult(null);
        setAnalysisId(null);
        setCakeInfo(null);
        setMainToppers([]);
        setSupportElements([]);
        setCakeMessages([]);
        setIcingDesign(null);
        setAdditionalInstructions('');
        setAnalysisError(null);
        setIsAnalyzing(false);
        setIsCustomizationDirty(false);
        setDirtyFields(new Set());
    }, []);

    const handleApplyAnalysis = useCallback((analysisData: HybridAnalysisResult) => {
        setAnalysisId(uuidv4());
        setAnalysisResult(analysisData);

        if (!dirtyFields.has('cakeInfo')) {
            const getFlavorCount = (type: CakeType): number => {
                if (type.includes('2 Tier')) return 2;
                if (type.includes('3 Tier')) return 3;
                return 1;
            };
            const flavorCount = getFlavorCount(analysisData.cakeType);
            const initialFlavors: CakeFlavor[] = Array(flavorCount).fill('Chocolate Cake');
            setCakeInfo({
                type: analysisData.cakeType,
                thickness: analysisData.cakeThickness,
                flavors: initialFlavors,
                size: DEFAULT_SIZE_MAP[analysisData.cakeType]
            });
        }

        if (!dirtyFields.has('mainToppers')) {
            const newMainToppers = analysisData.main_toppers.map((t): MainTopperUI => {
                let initialType = t.type;
                const canBePrintout = ['edible_3d', 'toy', 'figurine', 'edible_photo'].includes(t.type);
                const isCharacterOrLogo = /character|figure|logo|brand/i.test(t.description);

                // Default to 'printout' for characters, logos, etc., if it's a valid alternative
                if (canBePrintout && isCharacterOrLogo) {
                    initialType = 'printout';
                }

                return {
                    ...t,
                    x: t.x, // Explicitly carry over x
                    y: t.y, // Explicitly carry over y
                    id: uuidv4(),
                    isEnabled: true,
                    price: 0,
                    original_type: t.type,
                    type: initialType,
                    replacementImage: undefined,
                    original_color: t.color,
                    original_colors: t.colors,
                };
            });
            setMainToppers(newMainToppers);
        }

        if (!dirtyFields.has('supportElements')) {
            const newSupportElements = analysisData.support_elements.map((s): SupportElementUI => {
                let initialType = s.type;
                // Default edible photo wraps to the more common 'support_printout' option first.
                if (s.type === 'edible_photo_side') {
                    initialType = 'support_printout';
                }

                return {
                    ...s,
                    x: s.x, // Explicitly carry over x
                    y: s.y, // Explicitly carry over y
                    id: uuidv4(),
                    isEnabled: true,
                    price: 0,
                    original_type: s.type,
                    type: initialType,
                    replacementImage: undefined,
                    original_color: s.color,
                    original_colors: s.colors,
                };
            });
            setSupportElements(newSupportElements);
        }

        if (!dirtyFields.has('cakeMessages')) {
            const newCakeMessages = analysisData.cake_messages.map((msg): CakeMessageUI => ({
                ...msg,
                x: msg.x, // Explicitly carry over x
                y: msg.y, // Explicitly carry over y
                id: uuidv4(),
                isEnabled: true,
                price: 0,
                originalMessage: { ...msg }
            }));
            setCakeMessages(newCakeMessages);
        }

        setIcingDesign(prev => {
            const analysisIcing = analysisData.icing_design;
            if (!prev) return { ...analysisIcing, dripPrice: 100, gumpasteBaseBoardPrice: 100 };

            const newIcing = { ...prev, colors: { ...prev.colors } };

            if (!dirtyFields.has('icingDesign.base')) newIcing.base = analysisIcing.base;
            if (!dirtyFields.has('icingDesign.color_type')) newIcing.color_type = analysisIcing.color_type;
            if (!dirtyFields.has('icingDesign.drip')) newIcing.drip = analysisIcing.drip;

            if (!dirtyFields.has('icingDesign.gumpasteBaseBoard')) {
                const isBaseBoardWhite = analysisIcing.colors.gumpasteBaseBoardColor?.toLowerCase() === '#ffffff';
                // The feature is enabled only if the AI detects it AND the color is not white.
                newIcing.gumpasteBaseBoard = analysisIcing.gumpasteBaseBoard && !isBaseBoardWhite;
            }

            if (!dirtyFields.has('icingDesign.border_top')) newIcing.border_top = analysisIcing.border_top;
            if (!dirtyFields.has('icingDesign.border_base')) newIcing.border_base = analysisIcing.border_base;

            const allAnalysisColorKeys = Object.keys(analysisIcing.colors) as Array<keyof IcingColorDetails>;
            for (const colorKey of allAnalysisColorKeys) {
                if (!dirtyFields.has(`icingDesign.colors.${String(colorKey)}`)) {
                    newIcing.colors[colorKey] = analysisIcing.colors[colorKey];
                }
            }

            return newIcing;
        });

        if (!dirtyFields.has('additionalInstructions')) {
            setAdditionalInstructions('');
        }

        setIsCustomizationDirty(false);
        setDirtyFields(new Set());

        const toppersFound = analysisData.main_toppers.length;
        const elementsFound = analysisData.support_elements.length;
        let analysisSummaryParts: string[] = [];
        if (toppersFound > 0) analysisSummaryParts.push(`${toppersFound} topper${toppersFound > 1 ? 's' : ''}`);
        if (elementsFound > 0) analysisSummaryParts.push(`${elementsFound} design element${elementsFound > 1 ? 's' : ''}`);
        const analysisSummary = analysisSummaryParts.length > 0 ? `We found ${analysisSummaryParts.join(' and ')}.` : "We've analyzed your cake's base design.";
        showSuccess(`Price and Design Elements updated! ${analysisSummary}`, { duration: 6000 });

    }, [dirtyFields]);

    useEffect(() => {
        if (pendingAnalysisData) {
            handleApplyAnalysis(pendingAnalysisData);
            setPendingAnalysisData(null); // Clear after applying to prevent re-runs
        }
    }, [pendingAnalysisData, handleApplyAnalysis]);

    const handleTopperImageReplace = useCallback(async (topperId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService.lazy');
            const replacementData = await fileToBase64(file);
            updateMainTopper(topperId, { replacementImage: replacementData });
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, [updateMainTopper]);

    const handleSupportElementImageReplace = useCallback(async (elementId: string, file: File) => {
        try {
            const { fileToBase64 } = await import('../services/geminiService.lazy');
            const replacementData = await fileToBase64(file);
            updateSupportElement(elementId, { replacementImage: replacementData });
        } catch (err) {
            setAnalysisError("Could not process the replacement image. Please try another file.");
        }
    }, [updateSupportElement]);


    return {
        // State
        cakeInfo,
        mainToppers,
        supportElements,
        cakeMessages,
        icingDesign,
        additionalInstructions,
        analysisResult,
        analysisId,
        isAnalyzing,
        analysisError,
        isCustomizationDirty,
        dirtyFields,
        availability,

        // Setters
        setIsAnalyzing,
        setAnalysisError,
        setPendingAnalysisData,
        setIsCustomizationDirty,

        // Functions
        handleCakeInfoChange,
        onMainTopperChange, // Kept for complex changes if needed
        updateMainTopper,
        removeMainTopper,
        updateSupportElement,
        removeSupportElement,
        onCakeMessageChange, // Kept for complex changes if needed
        updateCakeMessage,
        removeCakeMessage,
        onIcingDesignChange,
        onAdditionalInstructionsChange,
        handleTopperImageReplace,
        handleSupportElementImageReplace,
        clearCustomization,
        initializeDefaultState,
        initializeFromShopify,
    };
};
```

## File: src/hooks/usePricing.ts

```ts
import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { calculatePriceFromDatabase, clearPricingCache } from '../services/pricingService.database';
import { getCakeBasePriceOptions } from '../services/supabaseService';
import {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI,
    AddOnPricing,
    BasePriceInfo,
    CakeType,
    CakeThickness,
} from '../types';
import { DEFAULT_THICKNESS_MAP } from '../constants';

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)',
    '2 Tier': '2 Tier (Soft icing)',
    '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant',
    '2 Tier Fondant': '2 Tier Fondant',
    '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square',
    'Rectangle': 'Rectangle',
    'Bento': 'Bento',
};

const pricingKeys = {
    basePrice: (type?: CakeType, thickness?: CakeThickness) =>
      ['pricing', 'base', type, thickness] as const,
    addOnPrice: (uiState: any) => ['pricing', 'addon', uiState] as const,
};

interface UsePricingProps {
    analysisResult: HybridAnalysisResult | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    cakeInfo: CakeInfoUI | null;
    onCakeInfoCorrection: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    initialPriceInfo?: { size: string; price: number } | null;
    analysisId: string | null;
}

async function calculateAddOnPrice(uiState: {
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    cakeInfo: CakeInfoUI,
}) {
    return await calculatePriceFromDatabase(uiState);
}

export const usePricing = ({
    analysisResult,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    cakeInfo,
    onCakeInfoCorrection,
    initialPriceInfo = null,
    analysisId,
}: UsePricingProps) => {
    const lastProcessedAnalysisId = useRef<string | null>(null);

    const {
        data: queryResult,
        isLoading: isFetchingBasePrice,
        error: queryError,
    } = useQuery({
        queryKey: pricingKeys.basePrice(cakeInfo?.type, cakeInfo?.thickness),
        queryFn: async () => {
            if (!cakeInfo?.type || !cakeInfo?.thickness) {
                return { options: [], effectiveThickness: cakeInfo?.thickness };
            }
            
            let results = await getCakeBasePriceOptions(cakeInfo.type, cakeInfo.thickness);
            let effectiveThickness = cakeInfo.thickness;

            if (results.length === 0) {
                const defaultThickness = DEFAULT_THICKNESS_MAP[cakeInfo.type];
                if (defaultThickness && defaultThickness !== cakeInfo.thickness) {
                    const fallbackResults = await getCakeBasePriceOptions(cakeInfo.type, defaultThickness);
                    if (fallbackResults.length > 0) {
                        results = fallbackResults;
                        effectiveThickness = defaultThickness;
                    }
                }
            }
            
            if (results.length === 0) {
                throw new Error(`We don't have price options for a "${cakeTypeDisplayMap[cakeInfo.type]}" cake. Please try another design.`);
            }

            return { options: results, effectiveThickness };
        },
        enabled: !!cakeInfo?.type && !!cakeInfo?.thickness && !initialPriceInfo,
        staleTime: 5 * 60 * 1000,
    });
    
    const basePriceOptions = useMemo(() => {
        if (initialPriceInfo) return [initialPriceInfo];
        return queryResult?.options || null;
    }, [initialPriceInfo, queryResult]);

    const basePriceError = useMemo(() => {
        return queryError ? (queryError as Error).message : null;
    }, [queryError]);
    
    useEffect(() => {
        if (initialPriceInfo) {
            onCakeInfoCorrection({ size: initialPriceInfo.size }, { isSystemCorrection: true });
            return;
        }

        if (queryResult && cakeInfo) {
            const { options, effectiveThickness } = queryResult;
            
            if (options.length > 0) {
                const updates: Partial<CakeInfoUI> = {};
                
                if (effectiveThickness && effectiveThickness !== cakeInfo.thickness) {
                    updates.thickness = effectiveThickness;
                }

                const isNewAnalysis = analysisId && analysisId !== lastProcessedAnalysisId.current;
                const currentSizeIsValid = options.some(r => r.size === cakeInfo.size);

                if (isNewAnalysis) {
                    const sortedOptions = [...options].sort((a, b) => a.price - b.price);
                    updates.size = sortedOptions[0].size;
                    lastProcessedAnalysisId.current = analysisId;
                } else if (!currentSizeIsValid) {
                    updates.size = options[0].size;
                }

                if (Object.keys(updates).length > 0) {
                    onCakeInfoCorrection(updates, { isSystemCorrection: true });
                }
            }
        }
    }, [queryResult, cakeInfo, onCakeInfoCorrection, analysisId, initialPriceInfo]);

    const uiStateForQuery = { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo };
    const { 
        data: addonPricingResult,
        isLoading: isCalculatingAddons
    } = useQuery({
        queryKey: pricingKeys.addOnPrice(uiStateForQuery),
        queryFn: () => {
             if (!analysisResult || !icingDesign || !cakeInfo) {
                return { addOnPricing: null, itemPrices: new Map<string, number>() };
            }
            return calculateAddOnPrice({ mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo });
        },
        enabled: !!analysisResult && !!icingDesign && !!cakeInfo,
        staleTime: 1 * 60 * 1000,
    });

    const addOnPricing = addonPricingResult?.addOnPricing;
    const itemPrices = addonPricingResult?.itemPrices ?? new Map<string, number>();

    const selectedPriceOption = useMemo(
        () => basePriceOptions?.find(opt => opt.size === cakeInfo?.size), 
        [basePriceOptions, cakeInfo?.size]
    );

    const basePrice = selectedPriceOption?.price;

    const finalPrice = useMemo(
        () => (basePrice !== undefined && addOnPricing ? basePrice + addOnPricing.addOnPrice : null), 
        [basePrice, addOnPricing]
    );

    return {
        addOnPricing,
        itemPrices,
        basePriceOptions,
        isFetchingBasePrice: isFetchingBasePrice || isCalculatingAddons,
        basePriceError,
        basePrice,
        finalPrice,
        pricingRules: null,
    };
};
```

## File: src/hooks/useAvailabilitySettings.ts

```ts
import { useQuery } from '@tanstack/react-query';
import { getAvailabilitySettings } from '../services/supabaseService';
import { AvailabilitySettings } from '../types';

export function useAvailabilitySettings() {
  const { data, isLoading, error, refetch } = useQuery<AvailabilitySettings, Error>({
    queryKey: ['availability-settings'],
    queryFn: async () => {
      const { data, error } = await getAvailabilitySettings();
      if (error) throw error;
      if (!data) throw new Error('Availability settings not found.');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes, settings don't change often
    refetchOnWindowFocus: true, // Refetch in case admin changed settings
  });

  return {
    settings: data,
    loading: isLoading,
    error,
    refetch,
  };
}

```

## File: src/hooks/useOrders.ts

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserOrders, uploadPaymentProof, getSingleOrder, cancelOrder, getBillSharingCreations } from '../services/supabaseService';
import { CakeGenieOrder } from '../lib/database.types';
import { showSuccess, showError } from '../lib/utils/toast';

export function useOrders(userId: string | undefined, options?: { limit?: number; offset?: number, includeItems?: boolean }) {
  return useQuery({
    queryKey: ['creations', userId, options?.limit, options?.offset],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      
      const [ordersResult, designsResult] = await Promise.all([
        getUserOrders(userId, options),
        // Only fetch designs on the first page load to avoid re-fetching
        (options?.offset ?? 0) === 0 ? getBillSharingCreations(userId) : Promise.resolve({ data: [], error: null }),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (designsResult.error) throw designsResult.error;
      
      return {
        orders: ordersResult.data?.orders || [],
        totalOrderCount: ordersResult.data?.totalCount || 0,
        designs: designsResult.data || [],
      };
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useOrderDetails(orderId: string | undefined, userId: string | undefined, enabled: boolean) {
    return useQuery({
        queryKey: ['order-details', orderId],
        queryFn: async () => {
            if (!userId || !orderId) throw new Error('User and Order ID required');
            const result = await getSingleOrder(orderId, userId);
            if (result.error) throw result.error;
            return result.data;
        },
        enabled: !!userId && !!orderId && enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useUploadPaymentProof() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      orderId, 
      userId, 
      file 
    }: { 
      orderId: string; 
      userId: string; 
      file: File;
    }) => {
      const result = await uploadPaymentProof(orderId, userId, file);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all queries related to this user's orders to refetch them
      queryClient.invalidateQueries({ queryKey: ['creations', variables.userId] });
      // Also invalidate the specific order detail query if it's cached
      queryClient.invalidateQueries({ queryKey: ['order-details', variables.orderId]});
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      orderId, 
      userId 
    }: { 
      orderId: string; 
      userId: string; 
    }) => {
      const result = await cancelOrder(orderId, userId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data, variables) => {
      showSuccess("Order has been cancelled successfully.");
      // Invalidate all queries related to this user's orders to refetch them
      queryClient.invalidateQueries({ queryKey: ['creations', variables.userId] });
      // Also invalidate the specific order detail query if it's cached
      queryClient.invalidateQueries({ queryKey: ['order-details', variables.orderId]});
    },
    onError: (err: any) => {
        showError(err.message || "Failed to cancel the order.");
    }
  });
}

```

## File: src/hooks/useImageManagement.ts

```ts


import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast as toastHot } from 'react-hot-toast';
import { fileToBase64, analyzeCakeFeaturesOnly, enrichAnalysisWithCoordinates } from '../services/geminiService.lazy';
import { getSupabaseClient } from '../lib/supabase/client';
import { compressImage, dataURItoBlob } from '../lib/utils/imageOptimization';
import { showSuccess, showError, showLoading, showInfo } from '../lib/utils/toast';
import { HybridAnalysisResult } from '../types';
import { findSimilarAnalysisByHash, cacheAnalysisResult } from '../services/supabaseService';

/**
 * Generates a perceptual hash (pHash) for an image.
 * This creates a fingerprint based on visual content, not binary data.
 * @param imageSrc The data URI of the image.
 * @returns A promise that resolves to a 16-character hex string representing the hash.
 */
async function generatePerceptualHash(imageSrc: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 8; // Create an 8x8 grayscale image
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');

            ctx.drawImage(img, 0, 0, size, size);
            const imageData = ctx.getImageData(0, 0, size, size);
            const grayscale = new Array(size * size);
            let totalLuminance = 0;

            for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                grayscale[i / 4] = luminance;
                totalLuminance += luminance;
            }

            const avgLuminance = totalLuminance / (size * size);
            let hash = 0n; // Use BigInt for bitwise operations

            for (let i = 0; i < grayscale.length; i++) {
                if (grayscale[i] > avgLuminance) {
                    hash |= 1n << BigInt(i);
                }
            }

            // Convert BigInt to a 16-character hex string
            resolve(hash.toString(16).padStart(16, '0'));
        };
        img.onerror = () => reject(new Error('Failed to load image for hashing.'));
        img.src = imageSrc;
    });
}


export const useImageManagement = () => {
    const supabase = getSupabaseClient();

    // State
    const [originalImageData, setOriginalImageData] = useState<{ data: string; mimeType: string } | null>(null);
    const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [threeTierReferenceImage, setThreeTierReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch 3-tier reference image on mount
    useEffect(() => {
        const fetchReferenceImage = async () => {
            try {
                const imageUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/3tier.webp';

                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error('Failed to fetch reference image');
                const blob = await response.blob();
                const file = new File([blob], '3tier-reference.webp', { type: blob.type || 'image/webp' });
                const imageData = await fileToBase64(file);
                setThreeTierReferenceImage(imageData);

            } catch (error) {
                console.error('❌ Failed to load 3-tier reference image:', error);
            }
        };
        fetchReferenceImage();
    }, []);

    const clearImages = useCallback(() => {
        setOriginalImageData(null);
        setOriginalImagePreview(null);
        setEditedImage(null);
        setError(null);
        setIsLoading(false);
    }, []);

    const handleImageUpload = useCallback(async (
        file: File,
        onSuccess: (result: HybridAnalysisResult) => void,
        onError: (error: Error) => void,
        options?: { imageUrl?: string; onCoordinatesEnriched?: (result: HybridAnalysisResult) => void }
    ) => {
        setIsLoading(true); // For file processing
        setError(null);
        try {
            const imageData = await fileToBase64(file);
            const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;
            setOriginalImageData(imageData);
            setOriginalImagePreview(imageSrc);
            setIsLoading(false); // File processing done

            // --- STEP 1: CHECK CACHE FIRST (FAST PATH) ---

            const pHash = await generatePerceptualHash(imageSrc);
            const cachedAnalysis = await findSimilarAnalysisByHash(pHash);

            if (cachedAnalysis) {

                onSuccess(cachedAnalysis);
                return; // Skip compression and AI call entirely!
            }



            // --- STEP 2: COMPRESS IMAGE FOR AI & STORAGE (ONLY ON CACHE MISS) ---
            let uploadedImageUrl = options?.imageUrl; // Use existing URL if from web search
            let compressedImageData = imageData; // Default to original

            try {
                // Compress image for both AI analysis and storage. 1024x1024 is optimal for Gemini.
                const imageBlob = dataURItoBlob(imageSrc);
                const fileToUpload = new File([imageBlob], file.name, { type: file.type });

                const compressedFile = await compressImage(fileToUpload, {
                    maxSizeMB: 0.5,
                    maxWidthOrHeight: 1024,
                    fileType: 'image/webp',
                });

                // Convert compressed file to base64 for AI
                compressedImageData = await fileToBase64(compressedFile);


                // Upload compressed file to storage
                if (!uploadedImageUrl) {
                    const fileName = `analysis-cache/${uuidv4()}.webp`;
                    const { error: uploadError } = await supabase.storage
                        .from('cakegenie')
                        .upload(fileName, compressedFile, {
                            contentType: 'image/webp',
                            upsert: false,
                        });

                    if (uploadError) {
                        console.warn('Failed to upload image for caching, proceeding without URL.', uploadError.message);
                    } else {
                        const { data: { publicUrl } } = supabase.storage.from('cakegenie').getPublicUrl(fileName);
                        uploadedImageUrl = publicUrl;

                    }
                }
            } catch (compressionErr) {
                console.warn('Image compression failed, proceeding with original:', compressionErr);
            }
            // --- END OF COMPRESSION LOGIC ---

            // --- STEP 3: TWO-PHASE AI ANALYSIS ---


            try {
                // PHASE 1: Fast feature-only analysis (coordinates all 0,0)
                const fastResult = await analyzeCakeFeaturesOnly(
                    compressedImageData.data,
                    compressedImageData.mimeType
                );


                onSuccess(fastResult); // User can now see features and price immediately!

                // PHASE 2: Background coordinate enrichment (silent, non-blocking)

                enrichAnalysisWithCoordinates(
                    compressedImageData.data,
                    compressedImageData.mimeType,
                    fastResult
                ).then(enrichedResult => {


                    // Notify the UI to update with enriched coordinates
                    if (options?.onCoordinatesEnriched) {
                        options.onCoordinatesEnriched(enrichedResult);
                    }

                    // Cache the fully enriched result
                    cacheAnalysisResult(pHash, enrichedResult, uploadedImageUrl);
                }).catch(enrichmentError => {
                    console.warn('⚠️ Coordinate enrichment failed, but features are still available:', enrichmentError);
                    // Still cache the fast result even if enrichment fails
                    cacheAnalysisResult(pHash, fastResult, uploadedImageUrl);
                });

            } catch (error) {
                onError(error instanceof Error ? error : new Error('Failed to analyze image'));
            }

        } catch (err) {
            const fileProcessingError = err instanceof Error ? err : new Error("Failed to read image file.");
            setError(fileProcessingError.message);
            setIsLoading(false); // Also stop loading on error
            onError(fileProcessingError); // Propagate error
        }
    }, [supabase]);

    const loadImageWithoutAnalysis = useCallback(async (imageUrl: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.warn(`Fetch for ${imageUrl} timed out.`);
            }, 8000); // 8-second timeout

            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`;
            const response = await fetch(proxyUrl, { signal: controller.signal });

            clearTimeout(timeoutId); // Clear timeout if fetch succeeds

            if (!response.ok) throw new Error(`Failed to fetch image via proxy (status: ${response.status}).`);
            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) {
                throw new Error('Fetched content is not an image. The proxy may have failed.');
            }
            const file = new File([blob], 'shopify-product-image.webp', { type: blob.type || 'image/webp' });

            const imageData = await fileToBase64(file);
            setOriginalImageData(imageData);
            setOriginalImagePreview(`data:${imageData.mimeType};base64,${imageData.data}`);
            return imageData;
        } catch (err) {
            let errorMessage = 'Could not load product image.';
            if (err instanceof Error) {
                errorMessage = err.name === 'AbortError'
                    ? 'Image loading timed out. Please try again.'
                    : err.message;
            }
            showError(errorMessage);
            setError(errorMessage);
            throw new Error(errorMessage); // re-throw to be caught by the page component
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleSave = useCallback(async () => {
        if (!editedImage) return;

        setIsLoading(true);
        const toastId = showLoading("Saving image...");

        try {
            const watermarkUrl = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20watermark.png';

            const [cakeImage, watermarkImage] = await Promise.all([
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Failed to load cake image.'));
                    img.src = editedImage;
                }),
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Failed to load watermark image.'));
                    img.src = watermarkUrl;
                })
            ]);

            const canvas = document.createElement('canvas');
            canvas.width = cakeImage.naturalWidth;
            canvas.height = cakeImage.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context.');

            ctx.drawImage(cakeImage, 0, 0);

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const watermarkAspectRatio = watermarkImage.naturalWidth / watermarkImage.naturalHeight;
            let watermarkWidth, watermarkHeight;

            if (canvasHeight > canvasWidth) {
                watermarkWidth = canvasWidth;
                watermarkHeight = watermarkWidth / watermarkAspectRatio;
            } else {
                watermarkHeight = canvasHeight;
                watermarkWidth = watermarkHeight * watermarkAspectRatio;
            }

            const x = (canvasWidth - watermarkWidth) / 2;
            const y = (canvasHeight - watermarkHeight) / 2;
            ctx.drawImage(watermarkImage, x, y, watermarkWidth, watermarkHeight);

            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `cake-genie-design-${new Date().toISOString()}.png`;
            link.click();

            toastHot.dismiss(toastId);
            showSuccess("Image saved successfully!");
        } catch (err) {
            toastHot.dismiss(toastId);
            const message = err instanceof Error ? err.message : 'An unexpected error occurred while saving.';
            showError(message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [editedImage]);

    const uploadCartImages = useCallback(async (
        options: { editedImageDataUri?: string | null } = {}
    ): Promise<{ originalImageUrl: string; finalImageUrl: string }> => {
        if (!originalImagePreview) {
            throw new Error("Cannot upload to cart: original image is missing.");
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error("Authentication session not found. Cannot upload images.");
        }
        const userId = user.id;

        const originalImageBlob = dataURItoBlob(originalImagePreview);
        const originalImageFileName = `designs/${userId}/${uuidv4()}.webp`;

        const { error: originalUploadError } = await supabase.storage.from('cakegenie').upload(originalImageFileName, originalImageBlob, { contentType: 'image/webp', upsert: false });
        if (originalUploadError) throw new Error(`Failed to upload original image: ${originalUploadError.message}`);
        const { data: { publicUrl: originalImageUrl } } = supabase.storage.from('cakegenie').getPublicUrl(originalImageFileName);
        if (!originalImageUrl) throw new Error("Could not get original image public URL.");

        let finalImageUrl = originalImageUrl;
        const imageToUpload = options.editedImageDataUri !== undefined ? options.editedImageDataUri : editedImage;

        if (imageToUpload) {
            const editedImageBlob = dataURItoBlob(imageToUpload);
            const editedImageFile = new File([editedImageBlob], 'edited-design.webp', { type: 'image/webp' });
            const compressedEditedFile = await compressImage(editedImageFile, { maxSizeMB: 1, fileType: 'image/webp' });

            const editedImageFileName = `designs/${userId}/${uuidv4()}.webp`;
            const { error: editedUploadError } = await supabase.storage.from('cakegenie').upload(editedImageFileName, compressedEditedFile, { contentType: 'image/webp', upsert: false });
            if (editedUploadError) throw new Error(`Failed to upload customized image: ${editedUploadError.message}`);
            const { data: { publicUrl: editedPublicUrl } } = supabase.storage.from('cakegenie').getPublicUrl(editedImageFileName);
            if (!editedPublicUrl) throw new Error("Could not get customized image public URL.");
            finalImageUrl = editedPublicUrl;
        }

        return { originalImageUrl, finalImageUrl };
    }, [originalImagePreview, editedImage, supabase]);

    return {
        // State
        originalImageData,
        originalImagePreview,
        editedImage,
        threeTierReferenceImage,
        isLoading,
        error,
        setEditedImage,
        setError,
        setIsLoading,

        // Functions
        handleImageUpload,
        loadImageWithoutAnalysis,
        handleSave,
        uploadCartImages,
        clearImages,
    };
};
```

## File: src/hooks/useUserProfile.ts

```ts

```

## File: src/hooks/useAuth.ts

```ts
// hooks/useAuth.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const supabase = getSupabaseClient();

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Initial check
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    checkUser();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (
    credentials: { email: string; password: string; },
    metadata?: { first_name?: string, last_name?: string }
  ) => {
    const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
            data: metadata
        }
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (credentials: { email: string; password: string; }) => {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        // Even if there's an error, clear local state
        setUser(null);
      } else {
        setUser(null);
      }
      return { error };
    } catch (err) {
      console.error('Logout exception:', err);
      // Force clear user state even on exception
      setUser(null);
      return { error: err as Error };
    }
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
  };
};

```

## File: src/hooks/useAppNavigation.ts

```ts
import { useState, useRef, useEffect, useCallback } from 'react';

// Define and export the AppState type for use in other components
export type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation' | 'shared_design' | 'about' | 'how_to_order' | 'contact' | 'reviews' | 'shopify_customizing' | 'pricing_sandbox';

export const useAppNavigation = () => {
    // State
    const [appState, _setAppState] = useState<AppState>('landing');
    const appStateRef = useRef(appState);
    const previousAppState = useRef<AppState | null>(null);
    const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
    const [viewingDesignId, setViewingDesignId] = useState<string | null>(null);
    const [viewingShopifySessionId, setViewingShopifySessionId] = useState<string | null>(null);

    // Custom setter for appState to also manage refs, ensuring consistency
    const setAppState = useCallback((newState: AppState) => {
        if (appStateRef.current !== newState) {
            previousAppState.current = appStateRef.current;
            appStateRef.current = newState;
            _setAppState(newState);
        }
    }, []);

    // Effect for SPA routing via URL hash
    useEffect(() => {
        const handleRouting = () => {
            console.log('[Routing] Handling route for hash:', window.location.hash);
            const pathWithQuery = window.location.hash.substring(1) || ''; // e.g., /order-confirmation?order_id=...

            const [path = '', queryString] = pathWithQuery.split('?');
            const params = new URLSearchParams(queryString || '');
            
            console.log('[Routing] Parsed Path:', path, 'Query:', queryString);

            // Ensure path is a string before calling .match()
            if (!path || typeof path !== 'string') {
                // If path is invalid, reset to landing if needed
                if (appStateRef.current === 'shared_design' || appStateRef.current === 'shopify_customizing') {
                    setViewingDesignId(null);
                    setViewingShopifySessionId(null);
                    setAppState('landing');
                }
                return;
            }

            const designMatch = path.match(/^\/designs\/([a-z0-9-]+)\/?$/);
            const shopifyMatch = path.match(/^\/cakesandmemories\/([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})\/?$/);
            const orderConfirmationMatch = path.match(/^\/order-confirmation\/?$/);
            const oldDesignMatch = path.match(/^\/design\/([a-zA-Z0-9-]+)\/?$/);

            if (orderConfirmationMatch && params.get('order_id')) {
                const orderId = params.get('order_id');
                console.log('[Routing] Matched order confirmation with orderId:', orderId);
                if (orderId) {
                    setConfirmedOrderId(orderId);
                    setAppState('order_confirmation');
                    // TEMPORARILY REMOVED to debug state loss issues. The URL will keep the query param.
                    // window.history.replaceState({}, document.title, `${window.location.pathname}#/order-confirmation`);
                }
            } else if (designMatch && designMatch[1]) {
                setViewingDesignId(designMatch[1]);
                setAppState('shared_design');
            } else if (oldDesignMatch && oldDesignMatch[1]) { // Keep for backward compatibility
                setViewingDesignId(oldDesignMatch[1]);
                setAppState('shared_design');
            } else if (shopifyMatch && shopifyMatch[1]) {
                const sessionId = shopifyMatch[1];
                setViewingShopifySessionId(sessionId);
                setAppState('shopify_customizing');
            } else {
                // If the hash is cleared or doesn't match a special route, reset to landing.
                if (appStateRef.current === 'shared_design' || appStateRef.current === 'shopify_customizing') {
                    setViewingDesignId(null);
                    setViewingShopifySessionId(null);
                    setAppState('landing');
                }
            }
        };

        // Listen for direct hash changes
        window.addEventListener('hashchange', handleRouting);
        
        // Listen for browser back/forward button clicks
        window.addEventListener('popstate', handleRouting);

        // Initial check on component mount to handle direct URL access
        handleRouting();

        // Cleanup listeners on unmount
        return () => {
            window.removeEventListener('hashchange', handleRouting);
            window.removeEventListener('popstate', handleRouting);
        };
    }, [setAppState, setConfirmedOrderId, setViewingDesignId, setViewingShopifySessionId]);

    return {
        appState,
        previousAppState, // The ref for immediate access without re-renders
        confirmedOrderId,
        viewingDesignId,
        viewingShopifySessionId,
        setAppState,
        setConfirmedOrderId,
    };
};
```

## File: src/hooks/index.ts

```ts
// hooks/index.ts
export { useImageManagement } from './useImageManagement';
export { useCakeCustomization } from './useCakeCustomization';
export { useSearchEngine } from './useSearchEngine';
export { usePricing } from './usePricing';
export { useDesignSharing } from './useDesignSharing';
export { useAppNavigation, type AppState } from './useAppNavigation';
export { useDesignUpdate } from './useDesignUpdate';
export { useAuth } from './useAuth';
export { useAddresses } from './useAddresses';
export { useOrders } from './useOrders';
export { useAvailabilitySettings } from './useAvailabilitySettings';
export { useCanonicalUrl } from './useCanonicalUrl';

```

## File: src/hooks/useDesignSharing.ts

```ts
// hooks/useDesignSharing.ts
import { useState, useCallback } from 'react';
// FIX: Import `updateSharedDesignTextsWithRetry` from `shareService` to resolve the "Cannot find name" error.
import { saveDesignToShare, ShareResult, updateSharedDesignTextsWithRetry } from '../services/shareService';
import { generateShareableTexts } from '../services/geminiService.lazy';
import { showError } from '../lib/utils/toast';
import {
    CakeInfoUI,
    MainTopperUI,
    SupportElementUI,
    IcingDesignUI,
    HybridAnalysisResult,
    CakeType,
    CartItemDetails,
    CakeMessageUI,
} from '../types';

interface UseDesignSharingProps {
    editedImage: string | null;
    originalImagePreview: string | null;
    cakeInfo: CakeInfoUI | null;
    basePrice: number | undefined;
    finalPrice: number | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    icingDesign: IcingDesignUI | null;
    analysisResult: HybridAnalysisResult | null;
    HEX_TO_COLOR_NAME_MAP: Record<string, string>;
    cakeMessages: CakeMessageUI[];
    additionalInstructions: string;
}

function calculateAvailabilityForSharing(mainToppers: MainTopperUI[], supportElements: SupportElementUI[], icingDesign: IcingDesignUI | null, cakeInfo: CakeInfoUI | null): 'rush' | 'same-day' | 'normal' {
    if (!cakeInfo || !icingDesign) {
        return 'normal';
    }

    // --- Step 1: Check for Absolute "Standard Order" Overrides ---
    const complexTypes: CakeType[] = ['2 Tier', '3 Tier', '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant', 'Square', 'Rectangle'];
    if (complexTypes.includes(cakeInfo.type) || icingDesign.base === 'fondant') {
        return 'normal';
    }
    
    // FIX: The 'edible_3d' type no longer exists. Updated to check for related types
    // 'edible_3d_complex' and 'edible_3d_ordinary'.
    const has3dTopper = mainToppers.some(t => t.isEnabled && (t.type === 'edible_3d_complex' || t.type === 'edible_3d_ordinary'));
    const hasDrip = icingDesign.drip;
    const hasGumpasteBase = icingDesign.gumpasteBaseBoard;
    
    if (has3dTopper || hasDrip || hasGumpasteBase) {
        return 'normal';
    }

    // --- Step 2: Check for Fast-Track Eligibility ---
    const isFastTrackEligible = 
        (cakeInfo.type === '1 Tier' && (cakeInfo.size === '6" Round' || cakeInfo.size === '8" Round')) || 
        (cakeInfo.type === 'Bento');

    if (!isFastTrackEligible) {
        return 'normal';
    }

    // --- Step 3: Classify as Same-Day or Rush ---
    // FIX: The 'gumpaste_panel' and 'small_gumpaste' types no longer exist.
    // Updated to check for the current gumpaste support types 'edible_3d_support' and 'edible_2d_support'.
    const hasGumpasteSupport = supportElements.some(s => s.isEnabled && (s.type === 'edible_3d_support' || s.type === 'edible_2d_support'));
    const hasEdiblePhoto = 
        mainToppers.some(t => t.isEnabled && t.type === 'edible_photo') || 
        supportElements.some(s => s.isEnabled && s.type === 'edible_photo_side');

    if (hasGumpasteSupport || hasEdiblePhoto) {
        return 'same-day';
    }
    
    // If it passes all checks, it's a Rush order.
    return 'rush';
}


export const useDesignSharing = ({
    editedImage,
    originalImagePreview,
    cakeInfo,
    basePrice,
    finalPrice,
    mainToppers,
    supportElements,
    icingDesign,
    analysisResult,
    HEX_TO_COLOR_NAME_MAP,
    cakeMessages,
    additionalInstructions,
}: UseDesignSharingProps) => {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [shareData, setShareData] = useState<ShareResult | null>(null);
    const [isSavingDesign, setIsSavingDesign] = useState(false);

    const handleShare = useCallback(() => {
        setShareData(null); // Reset any previous share data when opening
        setIsShareModalOpen(true);
    }, []);

    const closeShareModal = () => {
        setIsShareModalOpen(false);
    };

    const createShareLink = useCallback(async (config: {
      billSharingEnabled: boolean;
      billSharingMessage?: string;
      suggestedSplitCount?: number;
      // ADD THESE:
      deliveryAddress?: string;
      deliveryCity?: string;
      deliveryPhone?: string;
      eventDate?: string;
      eventTime?: string;
      recipientName?: string;
    }) => {
        const imageUrlToShare = editedImage || originalImagePreview;
        if (!imageUrlToShare || !analysisResult || !cakeInfo || basePrice === undefined || finalPrice === null || !icingDesign) {
            showError('Cannot create link: missing design or price information.');
            return;
        }
        setIsSavingDesign(true);
        try {
            const availabilityType = calculateAvailabilityForSharing(mainToppers, supportElements, icingDesign, cakeInfo);
            const accessoriesList = [...mainToppers.filter(t => t.isEnabled).map(t => t.description), ...supportElements.filter(s => s.isEnabled).map(s => s.description)];
            const colorsList: { name: string; hex: string }[] = [];
            if (icingDesign) {
                for (const [colorKey, hex] of Object.entries(icingDesign.colors)) {
                    if (typeof hex === 'string') {
                        const colorName = HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || hex;
                        const keyName = colorKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        colorsList.push({ name: `${keyName}: ${colorName}`, hex });
                    }
                }
            }

            const hexToName = (hex: string) => HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || hex;
            const customizationDetails: CartItemDetails = {
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
            
            const designData = {
              customizedImageUrl: imageUrlToShare,
              originalImageUrl: originalImagePreview || undefined,
              cakeType: cakeInfo.type,
              cakeSize: cakeInfo.size,
              cakeFlavor: cakeInfo.flavors.join(', '),
              cakeThickness: cakeInfo.thickness,
              icingColors: colorsList,
              accessories: accessoriesList,
              basePrice,
              finalPrice,
              availabilityType,
              title: `${cakeInfo.size} ${cakeInfo.type} Cake`,
              description: 'A custom cake design from Genie.',
              altText: `A custom ${cakeInfo.type} cake.`,
              billSharingEnabled: config.billSharingEnabled,
              billSharingMessage: config.billSharingMessage,
              suggestedSplitCount: config.suggestedSplitCount,
              deliveryAddress: config.deliveryAddress,
              deliveryCity: config.deliveryCity,
              deliveryPhone: config.deliveryPhone,
              eventDate: config.eventDate,
              eventTime: config.eventTime,
              recipientName: config.recipientName,
              customization_details: customizationDetails,
            };

            const result = await saveDesignToShare(designData);

            if (result) {
                setShareData(result);

                (async () => {
                    try {
                        const { title, description, altText } = await generateShareableTexts(
                            analysisResult,
                            cakeInfo,
                            HEX_TO_COLOR_NAME_MAP,
                            editedImage // Pass the edited image for accurate text generation
                        );
                        await updateSharedDesignTextsWithRetry(result.designId, title, description, altText);
                    } catch (enrichError) {
                        console.error('❌ Background enrichment failed:', enrichError);
                    }
                })();
            } else {
                throw new Error("Failed to save design data.");
            }
        } catch (error) {
            showError('Failed to create a shareable link.');
        } finally {
            setIsSavingDesign(false);
        }
    }, [editedImage, originalImagePreview, cakeInfo, basePrice, finalPrice, mainToppers, supportElements, icingDesign, analysisResult, HEX_TO_COLOR_NAME_MAP, cakeMessages, additionalInstructions]);


    return {
        isShareModalOpen,
        shareData,
        isSavingDesign,
        handleShare,
        createShareLink,
        closeShareModal,
    };
};
```

## File: src/hooks/useSearchEngine.ts

```ts
import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { trackSearchTerm } from '../services/supabaseService';
import { AppState } from './useAppNavigation';
import { GoogleCSE, GoogleCSEElement } from '../types';

// Global window type extension from App.tsx
declare global {
  interface Window {
    __gcse?: {
      parsetags: string;
      callback: () => void;
    };
    google?: GoogleCSE | any;
  }
}

// Declare gtag for Google Analytics event tracking
declare const gtag: (...args: any[]) => void;

interface UseSearchEngineProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
  handleImageUpload: (file: File, imageUrl?: string) => Promise<any>;
  setImageError: (error: string | null) => void;
  originalImageData: { data: string; mimeType: string } | null;
  setIsFetchingWebImage: (fetching: boolean) => void;
}

const GOOGLE_SEARCH_CONTAINER_ID = 'google-search-container';

const fetchWithTimeout = (
  resource: RequestInfo,
  options: RequestInit & { timeout: number }
): Promise<Response> => {
  const { timeout = 6000 } = options;

  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const id = setTimeout(() => {
      controller.abort();
      reject(new Error('Fetch timed out'));
    }, timeout);

    fetch(resource, { ...options, signal: controller.signal })
      .then(response => {
        clearTimeout(id);
        if (!response.ok) {
          reject(new Error(`HTTP error! status: ${response.status}`));
        } else {
          resolve(response);
        }
      })
      .catch(error => {
        clearTimeout(id);
        reject(error);
      });
  });
};


export const useSearchEngine = ({
  appState,
  setAppState,
  handleImageUpload,
  setImageError,
  originalImageData,
  setIsFetchingWebImage
}: UseSearchEngineProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [isCSELoaded, setIsCSELoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const cseElementRef = useRef<GoogleCSEElement | null>(null);
  const isProcessingUrlRef = useRef(false);

  const handleImageFromUrl = useCallback(async (imageUrl: string, clickedElement: HTMLElement) => {
    if (isProcessingUrlRef.current) return;
    isProcessingUrlRef.current = true;
    setIsFetchingWebImage(true);

    // Reset styles on all other images and apply active style to the clicked one
    const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
    if (container) {
      container.querySelectorAll('img').forEach(img => {
        const htmlImg = img as HTMLElement;
        htmlImg.style.border = 'none';
        htmlImg.style.boxShadow = 'none';
        htmlImg.style.transform = 'scale(1)';
        htmlImg.style.opacity = '1';
      });
    }
    clickedElement.style.transition = 'all 0.2s ease-out';
    clickedElement.style.border = '4px solid #EC4899';
    clickedElement.style.boxShadow = '0 0 20px rgba(236, 72, 153, 0.6)';
    clickedElement.style.transform = 'scale(0.95)';
    clickedElement.style.opacity = '0.9';

    const proxies = [
      'https://corsproxy.io/?', // Primary, fastest
      'https://api.allorigins.win/raw?url=' // Reliable backup
    ];
    const timeout = 6000; // 6 seconds

    const fetchPromises = proxies.map(proxy =>
      fetchWithTimeout(`${proxy}${encodeURIComponent(imageUrl)}`, { timeout })
        .then(response => response.blob())
        .then(blob => {
          if (blob.type.startsWith('text/')) {
            throw new Error('Proxy returned non-image content.');
          }
          return blob;
        })
    );

    // Add direct fetch as a last resort, it might work for some sites
    fetchPromises.push(
      fetchWithTimeout(imageUrl, { timeout, mode: 'cors' })
        .then(response => response.blob())
        .catch(() => {
          throw new Error('Direct fetch failed (likely CORS)');
        })
    );

    try {
      // Race all promises. The first one to resolve (not reject) wins.
      const blob = await Promise.race(fetchPromises);
      const file = new File([blob], 'cake-design.webp', { type: blob.type || 'image/webp' });
      await handleImageUpload(file, imageUrl);
    } catch (err) {
      console.warn("Promise.race failed, falling back to allSettled to find any success.", err);
      const results = await Promise.allSettled(fetchPromises);
      const successResult = results.find(result => result.status === 'fulfilled');

      if (successResult && 'value' in successResult && successResult.value instanceof Blob) {
        const blob = successResult.value;
        const file = new File([blob], 'cake-design.webp', { type: blob.type || 'image/webp' });
        await handleImageUpload(file, imageUrl);
      } else {
        console.error("All fetch attempts failed completely:", results);
        setImageError("Could not load image from any source. It may be protected. Tip: Try saving it to your device and using the 'Upload' button.");
        clickedElement.style.border = '4px solid #EF4444';
        clickedElement.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.6)';
        setAppState('searching');
      }
    } finally {
      setIsFetchingWebImage(false);
      isProcessingUrlRef.current = false;
    }
  }, [handleImageUpload, setImageError, setAppState, setIsFetchingWebImage]);

  const handleSearch = useCallback((query?: string) => {
    const searchQueryValue = typeof query === 'string' ? query.trim() : searchInput.trim();
    if (!searchQueryValue) return;

    // Analytics: Track when a user starts the design process via search
    if (typeof gtag === 'function') {
      gtag('event', 'start_design', {
        'event_category': 'ecommerce_funnel',
        'event_label': 'search'
      });
    }

    trackSearchTerm(searchQueryValue).catch(console.error);
    if (typeof query === 'string') setSearchInput(searchQueryValue);
    setIsSearching(true);
    setImageError(null);
    setAppState('searching');
    setSearchQuery(searchQueryValue);
  }, [searchInput, setImageError, setAppState]);

  // FIX: Added React to import to make React.KeyboardEvent available.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { if (searchInput.trim()) handleSearch(searchInput.trim()); }
    if (e.key === 'Escape' && appState === 'searching') { originalImageData ? setAppState('customizing') : setAppState('landing'); }
  }, [searchInput, handleSearch, appState, originalImageData, setAppState]);

  useEffect(() => {
    if (window.__gcse) return;
    window.__gcse = { parsetags: 'explicit', callback: () => { if (window.google?.search?.cse) setIsCSELoaded(true); } };
    const script = document.createElement('script');
    script.src = 'https://cse.google.com/cse.js?cx=825ca1503c1bd4d00';
    script.async = true;
    script.id = 'google-cse-script';
    script.onerror = () => { setImageError('Failed to load the search engine. Please refresh the page.'); setIsSearching(false); };
    document.head.appendChild(script);
    return () => { document.getElementById('google-cse-script')?.remove(); };
  }, [setImageError]);

  useEffect(() => {
    // This effect handles rendering the Google CSE results.
    // It runs when the app enters the 'searching' state and the CSE script is ready.
    if (appState !== 'searching' || !searchQuery || !isCSELoaded) {
      if (appState !== 'searching') {
        setIsSearching(false);
      }
      return;
    }

    const renderAndExecute = () => {
      try {
        let element = cseElementRef.current;
        if (!element) {
          element = window.google.search.cse.element.render({
            div: GOOGLE_SEARCH_CONTAINER_ID,
            tag: 'searchresults-only',
            gname: 'image-search',
            attributes: { searchType: 'image', disableWebSearch: true }
          });
          cseElementRef.current = element;
        }
        element.execute(searchQuery);
      } catch (e) {
        setImageError('Failed to initialize or run the search service. Please refresh.');
      } finally {
        setIsSearching(false);
      }
    };

    const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
    if (container) {
      renderAndExecute();
    } else {
      // Poll for the container if it's not immediately available
      let attempts = 0;
      const intervalId = setInterval(() => {
        const polledContainer = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
        if (polledContainer) {
          clearInterval(intervalId);
          renderAndExecute();
        } else if (attempts > 30) { // Give up after ~3 seconds
          clearInterval(intervalId);
          setImageError('Search container did not appear. Please refresh the page.');
          setIsSearching(false);
        }
        attempts++;
      }, 100);

      return () => clearInterval(intervalId);
    }
  }, [appState, isCSELoaded, searchQuery, setImageError]);

  useEffect(() => {
    let timeoutId: number | null = null;
    if (appState === 'searching' && searchQuery && !isCSELoaded) {
      timeoutId = window.setTimeout(() => { if (!isCSELoaded) { setImageError('The search service is taking too long. Please refresh.'); setIsSearching(false); } }, 8000);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [appState, searchQuery, isCSELoaded, setImageError]);


  useEffect(() => {
    if (appState !== 'searching' && cseElementRef.current) {
      const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
      if (container) container.innerHTML = '';
      cseElementRef.current = null;
    }
  }, [appState]);

  useEffect(() => {
    if (appState !== 'searching') return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const img = target.tagName === 'IMG' ? target : target.closest('a')?.querySelector('img');
      if (img instanceof HTMLImageElement && img.src && document.getElementById(GOOGLE_SEARCH_CONTAINER_ID)?.contains(img)) {
        event.preventDefault();
        handleImageFromUrl(img.src, img);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [appState, handleImageFromUrl]);

  useEffect(() => {
    if (appState !== 'searching') return;
    const container = document.getElementById(GOOGLE_SEARCH_CONTAINER_ID);
    if (!container) return;
    const observer = new MutationObserver(() => {
      container.querySelectorAll('.gcse-result-tabs, .gsc-tabsArea, .gsc-above-wrapper-area, .gsc-adBlock, .gs-image-box-popup, .gs-image-popup-box, .gs-title, .gs-bidi-start-align').forEach(el => (el as HTMLElement).style.display = 'none');
      container.querySelectorAll('.gs-image-box:not(.customize-btn-added)').forEach(resultContainer => {
        const containerEl = resultContainer as HTMLElement;
        containerEl.classList.add('customize-btn-added'); // Mark as processed immediately to prevent re-adding

        const img = containerEl.querySelector('img');
        if (img && img.src) {
          // Delay button appearance by 500ms as requested
          setTimeout(() => {
            // Before appending, ensure the container is still part of the document
            if (!document.body.contains(containerEl)) return;

            containerEl.style.position = 'relative';
            const button = document.createElement('button');
            const sparkleIconSVG = `<svg class="w-4 h-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>`;
            button.innerHTML = `${sparkleIconSVG}<span>Get Price</span>`;
            button.className = 'absolute bottom-2 right-2 flex items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all opacity-0 z-50';
            button.addEventListener('click', (e) => { e.stopPropagation(); handleImageFromUrl(img.src, img); });
            containerEl.appendChild(button);

            // Use requestAnimationFrame to trigger the CSS transition for fade-in
            requestAnimationFrame(() => {
              button.style.opacity = '1';
            });
          }, 500);
        }
      });
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [appState, handleImageFromUrl]);


  return {
    isSearching,
    isCSELoaded,
    searchQuery,
    searchInput,
    setSearchInput,
    cseElementRef,
    handleSearch,
    handleKeyDown,
    handleImageFromUrl,
  };
};
```

## File: src/hooks/useDesignUpdate.ts

```ts
// hooks/useDesignUpdate.ts
import { useState, useRef, useCallback } from 'react';
import { updateDesign } from '../services/designService';
import type {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI
} from '../types';

// Declare gtag for Google Analytics event tracking
declare const gtag: (...args: any[]) => void;

interface UseDesignUpdateProps {
    originalImageData: { data: string; mimeType: string } | null;
    analysisResult: HybridAnalysisResult | null;
    cakeInfo: CakeInfoUI | null;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI | null;
    additionalInstructions: string;
    threeTierReferenceImage: { data: string; mimeType: string } | null;
    onSuccess: (editedImage: string) => void;
    // ADDED: Optional prompt generator for specialized flows
    promptGenerator?: (
        originalAnalysis: HybridAnalysisResult | null,
        newCakeInfo: CakeInfoUI,
        mainToppers: MainTopperUI[],
        supportElements: SupportElementUI[],
        cakeMessages: CakeMessageUI[],
        icingDesign: IcingDesignUI,
        additionalInstructions: string
    ) => string;
}

export const useDesignUpdate = ({
    originalImageData,
    analysisResult,
    cakeInfo,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    additionalInstructions,
    threeTierReferenceImage,
    onSuccess,
    promptGenerator, // ADDED
}: UseDesignUpdateProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastGenerationInfoRef = useRef<{ prompt: string; systemInstruction: string; } | null>(null);

    const handleUpdateDesign = useCallback(async () => {
        // Analytics: Track when a user completes a customization by updating the design
        if (typeof gtag === 'function') {
            gtag('event', 'update_design', {
                'event_category': 'ecommerce_funnel'
            });
        }
        
        // Guard against missing critical data which is checked in the service, but good to have here too.
        if (!originalImageData || !icingDesign || !cakeInfo) {
            const missingDataError = "Cannot update design: missing original image, icing design, or cake info.";
            console.error(missingDataError);
            setError(missingDataError);
            throw new Error(missingDataError);
        }
        
        setIsLoading(true);
        setError(null);

        try {
            const { image: editedImageResult, prompt, systemInstruction } = await updateDesign({
                originalImageData,
                analysisResult,
                cakeInfo,
                mainToppers,
                supportElements,
                cakeMessages,
                icingDesign,
                additionalInstructions,
                threeTierReferenceImage,
                promptGenerator, // ADDED: Pass the generator to the service
            });

            lastGenerationInfoRef.current = { prompt, systemInstruction };
            onSuccess(editedImageResult);
            return editedImageResult;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while updating the design.';
            setError(errorMessage);
            throw err; // Re-throw the error to be caught by the caller
        } finally {
            setIsLoading(false);
        }
    }, [
        originalImageData, 
        analysisResult, 
        cakeInfo,
        mainToppers, 
        supportElements, 
        cakeMessages, 
        icingDesign, 
        additionalInstructions, 
        threeTierReferenceImage,
        onSuccess,
        promptGenerator, // ADDED
    ]);

    return {
        isLoading,
        error,
        lastGenerationInfoRef,
        handleUpdateDesign,
        setError,
    };
};
```

## File: src/hooks/useAddresses.ts

```ts



import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getUserAddresses, 
  addAddress, 
  deleteAddress, 
  setDefaultAddress,
  updateAddress,
} from '../services/supabaseService';
import { CakeGenieAddress } from '../lib/database.types';

export function useAddresses(userId: string | undefined) {
  return useQuery({
    queryKey: ['addresses', userId],
    queryFn: async () => {
      if (!userId) return []; // Return empty array if no user
      const result = await getUserAddresses(userId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAddAddress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, addressData }: { userId: string; addressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>}) => {
      const result = await addAddress(userId, addressData);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.user_id) {
        queryClient.invalidateQueries({ queryKey: ['addresses', data.user_id] });
      }
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, addressId, addressData }: { userId: string; addressId: string; addressData: Partial<Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>>}) => {
      const result = await updateAddress(userId, addressId, addressData);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.user_id) {
        queryClient.invalidateQueries({ queryKey: ['addresses', data.user_id] });
      }
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, addressId }: { userId: string; addressId: string }) => {
      const result = await deleteAddress(addressId);
      if (result.error) throw result.error;
      // FIX: `result.data` is null, so it cannot be spread. Return it directly.
      // The `userId` is available in `variables` in `onSuccess`.
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['addresses', variables.userId] });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, addressId }: { userId: string; addressId: string }) => {
      const result = await setDefaultAddress(addressId, userId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['addresses', variables.userId] });
    },
  });
}
```

## File: src/lib/database.types.ts

```ts
// lib/database.types.ts

/**
 * The status of a customer's order in the fulfillment process.
 */
export type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'ready_for_delivery' | 'out_for_delivery' | 'delivered' | 'cancelled';

/**
 * The payment status of an order.
 */
export type PaymentStatus = 'pending' | 'verifying' | 'partial' | 'paid' | 'refunded' | 'failed';

/**
 * Detailed breakdown of a cake's customizations.
 * Stored as JSONB in the database.
 * This should ONLY contain decorative/flavor info, not the base cake properties.
 */
export interface CustomizationDetails {
  flavors: string[];
  mainToppers: {
    description: string;
    type: string;
    size?: string;
  }[];
  supportElements: {
    description: string;
    type: string;
    coverage?: string;
  }[];
  cakeMessages: {
    text: string;
    color: string;
  }[];
  icingDesign: {
    drip: boolean;
    gumpasteBaseBoard: boolean;
    colors: Record<string, string>;
  };
  additionalInstructions: string;
}

/**
 * Represents a user in the `cakegenie_users` table.
 */
export interface CakeGenieUser {
  user_id: string; // UUID
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  email_verified: boolean;
  is_active: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  last_login: string | null; // ISO 8601 timestamp
}

/**
 * Represents a delivery address in the `cakegenie_addresses` table.
 */
export interface CakeGenieAddress {
  address_id: string; // UUID
  user_id: string; // UUID
  address_label: string; // e.g., "Home", "Work"
  recipient_name: string;
  recipient_phone: string;
  street_address: string;
  barangay: string;
  city: string;
  province: string;
  postal_code: string;
  landmark: string | null;
  country: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Represents an item in a user's shopping cart in the `cakegenie_cart` table.
 */
export interface CakeGenieCartItem {
  cart_item_id: string; // UUID
  user_id: string | null; // UUID, nullable for guest carts
  session_id: string | null; // For guest carts
  cake_type: string;
  cake_thickness: string;
  cake_size: string;
  base_price: number;
  addon_price: number;
  final_price: number;
  quantity: number;
  original_image_url: string;
  customized_image_url: string;
  customization_details: CustomizationDetails;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  expires_at: string; // ISO 8601 timestamp
}

/**
 * Represents a customer order in the `cakegenie_orders` table.
 */
export interface CakeGenieOrder {
  order_id: string; // UUID
  order_number: string;
  user_id: string | null; // UUID, nullable for guest orders
  guest_email: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  delivery_address_id: string | null; // UUID, nullable for guest orders
  delivery_date: string; // YYYY-MM-DD
  delivery_time_slot: string;
  delivery_instructions: string | null;
  customer_notes: string | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  discount_code_id: string | null; // UUID, tracks which discount code was used
  total_amount: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_proof_url: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  confirmed_at: string | null; // ISO 8601 timestamp
  delivered_at: string | null; // ISO 8601 timestamp
  cakegenie_order_items?: CakeGenieOrderItem[]; // Optional for joined queries
}

/**
 * Represents a line item within an order in the `cakegenie_order_items` table.
 */
export interface CakeGenieOrderItem {
  item_id: string; // UUID
  order_id: string; // UUID
  cake_type: string;
  cake_thickness: string;
  cake_size: string;
  base_price: number;
  addon_price: number;
  final_price: number;
  quantity: number;
  original_image_url: string;
  customized_image_url: string;
  customization_details: CustomizationDetails;
  item_notes: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}
```

## File: src/lib/queryClient.ts

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh for 5 mins
      gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache for 10 mins
      retry: 1, // Retry failed requests once
      refetchOnWindowFocus: false, // Don't refetch when user switches tabs
      refetchOnReconnect: true, // Refetch when internet reconnects
    },
  },
});

```

## File: src/lib/utils/urlHelpers.ts

```ts
// lib/utils/urlHelpers.ts
export function generateUrlSlug(title: string, uuid: string): string {
  // Take first 8 chars of UUID
  const shortId = uuid.substring(0, 8);
  
  // Clean and format title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/-+/g, '-') // Multiple hyphens to single
    .substring(0, 50) // Limit length
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  return `${slug}-${shortId}`;
}

```

## File: src/lib/utils/availability.ts

```ts
// lib/utils/availability.ts

import { CakeInfoUI, MainTopperUI, SupportElementUI, IcingDesignUI, CartItem, CakeType } from '../../types';

export type AvailabilityType = 'rush' | 'same-day' | 'normal';

// This is the data structure needed by the function, which can be constructed
// from either a CartItem or the state in the customizing page.
interface DesignData {
    cakeType: CakeType;
    cakeSize: string;
    icingBase: 'soft_icing' | 'fondant';
    drip: boolean;
    gumpasteBaseBoard: boolean;
    mainToppers: { type: string; description: string; }[];
    supportElements: { type: string; description: string; }[];
}

/**
 * Determines the availability of a cake design based on its complexity using a hierarchical approach.
 */
function getDesignAvailability(design: DesignData): AvailabilityType {
    const allItems = [...design.mainToppers, ...design.supportElements];

    // --- STEP 1: NORMAL ORDER CHECKS (1-day lead time) ---
    // Checks for structurally complex cakes or the most time-consuming decorations.
    const isStructurallyComplex = [
        '2 Tier', '3 Tier', '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant', 'Square', 'Rectangle'
    ].includes(design.cakeType) || design.icingBase === 'fondant';

    // Truly complex, hand-sculpted or assembled items.
    const hasHighlyComplexDecorations = allItems.some(item =>
        ['edible_3d_complex', 'edible_3d_ordinary'].includes(item.type) || // 3D sculptures (was 'edible_3d')
        item.type === 'edible_2d_support' || // Large panels (was 'gumpaste_panel')
        item.type === 'edible_flowers'    // Intricate sugar flowers
    );

    if (isStructurallyComplex || hasHighlyComplexDecorations || design.drip || design.gumpasteBaseBoard) {
        return 'normal';
    }

    // --- STEP 2: SAME-DAY ORDER CHECKS (3-hour lead time) ---
    // Checks for decorations that take some prep time but not a full day.
    const hasSameDayDecorations = allItems.some(item =>
        item.type === 'edible_2d_support' || // Flat 2D cutouts (was 'edible_2d_gumpaste')
        (item.type === 'edible_3d_support' && !item.description.toLowerCase().includes('dots')) || // Small non-dot gumpaste items (was 'small_gumpaste')
        item.type === 'edible_photo' ||
        item.type === 'edible_photo_side' ||
        item.type === 'icing_doodle' // Piped doodles require more time than rush orders.
    );

    if (hasSameDayDecorations) {
        return 'same-day';
    }

    // --- STEP 3: RUSH ORDER ELIGIBILITY (30-min lead time) ---
    // If we've reached this point, the cake has only the simplest decorations.
    // We now check if the base cake itself is simple enough for a rush order.
    const isRushEligibleBase =
        (design.cakeType === '1 Tier' && (design.cakeSize === '6" Round' || design.cakeSize === '8" Round')) ||
        (design.cakeType === 'Bento');

    if (isRushEligibleBase) {
        return 'rush';
    }

    // --- STEP 4: DEFAULT FALLBACK ---
    // If the cake base is not eligible for rush (e.g., a 10" round 1-tier cake)
    // but has no complex decorations, it defaults to a standard order as a safe fallback.
    return 'normal';
}


// --- Main exported functions ---

export function calculateCartAvailability(items: CartItem[]): AvailabilityType {
    // If any item has an error, default to normal as a safe fallback.
    if (items.some(item => item.status === 'error')) {
        return 'normal';
    }

    // Calculate availability for all items, including 'pending' ones,
    // as they contain all necessary details for the calculation.
    const availabilities = items.map((item): AvailabilityType => {
        // Map CartItem string type back to CakeType enum
        const stringToCakeType: Record<string, CakeType> = {
            '1 Tier (Soft icing)': '1 Tier',
            '2 Tier (Soft icing)': '2 Tier',
            '3 Tier (Soft icing)': '3 Tier',
            '1 Tier Fondant': '1 Tier Fondant',
            '2 Tier Fondant': '2 Tier Fondant',
            '3 Tier Fondant': '3 Tier Fondant',
            'Square': 'Square',
            'Rectangle': 'Rectangle',
            'Bento': 'Bento'
        };
        const cakeType = stringToCakeType[item.type] || item.type as CakeType;

        const design: DesignData = {
            cakeType: cakeType,
            cakeSize: item.size,
            icingBase: item.type.includes('Fondant') ? 'fondant' : 'soft_icing',
            drip: item.details.icingDesign.drip,
            gumpasteBaseBoard: item.details.icingDesign.gumpasteBaseBoard,
            mainToppers: item.details.mainToppers,
            supportElements: item.details.supportElements,
        };
        return getDesignAvailability(design);
    });

    // The most restrictive availability determines the cart's overall availability.
    if (availabilities.includes('normal')) return 'normal';
    if (availabilities.includes('same-day')) return 'same-day';
    
    // If no 'normal' or 'same-day' items, it must be 'rush' (or empty, which also qualifies as 'rush').
    return 'rush';
}

export function calculateCustomizingAvailability(
    cakeInfo: CakeInfoUI,
    icingDesign: IcingDesignUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[]
): AvailabilityType {
    // Map customizing state to DesignData, ensuring we only consider enabled items.
    const design: DesignData = {
        cakeType: cakeInfo.type,
        cakeSize: cakeInfo.size,
        icingBase: icingDesign.base,
        drip: icingDesign.drip,
        gumpasteBaseBoard: icingDesign.gumpasteBaseBoard,
        mainToppers: mainToppers.filter(t => t.isEnabled),
        supportElements: supportElements.filter(s => s.isEnabled),
    };
    return getDesignAvailability(design);
}
```

## File: src/lib/utils/toast.ts

```ts
// lib/utils/toast.ts
import toast, { ToastOptions } from 'react-hot-toast';

/**
 * Displays a success toast notification with a consistent style.
 * @param message The message to display.
 */
export const showSuccess = (message: string, options?: ToastOptions) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#10B981', // Green-500
      color: '#ffffff',
    },
    ...options,
  });
};

/**
 * Displays an error toast notification with a consistent style.
 * @param message The message to display.
 */
export const showError = (message: string, options?: ToastOptions) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#EF4444', // Red-500
      color: '#ffffff',
    },
    ...options,
  });
};

/**
 * Displays a loading toast notification and returns its ID.
 * @param message The message to display.
 * @returns The ID of the toast, which can be used to dismiss it later.
 */
export const showLoading = (message: string, options?: ToastOptions): string => {
  return toast.loading(message, {
    position: 'top-center',
    ...options,
  });
};

/**
 * Displays an informational toast notification.
 * @param message The message to display.
 */
export const showInfo = (message: string, options?: ToastOptions) => {
  toast(message, {
    duration: 4000,
    position: 'top-center',
    icon: 'ℹ️',
    style: {
      background: '#3B82F6', // Blue-500
      color: '#ffffff',
    },
    ...options,
  });
};
```

## File: src/lib/utils/imageOptimization.ts

```ts
import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
}

/**
 * Compress an image file for optimal upload size
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 1, // Max file size in MB
    maxWidthOrHeight: 1920, // Max dimension
    useWebWorker: true, // Use web worker for better performance
    fileType: 'image/webp', // Convert to WebP for better compression
  };

  const compressionOptions = { ...defaultOptions, ...options };

  try {
    console.log('Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    const compressedFile = await imageCompression(file, compressionOptions);
    
    console.log('Compressed file size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Compression ratio:', ((1 - compressedFile.size / file.size) * 100).toFixed(2), '%');
    
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Compress an image for thumbnail display
 */
export async function compressThumbnail(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 400,
  });
}

/**
 * Get optimized image URL from Supabase Storage with transforms
 */
export function getOptimizedImageUrl(
  supabaseUrl: string,
  bucketName: string,
  filePath: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}
): string {
  const { width = 800, height = 800, quality = 80, format = 'webp' } = options;
  
  // Supabase storage transform URL format
  const transformParams = `width=${width}&height=${height}&quality=${quality}&format=${format}`;
  return `${supabaseUrl}/storage/v1/render/image/public/${bucketName}/${filePath}?${transformParams}`;
}

/**
 * Validate image file type and size
 */
export function validateImageFile(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const { maxSizeMB = 10, allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] } = options;

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB (your file: ${fileSizeMB.toFixed(2)}MB)`,
    };
  }

  return { valid: true };
}

/**
 * Create a preview URL for an image file
 */
export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a data URI to a Blob object.
 */
// FIX: Add dataURItoBlob utility function to be shared.
export function dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}
```

## File: src/lib/utils/timeout.ts

```ts
// lib/utils/timeout.ts
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
  return Promise.race([promise, timeout]);
}

```

## File: src/lib/supabase/client.ts

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
  throw new Error("Supabase credentials are not configured. Please update your details in the `config.ts` file.");
}

let client: SupabaseClient | null = null;

/**
 * Gets the singleton Supabase client instance.
 * Creates the client if it doesn't exist yet.
 * Safe for concurrent calls - always returns the same instance.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

```

## File: src/lib/services/supabaseService.ts

```ts

```

## File: src/services/discountService.ts

```ts
import { getSupabaseClient } from '../lib/supabase/client';
import type { DiscountValidationResult } from '../types';

const supabase = getSupabaseClient();

/**
 * Validates a discount code and returns the calculated discount
 * Checks all restrictions: active, expired, usage limits, user restrictions, etc.
 */
export async function validateDiscountCode(
  code: string,
  orderAmount: number
): Promise<DiscountValidationResult> {
  try {
    const normalizedCode = code.trim().toUpperCase();
    console.log('🎫 Validating discount code:', { code: normalizedCode, orderAmount });

    // Query the discount_codes table
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    // Code doesn't exist
    if (error || !discountCode) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'Invalid discount code',
      };
    }

    // Check if active
    if (!discountCode.is_active) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This discount code is no longer active',
      };
    }

    // Check expiration
    if (discountCode.expires_at) {
      const expirationDate = new Date(discountCode.expires_at);
      if (expirationDate < new Date()) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: `This code expired on ${expirationDate.toLocaleDateString()}`,
        };
      }
    }

    // Check usage limit
    if (discountCode.max_uses !== null && discountCode.times_used >= discountCode.max_uses) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This discount code has reached its usage limit',
      };
    }

    // Check minimum order amount
    if (discountCode.min_order_amount && orderAmount < discountCode.min_order_amount) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: `Minimum order amount of ₱${discountCode.min_order_amount} required`,
      };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Check if code is user-specific
    if (discountCode.user_id && discountCode.user_id !== user?.id) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'This code is not valid for your account',
      };
    }

    // Check if user needs to be logged in
    if ((discountCode.one_per_user || discountCode.new_users_only) && (!user || user.is_anonymous)) {
      return {
        valid: false,
        discountAmount: 0,
        originalAmount: orderAmount,
        finalAmount: orderAmount,
        message: 'You must be logged in to use this discount code',
      };
    }

    // Check new users only restriction
    if (discountCode.new_users_only && user) {
        const { count } = await supabase
            .from('cakegenie_orders')
            .select('order_id', { count: 'exact', head: true })
            .eq('user_id', user.id);

      if (count && count > 0) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'This code is only for new customers',
        };
      }
    }

    // Check one-per-user restriction
    if (discountCode.one_per_user && user) {
        const { count } = await supabase
            .from('discount_code_usage')
            .select('usage_id', { count: 'exact', head: true })
            .eq('discount_code_id', discountCode.code_id)
            .eq('user_id', user.id);

      if (count && count > 0) {
        return {
          valid: false,
          discountAmount: 0,
          originalAmount: orderAmount,
          finalAmount: orderAmount,
          message: 'You have already used this discount code',
        };
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.discount_amount) {
      discountAmount = discountCode.discount_amount;
    } else if (discountCode.discount_percentage) {
      discountAmount = (orderAmount * discountCode.discount_percentage) / 100;
    }

    // Ensure discount doesn't exceed order amount, but don't let it go below zero.
    discountAmount = Math.min(discountAmount, orderAmount);
    const finalAmount = Math.max(0, orderAmount - discountAmount);

    return {
      valid: true,
      discountAmount,
      codeId: discountCode.code_id,
      originalAmount: orderAmount,
      finalAmount,
      message: 'Discount code applied successfully!',
    };
  } catch (error) {
    console.error('Error validating discount code:', error);
    return {
      valid: false,
      discountAmount: 0,
      originalAmount: orderAmount,
      finalAmount: orderAmount,
      message: 'An unexpected error occurred while validating the code.',
    };
  }
}

/**
 * Records that a user used a discount code (call after order creation)
 * NOTE: This is handled by the `create_order_from_cart` RPC and is redundant for the main flow.
 */
export async function recordDiscountCodeUsage(
  discountCodeId: string,
  userId: string,
  orderId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('discount_code_usage')
      .insert({
        discount_code_id: discountCodeId,
        user_id: userId,
        order_id: orderId,
      });

    if (error) {
      console.error('Error recording discount usage:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception recording discount usage:', error);
    return { success: false, error };
  }
}

/**
 * Get user's available discount codes.
 */
export async function getUserDiscountCodes(): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Temporarily disabled - RPC function not yet created
    const userDiscounts: any[] = [];
    return userDiscounts;
  } catch (error) {
    console.error('Exception fetching user discount codes:', error);
    return [];
  }
}
```

## File: src/services/pricingService.ts

```ts
// services/pricingService.ts
import { MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, AddOnPricing, Size, CakeInfoUI, CakeType, Coverage } from '../types';

// ============================================================================
// DYNAMIC PRICING ENGINE (V5 - Gumpaste Overhaul)
// ============================================================================

// --- Helper Functions ---

function getEdible3DComplexPrice(size: Size): number {
    if (size === 'large') return 600;
    if (size === 'medium') return 400;
    if (size === 'small') return 200;
    if (size === 'tiny') return 100;
    return 0;
}

function getEdible3DOrdinaryPrice(size: Size): number {
    if (size === 'large') return 200;
    if (size === 'medium') return 100;
    if (size === 'small') return 50;
    if (size === 'tiny') return 20;
    return 0;
}

function getSupportGumpastePrice(coverage: Coverage): number { // This is now for edible_3d_support
    if (coverage === 'large') return 300;
    if (coverage === 'medium') return 200;
    if (coverage === 'small') return 100;
    if (coverage === 'tiny') return 50;
    return 0;
}

// NEW function for edible_2d_support
function getEdible2DSupportPrice(coverage: Coverage): number {
    if (coverage === 'large') return 150;
    if (coverage === 'medium') return 100;
    if (coverage === 'small') return 50;
    if (coverage === 'tiny') return 20;
    return 0;
}


function extractTierCount(cakeType: CakeType): number {
  if (cakeType.includes('3 Tier')) return 3;
  if (cakeType.includes('2 Tier')) return 2;
  return 1;
}

// --- Main Calculation Logic ---

export const calculatePrice = (
    uiState: {
        mainToppers: MainTopperUI[],
        supportElements: SupportElementUI[],
        cakeMessages: CakeMessageUI[],
        icingDesign: IcingDesignUI,
        cakeInfo: CakeInfoUI,
    }
): { addOnPricing: AddOnPricing; itemPrices: Map<string, number> } => {

    const { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo } = uiState;
    const breakdown: { item: string; price: number; }[] = [];
    
    const itemPrices = new Map<string, number>();
    let heroGumpasteTotal = 0;
    let supportGumpasteRawTotal = 0;
    let nonGumpasteTotal = 0;

    const GUMPASTE_ALLOWANCE = 200;

    // --- Process All Main Toppers in a Single Loop ---
    mainToppers.forEach(topper => {
        if (!topper.isEnabled) {
            itemPrices.set(topper.id, 0);
            return;
        }

        let price = 0;
        
        switch (topper.type) {
            case 'edible_3d_complex':
                price = getEdible3DComplexPrice(topper.size) * topper.quantity;
                heroGumpasteTotal += price;
                break;
            case 'edible_3d_ordinary':
                price = getEdible3DOrdinaryPrice(topper.size) * topper.quantity;
                heroGumpasteTotal += price;
                break;

            case 'meringue_pop':
                price = 20 * topper.quantity;
                nonGumpasteTotal += price;
                break;
            case 'icing_doodle':
                if (topper.description?.toLowerCase().includes('intricate') || topper.description?.toLowerCase().includes('complex')) {
                    price = cakeInfo.type === 'Bento' ? 50 : 100;
                    nonGumpasteTotal += price;
                }
                break;
            case 'icing_palette_knife':
                const isIntricateMain = topper.description?.toLowerCase().includes('intricate');
                if (topper.size === 'large' && isIntricateMain) {
                    const tierCount = extractTierCount(cakeInfo.type);
                    price = 100 * tierCount;
                } else {
                    price = 0; // All other cases are free
                }
                nonGumpasteTotal += price;
                break;
            case 'plastic_ball':
                if (topper.size === 'tiny') {
                    price = 0;
                } else {
                    const lowerDescPB = topper.description?.toLowerCase() || '';
                    if (lowerDescPB.includes('disco ball')) {
                        // Price disco balls at 50 pesos each
                        price = 50 * topper.quantity;
                    } else { // Regular plastic balls
                        // Price normal balls at 100 pesos per 3 pieces
                        price = Math.ceil(topper.quantity / 3) * 100;
                    }
                }
                nonGumpasteTotal += price;
                break;
            case 'toy':
                // High-Detail Toys pricing based on size
                if (topper.size === 'large') price = 200;
                else if (topper.size === 'medium') price = 150;
                else price = 100; // 'small' or 'partial'
                price *= topper.quantity;
                nonGumpasteTotal += price;
                break;
            case 'figurine':
                // Simpler Figurines pricing based on size
                if (topper.size === 'large') price = 90;
                else if (topper.size === 'medium') price = 70;
                else price = 50; // 'small' or 'partial'
                price *= topper.quantity;
                nonGumpasteTotal += price;
                break;
            case 'printout':
                price = 0;
                break;
            case 'edible_photo':
                price = 50; // Flat price for top edible photo
                nonGumpasteTotal += price;
                break;
            case 'cardstock':
                // Cardstock pricing based on size
                if (topper.size === 'large') price = 100;
                else if (topper.size === 'medium') price = 60;
                else price = 25; // 'small' or 'partial'
                price *= topper.quantity;
                nonGumpasteTotal += price;
                break;
            case 'candle':
                const digits = topper.description?.match(/\d/g) || [];
                const digitCount = Math.max(1, digits.length);
                price = digitCount * 25; // 25 per digit
                nonGumpasteTotal += price;
                break;
            default:
                price = 0;
        }
        
        itemPrices.set(topper.id, price);
        if (price > 0) {
            breakdown.push({ item: topper.description, price });
        }
    });

    // --- Process Support Elements ---
    supportElements.forEach(element => {
        if (!element.isEnabled) {
            itemPrices.set(element.id, 0);
            return;
        }
        
        let price = 0;
        switch (element.type) {
            case 'edible_3d_support':
                price = getSupportGumpastePrice(element.coverage);
                supportGumpasteRawTotal += price;
                break;
            case 'edible_2d_support':
                price = getEdible2DSupportPrice(element.coverage); // Use new function
                supportGumpasteRawTotal += price;
                break;
            
            // --- Legacy gumpaste types are removed, logic for other types remains ---
            
            case 'icing_doodle':
                if (element.description?.toLowerCase().includes('intricate') || element.description?.toLowerCase().includes('complex')) {
                    price = cakeInfo.type === 'Bento' ? 50 : 100;
                    // Note: As per old logic, this was not part of allowance. Keeping it that way unless specified.
                    // To make it eligible, change to: supportGumpasteRawTotal += price;
                    nonGumpasteTotal += price;
                }
                break;
            
            case 'icing_palette_knife':
                const isIntricateSupport = element.description?.toLowerCase().includes('intricate');
                if (element.coverage === 'large' && isIntricateSupport) { // Changed from 'heavy'
                    const tierCount = extractTierCount(cakeInfo.type);
                    price = 100 * tierCount;
                } else {
                    price = 0; // All other cases are free
                }
                nonGumpasteTotal += price;
                break;

            case 'chocolates':
                if (element.coverage === 'large') price = 200; // Changed from 'heavy'
                else if (element.coverage === 'medium') price = 100;
                else if (element.coverage === 'small') price = 50; // Changed from 'light'
                nonGumpasteTotal += price;
                break;
            
            case 'sprinkles':
            case 'dragees':
                if (element.coverage === 'large') price = 100; // Changed from 'heavy'
                supportGumpasteRawTotal += price; // MOVED TO ALLOWANCE BUCKET
                break;

            case 'isomalt':
                const isComplex = element.description?.toLowerCase().includes('complex') || element.description?.toLowerCase().includes('elaborate');
                price = isComplex ? 500 : 200;
                nonGumpasteTotal += price;
                break;
            
            case 'edible_photo_side':
                if (element.coverage === 'large') price = 300;
                else if (element.coverage === 'medium') price = 200;
                else if (element.coverage === 'small') price = 100;
                else if (element.coverage === 'tiny') price = 50;
                nonGumpasteTotal += price;
                break;

            case 'edible_flowers': // Kept for non-gumpaste flowers if any
                if (element.coverage === 'large') price = 300;
                else if (element.coverage === 'medium') price = 200;
                else if (element.coverage === 'small') price = 100;
                nonGumpasteTotal += price; // Assuming these might not be gumpaste, e.g., real flowers
                break;
            
            default:
                price = 0;
        }

        itemPrices.set(element.id, price);
        if (price > 0) {
            breakdown.push({ item: element.description, price });
        }
    });

    // --- Process Cake Messages and Icing ---
    cakeMessages.forEach(message => {
        let price = 0;
        if (message.isEnabled && message.type === 'cardstock') {
            price = 100;
            nonGumpasteTotal += price;
            breakdown.push({ item: `"${message.text}" (Cardstock)`, price });
        }
        itemPrices.set(message.id, price);
    });

    if (icingDesign.drip) {
        const tierCount = extractTierCount(cakeInfo.type);
        const dripPrice = 100 * tierCount;
        nonGumpasteTotal += dripPrice;
        breakdown.push({ item: `Drip Effect (${tierCount > 1 ? `${tierCount} tiers` : '1 tier'})`, price: dripPrice });
        itemPrices.set('icing_drip', dripPrice);
    } else {
        itemPrices.set('icing_drip', 0);
    }
    
    if (icingDesign.gumpasteBaseBoard) {
        const baseBoardPrice = 100;
        nonGumpasteTotal += baseBoardPrice; // No longer eligible for allowance
        breakdown.push({ item: "Gumpaste Covered Base Board", price: baseBoardPrice });
        itemPrices.set('icing_gumpasteBaseBoard', baseBoardPrice);
    } else {
        itemPrices.set('icing_gumpasteBaseBoard', 0);
    }

    // --- Final Calculation ---
    const allowanceApplied = Math.min(GUMPASTE_ALLOWANCE, supportGumpasteRawTotal);
    const supportGumpasteCharge = Math.max(0, supportGumpasteRawTotal - GUMPASTE_ALLOWANCE);

    if (allowanceApplied > 0) {
        breakdown.push({ item: "Gumpaste Allowance", price: -allowanceApplied });
    }
    
    const addOnPrice = heroGumpasteTotal + supportGumpasteCharge + nonGumpasteTotal;

    return {
        addOnPricing: {
            addOnPrice,
            breakdown,
        },
        itemPrices,
    };
};
```

## File: src/services/designService.ts

```ts
// services/designService.ts
import {
    editCakeImage
} from './geminiService.lazy';
import {
    DEFAULT_THICKNESS_MAP,
    COLORS
} from '../constants';
import type {
    HybridAnalysisResult,
    MainTopperUI,
    SupportElementUI,
    CakeMessageUI,
    IcingDesignUI,
    CakeInfoUI
} from '../types';

// --- NEW SPECIALIZED SYSTEM INSTRUCTIONS ---

const INPAINTING_STYLE_SYSTEM_INSTRUCTION = `You are an expert, non-destructive photo editor.

### **Core Editing Principles**
---
1.  **CRITICAL: TEXTURE-PRESERVING COLOR TINTING (Your ONLY Job)**
    *   When asked to change a color, you MUST perform a "hue-shift" or "color tinting" operation only."
    *   Analogy: You are applying a "Hue/Saturation" adjustment layer in Photoshop.
2.  **PRESERVE EVERYTHING ELSE:** Do NOT add, remove, or change the shape of any element. The final output image MUST have the exact same dimensions, aspect ratio, background, lighting, shadows, and all other unmentioned details as the original input image.
3.  **Remove watermarks and digitally overlayed logos (If there are any).**`;

const GENERATIVE_DESIGN_SYSTEM_INSTRUCTION = `You are a master digital cake artist performing photorealistic edits on a cake image. Your goal is to apply ONLY the specific changes listed in the prompt, while preserving the original image's style, lighting, and composition.

---
### **Core Editing Principles**
---
1.  **Master Prioritization:** If any rules conflict, preserving the original physical texture of unedited areas is the highest priority.
2.  **Technical Quality:** The final output MUST be a high-resolution, photorealistic image. Your task is technical cleanup: "Enhance" means you must upscale the final resolution and remove digital artifacts (like JPEG compression noise or pixelation). It does NOT mean artistically redrawing or repainting existing physical textures.
3.  **Realistic Interaction:** When adding a new element (like a drip or a base board), it must interact realistically with the scene. It should adopt the same lighting, cast subtle shadows, and flow around existing decorations, not erase them.
4.  **Preserve Unmentioned Details:** Any feature from the original image not mentioned in the list of changes MUST be preserved exactly as it is. This includes background, cake stand, and non-targeted decorations.
5.  **Clean Removals:** When asked to remove an element, you must cleanly erase it and realistically in-paint the background area to seamlessly match the surrounding texture and lighting.
6.  **Texture-Preserving Color Changes:** When asked to change an existing color, you MUST perform a "hue-shift" or "color tinting" operation. Preserve 100% of the original surface details and micro-textures (like icing strokes). The brightness and darkness (luminance) of every pixel should remain identical to the original; only the hue and saturation should change. Avoid flat, "plastic" looks.
7.  **Remove watermarks and digitally overlayed logos (If there are any).**`;

const THREE_TIER_RECONSTRUCTION_SYSTEM_INSTRUCTION = `You are a master digital cake artist tasked with reconstructing a cake design into a new 3-tier structure. You will be given an original cake image for its design language and a reference image for the 3-tier structure.

---
### **Core Reconstruction Principles (VERY IMPORTANT)**
---
1.  **High-Quality Output:** The final output MUST be a high-resolution, photorealistic image. Even if the original design source image is low-quality, the new 3-tier cake image you generate must be crisp, clear, and professional-grade.
2.  **Preserve Aspect Ratio:** The final output image MUST have the exact same dimensions and aspect ratio as the original input image. Do not change the image from portrait to landscape, square to rectangle, etc.
3.  **Reconstruct Proportionally:** Rebuild the cake with a 3-tier count, distributing height and width realistically. The final structure and proportions MUST strictly follow the provided plain white 3-tier reference image. Maintain the original cake’s visual proportions if possible (e.g., if it was tall and narrow, keep that ratio across the new tier structure).
4.  **Preserve Design Language, Not Layout:** Your primary task is to harvest the colors, textures, icing style, and decorative motifs from the original cake and apply them to the new 3-tier structure.
5.  **Redistribute Decorations Logically:**
    - Main toppers go on the top tier.
    - Side decorations (e.g., florals, lace) should appear on all tiers or follow a cascading pattern.
    - Cake messages should remain readable and be centered on an appropriate tier.
6.  **Maintain Theme & Style Consistency:** If the original had a drip effect, apply it to all tiers consistently. If it used gold leaf, fresh flowers, or geometric patterns, replicate that aesthetic across the new structure.
7.  **Do NOT Preserve Spatial Layout:** It is expected that elements will move to fit the new tier structure. The goal is stylistic continuity, not pixel-perfect replication of element positions.`;


const EDIT_CAKE_PROMPT_TEMPLATE = (
    originalAnalysis: HybridAnalysisResult | null,
    newCakeInfo: CakeInfoUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    additionalInstructions: string
): string => {
    if (!originalAnalysis) return ""; // Guard clause

    const isThreeTierReconstruction = newCakeInfo.type !== originalAnalysis.cakeType && newCakeInfo.type.includes('3 Tier');

    const colorName = (hex: string | undefined) => {
        if (!hex) return 'not specified';
        const foundColor = COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
        return foundColor ? `${foundColor.name} (${hex})` : hex;
    };

    let prompt: string;

    if (isThreeTierReconstruction) {
        prompt = `---
### **List of Changes to Apply to the New 3-Tier Structure**
---
`;
    } else {
        prompt = `---
### **List of Changes to Apply**
---
`;
    }

    const changes: string[] = [];

    // 1. Core Structure Changes
    if (newCakeInfo.type !== originalAnalysis.cakeType) {
        if (isThreeTierReconstruction) {
            changes.push(`- **Reconstruct the cake** from its original "${originalAnalysis.cakeType}" form into a new "${newCakeInfo.type}" structure based on the provided reference image.`);
        } else {
            let typeChangeInstruction = `- **Change the cake type** from "${originalAnalysis.cakeType}" to "${newCakeInfo.type}".`;
            if (newCakeInfo.type.includes('2 Tier')) {
                typeChangeInstruction += ' This means the cake must be rendered with two distinct levels (tiers) stacked vertically.';
            }
            changes.push(typeChangeInstruction);
        }
    }
    if (newCakeInfo.thickness !== originalAnalysis.cakeThickness) {
        changes.push(`- **Change the cake thickness** to "${newCakeInfo.thickness}".`);
    }

    // A more descriptive size instruction for multi-tier cakes.
    const tiers = newCakeInfo.size?.match(/\d+"/g); // e.g., ["6\"", "8\"", "10\""]
    if ((newCakeInfo.type.includes('2 Tier')) && tiers && tiers.length === 2) {
        changes.push(`- The final **cake size** represents a 2-tier structure: a ${tiers[0]} diameter top tier stacked on a ${tiers[1]} diameter bottom tier.`);
    } else if ((newCakeInfo.type.includes('3 Tier')) && tiers && tiers.length === 3) {
        changes.push(`- The final **cake size** represents a 3-tier structure: a ${tiers[0]} diameter top tier, an ${tiers[1]} diameter middle tier, and a ${tiers[2]} diameter bottom tier.`);
    } else {
        changes.push(`- The final **cake size** must be "${newCakeInfo.size}".`);
    }

    // 2. Topper Changes
    mainToppers.forEach(t => {
        if (!t.isEnabled) {
            changes.push(`- **Remove the main topper** described as: "${t.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (t.type !== t.original_type) {
                itemChanges.push(`change its material to **${t.type}**`);
            }
            if (t.replacementImage) {
                if (t.type === 'icing_doodle') {
                    itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **piped icing doodle style** as the original cake. Capture the likeness from the reference photo but render it as a simple, elegant line art portrait using piped icing.`);
                } else if (t.type === 'icing_palette_knife') {
                    const isFigure = t.description.toLowerCase().includes('person') || 
                                     t.description.toLowerCase().includes('character') || 
                                     t.description.toLowerCase().includes('human') ||
                                     t.description.toLowerCase().includes('figure');
                    if (isFigure) {
                        itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **painterly palette knife style** as the original cake. Capture the likeness from the reference photo but render it as a textured, abstract portrait using palette knife strokes.`);
                    } else {
                        // Default behavior if not a figure
                        itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                    }
                } else if (t.type === 'edible_3d_complex' || t.type === 'edible_3d_ordinary') {
                    itemChanges.push(`**re-sculpt this 3D gumpaste figure based on the new reference image provided**. The new figure must be in the same **3D gumpaste style** as the original cake. Capture the likeness, pose, and details from the reference photo but render it as a hand-sculpted, edible gumpaste figure.`);
                } else if (t.type === 'edible_photo') {
                    let instruction = `replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it. Crop it if necessary to fit the original edible photo's shape on the cake.`;
                    // Check if original description implies full coverage
                    if (t.description.toLowerCase().includes('full top') || t.description.toLowerCase().includes('entire top')) {
                        instruction += ` The new image MUST cover the **entire top surface of the cake**, just like the original one did. Ensure it is flat, perfectly aligned, and integrated seamlessly with the cake's top icing.`;
                    }
                    itemChanges.push(instruction);
                } else { // This applies to 'printout'
                    itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                }
            }
            
            const isPaletteKnife = t.type === 'icing_palette_knife';
            const hasSingleColorChanged = t.color && t.original_color && t.color !== t.original_color;
            const hasMultipleColorsChanged = t.colors && t.original_colors && JSON.stringify(t.colors) !== JSON.stringify(t.original_colors);

            if (isPaletteKnife && hasMultipleColorsChanged) {
                const originalColorNames = t.original_colors!.map(c => colorName(c || undefined)).join(', ');
                const newColorNames = t.colors!.map(c => colorName(c || undefined)).join(', ');
                itemChanges.push(`**remap its entire color palette**. The original color scheme was based on ${originalColorNames}. The new scheme MUST be based on **${newColorNames}**.`);
            } else if (hasSingleColorChanged) {
                const isTexturedIcing = ['icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread'].includes(t.type);
                if (isTexturedIcing) {
                    itemChanges.push(`**change the color texture** to color **${colorName(t.color)}**. Simply shift the hue of the existing texture to the new color.`);
                } else {
                    itemChanges.push(`recolor it to **${colorName(t.color)}**`);
                }
            }

            if (itemChanges.length > 0) {
                 changes.push(`- For the main topper "${t.description}": ${itemChanges.join(' and ')}.`);
            }
        }
    });

    // 3. Support Element Changes
    supportElements.forEach(s => {
        if (!s.isEnabled) {
            changes.push(`- **Remove the support element** described as: "${s.description}".`);
        } else {
            const itemChanges: string[] = [];
            if (s.type !== s.original_type) {
                itemChanges.push(`change its material to **${s.type}**`);
            }
            if (s.replacementImage) {
                if (s.type === 'icing_doodle') {
                    itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **piped icing doodle style** as the original cake. Capture the likeness from the reference photo but render it as a simple, elegant line art portrait using piped icing.`);
                } else if (s.type === 'icing_palette_knife') {
                    const isFigure = s.description.toLowerCase().includes('person') || 
                                     s.description.toLowerCase().includes('character') || 
                                     s.description.toLowerCase().includes('human') ||
                                     s.description.toLowerCase().includes('figure');
                    if (isFigure) {
                        itemChanges.push(`**redraw it based on the new reference image provided**. The new drawing must be in the same **painterly palette knife style** as the original cake. Capture the likeness from the reference photo but render it as a textured, abstract portrait using palette knife strokes.`);
                    } else {
                        // Default behavior for other palette knife changes (e.g. textures)
                        itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                    }
                } else if (s.type === 'edible_3d_support') {
                    const isFigure = s.description.toLowerCase().includes('person') || 
                                     s.description.toLowerCase().includes('character') || 
                                     s.description.toLowerCase().includes('human') || 
                                     s.description.toLowerCase().includes('figure') ||
                                     s.description.toLowerCase().includes('silhouette');
                    if (isFigure) {
                        itemChanges.push(`**re-sculpt this small 3D gumpaste item based on the new reference image provided**. The new item must be in the same **3D gumpaste style** as the original cake. Capture the likeness, pose, and details from the reference photo but render it as a small, hand-sculpted, edible gumpaste figure.`);
                    } else {
                        // This else block handles non-figure gumpaste support elements with replacement images, which is an unlikely scenario. But to be safe:
                        itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                    }
                } else { // Default for support_printout, edible_photo_side, etc.
                    itemChanges.push(`replace its image with the new one provided. **CRITICAL: You MUST preserve the original aspect ratio of this new image.** Do not stretch or squash it.`);
                }
            }
            
            const isPaletteKnife = s.type === 'icing_palette_knife';
            const hasSingleColorChanged = s.color && s.original_color && s.color !== s.original_color;
            const hasMultipleColorsChanged = s.colors && s.original_colors && JSON.stringify(s.colors) !== JSON.stringify(s.original_colors);

            if (isPaletteKnife && hasMultipleColorsChanged) {
                const originalColorNames = s.original_colors!.map(c => colorName(c || undefined)).join(', ');
                const newColorNames = s.colors!.map(c => colorName(c || undefined)).join(', ');
                itemChanges.push(`**remap its entire color palette**. The original color scheme was based on ${originalColorNames}. The new scheme MUST be based on **${newColorNames}**. It is critical that you preserve the original's textured strokes and relative light/dark variations, but translate them to the new color family.`);
            } else if (hasSingleColorChanged) {
                const isTexturedIcing = ['icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread'].includes(s.type);
                if (isTexturedIcing) {
                    itemChanges.push(`**rehue the texture** to a monochromatic palette based on the new color **${colorName(s.color)}**. It is critical that you **PRESERVE THE ORIGINAL STROKES, TEXTURE, AND LIGHTING (shadows/highlights)**. Simply shift the hue of the existing texture to the new color, maintaining all its original detail and form.`);
                } else {
                    itemChanges.push(`recolor it to **${colorName(s.color)}**`);
                }
            }
            
            if (itemChanges.length > 0) {
                 changes.push(`- For the support element "${s.description}": ${itemChanges.join(' and ')}.`);
            }
        }
    });


    // 4. Icing Design Changes
    const icingChanges: string[] = [];
    const originalIcing = originalAnalysis.icing_design;
    const newIcing = icingDesign;

    if (newIcing.base !== originalIcing.base) {
        icingChanges.push(`- **Change the base icing** to be **${newIcing.base}**.`);
    }

    // Handle Drip
    if (newIcing.drip && !originalIcing.drip) {
        let instruction = `- **Add a drip effect**. The drip should flow naturally from the top edge and interact realistically with any existing side decorations, flowing around them, not erasing them.`;
        if (newIcing.colors.drip) {
            instruction += ` The DRIP color should be **${colorName(newIcing.colors.drip)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.drip && originalIcing.drip) {
        icingChanges.push(`- **Remove the drip effect**.`);
    } else if (newIcing.drip && originalIcing.drip && newIcing.colors.drip !== originalIcing.colors.drip) {
        icingChanges.push(`- **Recolor the drip**. The new DRIP color should be **${colorName(newIcing.colors.drip!)}**. Preserve all other details.`);
    }

    // Handle Top Border
    if (newIcing.border_top && !originalIcing.border_top) {
        let instruction = `- **Add a decorative top border**.`;
        if (newIcing.colors.borderTop) {
            instruction += ` The TOP border color shade should be **${colorName(newIcing.colors.borderTop)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.border_top && originalIcing.border_top) {
        icingChanges.push(`- **Remove the top border**.`);
    } else if (newIcing.border_top && originalIcing.border_top && newIcing.colors.borderTop !== originalIcing.colors.borderTop) {
        icingChanges.push(`- **Re-hue the shade of the top icing border** to **${colorName(newIcing.colors.borderTop!)}**.`);
    }
    
    // Handle Base Border
    if (newIcing.border_base && !originalIcing.border_base) {
        let instruction = `- **Add a decorative base border**.`;
        if (newIcing.colors.borderBase) {
            instruction += ` The BASE border color shade should be **${colorName(newIcing.colors.borderBase)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.border_base && originalIcing.border_base) {
        icingChanges.push(`- **Remove the base border**.`);
    } else if (newIcing.border_base && originalIcing.border_base && newIcing.colors.borderBase !== originalIcing.colors.borderBase) {
        icingChanges.push(`- **Re-hue the shade of the base icing border** to **${colorName(newIcing.colors.borderBase!)}**.`);
    }

    // Handle Gumpaste Base Board
    if (newIcing.gumpasteBaseBoard && !originalIcing.gumpasteBaseBoard) {
        let instruction = `- Preserve any existing decorations on the base area.`;
        if (newIcing.colors.gumpasteBaseBoardColor) {
            instruction += ` Make the color of the round gumpaste-covered BASE BOARD to be **${colorName(newIcing.colors.gumpasteBaseBoardColor)}**.`;
        }
        icingChanges.push(instruction);
    } else if (!newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard) {
        icingChanges.push(`- **Remove the gumpaste-covered base board**.`);
    } else if (newIcing.gumpasteBaseBoard && originalIcing.gumpasteBaseBoard && newIcing.colors.gumpasteBaseBoardColor !== originalIcing.colors.gumpasteBaseBoardColor) {
        icingChanges.push(`- **Recolor the gumpaste base board shade**. to **${colorName(newIcing.colors.gumpasteBaseBoardColor!)}**. Preserve all other details.`);
    }

    // Handle core icing colors with explicit preservation
    const originalIcingColors = originalIcing.colors;
    const sideColorChanged = newIcing.colors.side !== undefined && newIcing.colors.side !== originalIcingColors.side;
    const topColorChanged = newIcing.colors.top !== undefined && newIcing.colors.top !== originalIcingColors.top;

    if (sideColorChanged && !topColorChanged) {
        const instruction = `- **Re-hue the side icing shade ONLY** to shades of**${colorName(newIcing.colors.side)}**.`;
        icingChanges.push(instruction);
    } else if (topColorChanged && !sideColorChanged) {
        const instruction = `- **Re-hue the top icing shade ONLY** to shades of**${colorName(newIcing.colors.top)}**.`;
        icingChanges.push(instruction);
    } else if (sideColorChanged && topColorChanged) {
        // Both colors changed, so no preservation needed, but remove "ONLY"
        icingChanges.push(`- **Re-hue the side icing shade** to shades of **${colorName(newIcing.colors.side)}**.`);
        icingChanges.push(`- **Re-hue the top icing shade** to shades of**${colorName(newIcing.colors.top)}**.`);
    }

    changes.push(...icingChanges);

    // 5. Cake Message Changes
    const messageChanges: string[] = [];
    const originalMessages = originalAnalysis.cake_messages || [];
    const currentUIMessages = cakeMessages;

    const availableUIMessages = [...currentUIMessages];

    originalMessages.forEach((originalMsg) => {
        // MATCHING
        const uiMsgIndex = availableUIMessages.findIndex(uiMsg => {
            if (!uiMsg.originalMessage) {
                return false;
            }
            const o = uiMsg.originalMessage;
            const matches = {
                text: o.text === originalMsg.text,
                pos: o.position === originalMsg.position,
                type: o.type === originalMsg.type,
                color: o.color.toLowerCase() === originalMsg.color.toLowerCase()
            };
            return matches.text && matches.pos && matches.type && matches.color;
        });

        let correspondingUIMsg: CakeMessageUI | undefined;
        if (uiMsgIndex > -1) {
            correspondingUIMsg = availableUIMessages.splice(uiMsgIndex, 1)[0];
        }

        if (!correspondingUIMsg || !correspondingUIMsg.isEnabled) {
            messageChanges.push(`- **Erase the text** that says "${originalMsg.text}" from the cake's **${originalMsg.position}**. The area should be clean as if the text was never there.`);
        } else {
            const uiMsg = correspondingUIMsg;
            const changesInMessage = [];

            const textChanged = uiMsg.text !== uiMsg.originalMessage.text;
            const colorChanged = uiMsg.color.toLowerCase() !== uiMsg.originalMessage.color.toLowerCase();

            if (textChanged) {
                changesInMessage.push(`change the text from "${uiMsg.originalMessage.text}" to "${uiMsg.text}"`);
            }
            if (colorChanged) {
                changesInMessage.push(`change the color to ${colorName(uiMsg.color)}`);
            }
            if (uiMsg.position !== uiMsg.originalMessage.position) {
                changesInMessage.push(`move it from the ${uiMsg.originalMessage.position} to the ${uiMsg.position}`);
            }
            if (uiMsg.type !== uiMsg.originalMessage.type) {
                changesInMessage.push(`change the style to ${uiMsg.type}`);
            }

            if (changesInMessage.length > 0) {
                messageChanges.push(`- Regarding the message on the **${uiMsg.originalMessage.position}** that originally said "${uiMsg.originalMessage.text}", please ${changesInMessage.join(' and ')}.`);
            }
        }
    });

    // Any remaining items in `availableUIMessages` must be new messages added by the user.
    availableUIMessages.forEach(uiMsg => {
        if (uiMsg.isEnabled && !uiMsg.originalMessage) {
            messageChanges.push(`- **Add new text**: Write "${uiMsg.text}" on the **${uiMsg.position}** using small ${uiMsg.type} style in the color ${colorName(uiMsg.color)}.`);
        }
    });

    if (messageChanges.length > 0) {
        changes.push(...[...new Set(messageChanges)]);
    }


    // 6. Bento-specific instruction
    if (newCakeInfo.type === 'Bento') {
        changes.push(`- **Bento Box Presentation:** The final image MUST show the cake placed inside a classic, open, light brown clamshell bento box. The box should be visible around the base of the cake, framing it.`);
    }

    // 7. Additional Instructions
    if (additionalInstructions.trim()) {
        changes.push(`- **Special Instructions:** ${additionalInstructions.trim()}`);
    }

    // Assemble the final prompt
    if (changes.length > 0) {
        prompt += changes.join('\n');
    } else {
        prompt += "- No changes were requested. The image should remain exactly the same.";
    }
    
    return prompt;
};

/**
 * Generates a new cake design by calling the Gemini API.
 * This function encapsulates all business logic for updating a design.
 * @returns A promise that resolves to an object containing the new image data URI and the prompt used.
 */
export async function updateDesign({
    originalImageData,
    analysisResult,
    cakeInfo,
    mainToppers,
    supportElements,
    cakeMessages,
    icingDesign,
    additionalInstructions,
    threeTierReferenceImage,
    promptGenerator, // ADDED
}: {
    originalImageData: { data: string; mimeType: string } | null;
    analysisResult: HybridAnalysisResult | null;
    cakeInfo: CakeInfoUI;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    cakeMessages: CakeMessageUI[];
    icingDesign: IcingDesignUI;
    additionalInstructions: string;
    threeTierReferenceImage: { data: string; mimeType: string } | null;
    // ADDED: Optional prompt generator function
    promptGenerator?: (
        originalAnalysis: HybridAnalysisResult | null,
        newCakeInfo: CakeInfoUI,
        mainToppers: MainTopperUI[],
        supportElements: SupportElementUI[],
        cakeMessages: CakeMessageUI[],
        icingDesign: IcingDesignUI,
        additionalInstructions: string
    ) => string;
}): Promise<{ image: string, prompt: string, systemInstruction: string }> {

    // 1. Validate inputs
    if (!originalImageData || !icingDesign || !cakeInfo) {
        throw new Error("Missing required data to update design.");
    }

    // 2. Check for forbidden keywords
    const forbiddenKeywords = ['add', 'extra', 'another', 'include', 'new topper', 'new figure', 'create', 'put a new'];
    if (forbiddenKeywords.some(keyword => additionalInstructions.toLowerCase().includes(keyword))) {
        throw new Error("Instructions cannot add new items. Please use it only to clarify changes like color or position.");
    }

    // 3. Build the prompt
    const analysisForPrompt = analysisResult || {
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
        icing_design: {
            base: 'soft_icing',
            color_type: 'single',
            colors: {
                side: '#FFFFFF'
            },
            border_top: false,
            border_base: false,
            drip: false,
            gumpasteBaseBoard: false
        },
        cakeType: '1 Tier',
        cakeThickness: DEFAULT_THICKNESS_MAP['1 Tier']
    };
    
    // Use the provided prompt generator, or fall back to the default one
    let prompt = promptGenerator
        ? promptGenerator(
            analysisForPrompt, cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions
          )
        : EDIT_CAKE_PROMPT_TEMPLATE(
            analysisForPrompt, cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions
          );

    // 4. Determine change type and select system instruction
    const changesList = prompt.split('### **List of Changes to Apply**')[1]?.trim().split('\n').filter(line => line.startsWith('- ')) || [];
    
    const isColorOnlyChange = (changes: string[]): boolean => {
        if (changes.length === 0) return true;
        const designChangeKeywords = [
            'remove', 'add', 'change the cake type', 'change the cake thickness', 
            'reconstruct', 'erase', 'move', 'change the style', 'redraw', 
            're-sculpt', 'replace its image', 'bento box presentation',
            'change the text', 'erase the text', 'add new text', 'regarding the message'
        ];
        return !changes.some(change => 
            designChangeKeywords.some(keyword => change.toLowerCase().includes(keyword))
        );
    };

    const isThreeTierReconstruction = cakeInfo.type !== (analysisResult?.cakeType || cakeInfo.type) && cakeInfo.type.includes('3 Tier');
    const useInpaintingStyle = isColorOnlyChange(changesList);
    
    let systemInstruction = 
        isThreeTierReconstruction ? THREE_TIER_RECONSTRUCTION_SYSTEM_INSTRUCTION :
        useInpaintingStyle ? INPAINTING_STYLE_SYSTEM_INSTRUCTION :
        GENERATIVE_DESIGN_SYSTEM_INSTRUCTION;

    // 5. Smart Prompt Filtering for Inpainting
    if (useInpaintingStyle && !isThreeTierReconstruction) {
        const colorKeywords = ['re-hue', 'recolor', 'color shade', 'color to'];
        const colorChanges = changesList.filter(change =>
            colorKeywords.some(keyword => change.toLowerCase().includes(keyword))
        );

        if (colorChanges.length > 0) {
            prompt = `---
### **List of Changes to Apply**
---
${colorChanges.join('\n')}`;
        } else {
             prompt = `---
### **List of Changes to Apply**
---
- No changes were requested. The image should remain exactly the same.`;
        }
    }


    // 6. Handle timeout
    const timeoutPromise = new Promise < never > ((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out after 60 seconds.")), 60000)
    );

    try {
        // 7. Call editCakeImage
        const editedImageResult: string | unknown = await Promise.race([
            editCakeImage(
                prompt,
                originalImageData,
                mainToppers,
                supportElements,
                isThreeTierReconstruction ? threeTierReferenceImage : null,
                systemInstruction
            ),
            timeoutPromise
        ]);
        
        // 8. Return the edited image or throw an error
        if (typeof editedImageResult !== 'string') {
            throw new Error("Image generation did not return a valid string response.");
        }
        
        return { image: editedImageResult, prompt, systemInstruction };

    } catch (err) {
        // Re-throw the caught error to be handled by the component
        throw err;
    }
}
```

## File: src/services/paymentVerificationService.ts

```ts
// services/paymentVerificationService.ts
import { getSupabaseClient } from '../lib/supabase/client';

const supabase = getSupabaseClient();

export interface PaymentVerificationResult {
  success: boolean;
  status: 'paid' | 'pending' | 'expired' | 'failed';
  message?: string;
  error?: string;
}

/**
 * Manually verify a contribution payment with Xendit
 * This is a backup when webhooks fail
 */
export async function verifyContributionPayment(
  contributionId: string
): Promise<PaymentVerificationResult> {
  try {


    const { data, error } = await supabase.functions.invoke('verify-contribution-payment', {
      body: { contributionId }
    });

    if (error) {
      console.error('❌ Verification error:', error);
      return {
        success: false,
        status: 'pending',
        error: 'Failed to verify payment'
      };
    }


    return data;
  } catch (error) {
    console.error('❌ Exception during verification:', error);
    return {
      success: false,
      status: 'pending',
      error: 'An error occurred during verification'
    };
  }
}

/**
 * Poll for payment status after redirect from Xendit
 */
export async function pollPaymentStatus(
  contributionId: string,
  maxAttempts: number = 10,
  intervalMs: number = 3000
): Promise<PaymentVerificationResult> {


  for (let attempt = 1; attempt <= maxAttempts; attempt++) {


    // First check database
    const { data: contribution, error } = await supabase
      .from('bill_contributions')
      .select('status')
      .eq('contribution_id', contributionId)
      .single();

    if (!error && contribution?.status === 'paid') {

      return {
        success: true,
        status: 'paid',
        message: 'Payment confirmed'
      };
    }

    // If still pending after 3 attempts, trigger manual verification
    if (attempt >= 3) {

      const verificationResult = await verifyContributionPayment(contributionId);

      if (verificationResult.status === 'paid') {
        return verificationResult;
      }
    }

    // Wait before next attempt (unless it's the last one)
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }


  return {
    success: false,
    status: 'pending',
    message: 'Payment verification timed out. Please refresh the page.'
  };
}

```

## File: src/services/buxService.ts

```ts

```

## File: src/services/shareService.ts

```ts
import { getSupabaseClient } from '../lib/supabase/client';
import { showSuccess, showError } from '../lib/utils/toast';
import { v4 as uuidv4 } from 'uuid';
import { generateUrlSlug } from '../lib/utils/urlHelpers';
import { generateContributorDiscountCode } from './incentiveService';
import { CartItemDetails } from '../types';

const supabase = getSupabaseClient();

/**
 * Convert data URI to Blob
 */
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * Upload image to Supabase Storage and return public URL
 */
async function uploadImageToStorage(imageDataUri: string, designId: string): Promise<string> {
  try {
    // Convert data URI to blob
    const blob = dataURItoBlob(imageDataUri);

    // Generate filename with design ID
    const fileName = `${designId}.jpg`;
    const filePath = `shared-cake-images/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('shared-cake-images')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true, // Allow overwriting if exists
      });

    if (error) {
      console.error('Error uploading image to storage:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('shared-cake-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw error;
  }
}

export interface ShareDesignData {
  customizedImageUrl: string;
  originalImageUrl?: string;
  cakeType: string;
  cakeSize: string;
  cakeFlavor: string;
  cakeThickness?: string;
  icingColors?: Array<{ name: string, hex: string }>;
  accessories?: string[];
  basePrice: number;
  finalPrice: number;
  creatorName?: string;
  title: string;
  description: string;
  altText: string;
  availabilityType: 'rush' | 'same-day' | 'normal';
  billSharingEnabled?: boolean;
  billSharingMessage?: string;
  suggestedSplitCount?: number;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPhone?: string;
  eventDate?: string;
  eventTime?: string;
  recipientName?: string;
  customization_details: CartItemDetails;
}

export interface BillContribution {
  contribution_id: string;
  design_id: string;
  contributor_name: string;
  contributor_email: string | null;
  contributor_phone: string | null;
  amount: number;
  xendit_invoice_id: string | null;
  payment_url: string | null;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paid_at: string | null;
  created_at: string;
}

export interface ShareResult {
  designId: string;
  shareUrl: string;
  botShareUrl: string;
  urlSlug: string;
}

/**
 * Save a cake design for sharing
 */
export async function saveDesignToShare(data: ShareDesignData): Promise<ShareResult | null> {
  try {
    // Get current user (can be anonymous)
    const { data: { user } } = await supabase.auth.getUser();

    // Require authenticated user for bill sharing
    if (data.billSharingEnabled) {
      if (!user || user.is_anonymous) {
        showError('You must be signed in to enable bill sharing');
        return null;
      }
    }

    const designId = uuidv4();
    const urlSlug = generateUrlSlug(data.title, designId);

    // Upload image to storage if it's a data URI
    let imageUrl = data.customizedImageUrl;
    if (data.customizedImageUrl.startsWith('data:')) {

      imageUrl = await uploadImageToStorage(data.customizedImageUrl, designId);

    }

    // Upload original image if it's a data URI
    let originalImageUrl = data.originalImageUrl;
    if (originalImageUrl && originalImageUrl.startsWith('data:')) {

      originalImageUrl = await uploadImageToStorage(originalImageUrl, `${designId}-original`);

    }

    const { error } = await supabase
      .from('cakegenie_shared_designs')
      .insert({
        design_id: designId,
        url_slug: urlSlug,
        customized_image_url: imageUrl,
        original_image_url: originalImageUrl,
        cake_type: data.cakeType,
        cake_size: data.cakeSize,
        cake_flavor: data.cakeFlavor,
        cake_thickness: data.cakeThickness,
        icing_colors: data.icingColors || [],
        accessories: data.accessories || [],
        base_price: data.basePrice,
        final_price: data.finalPrice,
        created_by_user_id: data.billSharingEnabled ? user!.id : (user && !user.is_anonymous ? user.id : null),
        creator_name: data.creatorName,
        title: data.title,
        description: data.description,
        alt_text: data.altText,
        availability_type: data.availabilityType,
        bill_sharing_enabled: data.billSharingEnabled || false,
        bill_sharing_message: data.billSharingMessage || null,
        suggested_split_count: data.suggestedSplitCount || null,
        delivery_address: data.deliveryAddress || null,
        delivery_city: data.deliveryCity || null,
        delivery_phone: data.deliveryPhone || null,
        event_date: data.eventDate || null,
        event_time: data.eventTime || null,
        recipient_name: data.recipientName || null,
        auto_order_enabled: data.billSharingEnabled || false, // Enable auto-order when bill sharing is enabled
        customization_details: data.customization_details,
      });

    if (error) {
      console.error('Supabase error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw error;
    }

    const clientDomain = window.location.origin;
    const shareUrl = `${clientDomain}/#/designs/${urlSlug}`;
    const botShareUrl = `https://genie.ph/designs/${urlSlug}`;

    showSuccess('Share link created!');

    return {
      designId: designId,
      shareUrl,
      botShareUrl,
      urlSlug
    };
  } catch (error) {
    console.error('Error saving design:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    showError('Failed to create shareable link');
    return null;
  }
}

/**
 * Updates an existing shared design with AI-generated text.
 * This function now throws on failure.
 */
export async function updateSharedDesignTexts(
  designId: string,
  title: string,
  description: string,
  altText: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('cakegenie_shared_designs')
      .update({
        title,
        description,
        alt_text: altText,
      })
      .eq('design_id', designId);

    if (error) {
      console.error('❌ Supabase RLS error updating shared design texts:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      // CRITICAL: Throw the error so the caller knows it failed
      throw new Error(`Failed to update shared design: ${error.message}`);
    }


  } catch (error) {
    console.error('❌ Exception updating shared design texts:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    // Re-throw so the background task knows it failed
    throw error;
  }
}

/**
 * Retry enrichment with exponential backoff
 */
export async function updateSharedDesignTextsWithRetry(
  designId: string,
  title: string,
  description: string,
  altText: string,
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await updateSharedDesignTexts(designId, title, description, altText);

      return; // Success!
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Enrichment attempt ${attempt}/${maxRetries} failed:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  throw new Error(`Failed to enrich design after ${maxRetries} attempts: ${lastError?.message}`);
}


/**
 * Get a shared design by ID or slug - WITH DETAILED LOGGING
 */
export async function getSharedDesign(identifier: string) {



  try {


    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const query = supabase
      .from('cakegenie_shared_designs')
      .select('*');

    if (isUuid) {
      query.eq('design_id', identifier);
    } else {
      query.eq('url_slug', identifier);
    }

    const { data, error } = await query.single();




    if (error) {
      console.error('❌ [getSharedDesign] Supabase error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw error;
    }

    if (!data) {
      console.warn('⚠️ [getSharedDesign] No data returned for identifier:', identifier);
      return null;
    }



    // Increment view count but don't wait for it to finish (fire-and-forget).
    // This prevents the main data fetch from hanging if the RPC call is slow or fails.
    if (data) {
      // FIX: Converted to an async IIFE to use try/catch for error handling,
      // as the Supabase query builder is a 'thenable' but may not have a .catch method.
      (async () => {
        try {
          const { error: rpcError } = await supabase.rpc('increment_design_view', { p_design_id: data.design_id });
          if (rpcError) {
            console.warn('Failed to increment view count:', rpcError);
          }
        } catch (err) {
          console.warn('Exception during fire-and-forget view count increment:', err);
        }
      })();
    }

    return data;
  } catch (error) {
    console.error('❌ [getSharedDesign] Exception caught:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return null;
  }
}


/**
 * Increment share count when user shares. This is a non-blocking call.
 */
export function incrementShareCount(designId: string) {
  // FIX: Converted to an async IIFE to use try/catch for error handling,
  // as the Supabase query builder is a 'thenable' but may not have a .catch method.
  (async () => {
    try {
      const { error } = await supabase.rpc('increment_design_share', { p_design_id: designId });
      if (error) {
        console.warn('Error incrementing share count:', error);
      }
    } catch (err) {
      console.warn('Exception during fire-and-forget share count increment:', err);
    }
  })();
}

/**
 * Generate social media share URLs
 */
export function generateSocialShareUrl(
  platform: 'facebook' | 'messenger' | 'twitter',
  shareUrl: string,
  text?: string
): string {
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(text || '');

  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

    case 'messenger':
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        return `fb-messenger://share/?link=${encodedUrl}`;
      }
      // The 'dialog/send' endpoint is deprecated but can work with a valid app_id.
      // We use a generic Facebook app_id here to make it more reliable on desktop.
      const facebookAppId = '966242223397117'; // A common public app_id for sharing
      return `https://www.facebook.com/dialog/send?app_id=${facebookAppId}&link=${encodedUrl}&redirect_uri=${encodedUrl}`;

    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;

    default:
      return shareUrl;
  }
}

/**
 * Get all contributions for a design
 */
export async function getDesignContributions(designId: string): Promise<BillContribution[]> {
  try {
    const { data, error } = await supabase
      .from('bill_contributions')
      .select('*')
      .eq('design_id', designId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contributions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching contributions:', error);
    return [];
  }
}

/**
 * Create a contribution and Xendit payment
 */
export async function createContribution(
  designId: string,
  contributorName: string,
  contributorEmail: string,
  amount: number,
  userId: string
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  try {
    // 1. Get design details
    const design = await getSharedDesign(designId);
    if (!design) {
      return { success: false, error: 'Design not found' };
    }

    if (!design.bill_sharing_enabled) {
      return { success: false, error: 'Bill sharing is not enabled for this design' };
    }




    // 2. Check remaining amount
    const remaining = design.final_price - (design.amount_collected || 0);
    if (amount > remaining) {
      return { success: false, error: `Amount exceeds remaining ₱${remaining.toFixed(2)}` };
    }

    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    // 3. Create contribution record
    const { data: contribution, error: insertError } = await supabase
      .from('bill_contributions')
      .insert({
        design_id: designId,
        contributor_name: contributorName,
        contributor_email: contributorEmail,
        amount: amount,
        status: 'pending',
        user_id: userId
      })
      .select()
      .single();

    if (insertError || !contribution) {
      console.error('Error creating contribution:', insertError);
      return { success: false, error: 'Failed to create contribution record' };
    }

    // Track referral if this is a new user being referred
    if (userId && design.created_by_user_id && userId !== design.created_by_user_id) {
      await trackReferral(userId, design.created_by_user_id, design.design_id, contribution.contribution_id);
    }

    // Generate discount code for contributor
    const discountCode = await generateContributorDiscountCode(userId, amount);

    // 4. Create Xendit invoice using existing Edge Function
    const domain = window.location.origin;
    const successUrl = `${domain}/#/designs/${design.url_slug || design.design_id}?contribution=success&contribution_id=${contribution.contribution_id}&amount=${amount}&code=${discountCode || 'FRIEND100'}`;
    const failureUrl = `${domain}/#/designs/${design.url_slug || design.design_id}?contribution=failed`;

    const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
      'create-xendit-payment',
      {
        body: {
          orderId: contribution.contribution_id, // Use contribution_id as external_id
          amount: amount,
          customerEmail: contributorEmail,
          customerName: contributorName,
          items: [{
            name: `Contribution for: ${design.title || 'Custom Cake'}`,
            quantity: 1,
            price: amount
          }],
          success_redirect_url: successUrl,
          failure_redirect_url: failureUrl,
          isContribution: true // Flag to identify this as a contribution
        }
      }
    );




    if (paymentError || !paymentData.success) {
      console.error('Error creating Xendit payment:', paymentError);
      // Clean up contribution record
      await supabase.from('bill_contributions').delete().eq('contribution_id', contribution.contribution_id);
      return { success: false, error: 'Failed to create payment link' };
    }

    // 5. Update contribution with Xendit details
    await supabase
      .from('bill_contributions')
      .update({
        xendit_invoice_id: paymentData.invoiceId,
        xendit_external_id: contribution.contribution_id,
        payment_url: paymentData.paymentUrl
      })
      .eq('contribution_id', contribution.contribution_id);

    return {
      success: true,
      paymentUrl: paymentData.paymentUrl
    };
  } catch (error) {
    console.error('Exception in createContribution:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Track that a user was referred through a bill share
 */
export async function trackReferral(
  referredUserId: string,
  referringUserId: string,
  designId: string,
  contributionId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_referrals')
      .insert({
        referring_user_id: referringUserId,
        referred_user_id: referredUserId,
        referral_source: 'bill_sharing',
        design_id: designId,
        contribution_id: contributionId
      });

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error('Error tracking referral:', error);
    }
  } catch (error) {
    console.error('Exception tracking referral:', error);
  }
}

/**
 * Pre-written social media messages
 */
export const SOCIAL_MESSAGES = {
  facebook: "🎂 Check out this AMAZING custom cake I just designed!\nWhat do you think? Should I order it? 😍\n\nDesign yours at CakeGenie!",

  messenger: "Hey! 👋 What do you think of this cake design I made?\nBe honest! 😅🎂",

  twitter: "Just designed the perfect cake using AI! 🎂✨\nCheck it out 👇\n\n#CakeDesign #CustomCake #CakeGenie",

  instagram: "🎂 Designed my dream cake using AI!\nWhat do you think? 😍\n\n🔗 Link in bio to see the full design!\nTag someone who needs to see this! 👇\n\n#CakeGenie #CustomCake #DreamCake #BirthdayCake"
};
```

## File: src/services/incentiveService.ts

```ts
import { getSupabaseClient } from '../lib/supabase/client';

const supabase = getSupabaseClient();

/**
 * Generate a discount code for a contributor
 */
export async function generateContributorDiscountCode(
  userId: string,
  contributionAmount: number
): Promise<string | null> {
  try {
    // Generate code: FRIEND{last 4 of user id}
    const code = `FRIEND${userId.slice(-4).toUpperCase()}`;
    
    const { error } = await supabase
      .from('discount_codes')
      .insert({
        user_id: userId,
        code: code,
        discount_amount: 100, // ₱100 off
        reason: 'contributed',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });
    
    if (error) {
      // If the code already exists (e.g., user contributed before), it's not a critical failure.
      // We can just return the predictable code.
      if (error.code === '23505') { // unique_violation
        console.log(`Discount code ${code} already exists for user ${userId}. Reusing it.`);
        return code;
      }
      console.error('Error creating discount code:', error);
      return null;
    }
    
    return code;
  } catch (error) {
    console.error('Exception creating discount code:', error);
    return null;
  }
}

```

## File: src/services/geminiService.ts

```ts
// services/geminiService.ts

import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, IcingColorDetails, CakeInfoUI, CakeType, CakeThickness, IcingDesign, MainTopperType, CakeMessage, SupportElementType } from '../types';
import { CAKE_TYPES, CAKE_THICKNESSES, COLORS } from "../constants";
import { getSupabaseClient } from '../lib/supabase/client';

let ai: InstanceType<typeof GoogleGenAI> | null = null;

function getAI() {
    if (!ai) {
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new Error("VITE_GEMINI_API_KEY environment variable not set");
        }
        ai = new GoogleGenAI({ apiKey: geminiApiKey });
    }
    return ai;
}

const supabase = getSupabaseClient();

// Cache the prompt for 10 minutes
let promptCache: {
  prompt: string;
  timestamp: number;
} | null = null;

const PROMPT_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Cache for dynamic enums
let typeEnumsCache: {
  mainTopperTypes: string[];
  supportElementTypes: string[];
  timestamp: number;
} | null = null;
const ENUM_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function getActivePrompt(): Promise<string> {
  const now = Date.now();
  
  // Return cached if still valid
  if (promptCache && (now - promptCache.timestamp < PROMPT_CACHE_DURATION)) {
    return promptCache.prompt;
  }
  
  // Fetch from database
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_text')
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (error || !data) {
    console.warn('Failed to fetch prompt from database, using fallback');
    // Keep your current hardcoded prompt as fallback
    return FALLBACK_PROMPT;
  }
  
  // Update cache
  promptCache = {
    prompt: data.prompt_text,
    timestamp: now
  };
  
  return data.prompt_text;
}

async function getDynamicTypeEnums(): Promise<{ mainTopperTypes: string[], supportElementTypes: string[] }> {
    const now = Date.now();
  
    // Check cache first
    if (typeEnumsCache && (now - typeEnumsCache.timestamp < ENUM_CACHE_DURATION)) {
        return { 
            mainTopperTypes: typeEnumsCache.mainTopperTypes, 
            supportElementTypes: typeEnumsCache.supportElementTypes 
        };
    }
  
    // Fetch from Supabase pricing_rules table
    const { data, error } = await supabase
        .from('pricing_rules')
        .select('item_type, category')
        .eq('is_active', true)
        .not('item_type', 'is', null);
  
    // Define a hardcoded fallback for safety
    const fallbackEnums = {
        mainTopperTypes: ['edible_3d_complex', 'edible_3d_ordinary', 'printout', 'toy', 'figurine', 'cardstock', 'edible_photo', 'candle', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread', 'meringue_pop', 'plastic_ball'],
        supportElementTypes: ['edible_3d_support', 'edible_2d_support', 'chocolates', 'sprinkles', 'support_printout', 'isomalt', 'dragees', 'edible_flowers', 'edible_photo_side', 'icing_doodle', 'icing_palette_knife', 'icing_brush_stroke', 'icing_splatter', 'icing_minimalist_spread']
    };

    if (error || !data) {
        console.warn('Failed to fetch dynamic enums from pricing_rules, using hardcoded fallback enums.');
        return fallbackEnums;
    }

    const mainTopperTypes = new Set<string>();
    const supportElementTypes = new Set<string>();

    // Separate the types based on their category
    data.forEach(rule => {
        if (rule.item_type) {
            if (rule.category === 'main_topper') {
                mainTopperTypes.add(rule.item_type);
            } else if (rule.category === 'support_element') {
                supportElementTypes.add(rule.item_type);
            }
        }
    });
    
    const result = {
        mainTopperTypes: Array.from(mainTopperTypes),
        supportElementTypes: Array.from(supportElementTypes),
    };
    
    // If the fetched lists are empty for some reason, use the fallback
    if (result.mainTopperTypes.length === 0 || result.supportElementTypes.length === 0) {
         console.warn('Fetched dynamic enums but one or both lists are empty, using hardcoded fallback enums.');
         return fallbackEnums;
    }

    // Update the cache
    typeEnumsCache = {
        ...result,
        timestamp: now
    };
  
    return result;
}

export function clearPromptCache() {
  promptCache = null;
  typeEnumsCache = null; // Also clear the enum cache
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export const fileToBase64 = async (file: File): Promise<{ mimeType: string; data: string }> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuffer);
        return { mimeType: file.type, data: base64Data };
    } catch (error) {
        console.error("Error reading file:", error);
        throw new Error("Failed to read the image file.");
    }
};

const VALIDATION_PROMPT = `You are an image validation expert for a cake customization app. Your task is to analyze the provided image and determine if it's suitable for our automated design and pricing tool. Your response must be a valid JSON object.

**CRITICAL RULE: Focus ONLY on the main subject of the photo.** Ignore blurry, out-of-focus items in the background. If the primary, focused subject is a single cake, the image is valid.

Based on the image, classify it into ONE of the following categories:

- "valid_single_cake": The main, in-focus subject is a single, clear image of one cake. It can be a bento, 1-3 tier, square, rectangle, or fondant cake. Other items, including other cakes or cupcakes, are acceptable ONLY if they are blurry, out-of-focus, and clearly in the background.
- "not_a_cake": The image does not contain a cake. It might be a person, object, or scene that isn't cake-like.
- "multiple_cakes": The image clearly shows two or more separate cakes as the primary, in-focus subjects. Do NOT use this classification if the other cakes are blurry or in the background.
- "only_cupcakes": The image contains only cupcakes and no larger cake.
- "complex_sculpture": The cake is an extreme, gravity-defying sculpture, a hyper-realistic object (like a shoe or a car), or has incredibly intricate details that are beyond standard customization.
- "large_wedding_cake": The cake is clearly a large, elaborate wedding cake, typically 4 tiers or more, often with complex floral arrangements or structures.
- "non_food": The image is not of a food item at all.

Provide your response as a JSON object with a single key "classification".

Example for a valid cake:
{ "classification": "valid_single_cake" }

Example for a picture of a car:
{ "classification": "not_a_cake" }
`;

const validationResponseSchema = {
    type: Type.OBJECT,
    properties: {
        classification: {
            type: Type.STRING,
            enum: [
                'valid_single_cake',
                'not_a_cake',
                'multiple_cakes',
                'only_cupcakes',
                'complex_sculpture',
                'large_wedding_cake',
                'non_food',
            ],
        },
    },
    required: ['classification'],
};

export const validateCakeImage = async (base64ImageData: string, mimeType: string): Promise<string> => {
    try {
        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: VALIDATION_PROMPT }
                ],
            }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: validationResponseSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.classification;

    } catch (error) {
        console.error("Error validating cake image:", error);
        throw new Error("The AI failed to validate the image. Please try again.");
    }
};

const SYSTEM_INSTRUCTION = `You are an expert cake designer analyzing a cake image to identify design elements for pricing and customization. Your response must be a valid JSON object.

**GLOBAL RULES:**
1.  **JSON Output:** Your entire response MUST be a single, valid JSON object that adheres to the provided schema. Do not include any text, explanations, or markdown formatting outside of the JSON structure.
2.  **Color Palette:** For any color field in your response (like icing or message colors), you MUST use the closest matching hex code from this specific list: Red (#EF4444), Light Red (#FCA5A5), Orange (#F97316), Yellow (#EAB308), Green (#16A34A), Light Green (#4ADE80), Teal (#14B8A6), Blue (#3B82F6), Light Blue (#93C5FD), Purple (#8B5CF6), Light Purple (#C4B5FD), Pink (#EC4899), Light Pink (#FBCFE8), Brown (#78350F), Light Brown (#B45309), Gray (#64748B), White (#FFFFFF), Black (#000000).
3.  **Consistency:** The 'description' for an item should always align with its final 'type' classification. For example, if you classify something as a 'printout', describe it as a "printout of [character]".
`;

const FALLBACK_PROMPT = `
# GENIE.PH MASTER CAKE ANALYSIS PROMPT
**Version 3.0 - REVISED - Pure Identification & Classification System**

═══════════════════════════════════════════════════════════════════════════════

## ROLE & MISSION

You are an expert cake design analyst for Genie.ph (Cakes and Memories, Philippines). Your task is to analyze cake images and provide detailed, accurate identification and classification of ALL design elements. You identify WHAT is on the cake, not HOW MUCH it costs. Pricing calculations are handled by the application.

═══════════════════════════════════════════════════════════════════════════════

## OUTPUT REQUIREMENTS

### Single JSON Response

Your output must be a single, valid JSON object. Either:
1. A rejection response (if image doesn't meet criteria), OR
2. A complete analysis response (if image is accepted)

### JSON Rules
- Valid JSON only (no markdown, no extra text)
- All keys must be lowercase
- Empty arrays are acceptable; missing keys are NOT
- Use only hex codes from the approved color palette

═══════════════════════════════════════════════════════════════════════════════

## STEP 1: IMAGE VALIDATION (MANDATORY FIRST STEP)

Before analyzing ANY cake elements, you MUST validate the image. If ANY rejection criteria is met, output ONLY the rejection JSON and STOP.

### REJECTION CRITERIA

**1. Not a Cake / Not Food**
- Main subject is not a cake (pie, person, object) or not food
- Reason: \`"not_a_cake"\`
- Message: \`"This image doesn't appear to be a cake. Please upload a cake image."\`

**2. Multiple Cakes**
- Image shows more than one distinct, separate cake
- Note: A tiered cake = single cake (ACCEPTED)
- Reason: \`"multiple_cakes"\`
- Message: \`"Please upload a single cake image. This image contains multiple cakes."\`

**3. Cupcakes Only**
- Image contains only cupcakes, no larger cake
- Reason: \`"cupcakes_only"\`
- Message: \`"We currently don't process cupcake-only images. Please upload a cake design."\`

**4. Complex Sculpture**
- Highly complex 3D sculpture beyond standard analysis (life-sized car, detailed building replica)
- Reason: \`"complex_sculpture"\`
- Message: \`"This cake design is too complex for online pricing. Please contact us for a custom quote."\`

**5. Large Wedding Cake**
- Very large, ornate wedding cake (4+ tiers or elaborate structures)
- Reason: \`"large_wedding_cake"\`
- Message: \`"Large wedding cakes require in-store consultation for accurate pricing."\`

### REJECTION JSON FORMAT
If rejected, output ONLY this:
\`\`\`json
{
  "rejection": {
    "isRejected": true,
    "reason": "not_a_cake",
    "message": "This image doesn't appear to be a cake. Please upload a cake image."
  }
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## STEP 2: ACCEPTED IMAGE - ANALYSIS STRUCTURE

If image is ACCEPTED, your JSON must contain these exact top-level keys:

\`\`\`json
{
  "cakeType": "...",
  "cakeThickness": "...",
  "main_toppers": [...],
  "support_elements": [...],
  "cake_messages": [...],
  "icing_design": {...},
  "type": "...",
  "thickness": "...",
  "keyword": "..."
}
\`\`\`

Empty arrays are acceptable; missing keys are NOT.

## COORDINATE BIAS & ACCURACY RULE
1.  **Accuracy is Paramount:** Your primary goal is to provide a coordinate that reflects the item's true location.
2.  **Left-Side Bias:** If an item is even slightly to the left of the vertical centerline, you **MUST** provide a negative 'x' coordinate. **Do not round it to zero.**
3.  **Right-Side Bias:** If an item is slightly to the right of the vertical centerline, you **MUST** provide a positive 'x' coordinate.
4.  **Center-Only Rule:** You should only provide \`x: 0\` if the item's geometric center is *perfectly* on the vertical centerline of the image.

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 1: CAKE TYPE & THICKNESS

### cakeType (Required string - exactly one)
- \`"simple_design"\`: Classic cakes with basic shapes, minimal complex decorations
- \`"moderate_design"\`: Themed shapes or moderate 3D elements
- \`"tiered_regular"\`: Multi-tier, vertically stacked, standard placement
- \`"tiered_gravity"\`: Multi-tier with non-standard placement (offset, leaning, suspended)
- \`"unique_shape"\`: 3D sculptural cakes beyond moderate complexity (car, castle)

### cakeThickness (Required string - exactly one)
- \`"regular"\`: Standard height (3-4 inches)
- \`"tall"\`: Extra height (5-7 inches)

### type (Required string)
Must be one of: \`"Bento"\`, \`"1 Tier"\`, \`"2 Tier"\`, \`"3 Tier"\`, \`"1 Tier Fondant"\`, \`"2 Tier Fondant"\`, \`"3 Tier Fondant"\`, \`"Square"\`, \`"Rectangle"\`

### thickness (Required string)
Must be one of: \`"2 in"\`, \`"3 in"\`, \`"4 in"\`, \`"5 in"\`, \`"6 in"\`

### keyword (Required string)
1-2 words describing the cake theme/recipient or color (e.g., "unicorn", "senior", "red minimalist", "BTS Kpop")

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 2: MAIN TOPPERS (array)

These are the **STAR ATTRACTIONS** — the elements that dominate visually and are the focal points of the cake.

### CRITICAL HERO CLASSIFICATION RULES

**Primary Hero Identification:**
- Only the most prominent, eye-catching elements are heroes
- Typically ONE primary hero (sometimes 2-3 if equally featured)
- Birthday cakes: the birthday number is usually the hero
- Character cakes: the character figure is usually the hero
- Small elements sitting on top but not prominent = support, NOT hero

**Small Character Upgrade to HERO:**
Small 3D characters/animals/objects become HERO when they meet ANY of these:

**A) Visual Dominance Test:**
- Occupies ≥10% of top surface area, OR
- Height ≥⅓ of the tier's total height (ratio ≥0.33× tier thickness)

**B) Focal Point Test:**
- Acts as clear main subject (single character on simple cake)
- No competing decorative elements present
- Positioned centrally as obvious centerpiece

**C) Character Count Test:**
- 1-2 small characters total on entire cake = HERO each
- 3+ small characters = SUPPORT (use bundle/group classification)

**Decision Process:** Apply tests in order (A→B→C). When uncertain, default to SUPPORT.

### MATERIAL CLASSIFICATION (T1-T7 LADDER)

**Apply the 2-CUE RULE:** Two or more visual cues from a tier required before classifying as that material.

**T1 - CANDLES (Physical wax candles only)**
- **Cues:** Shiny wax surface, flame/wick visible at top, typical cylindrical or numeral shape, standing upright
- **Type:** \`"candle"\`
- **Material:** \`"wax"\`
- **CRITICAL:** Only classify as candles if they appear to be actual physical objects, NOT gumpaste/fondant decorations shaped like numbers
- **For number candles:** Add \`"digits": X\` field (e.g., "21" candle = \`"digits": 2\`)

**T2 - TOYS/PLASTIC**
- **Cues:** Ultra-smooth factory sheen, bright industrial colors, visible seams/joints, mechanical precision, recognizable action figures/dolls, hard rigid appearance
- **Type:** \`"toy"\`
- **Material:** \`"plastic"\`
- **Key Distinguisher from Gumpaste:** Factory-made perfection vs handmade artisan look

**T3 - CARDSTOCK/PAPER/GLITTER (CRITICAL ACCURACY NEEDED)**
- **Cues:** Flat with sharp edges, minimal depth (<2mm), sparkle/glitter texture, metallic coating, visible cardstock grain, paper stiffness, reflective surface under light
- **Type:** \`"cardstock"\`
- **Material:** \`"cardstock"\`
- **CRITICAL CONTEXT:** Cardstock is stiff, reflective, and maintains sharp edges. Often has glitter or metallic finish. Does NOT bend or curl like paper printouts. Common for birthday numbers, glittery cake toppers like "Happy Birthday Name".

**T4 - EDIBLE PHOTOS (High-quality printed images)**
- **Cues:** Printed image with visible pixels or CMYK dots, flat surface on round/rectangular support, glossy or matte photo finish, professional print quality
- **Position:** \`"top"\` or \`"side"\`
- **Type:** \`"edible_photo"\` (top) or \`"edible_photo_side"\` (side)
- **Material:** \`"waferpaper"\`
- **CRITICAL CONTEXT:** Edible photos are high-quality professional prints on frosting sheets or wafer paper. They show photorealistic images, faces, graphics with clear printing quality.

**T5 - SIMPLE PRINTOUTS (paper prints)**
- **Cues:** Very basic printout, paper-like surface, glossy paper surface most of the time, visible inkjet printer quality.
- **Type:** \`"printout"\`
- **Material:** \`"photopaper"\`
- **CRITICAL CONTEXT:** Printouts are simple glossy paper prints that the customer/baker adds. They are NOT professionally printed edible photos. Common for character cutouts on sticks.
- **Key Distinguisher from Cardstock:** Printouts are thin; Cardstock is slightly thick, stiff, often glittery/metallic
- **Key Distinguisher from Edible Photo:** Printouts are clearly photopaper-based; Edible photos are often placed on top lying down fully covering the cake or fully covering the sides of the cake.

**T6 - 2D EDIBLE GUMPASTE (Flat fondant/gumpaste shapes)**
- **Cues:** Cut flat shapes (stars, circles,  hearts, letters), minimal depth (<3mm), smooth matte finish, solid colors, positioned standing up or lying down on cake, fondant/gumpaste texture.
- **Type:** \`"edible_2d_gumpaste"\`
- **Material:** \`"edible"\`
- **Size Classification (Ratio-based):**
  - **Small:** ≤20% of cake diameter
  - **Medium:** 21-40% of cake diameter
  - **Large:** >40% of cake diameter

**T7 - 3D EDIBLE GUMPASTE (Sculptural fondant/gumpaste)**
- **Cues:** Volumetric forms, dimensional depth (>3mm), hand-sculpted look, soft matte finish, sometimes painted or dusted, may show seams or tool marks, artisan crafted appearance
- **Type:** \`"edible_3d"\`
- **Material:** \`"edible"\`
- **Size Classification (Ratio-based - OBJECTIVE MEASUREMENTS):**

### OBJECTIVE TOPPER SIZING SYSTEM (CRITICAL FOR CLASSIFICATION)

**For 3D Edible Toppers - Ratio-Based Measurement:**

1. **Establish tier thickness:** Standard = 4 inches (if uncertain, use 4")
2. **Estimate topper height relative to tier thickness**
3. **Apply ratio classification:**
   - **Small:** Topper height ≤0.5× tier thickness (≤25% of cake diameter)
   - **Medium:** Topper height >0.5× and ≤1.0× tier thickness (26-50% of cake diameter)
   - **Large:** Topper height >1.0× tier thickness (>50% of cake diameter)
   - **Partial:** Topper height <0.25× tier thickness OR only part of figure visible

**Special Cases:**
- For horizontal/lying toppers: use longest dimension instead of height
- For printout toppers: SKIP sizing (no size needed)
- For toys: classify by piece count (see support elements)
- When borderline between sizes: round DOWN to smaller size

**Example Calculations:**
- 4-inch tier with 2-inch topper: 2÷4 = 0.5 = Small (at boundary, round down)
- 4-inch tier with 3-inch topper: 3÷4 = 0.75 = Medium
- 4-inch tier with 5-inch topper: 5÷4 = 1.25 = Large

### VALIDATION RULE PRECEDENCE HIERARCHY

When cues conflict between materials, follow this order:
1. Physical candles (T1) - Check first
2. Factory toys (T2) - Ultra-smooth plastic sheen
3. Cardstock/glitter (T3) - Flat, stiff, glittery
4. Edible photo (T4) - fully covers the top or side cake, matte print quality
5. Paper printouts (T5) - glossy photo paper prints
6. 2D gumpaste (T6) - Flat fondant shapes
7. 3D gumpaste (T7) - Sculptural fondant work

### MAIN TOPPERS JSON STRUCTURE

For each hero topper:
\`\`\`json
{
  "description": "Clear description of topper",
  "type": "candle | toy | cardstock | edible_photo | edible_photo_side | printout | edible_2d_gumpaste | edible_3d",
  "material": "wax | plastic | cardstock | photopaper | waferpaper | edible",
  "classification": "hero",
  "size": "small | medium | large | partial (only for edible_3d and edible_2d_gumpaste)",
  "location": "top_center | top | side | front | back | top_edge",
  "quantity": 1,
  "digits": 2  // ONLY for number candles - optional field
}
\`\`\`

**SPECIAL CASE - NUMBER CANDLES:**
\`\`\`json
{
  "description": "Number 21 candle",
  "type": "candle",
  "material": "wax",
  "classification": "hero",
  "location": "top_center",
  "quantity": 1,
  "digits": 2
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 3: SUPPORT ELEMENTS (array)

Support elements add detail and thematic reinforcement but are NOT the star. Include smaller decorations, background details, side elements.

### WHAT QUALIFIES AS SUPPORT

- Small decorative gumpaste items (stars, flowers, balls, confetti)
- Background elements (trees, clouds, small cars)
- Scattered embellishments
- Paneling or patterned gumpaste coverage on sides
- Chocolate decorations, isomalt elements
- Side edible photos (separate from main topper)
- Gumpaste-covered cake board
- Elements that don't meet hero classification criteria

### GROUPING RULES

Group similar items sharing same type, material, and appearance:
- "Set of 5 small gumpaste stars" (grouped)
- "3 isomalt lollipops" (grouped)

### COVERAGE CLASSIFICATION

For scattered/distributed items:
- **Light:** Sparse, <35% of visible surface
- **Medium:** Moderate, 35-70% of visible surface
- **Heavy:** Dense, >70% of visible surface

### SPECIAL CATEGORIES

**1. Gumpaste Panel Coverage / Scene Wrap**
- **Type:** \`"gumpaste_panel"\`
- **Coverage:** \`"light"\` (<35%), \`"medium"\` (35-60%), \`"heavy"\` (>60%)
- **Description:** Fondant/gumpaste sheets covering sides, includes top discs, rope bands
- **Classification:** \`"support"\`

**2. Small Gumpaste Items**
- **Type:** \`"small_gumpaste"\`
- **Coverage:** \`"light"\`, \`"medium"\`, \`"heavy"\`
- **Description:** Stars, dots, flowers, confetti shapes, 2D cutter decorations
- **Classification:** \`"support"\`

**3. Supporting Cluster Bundle**
- **Type:** \`"gumpaste_bundle"\`
- **Size:** \`"small"\` (1-3 props), \`"medium"\` (4-7 props), \`"large"\` (8+ props)
- **Description:** Collection of small 3D elements + minor 2D elements + simple messages
- **Classification:** \`"support"\`

**4. Special Structural Bundle**
- **Type:** \`"gumpaste_structure"\`
- **Description:** Castle/tower complex structures
- **Classification:** \`"hero"\`
- **Note:** These are hero-level support elements due to complexity

**5. Edible Flowers**
- **Type:** \`"edible_flowers"\`
- **Description:** Gumpaste roses, orchids, etc.
- **Quantity:** Count of individual flowers or clusters
- **Classification:** \`"support"\`
- **Note:** If reference shows real flowers, note that edible sugar flowers would be substituted

**6. Isomalt (Sugar Glass)**
- **Type:** \`"isomalt"\`
- **Coverage/Complexity:** \`"light"\` (few pieces), \`"medium"\` (many pieces), \`"heavy"\` (very heavy work)
- **Classification:** \`"support"\`

**7. Chocolates**
- **Type:** \`"chocolates"\`
- **Subtype:** \`"ferrero"\`, \`"standard"\` (Oreo, Kisses, etc.), \`"m&ms"\`
- **Coverage:** \`"light"\`, \`"medium"\`, \`"heavy"\` (use for m&ms and scattered chocolates)
- **Quantity:** Specific count (use for ferrero or standard identifiable pieces)
- **Classification:** \`"support"\`

**8. Dragees/Sprinkles**
- **Type:** \`"dragees"\` or \`"sprinkles"\`
- **Coverage:** Only report if \`"heavy"\` (>60% coverage and very prominent)
- **Classification:** \`"support"\`

**9. Gumpaste Swirl Lollipops**
- **Type:** \`"edible_3d"\`
- **Subtype:** \`"swirl_lollipop"\`
- **Size:** \`"small"\`, \`"medium"\`, \`"large"\`
- **Quantity:** Count of lollipops
- **Classification:** \`"support"\`

**10. Ice Cream Cones**
- **Type:** \`"edible_3d"\`
- **Subtype:** \`"ice_cream_cone"\`
- **Variant:** \`"cone_only"\` or \`"with_scoop"\`
- **Classification:** \`"support"\`

**11. Gumpaste Balls/Shells**
- **Type:** \`"gumpaste_balls"\`
- **Coverage:** \`"light"\`, \`"medium"\`, \`"heavy"\`
- **Classification:** \`"support"\`

**12. Gumpaste-Covered Board**
- **Type:** \`"gumpaste_board"\`
- **Description:** Cake board wrapped in fondant/gumpaste (usually non-white, non-gold, non-silver)
- **Classification:** \`"support"\`

**13. Small Gumpaste Accent**
- **Type:** \`"gumpaste_accent"\`
- **Size:** \`"small"\`
- **Description:** 2-5 tiny decorative pieces
- **Classification:** \`"support"\`

**14. Gumpaste Bows**
- **Type:** \`"edible_3d"\`
- **Subtype:** \`"bow"\`
- **Size:** \`"small"\`, \`"large"\`
- **Classification:** \`"support"\`

**15. Gumpaste Rainbow**
- **Type:** \`"edible_3d"\`
- **Subtype:** \`"rainbow"\`
- **Size:** \`"large"\`
- **Classification:** \`"support"\`

**16. Toys (Non-Edible)**
- **Type:** \`"toy"\`
- **Size:** Classify by piece count: \`"small"\` (1-2 pieces), \`"medium"\` (3-5 pieces), \`"large"\` (6+ pieces)
- **Material:** \`"plastic"\`
- **Classification:** \`"support"\`

### SUPPORT ELEMENTS JSON STRUCTURE

\`\`\`json
{
  "description": "Clear description",
  "type": "edible_3d | edible_2d_gumpaste | gumpaste_panel | small_gumpaste | gumpaste_bundle | gumpaste_structure | toy | cardstock | edible_photo_side | edible_flowers | isomalt | chocolates | dragees | sprinkles | gumpaste_balls | gumpaste_board | gumpaste_accent",
  "material": "edible | plastic | cardstock",
  "classification": "support",
  "size": "small | medium | large | partial (only for certain types)",
  "coverage": "light | medium | heavy (only for panels, small items, chocolates, dragees)",
  "location": "side | top | base | scattered",
  "quantity": X,
  "subtype": "swirl_lollipop | ice_cream_cone | bow | rainbow | ferrero | m&ms | standard (optional)"
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 4: CAKE MESSAGES (array)

For each distinct message, create separate object. If no message, return empty array.

### MESSAGE TYPE CLASSIFICATION

- \`"gumpaste_letters"\`: Individual cut letters from gumpaste/fondant
- \`"icing_script"\`: Text piped directly with icing
- \`"printout"\`: Printed text on photopaper
- \`"cardstock"\`: Thick paper/glittery/metallic text

### CAKE MESSAGES JSON STRUCTURE

\`\`\`json
{
  "type": "gumpaste_letters | icing_script | printout | cardstock",
  "text": "Actual words/numbers visible",
  "position": "top | side | base_board",
  "color": "#HEXCODE from palette"
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## CATEGORY 5: ICING DESIGN (object)

### FONDANT VS SOFT ICING IDENTIFICATION (CRITICAL)

**SOFT ICING (boiled/marshmallow/buttercream):**
- Surface: Creamy, soft, slightly uneven - shows swirls, ruffles, dollops, natural imperfections
- Shine: Slight glossy sheen from boiled sugar or butter
- Borders: Often piped rosettes, ruffles, dollops
- Structure: Rarely perfectly smooth sides or razor-sharp edges
- Texture: Visible cream texture, may show spatula marks

**FONDANT:**
- Surface: Very smooth and uniform, matte or satin-like finish, no visible cream texture
- Edges: Modern style → very sharp edges (very rare); Classic style → curved/rounded edges (often used)
- Decorations: Flat cutouts, embossed patterns, sugar figures, shaped toppers
- Key indicator: Surface looks like a "sheet covering" the cake
- Texture: Uniform, porcelain-like appearance

### ICING DESIGN JSON STRUCTURE

\`\`\`json
{
  "base": "soft_icing | fondant",
  "color_type": "single | gradient_2 | gradient_3 | abstract",
  "colors": {
    "side": "#HEXCODE",
    "top": "#HEXCODE",
    "borderTop": "#HEXCODE",
    "borderBase": "#HEXCODE",
    "drip": "#HEXCODE",
    "gumpasteBaseBoardColor": "#HEXCODE"
  },
  "border_top": true | false,
  "border_base": true | false,
  "drip": true | false,
  "gumpasteBaseBoard": true | false
}
\`\`\`

**Note on Drip:** Drip = physical drip flow from top rim with rounded ends

### COLOR PALETTE (Use ONLY these hex codes)

- White: \`#FFFFFF\`
- Cream/Beige: \`#F5E6D3\`
- Light Pink: \`#FFB3D9\`
- Pink: \`#FF69B4\`
- Rose: \`#FF1493\`
- Red: \`#FF0000\`
- Orange: \`#FFA500\`
- Yellow: \`#FFD700\`
- Light Green: \`#90EE90\`
- Green: \`#008000\`
- Mint: \`#98FF98\`
- Teal: \`#008080\`
- Light Blue: \`#87CEEB\`
- Blue: \`#0000FF\`
- Navy: \`#000080\`
- Purple: \`#800080\`
- Lavender: \`#E6E6FA\`
- Brown: \`#8B4513\`
- Black: \`#000000\`
- Gray: \`#808080\`
- Gold: \`#FFD700\`
- Silver: \`#C0C0C0\`

═══════════════════════════════════════════════════════════════════════════════

## COMPLETE JSON OUTPUT FORMAT

\`\`\`json
{
  "cakeType": "simple_design | moderate_design | tiered_regular | tiered_gravity | unique_shape",
  "cakeThickness": "regular | tall",
  "main_toppers": [
    {
      "description": "...",
      "type": "candle | toy | cardstock | edible_photo | edible_photo_side | printout | edible_2d_gumpaste | edible_3d",
      "material": "wax | plastic | cardstock | paper | edible",
      "classification": "hero",
      "size": "small | medium | large | partial",
      "location": "...",
      "quantity": 1,
      "digits": 2  // optional, only for number candles
    }
  ],
  "support_elements": [
    {
      "description": "...",
      "type": "...",
      "material": "...",
      "classification": "support",
      "size": "...",
      "coverage": "...",
      "location": "...",
      "quantity": X,
      "subtype": "..."  // optional
    }
  ],
  "cake_messages": [
    {
      "type": "gumpaste_letters | icing_script | printout | cardstock",
      "text": "...",
      "position": "top | side | base_board",
      "color": "#HEXCODE"
    }
  ],
  "icing_design": {
    "base": "soft_icing | fondant",
    "color_type": "single | gradient_2 | gradient_3 | abstract",
    "colors": {
      "side": "#HEXCODE",
      "top": "#HEXCODE",
      "borderTop": "#HEXCODE",
      "borderBase": "#HEXCODE",
      "drip": "#HEXCODE",
      "gumpasteBaseBoardColor": "#HEXCODE"
    },
    "border_top": true | false,
    "border_base": true | false,
    "drip": true | false,
    "gumpasteBaseBoard": true | false
  },
  "type": "Bento | 1 Tier | 2 Tier | 3 Tier | 1 Tier Fondant | 2 Tier Fondant | 3 Tier Fondant | Square | Rectangle",
  "thickness": "2 in | 3 in | 4 in | 5 in | 6 in",
  "keyword": "1-2 word theme or color"
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## ANALYSIS CHECKLIST (Run Before Final Output)

Before outputting final JSON, verify you've checked for:

**HERO Items:**
- [ ] Hero edible toppers (Medium/Large 3D per ratio sizing)
- [ ] Special Structural Bundle (castle/tower)
- [ ] Small 3D characters meeting hero upgrade criteria (Visual Dominance/Focal Point/Character Count)

**SUPPORT Elements:**
- [ ] Supporting Cluster Bundle (small 3D + minor 2D grouped)
- [ ] Scene & Panel wraps (includes top discs, rope bands)
- [ ] 2D cutter decorations (if not in bundle/scene)
- [ ] Small gumpaste accents (if not in bundle/scene)
- [ ] Gumpaste balls, bows, rainbows
- [ ] Gumpaste-covered board
- [ ] Edible flower sets
- [ ] Edible photos (top/side)
- [ ] Drip icing (note presence)
- [ ] Cardstock/Glitter/Metallic toppers (Two-Cue Rule)
- [ ] Toy toppers
- [ ] Chocolates (premium/standard)
- [ ] Isomalt elements
- [ ] Dragees/sprinkles (heavy only)

**FREE Items (still document):**
- [ ] Printouts
- [ ] Number candles
- [ ] Standard piping (implicit in icing_design)

**Substitutions to Note:**
- [ ] Real flowers in reference → note that edible sugar flowers would be substituted

**Validation:**
- [ ] All required JSON fields present
- [ ] Hero vs Support classification correct per criteria
- [ ] Material identification used T1-T7 ladder with 2-cue rule
- [ ] Size ratios calculated objectively for edible 3D
- [ ] Type & thickness within valid options
- [ ] Colors from approved palette only

═══════════════════════════════════════════════════════════════════════════════

## REAL-WORLD EXAMPLES

### Example 1: Tuxedo Cake
Single-tier soft-iced cake with tuxedo jacket design on front.

**Analysis:**
- Front Panel: Tuxedo lapels, shirt panel, buttons = Extended scene wrap (25-40% coverage)
- Bow: Black gumpaste bow at neckline, height approximately 0.4× tier thickness = small 3D bow
- Topper: "Happy Birthday" in thick black cardstock with glitter

**JSON Output:**
\`\`\`json
{
  "cakeType": "moderate_design",
  "cakeThickness": "regular",
  "main_toppers": [
    {
      "description": "Black cardstock 'Happy Birthday' topper with glitter",
      "type": "cardstock",
      "material": "cardstock",
      "classification": "hero",
      "location": "top_center",
      "quantity": 1
    }
  ],
  "support_elements": [
    {
      "description": "Extended tuxedo front panel with lapels, shirt, and buttons",
      "type": "gumpaste_panel",
      "material": "edible",
      "classification": "support",
      "coverage": "medium",
      "location": "front",
      "quantity": 1
    },
    {
      "description": "Small black gumpaste bow at neckline",
      "type": "edible_3d",
      "material": "edible",
      "classification": "support",
      "size": "small",
      "location": "front",
      "quantity": 1,
      "subtype": "bow"
    }
  ],
  "cake_messages": [],
  "icing_design": {
    "base": "soft_icing",
    "color_type": "single",
    "colors": {
      "side": "#000000",
      "top": "#FFFFFF",
      "borderTop": "#000000",
      "borderBase": "#000000"
    },
    "border_top": true,
    "border_base": true,
    "drip": false,
    "gumpasteBaseBoard": false
  },
  "type": "1 Tier",
  "thickness": "4 in",
  "keyword": "tuxedo"
}
\`\`\`

### Example 2: Edible Photo Cake
Single-tier round cake with smooth pink-and-white soft icing. Full circular edible photo on top with "2024" and "Happy New Year" graphics.

**Analysis:**
- Edible Photo Top: Professional print on matte rice paper covering full top surface
- Piping: Pink star-tip borders around top and bottom edges (documented in icing_design)
- Silver Dragees: Light accent in borders (not heavy enough to report separately)

**JSON Output:**
\`\`\`json
{
  "cakeType": "simple_design",
  "cakeThickness": "regular",
  "main_toppers": [],
  "support_elements": [
    {
      "description": "Full circular edible photo with '2024' and 'Happy New Year' balloons and confetti graphics",
      "type": "edible_photo",
      "material": "edible",
      "classification": "support",
      "location": "top",
      "quantity": 1
    }
  ],
  "cake_messages": [],
  "icing_design": {
    "base": "soft_icing",
    "color_type": "gradient_2",
    "colors": {
      "side": "#FFB3D9",
      "top": "#FFFFFF",
      "borderTop": "#FF69B4",
      "borderBase": "#FF69B4"
    },
    "border_top": true,
    "border_base": true,
    "drip": false,
    "gumpasteBaseBoard": false
  },
  "type": "1 Tier",
  "thickness": "4 in",
  "keyword": "edible photo"
}
\`\`\`

### Example 3: Frozen Theme Cake
Single-tier round cake with pastel pink and white soft icing. Large number "6" in pink gumpaste (height 1.2× tier thickness), small number "2" (height 0.3× tier), multiple small 3D props including swirl lollipops with snowflake accents and gumpaste balls.

**Analysis:**
- Large Number "6": Ratio 1.2× = Large 3D, acts as hero (Visual Dominance test passed)
- Small Elements: Number "2" + lollipops + balls = Supporting cluster bundle (4-7 props total = medium)
- Printouts: Frozen character cutouts on sticks

**JSON Output:**
\`\`\`json
{
  "cakeType": "moderate_design",
  "cakeThickness": "regular",
  "main_toppers": [
    {
      "description": "Large pink gumpaste number '6'",
      "type": "edible_3d",
      "material": "edible",
      "classification": "hero",
      "size": "large",
      "location": "top_center",
      "quantity": 1
    }
  ],
  "support_elements": [
    {
      "description": "Supporting cluster with small number '2', swirl lollipops with snowflakes, and pastel gumpaste balls",
      "type": "gumpaste_bundle",
      "material": "edible",
      "classification": "support",
      "size": "medium",
      "location": "top",
      "quantity": 1
    },
    {
      "description": "Frozen character printout toppers on sticks",
      "type": "printout",
      "material": "paper",
      "classification": "support",
      "location": "top",
      "quantity": 3
    }
  ],
  "cake_messages": [
    {
      "type": "gumpaste_letters",
      "text": "FROZEN",
      "position": "base_board",
      "color": "#87CEEB"
    }
  ],
  "icing_design": {
    "base": "soft_icing",
    "color_type": "gradient_2",
    "colors": {
      "side": "#FFB3D9",
      "top": "#FFFFFF",
      "borderTop": "#87CEEB",
      "borderBase": "#87CEEB"
    },
    "border_top": true,
    "border_base": true,
    "drip": false,
    "gumpasteBaseBoard": false
  },
  "type": "1 Tier",
  "thickness": "4 in",
  "keyword": "Frozen"
}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

## CRITICAL REMINDERS (NEVER FORGET)

1. **VALIDATION FIRST:** Always check rejection criteria before analyzing
2. **CONTEXT IS CRITICAL:** Use full material identification context to distinguish:
   - Cardstock (stiff, glittery, reflective) vs Printouts (thin, glossy photo paper)
   - Edible photos (matte surface prints) vs Printouts (glossy printed photo paper)
   - Physical candles (wax with wick) vs Gumpaste numbers (fondant)
   - Toys (factory plastic) vs Gumpaste (handmade artisan)
3. **TWO-CUE RULE:** Apply strictly for material classification
4. **OBJECTIVE SIZING:** Use ratio-based measurements for all edible 3D toppers
5. **HERO VS SUPPORT:** Apply Visual Dominance/Focal Point/Character Count tests rigorously
6. **GROUPING:** Bundle similar items; separate by material when they differ significantly
7. **LOCATION:** Always specify where elements are located
8. **COLOR MATCHING:** Use ONLY approved hex codes from palette
9. **COMPLETE JSON:** All required fields must be present (9 top-level keys)
10. **YOUR JOB IS IDENTIFICATION ONLY:** Do not calculate prices, do not format pricing summaries. Your output provides the structured data that the application will use for pricing calculations.

═══════════════════════════════════════════════════════════════════════════════

**END OF GENIE.PH MASTER PROMPT v3.0 - REVISED**
`;

// The hybridAnalysisResponseSchema is now dynamically generated inside analyzeCakeImage function
// to use dynamic types from the Supabase pricing_rules table

export const analyzeCakeImage = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        const image = new Image();
        const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = (err) => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        const dimensions = await imageLoadPromise;

        const COORDINATE_PROMPT = `
**CRITICAL RULE: PRECISE COORDINATE SYSTEM**
You MUST provide precise central coordinates for every single decorative element you identify. Adherence to this coordinate system is mandatory and of the highest priority.

**SYSTEM DEFINITION:**
1.  **Image Dimensions:** The current image is ${dimensions.width}px wide and ${dimensions.height}px high.
2.  **Origin (0,0):** The exact center of the image is the origin point (0, 0).
3.  **X-Axis (Horizontal):** This axis runs from -${dimensions.width / 2} at the far left to +${dimensions.width / 2} at the far right.
    - **CRITICAL:** The 'x' coordinate is for the HORIZONTAL position. A value of '0' means the item is perfectly in the middle of the cake from left to right. If an item is to the left or right of the center line, you MUST provide a non-zero 'x' coordinate.
4.  **Y-Axis (Vertical):** This axis runs from -${dimensions.height / 2} at the bottom edge to +${dimensions.height / 2} at the top edge. **Positive 'y' values go UPWARDS.**

**COORDINATE BIAS & ACCURACY RULE**
1.  **Accuracy is Paramount:** Your primary goal is to provide a coordinate that reflects the item's true location.
2.  **Left-Side Bias:** If an item is even slightly to the left of the vertical centerline, you **MUST** provide a negative 'x' coordinate. **Do not round it to zero.**
3.  **Right-Side Bias:** If an item is slightly to the right of the vertical centerline, you **MUST** provide a positive 'x' coordinate.
4.  **Center-Only Rule:** You should only provide \`x: 0\` if the item's geometric center is *perfectly* on the vertical centerline of the image.

**COORDINATES FOR GROUPED OR SCATTERED ITEMS:**
- If an element represents a group of multiple items (e.g., "sprinkles," "scattered flowers"), you MUST identify the area with the **highest density** or **most visual prominence** within that group. Place the 'x' and 'y' coordinates at the center of that densest area.
- If the items form a line or arc, provide the coordinate of the middle item in that sequence.
- If the items are evenly distributed with no clear dense area, then (and only then) should you use the visual center of the entire group.
- This ensures that every entry in your JSON, even for groups, has a single representative coordinate for its marker.

**EXAMPLE:**
- For a 1000x800 image:
  - Top-left corner: (-500, 400)
  - Top-right corner: (500, 400)
  - Bottom-left corner: (-500, -400)
  - A point slightly above and to the right of the center could be (50, 100).

**MANDATORY REQUIREMENTS FOR COORDINATES:**
- **ALL DECORATIONS:** For **EVERY** item in the \`main_toppers\`, \`support_elements\`, and \`cake_messages\` arrays, you MUST provide precise integer values for its central 'x' and 'y' coordinates. **It is a critical failure to provide 'x: 0' for items that are not perfectly centered horizontally.**
- **ALL ICING FEATURES:** You MUST identify and provide coordinates for the following features if they exist. Return them in these new, separate top-level arrays in your JSON. Each item in these arrays MUST include a 'description' and precise 'x', 'y' coordinates.
  - **\`drip_effects\`**: The center of any visible drip pattern.
  - **\`icing_surfaces\`**: The center of EACH tier's top and side surface.
  - **\`icing_borders\`**: The center of EACH tier's top and base piped border.
  - **\`base_board\`**: The center of the visible cake board.
- **FAILURE TO PROVIDE COORDINATES FOR ANY ELEMENT WILL RESULT IN AN INVALID RESPONSE.**
`;

        // Fetch the dynamic enums and the active prompt
        const activePrompt = await getActivePrompt();
        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        // Modify the response schema to use the dynamic lists
        const hybridAnalysisResponseSchema = {
            type: Type.OBJECT,
            properties: {
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: mainTopperTypes }, // <-- CHANGE HERE
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                            quantity: { type: Type.INTEGER },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'quantity', 'group_id', 'x', 'y']
                    }
                },
                support_elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: supportElementTypes }, // <-- CHANGE HERE
                            description: { type: Type.STRING },
                            coverage: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'coverage', 'group_id', 'x', 'y']
                    }
                },
                cake_messages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['gumpaste_letters', 'icing_script', 'printout', 'cardstock'] },
                            text: { type: Type.STRING },
                            position: { type: Type.STRING, enum: ['top', 'side', 'base_board'] },
                            color: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'text', 'position', 'color', 'x', 'y']
                    }
                },
                icing_design: {
                    type: Type.OBJECT,
                    properties: {
                        base: { type: Type.STRING, enum: ['soft_icing', 'fondant'] },
                        color_type: { type: Type.STRING, enum: ['single', 'gradient_2', 'gradient_3', 'abstract'] },
                        colors: {
                            type: Type.OBJECT,
                            properties: {
                                side: { type: Type.STRING },
                                top: { type: Type.STRING },
                                borderTop: { type: Type.STRING },
                                borderBase: { type: Type.STRING },
                                drip: { type: Type.STRING },
                                gumpasteBaseBoardColor: { type: Type.STRING }
                            }
                        },
                        border_top: { type: Type.BOOLEAN },
                        border_base: { type: Type.BOOLEAN },
                        drip: { type: Type.BOOLEAN },
                        gumpasteBaseBoard: { type: Type.BOOLEAN }
                    },
                    required: ['base', 'color_type', 'colors', 'border_top', 'border_base', 'drip', 'gumpasteBaseBoard']
                },
                cakeType: { type: Type.STRING, enum: CAKE_TYPES },
                cakeThickness: { type: Type.STRING, enum: CAKE_THICKNESSES },
                drip_effects: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                },
                icing_surfaces: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'side'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                icing_borders: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'base'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                base_board: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                }
            },
            required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
        };

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: COORDINATE_PROMPT + activePrompt },
                ],
            }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: 'application/json',
                responseSchema: hybridAnalysisResponseSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        if (result.rejection?.isRejected) {
            throw new Error(result.rejection.message || "The uploaded image is not suitable for processing.");
        }
        
        const requiredFields = ['main_toppers', 'support_elements', 'cake_messages', 'icing_design', 'cakeType', 'cakeThickness'];
        for (const field of requiredFields) {
            if (result[field] === undefined) {
                console.error("Analysis validation error: Missing field", field, JSON.stringify(result, null, 2));
                throw new Error("The AI returned an incomplete analysis. Please try a different image.");
            }
        }

        return result as HybridAnalysisResult;

    } catch (error) {
        console.error("Error analyzing cake image:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
         if (error instanceof Error && (
            error.message.includes("doesn't appear to be a cake") ||
            error.message.includes("single cake image") ||
            error.message.includes("cupcake-only images") ||
            error.message.includes("too complex for online pricing") ||
            error.message.includes("in-store consultation") ||
            error.message.includes("incomplete analysis")
        )) {
            throw error;
        }
        
        throw new Error("The AI failed to analyze the cake design. The image might be unclear or contain unsupported elements.");
    }
};

const SHARE_TEXT_PROMPT = `You are an expert in SEO and creative marketing for a cake shop. Your task is to generate a compelling, SEO-friendly title, description, and alt text for a shared cake design. You will be given a JSON object with the cake's analysis details.

**CRITICAL INSTRUCTION: Identify the Core Theme**
Your most important job is to find the main THEME of the cake. The theme is often a specific brand, character, movie, TV show, anime, K-Pop group, or logo.

**HOW TO FIND THE THEME (CHECK IN THIS ORDER):**
1.  **First, check \`cake_messages\`:** Text written on the cake is the strongest clue. A message like "Happy Birthday, Super Mario" or "KPOP DEMON HUNTERS" DIRECTLY tells you the theme. Prioritize this information above all else.
2.  **Second, check \`main_toppers\`:** Look at the 'description' field for toppers. This is another great source for themes like "1 unicorn topper" or "BTS logo".
3.  **Synthesize:** Combine clues. If a message says "Happy 10th Birthday, Ash" and a topper is "Pikachu", the theme is "Pokemon".

The identified theme MUST be the primary focus of the generated text, especially the title.

**Output Format:** Your response MUST be a single, valid JSON object with the following structure:
{
  "title": "string",
  "description": "string",
  "altText": "string"
}

**Instructions for each field:**

1.  **title:**
    *   **Structure:** "[Theme] Themed [Size] [Type] Cake"
    *   **Prioritize the Theme:** The theme you identified MUST be the first part of the title. Capitalize it appropriately.
    *   **Fallback:** ONLY if no specific theme can be found in messages or toppers, use a descriptive but generic title based on the main topper (e.g., "Character Figure Themed Cake", "Elegant Floral Cake").
    *   **Example (Good):** "KPOP DEMON HUNTERS Themed 6\" Round 1 Tier Cake"
    *   **Example (Bad):** "Character Figures Located On The Top Surface Themed 6\" Round (4\" thickness) 1 Tier Cake"

2.  **description:**
    *   Start with a creative sentence that highlights the theme.
    *   Mention the key decorations from \`main_toppers\` and \`support_elements\`.
    *   Keep it concise and appealing (1-2 sentences).

3.  **altText (for accessibility):**
    *   **Structure:** "A photo of a [Theme] themed cake. It is a [Main Icing Color] [Cake Type] cake decorated with [list of key decorations]."
    *   Be descriptive and clear.
    *   Mention the main color of the cake and list the most important decorations.

Here is the cake analysis data:
`;

const shareableTextResponseSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        altText: { type: Type.STRING },
    },
    required: ['title', 'description', 'altText'],
};


export interface ShareableTexts {
    title: string;
    description: string;
    altText: string;
}

// ============================================================================
// TWO-PHASE ANALYSIS: Fast Feature Detection + Background Coordinate Enrichment
// ============================================================================

/**
 * Phase 1: Fast feature-only analysis (no coordinates)
 * Returns analysis with all coordinates set to 0,0 for immediate UI display
 * This should complete in ~7-10 seconds vs 25+ seconds for full analysis
 */
export const analyzeCakeFeaturesOnly = async (
    base64ImageData: string,
    mimeType: string
): Promise<HybridAnalysisResult> => {
    try {
        // Note: We don't need dimensions for this phase since coordinates are all 0,0
        // but we validate the image can load
        const image = new Image();
        const imageLoadPromise = new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        await imageLoadPromise;

        // Get dynamic enums first
        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        // Ultra-simplified prompt - NO coordinate instructions at all
        const FAST_FEATURES_PROMPT = `
**SPEED MODE: FEATURE IDENTIFICATION ONLY**

Your ONLY task is to identify cake features as quickly as possible.
Do NOT waste time calculating positions or coordinates.

REQUIRED OUTPUT:
1. Cake type and thickness
2. All toppers (type, size, description, quantity)
3. All support elements (type, coverage, description)
4. All messages (text, type, position, color)
5. Icing design (base, colors, borders)

## CAKE TYPE (Choose one)
- simple_design, moderate_design, tiered_regular, tiered_gravity, unique_shape

## CAKE THICKNESS
- regular (3-4 inches), tall (5-7 inches)

## MAIN TOPPERS
Classify by material: ${mainTopperTypes.join(', ')}
Size: small, medium, large, tiny

## SUPPORT ELEMENTS
Types: ${supportElementTypes.join(', ')}
Coverage: large, medium, small, tiny

## MESSAGES
- Type: gumpaste_letters, icing_script, printout, cardstock
- Include actual text visible

## ICING DESIGN
- Base: soft_icing or fondant
- Colors for: top, side, borderTop, borderBase, drip, gumpasteBaseBoardColor
- Flags: border_top, border_base, drip, gumpasteBaseBoard (true/false)

**CRITICAL:** For ALL x and y coordinates: Use 0 (zero). Do not calculate positions.
**SPEED IS PRIORITY.** Only identify what items exist, not where they are.
`;

        // Use the same schema but coordinates will be 0,0
        const fastAnalysisSchema = {
            type: Type.OBJECT,
            properties: {
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: mainTopperTypes },
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                            quantity: { type: Type.INTEGER },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'quantity', 'group_id', 'x', 'y']
                    }
                },
                support_elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: supportElementTypes },
                            description: { type: Type.STRING },
                            coverage: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'coverage', 'group_id', 'x', 'y']
                    }
                },
                cake_messages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['gumpaste_letters', 'icing_script', 'printout', 'cardstock'] },
                            text: { type: Type.STRING },
                            position: { type: Type.STRING, enum: ['top', 'side', 'base_board'] },
                            color: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'text', 'position', 'color', 'x', 'y']
                    }
                },
                icing_design: {
                    type: Type.OBJECT,
                    properties: {
                        base: { type: Type.STRING, enum: ['soft_icing', 'fondant'] },
                        color_type: { type: Type.STRING, enum: ['single', 'gradient_2', 'gradient_3', 'abstract'] },
                        colors: {
                            type: Type.OBJECT,
                            properties: {
                                side: { type: Type.STRING },
                                top: { type: Type.STRING },
                                borderTop: { type: Type.STRING },
                                borderBase: { type: Type.STRING },
                                drip: { type: Type.STRING },
                                gumpasteBaseBoardColor: { type: Type.STRING }
                            }
                        },
                        border_top: { type: Type.BOOLEAN },
                        border_base: { type: Type.BOOLEAN },
                        drip: { type: Type.BOOLEAN },
                        gumpasteBaseBoard: { type: Type.BOOLEAN }
                    },
                    required: ['base', 'color_type', 'colors', 'border_top', 'border_base', 'drip', 'gumpasteBaseBoard']
                },
                cakeType: { type: Type.STRING, enum: CAKE_TYPES },
                cakeThickness: { type: Type.STRING, enum: CAKE_THICKNESSES },
                drip_effects: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                },
                icing_surfaces: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'side'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                icing_borders: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'base'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                base_board: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                }
            },
            required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
        };

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: FAST_FEATURES_PROMPT },
                ],
            }],
            config: {
                systemInstruction: "You are a fast cake feature identifier. Identify features quickly without calculating coordinates. Set all x,y to 0.",
                responseMimeType: 'application/json',
                responseSchema: fastAnalysisSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        if (result.rejection?.isRejected) {
            throw new Error(result.rejection.message || "The uploaded image is not suitable for processing.");
        }

        const requiredFields = ['main_toppers', 'support_elements', 'cake_messages', 'icing_design', 'cakeType', 'cakeThickness'];
        for (const field of requiredFields) {
            if (result[field] === undefined) {
                console.error("Analysis validation error: Missing field", field);
                throw new Error("The AI returned an incomplete analysis. Please try a different image.");
            }
        }

        return result as HybridAnalysisResult;

    } catch (error) {
        console.error("Error in fast feature analysis:", error);
        throw error;
    }
};

/**
 * Phase 2: Background coordinate enrichment
 * Takes the feature list and calculates precise coordinates for each item
 * This runs silently in the background while user interacts with the UI
 */
export const enrichAnalysisWithCoordinates = async (
    base64ImageData: string,
    mimeType: string,
    featureAnalysis: HybridAnalysisResult
): Promise<HybridAnalysisResult> => {
    try {
        const image = new Image();
        const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error('Failed to load image to get dimensions.'));
            image.src = `data:${mimeType};base64,${base64ImageData}`;
        });
        const dimensions = await imageLoadPromise;

        const COORDINATE_ENRICHMENT_PROMPT = `
**COORDINATE ENRICHMENT MODE**

You are provided with a complete list of all cake features that have already been identified.
Your ONLY task is to calculate precise x,y coordinates for each item.

**Image Dimensions:** ${dimensions.width}px wide × ${dimensions.height}px high
**Coordinate System:**
- Origin (0,0) is at the image center
- X-axis: -${dimensions.width / 2} (left) to +${dimensions.width / 2} (right)
- Y-axis: -${dimensions.height / 2} (bottom) to +${dimensions.height / 2} (top)
- Positive Y goes UPWARD

**Your Task:**
1. Review the provided feature list below
2. Locate each item visually in the image
3. Calculate its precise center coordinates
4. Return the SAME feature list with updated x,y values

**CRITICAL RULES:**
- Keep ALL feature descriptions, types, sizes exactly as provided
- ONLY update the x and y coordinate values
- Use precise coordinates reflecting true positions
- Do not add or remove any features
- Apply left/right bias (x ≠ 0 unless perfectly centered)

**Identified Features:**
${JSON.stringify(featureAnalysis, null, 2)}
`;

        const { mainTopperTypes, supportElementTypes } = await getDynamicTypeEnums();

        const coordinateEnrichmentSchema = {
            type: Type.OBJECT,
            properties: {
                main_toppers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: mainTopperTypes },
                            description: { type: Type.STRING },
                            size: { type: Type.STRING, enum: ['small', 'medium', 'large', 'tiny'] },
                            quantity: { type: Type.INTEGER },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'size', 'quantity', 'group_id', 'x', 'y']
                    }
                },
                support_elements: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: supportElementTypes },
                            description: { type: Type.STRING },
                            coverage: { type: Type.STRING, enum: ['large', 'medium', 'small', 'tiny'] },
                            group_id: { type: Type.STRING },
                            color: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'description', 'coverage', 'group_id', 'x', 'y']
                    }
                },
                cake_messages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['gumpaste_letters', 'icing_script', 'printout', 'cardstock'] },
                            text: { type: Type.STRING },
                            position: { type: Type.STRING, enum: ['top', 'side', 'base_board'] },
                            color: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['type', 'text', 'position', 'color', 'x', 'y']
                    }
                },
                icing_design: {
                    type: Type.OBJECT,
                    properties: {
                        base: { type: Type.STRING, enum: ['soft_icing', 'fondant'] },
                        color_type: { type: Type.STRING, enum: ['single', 'gradient_2', 'gradient_3', 'abstract'] },
                        colors: {
                            type: Type.OBJECT,
                            properties: {
                                side: { type: Type.STRING },
                                top: { type: Type.STRING },
                                borderTop: { type: Type.STRING },
                                borderBase: { type: Type.STRING },
                                drip: { type: Type.STRING },
                                gumpasteBaseBoardColor: { type: Type.STRING }
                            }
                        },
                        border_top: { type: Type.BOOLEAN },
                        border_base: { type: Type.BOOLEAN },
                        drip: { type: Type.BOOLEAN },
                        gumpasteBaseBoard: { type: Type.BOOLEAN }
                    },
                    required: ['base', 'color_type', 'colors', 'border_top', 'border_base', 'drip', 'gumpasteBaseBoard']
                },
                cakeType: { type: Type.STRING, enum: CAKE_TYPES },
                cakeThickness: { type: Type.STRING, enum: CAKE_THICKNESSES },
                drip_effects: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                },
                icing_surfaces: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'side'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                icing_borders: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            tier: { type: Type.INTEGER },
                            position: { type: Type.STRING, enum: ['top', 'base'] },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'tier', 'position', 'x', 'y']
                    }
                },
                base_board: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                        },
                        required: ['description', 'x', 'y']
                    }
                }
            },
            required: ['cakeType', 'cakeThickness', 'main_toppers', 'support_elements', 'cake_messages', 'icing_design'],
        };

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64ImageData } },
                    { text: COORDINATE_ENRICHMENT_PROMPT },
                ],
            }],
            config: {
                systemInstruction: "You are a precise coordinate calculator. Update only x,y values, keep all other fields unchanged.",
                responseMimeType: 'application/json',
                responseSchema: coordinateEnrichmentSchema,
                temperature: 0,
            },
        });

        const jsonText = response.text.trim();
        const enrichedResult = JSON.parse(jsonText);

        return enrichedResult as HybridAnalysisResult;

    } catch (error) {
        console.error("Error enriching coordinates:", error);
        // Return original analysis if enrichment fails
        return featureAnalysis;
    }
};

// ============================================================================

export const generateShareableTexts = async (
    analysisResult: HybridAnalysisResult,
    cakeInfo: CakeInfoUI,
    HEX_TO_COLOR_NAME_MAP: Record<string, string>,
    editedImageDataUri?: string | null
): Promise<ShareableTexts> => {
    try {
        const simplifiedAnalysis = {
            cakeType: cakeInfo.type,
            cakeSize: cakeInfo.size,
            main_toppers: analysisResult.main_toppers,
            support_elements: analysisResult.support_elements,
            cake_messages: analysisResult.cake_messages,
            icing_colors: Object.entries(analysisResult.icing_design.colors).map(([key, hex]) => {
                if (typeof hex === 'string') {
                    return { location: key, name: HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || 'Custom Color' };
                }
                return { location: key, name: 'Custom Color' };
            })
        };

        // If we have an edited image, include it in the prompt for more accurate descriptions
        const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];
        
        if (editedImageDataUri) {
            // Extract base64 data from data URI
            const matches = editedImageDataUri.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                parts.push({ inlineData: { mimeType, data: base64Data } });
                parts.push({ text: `This is the FINAL customized cake design that the user created. Use this image to generate the title, description, and alt text. Pay attention to the actual colors, decorations, and text visible in this edited image.\n\n` });
            }
        }
        
        parts.push({ text: SHARE_TEXT_PROMPT });
        parts.push({ text: `\`\`\`json\n${JSON.stringify(simplifiedAnalysis, null, 2)}\n\`\`\`` });

        const response = await getAI().models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: shareableTextResponseSchema,
                temperature: 0.3,
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as ShareableTexts;
    } catch (error) {
        console.error("Error generating shareable texts:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        // Fallback to a basic title in case of error
        return {
            title: `${cakeInfo.size} ${cakeInfo.type} Cake`,
            description: 'A beautifully customized cake design.',
            altText: `A custom ${cakeInfo.type} cake.`,
        };
    }
};

export const editCakeImage = async (
    prompt: string,
    originalImage: { data: string; mimeType: string; },
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    threeTierReferenceImage: { data: string; mimeType: string; } | null,
    systemInstruction: string,
): Promise<string> => {

    const parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];

    // 1. Original Image (Source for style)
    parts.push({ inlineData: { mimeType: originalImage.mimeType, data: originalImage.data } });

    // 2. Reference Image (Source for structure, if provided)
    if (threeTierReferenceImage) {
        parts.push({ inlineData: { mimeType: threeTierReferenceImage.mimeType, data: threeTierReferenceImage.data } });
    }
    
    // 3. Replacement images for printouts, edible photos, and doodles (main toppers)
    mainToppers.forEach(topper => {
        if (topper.isEnabled && (topper.type === 'printout' || topper.type === 'edible_photo' || topper.type === 'icing_doodle') && topper.replacementImage) {
            parts.push({ 
                inlineData: { 
                    mimeType: topper.replacementImage.mimeType, 
                    data: topper.replacementImage.data 
                } 
            });
        }
    });

    // 4. Replacement images for printouts and edible photos (support elements)
    supportElements.forEach(element => {
        if (element.isEnabled && (element.type === 'support_printout' || element.type === 'edible_photo_side') && element.replacementImage) {
            parts.push({ 
                inlineData: { 
                    mimeType: element.replacementImage.mimeType, 
                    data: element.replacementImage.data 
                } 
            });
        }
    });
    
    // 5. Text prompt (last, to provide context for all images)
    parts.push({ text: prompt });

    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
                systemInstruction: systemInstruction,
                temperature: 0.1,
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        const refusalText = response.text?.trim();
        if (refusalText) {
             throw new Error(`The AI could not generate the image. Reason: ${refusalText}`);
        }

        throw new Error("The AI did not return an image. Please try again.");

    } catch (error) {
        console.error("Error editing cake image:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error("The request was blocked due to safety settings. Please modify your instructions and try again.");
        }
        throw error;
    }
};
```

## File: src/services/pricingService.database.ts

```ts
// services/pricingService.database.ts
import { getSupabaseClient } from '../lib/supabase/client';
import type { PricingRule, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, AddOnPricing, CakeType } from '../types';

const supabase = getSupabaseClient();

// Cache pricing rules in memory for 5 minutes
let pricingRulesCache: {
  rules: Map<string, PricingRule[]>;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getPricingRules(): Promise<Map<string, PricingRule[]>> {
  const now = Date.now();

  if (pricingRulesCache && (now - pricingRulesCache.timestamp < CACHE_DURATION)) {
    return pricingRulesCache.rules;
  }

  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch pricing rules:', error);
    if (pricingRulesCache) return pricingRulesCache.rules; // Fallback to stale cache on error
    throw error;
  }

  const rulesMap = new Map<string, PricingRule[]>();
  data.forEach(rule => {
    const existing = rulesMap.get(rule.item_key) || [];
    existing.push(rule);
    rulesMap.set(rule.item_key, existing);
  });

  pricingRulesCache = {
    rules: rulesMap,
    timestamp: now
  };

  return rulesMap;
}

export async function calculatePriceFromDatabase(
  uiState: {
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[],
    cakeMessages: CakeMessageUI[],
    icingDesign: IcingDesignUI,
    cakeInfo: CakeInfoUI,
  }
): Promise<{ addOnPricing: AddOnPricing; itemPrices: Map<string, number> }> {

  const rules = await getPricingRules();

  const { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo } = uiState;

  const breakdown: { item: string; price: number; }[] = [];
  const itemPrices = new Map<string, number>();

  let heroGumpasteTotal = 0;
  let supportGumpasteRawTotal = 0;
  let nonGumpasteTotal = 0;

  const getRule = (
    type: string,
    sizeOrCoverage?: string,
    category?: 'main_topper' | 'support_element' | 'message' | 'icing_feature' | 'special'
  ): PricingRule | undefined => {
    // For support_element and main_topper, ignore category matching - just match type and size/coverage
    const shouldMatchCategory = category && category !== 'support_element' && category !== 'main_topper';

    const findRuleByCategory = (rulesList: PricingRule[] | undefined) => {
      if (!rulesList) return undefined;
      // If we should match category, find by category. Otherwise, just return the first rule.
      return rulesList.find(r => !shouldMatchCategory || r.category === category);
    };

    if (sizeOrCoverage) {
      const specificKey = `${type}_${sizeOrCoverage}`;
      const rule = findRuleByCategory(rules.get(specificKey));
      if (rule) return rule;
    }

    const rule = findRuleByCategory(rules.get(type));

    if (!rule) {
      console.warn(`No pricing rule found for: type="${type}", size/coverage="${sizeOrCoverage}", category="${category}"`);
    }

    return rule;
  };

  const allowanceRule = getRule('gumpaste_allowance', undefined, 'special');
  const GUMPASTE_ALLOWANCE = allowanceRule?.price || 200;

  const extractTierCount = (cakeType: CakeType): number => {
    if (cakeType.includes('3 Tier')) return 3;
    if (cakeType.includes('2 Tier')) return 2;
    return 1;
  };

  // Process Main Toppers
  mainToppers.forEach(topper => {
    if (!topper.isEnabled) {
      itemPrices.set(topper.id, 0);
      return;
    }

    let price = 0;
    const rule = getRule(topper.type, topper.size, 'main_topper');

    if (rule) {
      price = rule.price;

      if (rule.quantity_rule === 'per_piece') {
        price *= topper.quantity;
      } else if (rule.quantity_rule === 'per_3_pieces') {
        price = Math.ceil(topper.quantity / 3) * rule.price;
      } else if (rule.quantity_rule === 'per_digit') {
        const digitCount = (topper.description.match(/\d/g) || []).length || 1;
        price = digitCount * rule.price;
      }

      if (rule.multiplier_rule === 'tier_count') {
        price *= extractTierCount(cakeInfo.type);
      }

      const conditions = rule.special_conditions;
      if (conditions) {
        if (conditions.bento_price && cakeInfo.type === 'Bento') price = conditions.bento_price;
      }

      if (rule.classification === 'hero') {
        heroGumpasteTotal += price;
      } else if (rule.classification === 'support') {
        supportGumpasteRawTotal += price;
      } else {
        nonGumpasteTotal += price;
      }
    }

    itemPrices.set(topper.id, price);
    if (price > 0) breakdown.push({ item: topper.description, price });
  });

  // Process Support Elements
  supportElements.forEach(element => {
    if (!element.isEnabled) {
      itemPrices.set(element.id, 0);
      return;
    }

    let price = 0;
    const rule = getRule(element.type, element.coverage, 'support_element');

    if (rule) {
      price = rule.price;

      if (rule.multiplier_rule === 'tier_count') {
        price *= extractTierCount(cakeInfo.type);
      }

      const conditions = rule.special_conditions;
      if (conditions?.allowance_eligible) {
        supportGumpasteRawTotal += price;
      } else {
        nonGumpasteTotal += price;
      }
    }

    itemPrices.set(element.id, price);
    if (price > 0) breakdown.push({ item: element.description, price });
  });

  // Process Messages
  cakeMessages.forEach(message => {
    let price = 0;
    if (message.isEnabled) {
      const rule = getRule(message.type, undefined, 'message');
      if (rule) {
        price = rule.price;
        const conditions = rule.special_conditions;
        if (conditions?.allowance_eligible) {
          supportGumpasteRawTotal += price;
        } else {
          nonGumpasteTotal += price;
        }
        breakdown.push({ item: `"${message.text}" (${message.type})`, price });
      }
    }
    itemPrices.set(message.id, price);
  });

  // Process Icing Features
  if (icingDesign.drip) {
    const rule = getRule('drip_per_tier', undefined, 'icing_feature');
    if (rule) {
      const dripPrice = rule.price * extractTierCount(cakeInfo.type);
      nonGumpasteTotal += dripPrice;
      breakdown.push({ item: `Drip Effect`, price: dripPrice });
      itemPrices.set('icing_drip', dripPrice);
    }
  } else {
    itemPrices.set('icing_drip', 0);
  }

  if (icingDesign.gumpasteBaseBoard) {
    const rule = getRule('gumpaste_base_board', undefined, 'icing_feature');
    if (rule) {
      const baseBoardPrice = rule.price;
      nonGumpasteTotal += baseBoardPrice;
      breakdown.push({ item: "Gumpaste Covered Base Board", price: baseBoardPrice });
      itemPrices.set('icing_gumpasteBaseBoard', baseBoardPrice);
    }
  } else {
    itemPrices.set('icing_gumpasteBaseBoard', 0);
  }

  // Apply gumpaste allowance
  const allowanceApplied = Math.min(GUMPASTE_ALLOWANCE, supportGumpasteRawTotal);
  const supportGumpasteCharge = Math.max(0, supportGumpasteRawTotal - GUMPASTE_ALLOWANCE);

  if (allowanceApplied > 0) {
    breakdown.push({ item: "Gumpaste Allowance", price: -allowanceApplied });
  }

  const addOnPrice = heroGumpasteTotal + supportGumpasteCharge + nonGumpasteTotal;

  return {
    addOnPricing: { addOnPrice, breakdown },
    itemPrices,
  };
}

export function clearPricingCache() {
  pricingRulesCache = null;
}
```

## File: src/services/xenditService.ts

```ts
import { getSupabaseClient } from '../lib/supabase/client';

const supabase = getSupabaseClient();

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  customerEmail?: string;
  customerName?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface CreatePaymentResponse {
  success: boolean;
  paymentUrl: string;
  invoiceId: string;
  expiresAt: string;
  error?: string;
}

export async function createXenditPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse> {
  try {
    // Get the current session to include auth token
    const { data: { session } } = await supabase.auth.getSession();
    
    // Dynamically construct redirect URLs based on the current domain.
    // This fixes the issue where deployed apps would fail on payment redirects.
    const domain = window.location.origin;
    const successUrl = `${domain}/#/order-confirmation?order_id=${params.orderId}`;
    const failureUrl = `${domain}/#/cart?payment_failed=true&order_id=${params.orderId}`;

    const bodyWithUrls = {
      ...params,
      success_redirect_url: successUrl,
      failure_redirect_url: failureUrl,
    };
    
    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('create-xendit-payment', {
      body: bodyWithUrls,
      headers: session ? {
        Authorization: `Bearer ${session.access_token}`
      } : {}
    });

    if (error) {
      console.error('Error creating Xendit payment:', error);
      throw new Error(error.message || 'Failed to create payment');
    }

    if (!data.success) {
      throw new Error(data.error || 'Payment creation failed');
    }

    return data;
  } catch (error) {
    console.error('createXenditPayment error:', error);
    throw error;
  }
}

export async function getPaymentStatus(orderId: string) {
  try {
    const { data, error } = await supabase
      .from('xendit_payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Gracefully handle not found error which is expected before webhook confirmation
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching payment status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('getPaymentStatus error:', error);
    return null;
  }
}

/**
 * Proactively verifies payment status by invoking a server-side Edge Function.
 * This function asks Xendit for the latest invoice status and updates the DB.
 */
export async function verifyXenditPayment(orderId: string): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke('verify-xendit-payment', {
      body: { orderId },
      headers: session ? {
        Authorization: `Bearer ${session.access_token}`
      } : {}
    });

    if (error) {
      throw new Error(error.message || 'Failed to verify payment status.');
    }

    return data;
  } catch (error) {
    console.error('verifyXenditPayment error:', error);
    // Return an error object so the UI can handle it gracefully without crashing
    return { success: false, error: (error as Error).message };
  }
}
```

## File: src/services/supabaseService.ts

```ts
// services/supabaseService.ts
import { getSupabaseClient } from '../lib/supabase/client';
import { CakeType, BasePriceInfo, CakeThickness, ReportPayload, CartItemDetails, HybridAnalysisResult, AiPrompt, PricingRule, PricingFeedback, AvailabilitySettings } from '../types';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { CakeGenieCartItem, CakeGenieAddress, CakeGenieOrder, CakeGenieOrderItem } from '../lib/database.types';
import { compressImage, validateImageFile } from '../lib/utils/imageOptimization';

const supabase: SupabaseClient = getSupabaseClient();

// Type for service responses
type SupabaseServiceResponse<T> = {
  data: T | null;
  error: Error | PostgrestError | null;
};

// Type for the new shopify_customization_requests table
export interface ShopifyCustomizationRequest {
  session_id: string;
  shopify_product_image_url: string;
  shopify_product_tags: string[];
  shopify_product_title: string;
  shopify_variant_id: string;
  shopify_variant_title: string;
  shopify_base_price: number;
  status: 'pending' | 'completed';
  customized_image_url?: string;
  customization_details?: CartItemDetails;
  created_at: string;
}

// --- New Types for Delivery Date RPCs ---
export interface AvailableDate {
  available_date: string;
  day_of_week: string;
  is_rush_available: boolean;
  is_same_day_available: boolean;
  is_standard_available: boolean;
}

export interface BlockedDateInfo {
    closure_reason: string | null;
    is_all_day: boolean;
    blocked_time_start: string | null;
    blocked_time_end: string | null;
}

// --- Dynamic Config Fetchers ---

export const savePricingFeedback = async (feedback: PricingFeedback): Promise<void> => {
    try {
        const { error } = await supabase
            .from('pricing_feedback')
            .insert([feedback]);
        
        if (error) {
            throw new Error(error.message);
        }
    } catch (err) {
        console.error("Error saving pricing feedback:", err);
        throw new Error("Could not save feedback to the database.");
    }
};


export const getCakeBasePriceOptions = async (
    type: CakeType,
    thickness: CakeThickness
): Promise<BasePriceInfo[]> => {
    try {
        const { data, error } = await supabase
            .from('productsizes_cakegenie')
            .select('cakesize, price, display_order')
            .eq('type', type)
            .eq('thickness', thickness)
            .order('display_order', { ascending: true })
            .order('cakesize', { ascending: true });

        if (error) {
            console.error("Supabase error:", error.message);
            throw new Error(error.message);
        }
        
        if (data && data.length > 0) {
            return data.map(item => ({ size: item.cakesize, price: item.price }));
        }

        // Return empty array instead of throwing error if no options are found
        return [];

    } catch (err) {
        // FIX: Serialize error object to prevent '[object Object]' in logs.
        console.error("Error fetching cake base price options:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        if (err instanceof Error && err.message.includes('not available')) {
            throw err;
        }
        throw new Error("Could not connect to the pricing database.");
    }
};

export const reportCustomization = async (payload: ReportPayload): Promise<void> => {
  try {
    const { error } = await supabase
      .from('cakegenie_reports')
      .insert([payload]);

    if (error) {
      console.error("Supabase report error:", error.message);
      throw new Error(error.message);
    }
  } catch (err) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error("Error reporting customization:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    throw new Error("Could not submit the report to the database.");
  }
};

/**
 * Tracks a search term by calling a Supabase RPC function.
 * This is a "fire-and-forget" operation for analytics.
 * @param term The search term to track.
 */
export async function trackSearchTerm(term: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('track_search', {
      p_term: term.toLowerCase().trim(),
    });

    if (error) {
      // Log the error but don't throw, as this is a non-critical background task.
      console.warn("Supabase search tracking error:", error.message);
    }
  } catch (err) {
    // Also catch network or other unexpected errors.
    console.warn("Error tracking search term:", err);
  }
}

// --- Analysis Cache Functions ---

/**
 * Searches for a similar analysis result in the cache using a perceptual hash.
 * @param pHash The perceptual hash of the new image.
 * @returns The cached analysis JSON if a similar one is found, otherwise null.
 */
export async function findSimilarAnalysisByHash(pHash: string): Promise<HybridAnalysisResult | null> {
  try {
    console.log('🔍 Calling find_similar_analysis RPC with pHash:', pHash);
    const { data, error } = await supabase.rpc('find_similar_analysis', {
      new_hash: pHash,
    });
    
    if (error) {
      console.error('❌ Analysis cache lookup error:', error);
      console.error('Error details:', { code: error.code, message: error.message, hint: error.hint });
      return null;
    }

    if (data) {
      console.log('✅ Cache HIT! Found matching analysis for pHash:', pHash);
    } else {
      console.log('⚫️ Cache MISS. No matching pHash found in database.');
    }
    return data; // Returns the JSONB object or null
  } catch (err) {
    console.error('❌ Exception during analysis cache lookup:', err);
    return null;
  }
}

/**
 * Saves a new AI analysis result to the cache table. This is a fire-and-forget operation.
 * @param pHash The perceptual hash of the image.
 * @param analysisResult The JSON result from the AI analysis.
 * @param imageUrl The public URL of the original image being cached.
 */
export function cacheAnalysisResult(pHash: string, analysisResult: HybridAnalysisResult, imageUrl?: string): void {
  // FIX: Converted to an async IIFE to use try/catch for error handling,
  // as the Supabase query builder is a 'thenable' but may not have a .catch method.
  (async () => {
    try {
      console.log('💾 Attempting to cache analysis result with pHash:', pHash);
      const { error } = await supabase
        .from('cakegenie_analysis_cache')
        .insert({
          p_hash: pHash,
          analysis_json: analysisResult,
          original_image_url: imageUrl,
        });

      if (error) {
        // Log error but don't interrupt the user. A unique constraint violation is expected and fine.
        if (error.code !== '23505') { // 23505 is unique_violation
          console.error('❌ Failed to cache analysis result:', error);
          console.error('Error details:', { code: error.code, message: error.message, hint: error.hint });
        } else {
          console.log('ℹ️ Analysis already cached (duplicate pHash - this is fine).');
        }
      } else {
        console.log('✅ Analysis result cached successfully with pHash:', pHash);
      }
    } catch (err) {
        console.error('❌ Exception during fire-and-forget cache write:', err);
    }
  })();
}


// --- Cart Functions ---

/**
 * Fetches active cart items for a logged-in user or a guest session.
 * @param userId - The UUID of the logged-in user.
 * @param sessionId - The session ID for a guest user.
 * @returns An object containing an array of cart items or an error.
 */
export async function getCartItems(
  userId: string | null,
  sessionId: string | null
): Promise<SupabaseServiceResponse<CakeGenieCartItem[]>> {
  if (!userId && !sessionId) {
    return { data: [], error: null };
  }

  try {
    let query = supabase
      .from('cakegenie_cart')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Adds a new item to the shopping cart.
 * @param params - The details of the cart item to add.
 * @returns An object containing the newly added cart item or an error.
 */
export async function addToCart(
    params: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>
): Promise<SupabaseServiceResponse<CakeGenieCartItem>> {
    try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Item expires in 7 days

        const { data, error } = await supabase
            .from('cakegenie_cart')
            .insert({ ...params, expires_at: expiresAt.toISOString() })
            .select()
            .single();

        if (error) {
            return { data: null, error };
        }
        
        return { data, error: null };
    } catch (err) {
        return { data: null, error: err as Error };
    }
}

/**
 * Updates the quantity of an existing item in the cart.
 * @param cartItemId - The UUID of the cart item to update.
 * @param quantity - The new quantity for the item.
 * @returns An object containing the updated cart item or an error.
 */
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<SupabaseServiceResponse<CakeGenieCartItem>> {
  try {
    if (quantity <= 0) {
      // Let removeCartItem handle deletion
      return { data: null, error: new Error("Quantity must be positive.") };
    }

    const { data, error } = await supabase
      .from('cakegenie_cart')
      .update({ quantity: quantity, updated_at: new Date().toISOString() })
      .eq('cart_item_id', cartItemId)
      .select()
      .single();
      
    if (error) {
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Removes an item from the shopping cart.
 * @param cartItemId - The UUID of the cart item to remove.
 * @returns An object containing an error if the operation failed.
 */
export async function removeCartItem(
  cartItemId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_cart')
      .delete()
      .eq('cart_item_id', cartItemId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// --- Address Functions ---

/**
 * Fetches all addresses for a given user.
 * @param userId The UUID of the user.
 */
export async function getUserAddresses(
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieAddress[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Adds a new address for a user. If setting as default, it will also handle
 * un-setting other addresses for that user.
 * @param userId The UUID of the user.
 * @param addressData The address data to insert.
 */
export async function addAddress(
  userId: string,
  addressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>
): Promise<SupabaseServiceResponse<CakeGenieAddress>> {
  try {
    // If this new address is the default, unset other defaults first
    if (addressData.is_default) {
      const { error: unsetError } = await supabase
        .from('cakegenie_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
      
      if (unsetError) {
        return { data: null, error: unsetError };
      }
    }

    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .insert({ ...addressData, user_id: userId })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Updates an existing address for a user.
 * @param userId The UUID of the user (needed to unset other defaults).
 * @param addressId The UUID of the address to update.
 * @param addressData The new data for the address.
 */
export async function updateAddress(
  userId: string,
  addressId: string,
  addressData: Partial<Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>>
): Promise<SupabaseServiceResponse<CakeGenieAddress>> {
  try {
    // If updating to be the default, unset other defaults for this user first
    if (addressData.is_default) {
      const { error: unsetError } = await supabase
        .from('cakegenie_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .neq('address_id', addressId); // Don't unset the one we're about to set
      
      if (unsetError) {
        return { data: null, error: unsetError };
      }
    }

    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .update({ ...addressData, updated_at: new Date().toISOString() })
      .eq('address_id', addressId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


/**
 * Deletes a user's address.
 * @param addressId The UUID of the address to delete.
 */
export async function deleteAddress(
  addressId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_addresses')
      .delete()
      .eq('address_id', addressId);
    
    if (error) {
      return { data: null, error };
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Sets a specific address as the default for a user using atomic RPC function.
 * @param addressId The UUID of the address to set as default.
 * @param userId The UUID of the user.
 */
export async function setDefaultAddress(
  addressId: string,
  userId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase.rpc('set_default_address', {
      p_user_id: userId,
      p_address_id: addressId
    });
    
    if (error) {
      return { data: null, error };
    }
    
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// --- Order Functions ---

export async function createOrderFromCart(
  params: {
    cartItems: CakeGenieCartItem[];
    eventDate: string;
    eventTime: string;
    deliveryAddressId: string | null;
    deliveryInstructions?: string;
    discountAmount?: number;
    discountCodeId?: string;
  }
): Promise<{ success: boolean, order?: any, error?: Error }> {
  const { cartItems, eventDate, eventTime, deliveryAddressId, deliveryInstructions, discountAmount, discountCodeId } = params;
  
  try {
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // FIX: Fetch the user directly before the operation to ensure the most
    // up-to-date session is used, preventing RLS violations.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error("Authentication error: User session not found.");
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.final_price * item.quantity), 0);
    const deliveryFee = 150; // Fixed delivery fee for now

    // Call the atomic RPC function
    const { data, error } = await supabase.rpc('create_order_from_cart', {
      p_user_id: user.id,
      p_delivery_address_id: deliveryAddressId,
      p_delivery_date: eventDate,
      p_delivery_time_slot: eventTime,
      p_subtotal: subtotal,
      p_delivery_fee: deliveryFee,
      p_delivery_instructions: deliveryInstructions || null,
      p_discount_amount: discountAmount || 0,
      p_discount_code_id: discountCodeId || null,
    });

    if (error) throw error;
    
    // The RPC returns an array with one row
    const orderResult = data[0];
    
    // Fetch the complete order with items for return
    const { data: fullOrder, error: fetchError } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        cakegenie_addresses(*)
      `)
      .eq('order_id', orderResult.order_id)
      .single();
      
    if (fetchError) throw fetchError;

    return { success: true, order: fullOrder };
  } catch (error: any) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error('Error creating order:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    const message = (error && error.message) || 'An unknown error occurred during order creation.';
    return { success: false, error: new Error(message) };
  }
}

export async function getUserOrders(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    includeItems?: boolean;
  }
): Promise<SupabaseServiceResponse<{
  orders: (CakeGenieOrder & { cakegenie_order_items?: any[]; cakegenie_addresses?: any })[];
  totalCount: number;
}>> {
  try {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const includeItems = options?.includeItems ?? true;
    
    // Build the select query. If not including items, fetch item count for efficiency.
    const selectQuery = includeItems
      ? `*, cakegenie_order_items(*), cakegenie_addresses(*)`
      : `*, cakegenie_order_items(count), cakegenie_addresses(*)`;
    
    const { data, error, count } = await supabase
      .from('cakegenie_orders')
      .select(selectQuery, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error };
    }

    return { 
      data: { 
        orders: data || [], 
        totalCount: count || 0 
      }, 
      error: null 
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getSingleOrder(
  orderId: string,
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[], cakegenie_addresses: any }>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        cakegenie_addresses(*)
      `)
      .eq('order_id', orderId)
      .eq('user_id', userId) // Security check to ensure user owns the order
      .single();

    if (error) {
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


export async function uploadPaymentProof(
  orderId: string,
  userId: string,
  file: File
): Promise<SupabaseServiceResponse<CakeGenieOrder>> {
  try {
    // Validate file
    const validation = validateImageFile(file, { maxSizeMB: 10 });
    if (!validation.valid && validation.error) {
      throw new Error(validation.error);
    }

    // Compress image before upload, forcing JPEG format
    console.log('Compressing payment proof image to JPEG...');
    const compressedFile = await compressImage(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 1920,
      fileType: 'image/jpeg',
    });

    const originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const filePath = `${userId}/${orderId}/${uuidv4()}-${originalFileName}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('payments')
      .upload(filePath, compressedFile, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('payments')
      .getPublicUrl(filePath);

    const { data, error: updateError } = await supabase
      .from('cakegenie_orders')
      .update({ payment_proof_url: publicUrl, payment_status: 'verifying' })
      .eq('order_id', orderId)
      .select().single();

    if (updateError) throw updateError;

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Merges anonymous user's cart into authenticated user's cart
 * Called after successful login to preserve items
 */
export async function mergeAnonymousCartToUser(
  anonymousUserId: string,
  realUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.rpc('merge_anonymous_cart_to_user', {
      p_anonymous_user_id: anonymousUserId,
      p_real_user_id: realUserId
    });

    if (error) {
      console.error('Error merging cart:', error);
      return { success: false, error: error.message };
    }

    console.log('Cart merge result:', data);
    return { success: true };
  } catch (error: any) {
    console.error('Exception merging cart:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancels a pending order for a user.
 * @param orderId The UUID of the order to cancel.
 * @param userId The UUID of the user who owns the order.
 */
export async function cancelOrder(
  orderId: string,
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieOrder>> {
  try {
    // FIX: The original rpc(...).select().single() chain is unreliable if the RPC
    // does not return a SETOF table record. A more robust pattern, consistent
    // with createOrderFromCart, is to perform the action and then fetch the result.
    const { error: rpcError } = await supabase.rpc('cancel_order', {
      p_order_id: orderId,
      p_user_id: userId,
    });

    if (rpcError) {
      return { data: null, error: rpcError };
    }
    
    // After a successful cancellation, fetch the updated order to return the full object.
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// --- Shopify Integration Functions ---

/**
 * Fetches a customization request from the shopify_customization_requests table.
 */
export async function getShopifyCustomizationRequest(
  sessionId: string
): Promise<SupabaseServiceResponse<ShopifyCustomizationRequest>> {
  try {
    const { data, error } = await supabase
      .from('shopify_customization_requests')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Updates a Shopify customization request with the final image and details.
 */
export async function updateShopifyCustomizationRequest(
  sessionId: string,
  updates: {
    customized_image_url: string;
    customization_details: CartItemDetails;
  }
): Promise<SupabaseServiceResponse<ShopifyCustomizationRequest>> {
  try {
    const { data, error } = await supabase
      .from('shopify_customization_requests')
      .update({
        ...updates,
        status: 'completed',
      })
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches a list of suggested search keywords from the database.
 * @returns An array of suggested search terms.
 */
export async function getSuggestedKeywords(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_search_analytics')
      .select('search_term')
      .eq('is_suggested', true)
      .limit(8); // A sensible limit for suggestions

    if (error) {
      console.warn("Supabase suggested keywords error:", error.message);
      return []; // Return empty on error, not critical
    }

    // The data is an array of objects like [{ search_term: '...' }], so we map it
    if (Array.isArray(data)) {
      return data.map(item => item.search_term);
    }

    return [];
  } catch (err) {
    console.warn("Error fetching suggested keywords:", err);
    return [];
  }
}

/**
 * Fetches a list of popular search keywords from the database.
 * @returns An array of the most searched terms.
 */
export async function getPopularKeywords(): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_popular_keywords');

    if (error) {
      console.warn("Supabase popular keywords error:", error.message);
      return []; // Return empty on error, not critical
    }

    // The RPC returns an array of objects like [{ search_term: '...' }], so we map it
    if (Array.isArray(data)) {
      return data.map(item => item.search_term);
    }

    return [];
  } catch (err) {
    console.warn("Error fetching popular keywords:", err);
    return [];
  }
}

/**
 * Fetches all necessary data for the cart page in parallel.
 * @param userId - The UUID of the logged-in user.
 * @param sessionId - The session ID for a guest user.
 * @returns An object containing cart items and user addresses, or an error.
 */
export async function getCartPageData(
  userId: string | null,
  sessionId: string | null
): Promise<{ 
  cartData: SupabaseServiceResponse<CakeGenieCartItem[]>, 
  addressesData: SupabaseServiceResponse<CakeGenieAddress[]> 
}> {
  const isAnonymous = !userId && !!sessionId;

  // Use Promise.all to run queries in parallel
  const [cartResult, addressesResult] = await Promise.all([
    getCartItems(userId, sessionId),
    // Only fetch addresses for authenticated (non-anonymous) users
    isAnonymous ? Promise.resolve({ data: [], error: null }) : getUserAddresses(userId!),
  ]);

  return {
    cartData: cartResult,
    addressesData: addressesResult,
  };
}

// --- New Functions for Delivery Date ---
export async function getAvailableDeliveryDates(startDate: string, numDays: number): Promise<AvailableDate[]> {
    const { data, error } = await supabase.rpc('get_available_delivery_dates', {
      start_date: startDate,
      num_days: numDays,
    });
    if (error) {
        console.error("Error fetching available dates:", error);
        throw new Error("Could not fetch available delivery dates.");
    }
    return data || [];
}

export async function getBlockedDatesInRange(startDate: string, endDate: string): Promise<Record<string, BlockedDateInfo[]>> {
    try {
        const { data, error } = await supabase
            .from('blocked_dates')
            .select('blocked_date, closure_reason, is_all_day, blocked_time_start, blocked_time_end')
            .gte('blocked_date', startDate)
            .lte('blocked_date', endDate)
            .eq('is_active', true);

        if (error) {
            throw error;
        }

        const groupedByDate: Record<string, BlockedDateInfo[]> = {};
        (data || []).forEach(row => {
            const date = row.blocked_date;
            if (!groupedByDate[date]) {
                groupedByDate[date] = [];
            }
            groupedByDate[date].push({
                closure_reason: row.closure_reason,
                is_all_day: row.is_all_day,
                blocked_time_start: row.blocked_time_start,
                blocked_time_end: row.blocked_time_end,
            });
        });

        return groupedByDate;

    } catch(err) {
        const error = err as PostgrestError;
        console.error("Error in getBlockedDatesInRange:", error);
        throw new Error("Could not verify date availability.");
    }
}


export async function getAvailabilitySettings(): Promise<SupabaseServiceResponse<AvailabilitySettings>> {
  try {
    const { data, error } = await supabase
      .from('availability_settings')
      .select('*')
      .eq('setting_id', '00000000-0000-0000-0000-000000000001')
      .single();
    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches all bill-sharing designs created by a user.
 * @param userId The UUID of the user.
 */
export async function getBillSharingCreations(userId: string): Promise<SupabaseServiceResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('*, contributions:bill_contributions(amount, status)')
      .eq('created_by_user_id', userId)
      .eq('bill_sharing_enabled', true)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
```

## File: src/services/geminiService.lazy.ts

```ts
// Lazy load the heavy Gemini service
import type * as GeminiService from './geminiService';

export const loadGeminiService = async (): Promise<typeof GeminiService> => {
  const module = await import('./geminiService');
  return module;
};

// Export wrapper functions that lazy load
export const editCakeImage = async (...args: Parameters<typeof GeminiService.editCakeImage>) => {
  const { editCakeImage: fn } = await loadGeminiService();
  return fn(...args);
};

export const analyzeCakeImage = async (...args: Parameters<typeof GeminiService.analyzeCakeImage>) => {
  const { analyzeCakeImage: fn } = await loadGeminiService();
  return fn(...args);
};

export const validateCakeImage = async (...args: Parameters<typeof GeminiService.validateCakeImage>) => {
  const { validateCakeImage: fn } = await loadGeminiService();
  return fn(...args);
};

export const fileToBase64 = async (...args: Parameters<typeof GeminiService.fileToBase64>) => {
  const { fileToBase64: fn } = await loadGeminiService();
  return fn(...args);
};

export const generateShareableTexts = async (...args: Parameters<typeof GeminiService.generateShareableTexts>) => {
  const { generateShareableTexts: fn } = await loadGeminiService();
  return fn(...args);
};

export const analyzeCakeFeaturesOnly = async (...args: Parameters<typeof GeminiService.analyzeCakeFeaturesOnly>) => {
  const { analyzeCakeFeaturesOnly: fn } = await loadGeminiService();
  return fn(...args);
};

export const enrichAnalysisWithCoordinates = async (...args: Parameters<typeof GeminiService.enrichAnalysisWithCoordinates>) => {
  const { enrichAnalysisWithCoordinates: fn } = await loadGeminiService();
  return fn(...args);
};
```

