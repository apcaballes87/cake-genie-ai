



import React, { Dispatch, SetStateAction, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { FeatureList } from '../../components/FeatureList';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { MagicSparkleIcon, ErrorIcon, ImageIcon, ResetIcon, SaveIcon, CartIcon, BackIcon, ReportIcon, UserCircleIcon, LogOutIcon, Loader2, MapPinIcon, PackageIcon, SideIcingGuideIcon, TopIcingGuideIcon, TopBorderGuideIcon, BaseBorderGuideIcon, BaseBoardGuideIcon } from '../../components/icons';
import { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, BasePriceInfo, CakeType } from '../../types';
import { SearchAutocomplete } from '../../components/SearchAutocomplete';
import { AvailabilityType } from '../../lib/utils/availability';
import { FloatingResultPanel } from '../../components/FloatingResultPanel';
import { useAvailabilitySettings, getAvailabilityTimeMessage } from '../../hooks/useAvailabilitySettings';

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
  ({ id: string; description: string; x?: number; y?: number; cakeType?: CakeType } & { itemCategory: 'icing' });

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
  onCakeMessageChange: (messages: CakeMessageUI[]) => void;
}

const IcingToolbar: React.FC<{ onSelectItem: (item: AnalysisItem) => void; icingDesign: IcingDesignUI; cakeType: CakeType; isVisible: boolean }> = ({ onSelectItem, icingDesign, cakeType, isVisible }) => {
    const isBento = cakeType === 'Bento';
    const tools = [
        { id: 'drip', description: 'Drip Effect', icon: <img src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/dripeffect.webp" alt="Drip effect" />, featureFlag: icingDesign.drip },
        { id: 'borderTop', description: 'Top Border', icon: <TopBorderGuideIcon />, featureFlag: icingDesign.border_top },
        { id: 'borderBase', description: 'Base Border', icon: <BaseBorderGuideIcon />, featureFlag: icingDesign.border_base, disabled: isBento },
        { id: 'top', description: 'Top Icing Color', icon: <TopIcingGuideIcon />, featureFlag: !!icingDesign.colors.top },
        { id: 'side', description: 'Side Icing Color', icon: <SideIcingGuideIcon />, featureFlag: !!icingDesign.colors.side },
        { id: 'gumpasteBaseBoard', description: 'Gumpaste Covered Board', icon: <BaseBoardGuideIcon />, featureFlag: icingDesign.gumpasteBaseBoard, disabled: isBento },
    ];
    
    return (
        <div className={`absolute top-1/2 -translate-y-1/2 left-4 z-10 flex flex-col gap-2 transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {tools.map(tool => (
                <button 
                    key={tool.id} 
                    onClick={() => !tool.disabled && onSelectItem({ id: `icing-edit-${tool.id}`, itemCategory: 'icing', description: tool.description, cakeType: cakeType })}
                    className={`relative w-10 h-10 p-1.5 rounded-full hover:bg-purple-100 transition-colors group bg-white/80 backdrop-blur-md border border-slate-200 shadow-md ${tool.featureFlag ? 'ring-2 ring-purple-500 ring-offset-2' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
                    disabled={tool.disabled}
                >
                    {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-full h-full object-contain' })}
                    {tool.disabled && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                            <X className="w-5 h-5 text-white" />
                         </div>
                    )}
                    <span className="icing-toolbar-tooltip">{tool.description}</span>
                </button>
            ))}
        </div>
    );
};


const CustomizingPage: React.FC<CustomizingPageProps> = ({
    onClose,
    searchInput, setSearchInput, onSearch,
    setAppState, itemCount, isAuthenticated, isAccountMenuOpen, setIsAccountMenuOpen, accountMenuRef, user, onSignOut,
    onOpenReportModal, editedImage, isLoading, isUpdatingDesign, isReporting, reportStatus, mainImageContainerRef, isCustomizationDirty,
    activeTab, setActiveTab, originalImagePreview, isAnalyzing, setIsMainZoomModalOpen, originalImageData,
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
}) => {
    const { settings: availabilitySettings } = useAvailabilitySettings();

    // Generate dynamic availability info based on Supabase settings
    const availability: AvailabilityInfo = useMemo(() => {
        const baseInfo = AVAILABILITY_MAP[availabilityType];
        return {
            ...baseInfo,
            time: getAvailabilityTimeMessage(availabilityType, availabilitySettings)
        };
    }, [availabilityType, availabilitySettings]);
  const [areHelpersVisible, setAreHelpersVisible] = useState(true);
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ClusteredMarker | null>(null);
  const [selectedItem, setSelectedItem] = useState<ClusteredMarker | null>(null);
  const cakeBaseSectionRef = useRef<HTMLDivElement>(null);
  const markerContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{width: number, height: number} | null>(null);

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

  useEffect(() => {
    setOriginalImageDimensions(null);
  }, [originalImagePreview]);

  const isAdmin = useMemo(() => user?.email === 'apcaballes@gmail.com', [user]);

  const handleScrollToCakeBase = () => {
    cakeBaseSectionRef.current?.scrollIntoView({
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

  const rawMarkers = useMemo(() => {
    return analysisItems.filter(item => typeof item.x === 'number' && typeof item.y === 'number');
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

    const imageAspectRatio = imageWidth / imageHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let renderedWidth, renderedHeight, offsetX, offsetY;

    if (imageAspectRatio > containerAspectRatio) {
        renderedWidth = containerWidth;
        renderedHeight = containerWidth / imageAspectRatio;
        offsetX = 0;
        offsetY = (containerHeight - renderedHeight) / 2;
    } else {
        renderedHeight = containerHeight;
        renderedWidth = containerHeight * imageAspectRatio;
        offsetY = 0;
        offsetX = (containerWidth - renderedWidth) / 2;
    }

    const markerXPercent = (x + imageWidth / 2) / imageWidth;
    const markerYPercent = (-y + imageHeight / 2) / imageHeight;
    
    const markerX = (markerXPercent * renderedWidth) + offsetX;
    const markerY = (markerYPercent * renderedHeight) + offsetY;

    return { left: `${markerX}px`, top: `${markerY}px`, leftPx: markerX, topPx: markerY };
  }, [originalImageDimensions, containerDimensions]);

  const clusteredMarkers = useMemo((): ClusteredMarker[] => {
    const MIN_DISTANCE = 30; // Minimum pixel distance between markers
    
    // FIX: Add a guard clause to ensure all necessary data (markers, image dimensions, and container dimensions)
    // is available before attempting to calculate marker positions. This prevents a race condition on initial load.
    if (rawMarkers.length === 0 || !containerDimensions || !originalImageDimensions) {
        return [];
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
       <div ref={mainImageContainerRef} className="w-full max-w-4xl bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
            <div className="p-2 flex-shrink-0">
                <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                   <button onClick={() => setActiveTab('original')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50'}`}>Original</button>
                   <button onClick={handleCustomizedTabClick} disabled={(!editedImage && !isCustomizationDirty) || isUpdatingDesign} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'}`}>Customized</button>
                </div>
           </div>
           <div className="relative flex items-center justify-center p-2 pt-0">
               {isUpdatingDesign && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20"><LoadingSpinner /><p className="mt-4 text-slate-500 font-semibold">Working magic...</p></div>}
               {error && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20 p-4"><ErrorIcon /><p className="mt-4 font-semibold text-red-600">Update Failed</p><p className="text-sm text-red-500 text-center">{error}</p></div>}
               {!originalImagePreview && !isAnalyzing && <div className="text-center text-slate-400 py-16"><ImageIcon /><p className="mt-2 font-semibold">Your creation will appear here</p></div>}
               {(originalImagePreview) && (
                 <div
                   ref={markerContainerRef}
                   className="relative w-full flex items-center justify-center rounded-lg"
                   onContextMenu={(e) => e.preventDefault()}
                 >
                   {icingDesign && cakeInfo && (
                        <IcingToolbar 
                            onSelectItem={setSelectedItem} 
                            icingDesign={icingDesign} 
                            cakeType={cakeInfo.type} 
                            isVisible={areHelpersVisible}
                        />
                    )}
                   <img
                    onLoad={(e) => {
                        const img = e.currentTarget;
                        const container = markerContainerRef.current;
                        if (originalImagePreview && img.src === originalImagePreview && container) {
                            setOriginalImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                            // Set container dimensions at the same time to avoid race condition
                            setContainerDimensions({ width: container.clientWidth, height: container.clientHeight });
                        }
                    }}
                    key={activeTab} 
                    src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview} 
                    alt={activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"} 
                    className="w-full max-h-[550px] object-contain rounded-lg"
                   />
                   <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleScrollToCakeBase();
                        }}
                        className="absolute top-3 right-3 z-10 bg-black/40 backdrop-blur-sm text-white rounded-full text-xs font-semibold hover:bg-black/60 transition-all shadow-md px-3 py-1.5"
                        aria-label="Scroll to cake options"
                    >
                        Cake Options
                    </button>
                    {originalImageDimensions && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setAreHelpersVisible(prev => !prev);
                            }}
                            className="absolute bottom-3 right-3 z-10 bg-black/40 backdrop-blur-sm text-white rounded-full text-xs font-semibold hover:bg-black/60 transition-all shadow-md px-3 py-1.5"
                            aria-label={areHelpersVisible ? "Hide design helpers" : "Show design helpers"}
                        >
                            {areHelpersVisible ? 'Hide Helpers' : 'Show Helpers'}
                        </button>
                    )}
                   {originalImageDimensions && containerDimensions && containerDimensions.height > 0 && areHelpersVisible && clusteredMarkers.map((item) => {
                      if(item.x === undefined || item.y === undefined) return null;
                      const position = getMarkerPosition(item.x, item.y);
                      const isSelected = selectedItem?.id === item.id;
                      const isCluster = 'isCluster' in item && item.isCluster;

                      return (
                        <div
                          key={item.id}
                          className={`analysis-marker ${isSelected ? 'selected' : ''}`}
                          style={{ top: position.top, left: position.left }}
                          onMouseEnter={() => setHoveredItem(item)}
                          onMouseLeave={() => setHoveredItem(null)}
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(prev => prev?.id === item.id ? null : item)}}
                        >
                          <div className="marker-dot">
                            {isCluster ? item.items.length : markerMap.get(item.id)}
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
       
       {analysisResult && cakeInfo && icingDesign && (
            <div className={`w-full max-w-4xl p-4 rounded-xl border-2 flex items-start gap-4 transition-all duration-300 animate-fade-in ${availability.bgColor} ${availability.borderColor}`}>
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
                   updateMainTopper={updateMainTopper}
                   removeMainTopper={removeMainTopper}
                   updateSupportElement={updateSupportElement}
                   removeSupportElement={removeSupportElement}
                   updateCakeMessage={updateCakeMessage}
                   removeCakeMessage={removeCakeMessage}
                   onIcingDesignChange={onIcingDesignChange}
                   onAdditionalInstructionsChange={onAdditionalInstructionsChange}
                   onTopperImageReplace={onTopperImageReplace}
                   onSupportElementImageReplace={onSupportElementImageReplace}
                   isAnalyzing={isAnalyzing}
                   itemPrices={itemPrices}
                   user={user}
                   cakeBaseSectionRef={cakeBaseSectionRef}
                   onItemClick={handleListItemClick}
                   markerMap={markerMap}
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
            onCakeMessageChange={onCakeMessageChange}
            icingDesign={icingDesign}
            onIcingDesignChange={onIcingDesignChange}
            analysisResult={analysisResult}
            itemPrices={itemPrices}
            isAdmin={isAdmin}
        />
    </div>
   );
};

export default React.memo(CustomizingPage);