

import React, { Dispatch, SetStateAction, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, Wand2 } from 'lucide-react';
import { FeatureList } from '../../components/FeatureList';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { MagicSparkleIcon, ErrorIcon, ImageIcon, ResetIcon, SaveIcon, CartIcon, BackIcon, ReportIcon, UserCircleIcon, LogOutIcon, Loader2, MapPinIcon, PackageIcon, SideIcingGuideIcon, TopIcingGuideIcon, TopBorderGuideIcon, BaseBorderGuideIcon, BaseBoardGuideIcon } from '../../components/icons';
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

export type AnalysisItem =
  (MainTopperUI & { itemCategory: 'topper' }) |
  (SupportElementUI & { itemCategory: 'element' }) |
  (CakeMessageUI & { itemCategory: 'message' }) |
  ({ id: string; description: string; x?: number; y?: number; cakeType?: CakeType } & { itemCategory: 'icing' }) |
  ({ id: string; description: string; x?: number; y?: number; } & { itemCategory: 'action' });

// Add a type for clustered markers
// FIX: Changed `isCluster?: false` to `isCluster: false` to make this a proper discriminated union.
// This allows TypeScript to correctly narrow the type when checking `item.isCluster`.
export type ClusteredMarker = {
    id: string;
    x: number;
    y: number;
    isCluster: true;
    items: AnalysisItem[];
} | (AnalysisItem & { isCluster: false });

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
  onCakeMessageChange: (messages: CakeMessageUI[]) => void;
  onAdditionalInstructionsChange: (instructions: string) => void;
  onTopperImageReplace: (topperId: string, file: File) => Promise<void>;
  onSupportElementImageReplace: (elementId: string, file: File) => Promise<void>;
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
}

const IcingToolbar: React.FC<{ onSelectItem: (item: AnalysisItem) => void; icingDesign: IcingDesignUI; cakeType: CakeType; isVisible: boolean; highlightedItemId: string | null; }> = ({ onSelectItem, icingDesign, cakeType, isVisible, highlightedItemId }) => {
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
            {tools.map(tool => {
                const isHighlighted = tool.id === highlightedItemId;
                return (
                    <button 
                        key={tool.id} 
                        onClick={() => !tool.disabled && onSelectItem({ id: `icing-edit-${tool.id}`, itemCategory: 'icing', description: tool.description, cakeType: cakeType })}
                        className={`relative group w-10 h-10 p-1.5 rounded-full hover:bg-purple-100 transition-colors bg-white/80 backdrop-blur-md border border-slate-200 shadow-md ${tool.featureFlag ? 'ring-2 ring-purple-500 ring-offset-2' : ''} disabled:opacity-40 disabled:cursor-not-allowed ${isHighlighted ? 'highlight-tour' : ''}`}
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
                )
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
  const [editedImageDimensions, setEditedImageDimensions] = useState<{ width: number, height: number } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ClusteredMarker | null>(null);
  const [selectedItem, setSelectedItem] = useState<AnalysisItem | AnalysisItem[] | null>(null);
  const cakeBaseSectionRef = useRef<HTMLDivElement>(null);
  const markerContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{width: number, height: number} | null>(null);
  const [isMotifPanelOpen, setIsMotifPanelOpen] = useState(false);
  const [dynamicLoadingMessage, setDynamicLoadingMessage] = useState<string>('');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [highlightedTool, setHighlightedTool] = useState<string | null>(null);
  const tourShownForCurrentImage = useRef<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
        setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

    // Effect for Icing Toolbar tour
    useEffect(() => {
        // Trigger tour when an image is loaded and the tour hasn't been shown for this session
        if (originalImagePreview && !tourShownForCurrentImage.current && areHelpersVisible) {
            tourShownForCurrentImage.current = true; // Mark as shown for this session

            const tools = ['drip', 'borderTop', 'borderBase', 'top', 'side', 'gumpasteBaseBoard'];
            const timeouts: ReturnType<typeof setTimeout>[] = [];

            // Start the tour after a 1-second delay
            const initialDelay = setTimeout(() => {
                tools.forEach((toolId, index) => {
                    timeouts.push(setTimeout(() => {
                        setHighlightedTool(toolId);
                    }, index * 600)); // Stagger each highlight (50% faster)

                    timeouts.push(setTimeout(() => {
                        setHighlightedTool(currentTool => currentTool === toolId ? null : currentTool);
                    }, index * 600 + 550)); // Duration of highlight (50% faster)
                });
            }, 1000); // User-requested 1-second delay

            timeouts.push(initialDelay);

            return () => {
                timeouts.forEach(clearTimeout);
            };
        }
        // If the image is cleared, reset the tour flag so it can run on the next upload
        if (!originalImagePreview) {
            tourShownForCurrentImage.current = false;
        }
    }, [originalImagePreview, areHelpersVisible]);

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
        const colorValue = newIcingColors[key];
        if (typeof colorValue === 'string' && colorValue.toLowerCase() === oldHex) {
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
  }, [mainImageContainerRef]);

  const handleMarkerClick = useCallback((marker: ClusteredMarker) => {
      if (marker.isCluster) {
          setSelectedItem(marker.items);
      } else {
          // Explicitly cast to AnalysisItem to ensure type correctness in the non-cluster branch
          setSelectedItem(marker as AnalysisItem);
      }
      mainImageContainerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
      });
  }, [mainImageContainerRef]);

  const isAdmin = useMemo(() => user?.email === 'apcaballes@gmail.com', [user]);

  const handleScrollToCakeBase = () => {
    cakeBaseSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const analysisItems = useMemo<AnalysisItem[]>(() => {
    const toppers: AnalysisItem[] = mainToppers.map(t => ({ ...t, itemCategory: 'topper' }));
    const elements: AnalysisItem[] = supportElements.map(e => ({ ...e, itemCategory: 'element' }));
    const messages: AnalysisItem[] = cakeMessages.map(m => ({ ...m, itemCategory: 'message' }));
    return [...toppers, ...elements, ...messages];
  }, [mainToppers, supportElements, cakeMessages]);
  
  const markerMap = useMemo(() => {
    const map = new Map<string, string>();
    analysisItems.forEach((item, index) => {
        map.set(item.id, (index + 1).toString());
    });
    return map;
  }, [analysisItems]);

  const clusteredMarkers = useMemo<ClusteredMarker[]>(() => {
    const itemsWithCoords = analysisItems.filter(item => typeof item.x === 'number' && typeof item.y === 'number');
    const clusters: { x: number; y: number; items: AnalysisItem[] }[] = [];
    const CLUSTER_RADIUS = 20; // Pixel radius for clustering

    for (const item of itemsWithCoords) {
        let foundCluster = false;
        for (const cluster of clusters) {
            const distance = Math.sqrt(Math.pow(item.x! - cluster.x, 2) + Math.pow(item.y! - cluster.y, 2));
            if (distance < CLUSTER_RADIUS) {
                cluster.items.push(item);
                // Simple average for new center, can be improved
                cluster.x = (cluster.x * (cluster.items.length - 1) + item.x!) / cluster.items.length;
                cluster.y = (cluster.y * (cluster.items.length - 1) + item.y!) / cluster.items.length;
                foundCluster = true;
                break;
            }
        }
        if (!foundCluster) {
            clusters.push({ x: item.x!, y: item.y!, items: [item] });
        }
    }
    
    return clusters.map(cluster => {
        if (cluster.items.length > 1) {
            return {
                id: `cluster-${cluster.items.map(i => i.id).join('-')}`,
                x: cluster.x,
                y: cluster.y,
                isCluster: true,
                items: cluster.items
            };
        }
        return { ...cluster.items[0], isCluster: false }; // Not a cluster, just a single item
    });
  }, [analysisItems]);

  const calculateMarkerPosition = (x: number, y: number) => {
    if (!containerDimensions || (!originalImageDimensions && !editedImageDimensions)) return { left: '50%', top: '50%' };

    const imageDimensions = (activeTab === 'customized' && editedImageDimensions) ? editedImageDimensions : originalImageDimensions;
    if (!imageDimensions) return { left: '50%', top: '50%' };
    
    const scaleX = containerDimensions.width / imageDimensions.width;
    const scaleY = containerDimensions.height / imageDimensions.height;
    const scale = Math.min(scaleX, scaleY);
    
    const scaledWidth = imageDimensions.width * scale;
    const scaledHeight = imageDimensions.height * scale;
    
    const offsetX = (containerDimensions.width - scaledWidth) / 2;
    const offsetY = (containerDimensions.height - scaledHeight) / 2;
    
    const left = (x / (imageDimensions.width / 2)) * (scaledWidth / 2) + (scaledWidth / 2) + offsetX;
    const top = (-y / (imageDimensions.height / 2)) * (scaledHeight / 2) + (scaledHeight / 2) + offsetY;
    
    return {
        left: `${(left / containerDimensions.width) * 100}%`,
        top: `${(top / containerDimensions.height) * 100}%`,
    };
  };

  useEffect(() => {
    const loadImageDimensions = (src: string, setter: React.Dispatch<React.SetStateAction<{width: number, height: number} | null>>) => {
        const img = new Image();
        img.onload = () => {
            setter({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = src;
    };
    if (originalImagePreview) loadImageDimensions(originalImagePreview, setOriginalImageDimensions);
    if (editedImage) loadImageDimensions(editedImage, setEditedImageDimensions);
  }, [originalImagePreview, editedImage]);

  return (
    <>
      {showBackToTop && (
        <button onClick={scrollToTop} className="fixed bottom-24 right-4 z-40 bg-pink-500 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center">
            ↑
        </button>
      )}
      <div className="flex flex-col items-center gap-6 w-full max-w-6xl mx-auto pb-28">
          <div className="w-full max-w-2xl mx-auto flex items-center gap-2 md:gap-4">
              <button onClick={onClose} className="p-2 text-slate-600 hover:text-purple-700 transition-colors" aria-label="Go back"><BackIcon /></button>
              <div className="relative flex-grow">
                 <SearchAutocomplete value={searchInput} onChange={setSearchInput} onSearch={() => { onSearch(); }} onUploadClick={() => setAppState('searching')} />
              </div>
              <div className="flex items-center gap-2">
                 <button onClick={() => setAppState('cart')} className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors" aria-label={`View cart with ${itemCount} items`}>
                     <CartIcon />
                     {itemCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">{itemCount}</span>}
                 </button>
                 {isAuthenticated && user && !user.is_anonymous ? (
                     <div className="relative" ref={accountMenuRef}>
                         <button onClick={() => setIsAccountMenuOpen(prev => !prev)} className="p-2 text-slate-600 hover:text-purple-700 transition-colors" aria-label="Open account menu"><UserCircleIcon /></button>
                         {isAccountMenuOpen && (
                             <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-fade-in-fast z-50">
                                 <div className="px-4 py-2 border-b border-slate-100"><p className="text-sm font-medium text-slate-800 truncate">{user.email}</p></div>
                                 <button onClick={() => { setAppState('addresses'); setIsAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><MapPinIcon className="w-4 h-4" />My Addresses</button>
                                 <button onClick={() => { setAppState('orders'); setIsAccountMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><PackageIcon className="w-4 h-4" />My Orders</button>
                                 <button onClick={onSignOut} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><LogOutIcon className="w-4 h-4" />Sign Out</button>
                             </div>
                         )}
                     </div>
                 ) : (
                     <button onClick={() => setAppState('auth')} className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-xs font-semibold text-slate-700 hover:bg-white transition-all shadow-sm">Login</button>
                 )}
              </div>
          </div>

          <div className="grid grid-cols-1 gap-y-6 md:grid-cols-5 md:gap-8">
              {/* Left Column: Image and Actions */}
              <div className="md:col-span-2 md:sticky md:top-8 self-start space-y-4">
                  <div ref={mainImageContainerRef} className="w-full bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col p-2">
                      <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                          <button onClick={() => setActiveTab('original')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600'}`}>Original</button>
                          <button onClick={() => { if (isCustomizationDirty) { onUpdateDesign(); } else { setActiveTab('customized'); } }} disabled={(!editedImage && !isCustomizationDirty) || isUpdatingDesign} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 disabled:text-slate-400'}`}>Customized</button>
                      </div>
                      <div ref={markerContainerRef} className="relative flex-grow flex items-center justify-center p-2 aspect-square">
                          {(isLoading || isUpdatingDesign) && (
                              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-2xl z-20">
                                  <LoadingSpinner />
                                  <p className="mt-4 text-slate-500 font-semibold">{isUpdatingDesign ? dynamicLoadingMessage : 'Loading design...'}</p>
                              </div>
                          )}
                          {originalImagePreview ? (
                               <img key={activeTab} src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview} alt={activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"} className="w-full h-full object-contain rounded-lg" />
                          ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon /></div>}

                          {areHelpersVisible && !isAnalyzing && analysisResult && containerDimensions && (
                              <div className="absolute inset-0">
                                  {clusteredMarkers.map(item => {
                                      if (typeof item.x !== 'number' || typeof item.y !== 'number' || (item.x === 0 && item.y === 0)) {
                                          return null;
                                      }
                                      const { left, top } = calculateMarkerPosition(item.x, item.y);
                                      const isSelected = selectedItem && (Array.isArray(selectedItem) ? selectedItem.some(i => i.id === item.id) : selectedItem.id === item.id);
                                      return (
                                          <div key={item.id} className={`analysis-marker ${isSelected ? 'selected' : ''}`} style={{ left, top }} onMouseEnter={() => setHoveredItem(item)} onMouseLeave={() => setHoveredItem(null)} onClick={() => handleMarkerClick(item)}>
                                              <div className="marker-dot">
                                                 {item.isCluster ? item.items.length : markerMap.get(item.id)}
                                              </div>
                                              {hoveredItem?.id === item.id && <div className="marker-tooltip">{(() => {
                                                  if (item.isCluster) {
                                                      return `${item.items.length} items`;
                                                  }
                                                  const singleItem = item as AnalysisItem;
                                                  // Narrowing check for CakeMessageUI
                                                  if (singleItem.itemCategory === 'message') {
                                                      return `"${singleItem.text}"`;
                                                  }
                                                  // Narrowing check for other items which have description
                                                  if ('description' in singleItem) {
                                                      return singleItem.description;
                                                  }
                                                  return '';
                                              })()}</div>}
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                          {icingDesign && cakeInfo && <IcingToolbar onSelectItem={setSelectedItem} icingDesign={icingDesign} cakeType={cakeInfo.type} isVisible={areHelpersVisible && (isAnalyzing || !!analysisResult)} highlightedItemId={highlightedTool}/>}
                      </div>
                      {isAnalyzing && (
                        <div className="p-2 pt-0">
                            <div className="w-full bg-slate-200 rounded-full h-1.5 relative overflow-hidden mt-2">
                                <div className="absolute h-full w-1/2 bg-gradient-to-r from-pink-500 to-purple-600 animate-progress-slide"></div>
                            </div>
                        </div>
                      )}
                  </div>
                  <div className="w-full flex flex-col items-center gap-3">
                      <button onClick={onUpdateDesign} disabled={isUpdatingDesign} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center">
                         {isUpdatingDesign ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Updating...</> : <><MagicSparkleIcon className="w-5 h-5 mr-2" /> Update Design</>}
                      </button>
                      <div className="hidden md:flex w-full items-center justify-end gap-4 mt-2">
                          <button onClick={() => onOpenReportModal()} disabled={!editedImage || isUpdatingDesign || isReporting} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Report an issue with this image">
                              <ReportIcon />
                              <span className="ml-2">{isReporting ? 'Submitting...' : 'Report Issue'}</span>
                          </button>
                          <button onClick={onSave} disabled={!editedImage || isSaving} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Save customized image">
                              {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <SaveIcon />}
                              <span className="ml-2">{isSaving ? 'Saving...' : 'Save'}</span>
                          </button>
                          <button onClick={onClearAll} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors" aria-label="Reset everything">
                              <ResetIcon />
                              <span className="ml-2">Reset Everything</span>
                          </button>
                      </div>
                  </div>
                  {isAdmin && (
                    <div className="p-2 bg-yellow-100 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                      <strong>Admin Tools:</strong>
                      <button onClick={clearPromptCache} className="ml-2 font-semibold underline">Clear Prompt Cache</button>
                    </div>
                  )}
              </div>

              {/* Right Column: Customization Options */}
              <div className="md:col-span-3 flex flex-col space-y-4">
                 <div className="w-full p-4 rounded-xl border-2 flex items-start gap-4 transition-all duration-300 animate-fade-in bg-blue-50 border-blue-300">
                     <div className="text-3xl flex-shrink-0 mt-1">🕐</div>
                     <div className="flex-grow">
                         <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                             <h4 className="text-lg font-bold text-blue-800">Same-Day Order!</h4>
                             <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-200 text-blue-800">Ready in 3 hours</span>
                         </div>
                         <p className="text-sm mt-1 text-blue-700">Quick turnaround - order now for today!</p>
                         <p className="text-xs mt-2 text-blue-600">⏰ Order before 12 PM for same-day pickup!</p>
                     </div>
                 </div>

                  <div className="w-full bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200 space-y-6">
                     <div className="flex justify-between items-center -mb-2">
                       <h2 className="text-xl font-bold text-slate-800">Customize Your Cake</h2>
                       {dominantMotif && (
                           <button onClick={() => setIsMotifPanelOpen(true)} className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 p-1.5 rounded-md hover:bg-purple-50">
                               <Wand2 className="w-4 h-4" /> Change Motif Color
                           </button>
                       )}
                     </div>
                      {cakeInfo && icingDesign && (
                          <FeatureList
                            analysisError={analysisError} analysisId={analysisId} cakeInfo={cakeInfo} basePriceOptions={basePriceOptions}
                            mainToppers={mainToppers} supportElements={supportElements} cakeMessages={cakeMessages} icingDesign={icingDesign}
                            additionalInstructions={additionalInstructions} onCakeInfoChange={onCakeInfoChange}
                            updateMainTopper={updateMainTopper} removeMainTopper={removeMainTopper}
                            updateSupportElement={updateSupportElement} removeSupportElement={removeSupportElement}
                            updateCakeMessage={updateCakeMessage} removeCakeMessage={removeCakeMessage} onCakeMessageChange={onCakeMessageChange}
                            onIcingDesignChange={onIcingDesignChange} onAdditionalInstructionsChange={onAdditionalInstructionsChange}
                            onTopperImageReplace={onTopperImageReplace} onSupportElementImageReplace={onSupportElementImageReplace}
                            isAnalyzing={isAnalyzing} itemPrices={itemPrices} user={user}
                            cakeBaseSectionRef={cakeBaseSectionRef}
                            onItemClick={handleListItemClick} markerMap={markerMap}
                          />
                      )}
                  </div>
              </div>
              
              <div className="md:hidden flex w-full items-center justify-end gap-4 mt-4 border-t border-slate-200 pt-4">
                  <button onClick={() => onOpenReportModal()} disabled={!editedImage || isUpdatingDesign || isReporting} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Report an issue with this image">
                      <ReportIcon /> <span className="ml-2 hidden sm:inline">{isReporting ? 'Submitting...' : 'Report Issue'}</span>
                  </button>
                  <button onClick={onSave} disabled={!editedImage || isSaving} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Save customized image">
                      {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <SaveIcon />} <span className="ml-2 hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                  </button>
                  <button onClick={onClearAll} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors" aria-label="Reset everything">
                      <ResetIcon /> <span className="ml-2 hidden sm:inline">Reset All</span>
                  </button>
              </div>
          </div>
      </div>
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
      <MotifPanel
          isOpen={isMotifPanelOpen}
          onClose={() => setIsMotifPanelOpen(false)}
          dominantMotif={dominantMotif!}
          onColorChange={handleMotifColorChange}
      />
    </>
  );
};

export default CustomizingPage;
