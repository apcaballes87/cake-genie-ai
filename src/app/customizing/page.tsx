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
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-slate-400'}`}
            aria-pressed={isEnabled}
        >
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform shadow-sm ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
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
                                            {/* Add/Edit Messages button */}
                                            {cakeMessages.length > 0 ? (
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
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedItem(null);
                                                        handleScrollToCakeMessages();
                                                    }}
                                                    className="bg-black/40 backdrop-blur-sm text-white rounded-full text-xs font-semibold hover:bg-black/60 transition-all shadow-md px-3 py-1.5"
                                                    aria-label="Add message"
                                                >
                                                    Add Message
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