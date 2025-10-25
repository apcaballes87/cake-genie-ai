
import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { FeatureList } from '../../components/FeatureList';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { MagicSparkleIcon, ErrorIcon, ImageIcon, ResetIcon, SaveIcon, CartIcon, BackIcon, ReportIcon, UserCircleIcon, LogOutIcon, Loader2, MapPinIcon, PackageIcon } from '../../components/icons';
import { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, BasePriceInfo, CakeType } from '../../types';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';

// Determine cake availability based on design complexity
type AvailabilityType = 'rush' | 'same-day' | 'normal';

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

function calculateAvailability(
  cakeInfo: CakeInfoUI | null,
  mainToppers: MainTopperUI[],
  supportElements: SupportElementUI[],
  icingDesign: IcingDesignUI | null
): AvailabilityInfo {
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
      time: 'Requires 2 days lead time',
      icon: '📅',
      description: 'Complex or large designs need time for perfection!',
      bgColor: 'bg-slate-50',
      textColor: 'text-slate-800',
      borderColor: 'border-slate-300'
    }
  };

  if (!cakeInfo || !icingDesign) {
    return AVAILABILITY_MAP.normal;
  }

  // --- Step 1: Check for Absolute "Standard Order" Overrides ---
  const complexTypes: CakeType[] = ['2 Tier', '3 Tier', '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant', 'Square', 'Rectangle'];
  if (complexTypes.includes(cakeInfo.type) || icingDesign.base === 'fondant') {
    return AVAILABILITY_MAP.normal;
  }

  const has3dTopper = mainToppers.some(t => t.isEnabled && t.type === 'edible_3d');
  const hasGumpasteBase = icingDesign.gumpasteBaseBoard;

  if (has3dTopper || hasGumpasteBase) {
    return AVAILABILITY_MAP.normal;
  }

  // --- Step 2: Check for Fast-Track Eligibility ---
  const isFastTrackEligible =
      (cakeInfo.type === '1 Tier' && (cakeInfo.size === '6" Round' || cakeInfo.size === '8" Round')) ||
      (cakeInfo.type === 'Bento');

  if (!isFastTrackEligible) {
    return AVAILABILITY_MAP.normal;
  }

  // --- Step 3: Classify as Same-Day or Rush ---
  const smallGumpasteCount = supportElements.filter(s => s.isEnabled && s.type === 'small_gumpaste').length;
  const hasGumpastePanels = supportElements.some(s => s.isEnabled && s.type === 'gumpaste_panel');
  const hasEdiblePhoto =
      mainToppers.some(t => t.isEnabled && t.type === 'edible_photo') ||
      supportElements.some(s => s.isEnabled && s.type === 'edible_photo_side');

  if (hasGumpastePanels || hasEdiblePhoto || smallGumpasteCount >= 2) {
    return AVAILABILITY_MAP['same-day'];
  }

  // If it passes all checks, it's a Rush order.
  return AVAILABILITY_MAP.rush;
}


type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation';
type ImageTab = 'original' | 'customized';

interface CustomizingPageProps {
  onClose: () => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  onSearch: () => void;
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
  setIsMainZoomModalOpen: (isOpen: boolean) => void;
  setIsMainImageVisible: Dispatch<SetStateAction<boolean>>;
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
  onMainTopperChange: (toppers: MainTopperUI[]) => void;
  onSupportElementChange: (elements: SupportElementUI[]) => void;
  onCakeMessageChange: (messages: CakeMessageUI[]) => void;
  onIcingDesignChange: (design: IcingDesignUI) => void;
  onAdditionalInstructionsChange: (instructions: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => void;
  onSupportElementImageReplace: (elementId: string, file: File) => void;
  onSave: () => void;
  isSaving: boolean;
  onClearAll: () => void;
  error: string | null;
  isCustomizationDirty: boolean;
}


const CustomizingPage: React.FC<CustomizingPageProps> = ({
    onClose,
    searchInput, setSearchInput, onSearch,
    setAppState, itemCount, isAuthenticated, isAccountMenuOpen, setIsAccountMenuOpen, accountMenuRef, user, onSignOut,
    onOpenReportModal, editedImage, isLoading, isUpdatingDesign, isReporting, reportStatus, mainImageContainerRef, isCustomizationDirty,
    activeTab, setActiveTab, originalImagePreview, isAnalyzing, setIsMainZoomModalOpen, setIsMainImageVisible, originalImageData,
    onUpdateDesign, analysisResult, analysisError, analysisId, cakeInfo, basePriceOptions,
    mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions,
    onCakeInfoChange, onMainTopperChange, onSupportElementChange, onCakeMessageChange, onIcingDesignChange,
    onAdditionalInstructionsChange, onTopperImageReplace, onSupportElementImageReplace, onSave, isSaving, onClearAll, error
}) => {
    
  // Availability state
  const [availability, setAvailability] = useState<AvailabilityInfo>({
    type: 'normal',
    label: 'Standard Order',
    time: 'Requires 2 days lead time',
    icon: '📅',
    description: 'Hand-crafted designs need time for perfection!',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-800',
    borderColor: 'border-slate-300'
  });

  // Update availability when design changes
  useEffect(() => {
    if (analysisResult && cakeInfo && icingDesign) {
      console.log('🔍 Availability Check:', {
        cakeType: cakeInfo.type,
        cakeSize: cakeInfo.size,
        cakeThickness: cakeInfo.thickness,
        icingBase: icingDesign.base,
        hasDrip: icingDesign.drip,
        hasGumpaste: icingDesign.gumpasteBaseBoard,
        has3D: mainToppers.some(t => t.isEnabled && t.type === 'edible_3d'),
        mainToppers: mainToppers.filter(t => t.isEnabled).length,
        supportElements: supportElements.filter(s => s.isEnabled).length
      });
      
      const newAvailability = calculateAvailability(
        cakeInfo,
        mainToppers,
        supportElements,
        icingDesign
      );
      
      console.log('✅ Result:', newAvailability.type);
      setAvailability(newAvailability);
    }
  }, [mainToppers, supportElements, icingDesign, analysisResult, cakeInfo]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainImageVisible(entry.isIntersecting);
      },
      {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1, // considered "out of view" if less than 10% is visible
      }
    );

    const currentRef = mainImageContainerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [mainImageContainerRef, setIsMainImageVisible]);

  const handleCustomizedTabClick = () => {
    if (isCustomizationDirty) {
      onUpdateDesign();
    } else {
      setActiveTab('customized');
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-6xl mx-auto pb-28"> {/* Added padding-bottom */}
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
                       <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-fade-in">
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
           className="w-full max-w-4xl text-center bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm font-semibold px-4 py-2 rounded-xl shadow-sm mt-[18px] transition-colors hover:bg-yellow-200 disabled:bg-yellow-100/50 disabled:text-yellow-600 disabled:cursor-not-allowed disabled:hover:bg-yellow-100"
       >
           ALPHA TEST: Features are experimental. Click here to report any issues.
       </button>
       {isReporting && reportStatus === null && (
           <div className="w-full max-w-4xl flex items-center justify-center text-sm font-semibold p-2 rounded-xl animate-fade-in bg-blue-100 text-blue-700">
               <Loader2 className="animate-spin mr-2 w-4 h-4" />
               Submitting your report... Thank you!
           </div>
       )}
       {reportStatus && (
           <div className={`w-full max-w-4xl text-center text-sm font-semibold p-2 rounded-xl animate-fade-in ${reportStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
               {reportStatus === 'success' ? 'Report submitted successfully. Thank you for your feedback!' : 'Failed to submit report. Please try again.'}
           </div>
       )}
       <div ref={mainImageContainerRef} className="w-full max-w-4xl h-[550px] bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
           <div className="p-2 flex-shrink-0">
               <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                   <button onClick={() => setActiveTab('original')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50'}`}>Original</button>
                   <button onClick={handleCustomizedTabClick} disabled={(!editedImage && !isCustomizationDirty) || isUpdatingDesign} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'}`}>Customized</button>
               </div>
           </div>
           <div className="relative flex-grow flex items-center justify-center p-2 pt-0 min-h-0">
               {isLoading && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20"><LoadingSpinner /><p className="mt-4 text-slate-500 font-semibold">Working magic...</p></div>}
               {error && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20 p-4"><ErrorIcon /><p className="mt-4 font-semibold text-red-600">Update Failed</p><p className="text-sm text-red-500 text-center">{error}</p></div>}
               {!originalImagePreview && !isAnalyzing && <div className="text-center text-slate-400"><ImageIcon /><p className="mt-2 font-semibold">Your creation will appear here</p></div>}
               {(originalImagePreview) && (
                 <button
                   type="button"
                   onClick={() => setIsMainZoomModalOpen(true)}
                   className="w-full h-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-lg secure-image-container"
                   aria-label="Enlarge image"
                   onContextMenu={(e) => e.preventDefault()}
                 >
                   <img key={activeTab} src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview} alt={activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"} className="w-full h-full object-contain rounded-lg"/>
                 </button>
               )}
           </div>
       </div>

       {originalImageData && (
         <div className="w-full max-w-4xl space-y-3">
           <button
             onClick={onUpdateDesign}
             disabled={isUpdatingDesign || !originalImageData}
             className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-4 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center text-lg"
           >
             {isUpdatingDesign ? (
               <>
                 <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                 Updating Design...
               </>
             ) : (
               <>
                 <MagicSparkleIcon />
                 Update Design
               </>
             )}
           </button>
            {isAnalyzing && (
                <div className="w-full max-w-4xl text-center animate-fade-in">
                    <div className="w-full bg-slate-200 rounded-full h-2.5 relative overflow-hidden">
                       <div className="absolute h-full w-1/2 bg-gradient-to-r from-pink-500 to-purple-600 animate-progress-slide"></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 font-medium">Analyzing design elements & pricing... You can start customizing below.</p>
                </div>
            )}
         </div>
       )}
       
       {/* Cake Availability Banner */}
        {analysisResult && cakeInfo && icingDesign && (
            <div className={`w-full max-w-4xl p-4 rounded-xl border-2 flex items-start gap-4 transition-all duration-300 animate-fade-in ${availability.bgColor} ${availability.borderColor}`}>
                {/* Icon */}
                <div className="text-3xl flex-shrink-0 mt-1">
                    {availability.icon}
                </div>
                
                {/* Content */}
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
                    
                    {/* Additional info based on type */}
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
        )}

       <div className="w-full max-w-4xl bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200">
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
                   onMainTopperChange={onMainTopperChange}
                   onSupportElementChange={onSupportElementChange}
                   onCakeMessageChange={onCakeMessageChange}
                   onIcingDesignChange={onIcingDesignChange}
                   onAdditionalInstructionsChange={onAdditionalInstructionsChange}
                   onTopperImageReplace={onTopperImageReplace}
                   onSupportElementImageReplace={onSupportElementImageReplace}
                   isAnalyzing={isAnalyzing}
               />
           ) : <div className="text-center p-8 text-slate-500"><p>Upload an image to get started.</p></div>}
       </div>

       {originalImageData && (
         <div className="w-full max-w-4xl flex flex-col items-center gap-3">
           <div className="w-full flex items-center justify-end gap-4">
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
    </div>
   );
};

export default React.memo(CustomizingPage);
