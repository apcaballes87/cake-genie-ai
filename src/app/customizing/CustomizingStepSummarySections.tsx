'use client';

import React, { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { X, Check } from 'lucide-react';
import { CakeBaseOptions } from '@/components/CakeBaseOptions';
import { CakeMessagesOptions } from '@/components/CakeMessagesOptions';
import { CustomizingInstructionsPanel } from './CustomizingInstructionsPanel';
import LazyImage from '@/components/LazyImage';
import { 
    getCakeTypesForIcingBase, 
    inferIcingBaseFromCakeType, 
    THICKNESS_OPTIONS_MAP,
    FLAVOR_OPTIONS
} from '@/constants';
import { getIcingImage, type IcingImageType } from '@/utils/icingImage';
import { roundDownToNearest99 } from '@/lib/utils/pricing';
import type { BasePriceInfo, CakeInfoUI, CakeMessageUI, ClusteredMarker, IcingDesignUI, IcingGroup, MainTopperUI, SupportElementUI } from '@/types';

type LayoutMode = 'mobile' | 'desktop';
type StepOneItemKind = 'type' | 'size' | 'height' | 'flavor' | 'icing';
interface CustomizingStepSummarySectionsProps {
    layout: LayoutMode;
    cakeInfo: CakeInfoUI | null;
    icingDesign: IcingDesignUI | null;
    cakeMessages: CakeMessageUI[];
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    basePriceOptions?: BasePriceInfo[] | null;
    markerMap: Map<string, string>;
    itemPrices?: Map<string, number>;
    isAdmin: boolean;
    isAnalyzing: boolean;
    isRejectionError?: boolean;
    activeCustomization: string | null;
    selectedItemId: string | null;
    setActiveCustomization: Dispatch<SetStateAction<string | null>>;
    setSelectedItem: Dispatch<SetStateAction<ClusteredMarker | null>>;
    addCakeMessage?: (position: 'top' | 'side' | 'base_board') => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    additionalInstructions?: string;
    onAdditionalInstructionsChange?: (value: string) => void;
    removeCakeMessage: (id: string) => void;
    updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
    updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
    onTopperImageReplace: (topperId: string, file: File) => void;
    onSupportElementImageReplace: (elementId: string, file: File) => void;
    openTopperSheet: (section?: 'main' | 'support' | null, expandedItemId?: string | null) => void;
    onCakeInfoChange?: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    onIcingTypeChange?: (newType: IcingDesignUI['base']) => void;
    onIcingDesignChange?: (newDesign: IcingDesignUI) => void;
    onIcingColorSelect?: (newDesign: IcingDesignUI, color: { hex: string; name: string }) => void;
    icingTypePriceDeltas?: Partial<Record<IcingDesignUI['base'], number | null>>;
    addOnPricing?: number;
    separateIcingStep?: boolean;
    cakeDesignQuickActionsNode?: React.ReactNode;
    aiChatNode?: React.ReactNode;
    hideStepOne?: boolean;
    hideStepFour?: boolean;
    photoStepNode?: React.ReactNode;
    isUpdatingDesign?: boolean;
    dirtyFields?: Set<string>;
    /** Disables swatch clicks while the studio background edit is in flight (avoids stale
     *  recolors on top of a pre-existing studio edit). */
    isStudioBackgroundEditingPending?: boolean;
    isCupcake?: boolean;
    hasToppersChanges?: boolean;
    onApplyTopperChanges?: () => void;
}

export const THEME_COLORS = [
    { name: 'red', hex: '#EF4444' },
    { name: 'light red', hex: '#FCA5A5' },
    { name: 'orange', hex: '#F97316' },
    { name: 'yellow', hex: '#FACC15' },
    { name: 'green', hex: '#22C55E' },
    { name: 'light green', hex: '#86EFAC' },
    { name: 'dark green', hex: '#15803D' },
    { name: 'teal', hex: '#14B8A6' },
    { name: 'blue', hex: '#3B82F6' },
    { name: 'light blue', hex: '#93C5FD' },
    { name: 'navy blue', hex: '#1E3A8A' },
    { name: 'purple', hex: '#8B5CF6' },
    { name: 'light purple', hex: '#C4B5FD' },
    { name: 'dark purple', hex: '#581C87' },
    { name: 'pink', hex: '#EC4899' },
    { name: 'light pink', hex: '#FBCFE8' },
    { name: 'dark pink', hex: '#9D174D' },
    { name: 'brown', hex: '#92400E' },
    { name: 'black', hex: '#000000' },
    { name: 'gray', hex: '#6B7280' },
    { name: 'white', hex: '#FFFFFF' },
    { name: 'cream', hex: '#FFFDD0' },
];

const getStepOneFlavorLabel = (index: number, total: number) => {
    if (total === 2) return index === 0 ? 'Top Flavor' : 'Bottom Flavor';
    if (total === 3) return ['Top Flavor', 'Middle Flavor', 'Bottom Flavor'][index] || 'Flavor';
    return 'Flavor';
};

const formatFlavorLabel = (flavor: string) => flavor.replace(/\s+Cake$/i, '');

const getIcingTypeValue = (cakeInfo: CakeInfoUI, icingDesign: IcingDesignUI | null) => {
    if (cakeInfo.type.toLowerCase().includes('fondant') || icingDesign?.base === 'fondant') {
        return 'Fondant';
    }

    return 'Soft Icing';
};


export const CustomizingStepSummarySections = memo(function CustomizingStepSummarySections({
    layout,
    cakeInfo,
    icingDesign,
    cakeMessages,
    basePriceOptions,
    markerMap,
    itemPrices,
    isAdmin,
    isAnalyzing,
    isRejectionError = false,
    activeCustomization,
    selectedItemId,
    setActiveCustomization,
    setSelectedItem,
    addCakeMessage,
    updateCakeMessage,
    additionalInstructions = '',
    onAdditionalInstructionsChange,
    removeCakeMessage,
    onCakeInfoChange,
    onIcingTypeChange,
    onIcingDesignChange,
    onIcingColorSelect,
    icingTypePriceDeltas,
    addOnPricing = 0,
    separateIcingStep = false,
    cakeDesignQuickActionsNode,
    aiChatNode,
    hideStepOne,
    photoStepNode,
    isUpdatingDesign,
    isStudioBackgroundEditingPending = false,
    isCupcake = false,
}: CustomizingStepSummarySectionsProps) {
    // Default position when "+ Add" is clicked: Bento → front (side), all others → base_board
    const [showIcingChoice, setShowIcingChoice] = React.useState(true);
    const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);
    const colorPickerRef = React.useRef<HTMLDivElement | null>(null);

    const currentColorHex = icingDesign?.colors?.side || icingDesign?.colors?.top || '#FFFFFF';

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                const target = event.target as HTMLElement;
                if (target.closest('[data-icing-type-btn]')) {
                    return;
                }
                setIsColorPickerOpen(false);
            }
        };

        if (isColorPickerOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isColorPickerOpen]);
    const stepOneCardRef = React.useRef<HTMLDivElement | null>(null);
    const sizeScrollRef = React.useRef<HTMLDivElement | null>(null);
    const heightScrollRef = React.useRef<HTMLDivElement | null>(null);

    // Helper to scroll selected item to center
    const scrollToCenter = (container: HTMLDivElement | null, selector: string) => {
        if (!container) return;
        const element = container.querySelector(selector) as HTMLElement;
        if (element) {
            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            
            // Distance of element relative to container's left edge
            const relativeLeft = elementRect.left - containerRect.left;
            
            // Calculate target scroll: current + relative - (container/2) + (element/2)
            const targetScrollLeft = container.scrollLeft + relativeLeft - (containerRect.width / 2) + (elementRect.width / 2);

            container.scrollTo({
                left: targetScrollLeft,
                behavior: 'smooth'
            });
        }
    };

    // Auto-scroll on state change
    React.useEffect(() => {
        if (cakeInfo?.size && sizeScrollRef.current) {
            const escapedSize = cakeInfo.size.replace(/"/g, '\\"');
            setTimeout(() => scrollToCenter(sizeScrollRef.current, `[data-cakesize="${escapedSize}"]`), 100);
        }
    }, [cakeInfo?.size]);

    React.useEffect(() => {
        if (cakeInfo?.thickness && heightScrollRef.current) {
            setTimeout(() => scrollToCenter(heightScrollRef.current, `[data-cakethickness="${cakeInfo.thickness}"]`), 100);
        }
    }, [cakeInfo?.thickness]);

    const isDesktop = layout === 'desktop';
    const cakeType = cakeInfo?.type?.toLowerCase() || '';
    const isCupcakes = cakeType === 'cupcake' || cakeType.startsWith('cupcakes-');
    const isTieredFlavorLayout = cakeType.includes('2 tier') || cakeType.includes('3 tier');
    const containerClassName = isDesktop
        ? 'w-full hidden md:flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-2 pb-6 md:pb-32 scrollbar-hide snap-x md:snap-none relative z-60'
        : 'w-full mt-0 flex flex-col gap-2 pb-4 md:hidden';
    const cardClassName = isDesktop
        ? 'shrink-0 md:shrink w-fit md:w-full min-w-[280px] md:min-w-0 snap-start genie-card p-2 rounded-2xl'
        : 'w-full min-w-0 genie-card p-2 rounded-2xl';
    const itemsClassName = isDesktop ? 'flex gap-[7px] pt-1 pb-1 w-max md:w-full flex-wrap' : 'flex gap-[7px] pt-1 pb-1 w-full flex-wrap';
    const stepOneItemsViewportClassName = 'w-full overflow-x-auto overflow-y-hidden scrollbar-hide';
    const stepOneItemsClassName = 'flex gap-2.5 pt-1 pb-2 w-max min-w-max flex-nowrap snap-x snap-mandatory';
    const renderFlavorOptions = (currentFlavor: string, index: number, tieredRow = false) => {
        const currentFlavors = cakeInfo?.flavors ?? [];
        const currentCakeType = cakeInfo?.type ?? '';
        const rowClassName = tieredRow
            ? 'flex flex-nowrap overflow-x-auto gap-1.5 pt-1 pl-1 pr-1 pb-1 scrollbar-hide'
            : 'flex flex-wrap gap-1.5';
        const buttonClassName = tieredRow
            ? 'shrink-0 min-h-[37px] max-md:min-h-[34px] min-w-[92px] max-md:min-w-[78px] flex items-center justify-center px-2 rounded-xl border transition-all duration-300 shadow-sm'
            : 'min-h-[37px] max-md:min-h-[34px] min-w-[90px] max-md:min-w-[76px] flex-1 flex items-center justify-center px-3 py-1 rounded-xl border transition-all duration-300 shadow-sm';

        return (
            <div key={index} className="flex flex-col gap-1">
                {currentFlavors.length > 1 && (
                    <span className="text-[9px] max-md:text-[8px] font-medium text-slate-500 uppercase">{getStepOneFlavorLabel(index, currentFlavors.length)}</span>
                )}
                <div className={rowClassName}>
                    {FLAVOR_OPTIONS.map((flavor) => {
                        const isSelected = currentFlavor === flavor;

                        const isBento = currentCakeType === 'Bento';
                        const isCupcakes = currentCakeType.toLowerCase() === 'cupcake' || currentCakeType.toLowerCase().startsWith('cupcakes-');
                        const normType = currentCakeType.toLowerCase();
                        const isStandardOrMulti = normType.includes('1 tier') ||
                                                    normType.includes('2 tier') ||
                                                    normType.includes('3 tier') ||
                                                    normType.includes('square') ||
                                                    normType.includes('rectangle');

                        let isDisabled = false;
                        if (isBento) {
                            isDisabled = flavor !== 'Chocolate Cake' && flavor !== 'Vanilla Cake';
                        } else if (isCupcakes) {
                            isDisabled = flavor !== 'Chocolate Cake' && flavor !== 'Vanilla Cake';
                        } else if (isStandardOrMulti) {
                            isDisabled = flavor === 'Mocha Cake';
                        }

                        const flavorStyles: Record<string, { bg: string, border: string, text: string }> = {
                            'Chocolate Cake': { bg: 'bg-[#fdf0d5]', border: 'border-[#f2cc8f]', text: 'text-[#78350f]' },
                            'Ube Cake': { bg: 'bg-[#faf5ff]', border: 'border-[#e9d5ff]', text: 'text-[#7e22ce]' },
                            'Vanilla Cake': { bg: 'bg-[#fffbeb]', border: 'border-[#fef3c7]', text: 'text-[#92400e]' },
                            'Mocha Cake': { bg: 'bg-[#faf3e0]', border: 'border-[#e6ccb2]', text: 'text-[#9c6644]' },
                        };

                        const style = flavorStyles[flavor] || {
                            bg: 'bg-white', border: 'border-slate-100', text: 'text-slate-600'
                        };

                        return (
                            <button
                                key={flavor}
                                disabled={isDisabled}
                            onClick={() => {
                                if (isDisabled) return;
                                    const newFlavors = [...currentFlavors];
                                    newFlavors[index] = flavor;
                                    onCakeInfoChange?.({ flavors: newFlavors });
                                }}
                                className={`${buttonClassName} ${
                                    isDisabled
                                        ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50 grayscale'
                                        : isSelected
                                            ? 'genie-control-selected text-purple-700 scale-[1.02]'
                                            : `${style.bg} ${style.border} ${style.text} opacity-80 hover:opacity-100 hover:scale-[1.02]`
                                }`}
                            >
                                <span className="text-[9px] max-md:text-[8px] font-bold text-center leading-none uppercase tracking-tighter">{flavor.replace(' Cake', '')}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Auto-correct flavors based on cake type restrictions
    React.useEffect(() => {
        if (!cakeInfo?.flavors || !onCakeInfoChange) return;

        const isBento = cakeInfo.type === 'Bento';
        const isCupcakes = cakeInfo.type.toLowerCase() === 'cupcake' || cakeInfo.type.toLowerCase().startsWith('cupcakes-');
        const normType = cakeInfo.type.toLowerCase();
        const isStandardOrMulti = normType.includes('1 tier') || 
                                   normType.includes('2 tier') || 
                                   normType.includes('3 tier') || 
                                   normType.includes('square') || 
                                   normType.includes('rectangle') ||
                                   normType.includes('slab cake');

        let hasChange = false;
        const newFlavors = [...cakeInfo.flavors];

        newFlavors.forEach((flavor, index) => {
            let isDisabled = false;
            if (isBento) {
                isDisabled = flavor !== 'Chocolate Cake' && flavor !== 'Vanilla Cake';
            } else if (isCupcakes) {
                isDisabled = flavor !== 'Chocolate Cake' && flavor !== 'Vanilla Cake';
            } else if (isStandardOrMulti) {
                isDisabled = flavor === 'Mocha Cake';
            }

            if (isDisabled) {
                newFlavors[index] = 'Chocolate Cake';
                hasChange = true;
            }
        });

        if (hasChange) {
            onCakeInfoChange({ flavors: newFlavors }, { isSystemCorrection: true });
        }
    }, [cakeInfo?.type, cakeInfo?.flavors, onCakeInfoChange]);

    const shouldShowAiChatCard = Boolean(cakeInfo && !isAnalyzing && !isRejectionError && aiChatNode);
    const aiChatCard = shouldShowAiChatCard ? (
        <div className="w-full min-w-0">
            {aiChatNode}
        </div>
    ) : null;

    const cakeTypeSelectorNode = cakeInfo ? (() => {
        const currentIcingType = getIcingTypeValue(cakeInfo, icingDesign);
        const allTypes = getCakeTypesForIcingBase(currentIcingType === 'Fondant' ? 'fondant' : 'soft_icing');

        // Keep the current family grouping intact so shape changes stay scoped.
        const normalizeForGroup = (type: string) => type.replace(/\s+Fondant$/i, '');
        const standardGroup = ['Bento', '1 Tier', 'Square', 'Rectangle', 'Slab Cake'];
        const multiTierGroup = ['2 Tier', '3 Tier'];
        const currentBaseType = normalizeForGroup(cakeInfo.type);
        const isCurrentlyStandard = standardGroup.includes(currentBaseType);

        const filteredTypes = allTypes.filter((type) => {
            const baseType = normalizeForGroup(type);
            return isCurrentlyStandard ? standardGroup.includes(baseType) : multiTierGroup.includes(baseType);
        });

        return (
            <div className="flex flex-col gap-1">
                <span className="text-[10px] max-md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cake Type</span>
                <div className="flex flex-nowrap overflow-x-auto gap-3 py-1 px-1 scrollbar-hide">
                    {filteredTypes.map((type) => {
                        const isSelected = cakeInfo.type === type;

                        return (
                            <button
                                key={type}
                                onClick={() => onCakeInfoChange?.({ type })}
                                className={`min-h-[32px] max-md:min-h-[34px] min-w-[90px] max-md:min-w-[76px] flex-1 flex items-center justify-center px-2 rounded-xl border transition-all duration-300 ${
                                    isSelected
                                        ? 'genie-control-selected text-purple-700 scale-[1.02]'
                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-200 hover:bg-slate-100/50'
                                }`}
                            >
                                <span className="text-[9px] max-md:text-[8px] font-bold text-center leading-none whitespace-nowrap">{type}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    })() : null;
    const icingSummaryItems = icingDesign && cakeInfo ? [
        { id: 'icing-edit-drip', description: 'Drip', label: 'Drip', alt: 'Drip', imageType: 'drip' as const, group: 'drip' as IcingGroup, enabled: icingDesign.drip },
        { id: 'icing-edit-borderTop', description: 'Top Border', label: 'Top Border', alt: 'Top Border', imageType: 'borderTop' as const, group: 'border_top' as IcingGroup, enabled: icingDesign.border_top },
        { id: 'icing-edit-borderBase', description: 'Base Border', label: 'Base Border', alt: 'Base Border', imageType: 'borderBase' as const, group: 'border_base' as IcingGroup, enabled: icingDesign.border_base },
        { id: 'icing-edit-top', description: 'Top Icing', label: 'Top Icing', alt: 'Top Icing', imageType: 'top' as const, group: 'top' as IcingGroup, enabled: true, isTopSpecific: true },
        { id: 'icing-edit-side', description: 'Side Icing', label: 'Body Icing', alt: 'Body Icing', imageType: 'side' as const, group: 'side' as IcingGroup, enabled: true },
        { id: 'icing-edit-gumpasteBaseBoard', description: 'Base Board', label: 'Board', alt: 'Base Board', imageType: 'gumpasteBaseBoard' as const, group: 'gumpasteBaseBoard' as IcingGroup, enabled: icingDesign.gumpasteBaseBoard },
    ].filter(item => item.enabled || (activeCustomization === 'icing' && selectedItemId === item.id)).map((item) => {
        const isSelected = activeCustomization === 'icing' && selectedItemId === item.id;
        const isEnabled = item.enabled || isSelected;

        return (
            <button
                key={item.id}
                onClick={() => {
                    setActiveCustomization('icing');
                    setSelectedItem({ id: item.id, itemCategory: 'icing', description: item.group, cakeType: cakeInfo.type });
                }}
                className="group flex flex-col items-center gap-1 min-w-[60px] max-md:min-w-[51px]"
            >
                <div className={`w-14 h-14 max-md:w-12 max-md:h-12 rounded-full border border-purple-100 overflow-hidden relative group-hover:border-purple-400 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${isSelected ? 'genie-control-selected' : isEnabled ? 'ring-2 ring-purple-400' : ''}`}>
                    <LazyImage
                        src={getIcingImage(icingDesign, item.imageType, item.isTopSpecific)}
                        alt={item.alt}
                        width={36}
                        height={36}
                        containerClassName="w-full h-full flex items-center justify-center"
                        imageClassName="w-full h-full object-contain"
                    />
                </div>
                <span className="text-[10px] max-md:text-[9px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2 mt-0.5">{item.label}</span>
            </button>
        );
    }) : null;

    return (
        <div className={containerClassName}>

            {/* Pulsing hint for AI icing mask is disabled/hidden since the mask is disabled */}

            {aiChatCard}

            {cakeInfo && !isAnalyzing && !isRejectionError && !hideStepOne && (
                <div 
                    ref={stepOneCardRef} 
                    className={`${cardClassName} relative z-10`}
                >
                    <div className="flex flex-col gap-2 px-1 pb-2">
                        {cakeDesignQuickActionsNode && (
                            <div className="w-full px-0.5 pt-0.5">
                                {cakeDesignQuickActionsNode}
                            </div>
                        )}
                        {/* Line 1: Icing Type */}
                        {!isCupcakes && (
                            <div className="flex flex-col gap-1 relative">
                                <span className="text-[10px] max-md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Icing Type &amp; Color</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { id: 'soft_icing', label: 'Soft Icing' },
                                        { id: 'fondant', label: 'Fondant' },
                                    ].map((option) => {
                                        const isSelected = getIcingTypeValue(cakeInfo, icingDesign) === (option.id === 'fondant' ? 'Fondant' : 'Soft Icing');
                                        const priceDelta = !isSelected
                                            ? icingTypePriceDeltas?.[option.id as IcingDesignUI['base']]
                                            : null;
                                        const priceDeltaValue = typeof priceDelta === 'number' && Number.isFinite(priceDelta)
                                            ? priceDelta
                                            : null;
                                        const priceDeltaLabel = priceDeltaValue !== null && priceDeltaValue !== 0
                                            ? `${priceDeltaValue > 0 ? '+' : '-'}₱${Math.abs(priceDeltaValue).toLocaleString()}`
                                            : null;
                                        return (
                                            <button
                                                key={option.id}
                                                data-icing-type-btn
                                                onClick={() => {
                                                    onIcingTypeChange?.(option.id as IcingDesignUI['base']);
                                                    if (isSelected) {
                                                        setIsColorPickerOpen(prev => !prev);
                                                    } else {
                                                        setIsColorPickerOpen(true);
                                                    }
                                                }}
                                                className={`flex-1 min-h-[32px] max-md:min-h-[34px] flex items-center justify-center px-2.5 py-0.5 rounded-xl border transition-all duration-300 ${
                                                    isSelected 
                                                        ? 'genie-control-selected text-purple-700 scale-[1.02]' 
                                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-200 hover:bg-slate-100/50'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <span 
                                                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-xs shrink-0 mr-1.5"
                                                        style={{ backgroundColor: currentColorHex }}
                                                    />
                                                )}
                                                <span className="text-[9px] max-md:text-[8px] font-bold">{option.label}</span>
                                                {priceDeltaLabel && (
                                                    <span
                                                        className={`text-[8px] max-md:text-[7px] font-bold ml-1 ${priceDeltaValue !== null && priceDeltaValue > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                                                    >
                                                        {priceDeltaLabel}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Floating colors section */}
                                {isColorPickerOpen && cakeInfo && (
                                    <div 
                                        ref={colorPickerRef}
                                        className={`absolute left-0 right-0 z-50 bg-white border border-purple-100/90 rounded-2xl shadow-xl p-3 max-md:p-2.5 animate-in fade-in duration-200 ${
                                            isDesktop
                                                ? 'top-full mt-2 slide-in-from-top-2'
                                                : 'bottom-full mb-2 slide-in-from-bottom-2'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                                            <span className="text-[10px] max-md:text-[9px] font-bold text-slate-500 uppercase tracking-wider">Icing Colors</span>
                                            <div className="flex items-center gap-3.5">
                                                {isStudioBackgroundEditingPending ? (
                                                    <p className="max-w-[150px] text-right text-[10px] font-semibold leading-snug text-red-600">
                                                        Please wait while we&apos;re editing the background.
                                                    </p>
                                                ) : null}
                                                <button 
                                                    type="button"
                                                    onClick={() => setIsColorPickerOpen(false)}
                                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
                                                    aria-label="Close color picker"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 px-1 pb-0.5 md:gap-3">
                                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Main</span>
                                                <div
                                                    className="md:w-10 md:h-10 w-[34px] h-[34px] rounded-full border-2 border-white shadow-md ring-1 ring-slate-100 shrink-0"
                                                    style={{ backgroundColor: icingDesign?.colors?.side || icingDesign?.colors?.top || '#FFFFFF' }}
                                                />
                                            </div>

                                            <div className="w-px md:h-10 h-[34px] bg-slate-100 shrink-0" />

                                            <div className="flex-1 overflow-x-auto scrollbar-hide">
                                                <div className="flex gap-1 py-0.5 px-1">
                                                    {THEME_COLORS.map((color) => {
                                                        const isSwatchDisabled = isUpdatingDesign || isStudioBackgroundEditingPending;

                                                        return (
                                                            <button
                                                                key={color.name}
                                                                onClick={() => {
                                                                    if (isSwatchDisabled) return;
                                                                    let nextDesign: IcingDesignUI | undefined = undefined;
                                                                    if (icingDesign) {
                                                                        const hasSameBodyColor = [icingDesign.colors.top, icingDesign.colors.side]
                                                                            .filter((value): value is string => Boolean(value))
                                                                            .every(value => value.toLowerCase() === color.hex.toLowerCase());

                                                                        if (hasSameBodyColor) {
                                                                            setIsColorPickerOpen(false);
                                                                            return;
                                                                        }

                                                                        nextDesign = {
                                                                            ...icingDesign,
                                                                            colors: {
                                                                                ...icingDesign.colors,
                                                                                top: color.hex,
                                                                                side: color.hex,
                                                                            },
                                                                        };
                                                                        if (onIcingColorSelect) {
                                                                            onIcingColorSelect(nextDesign, color);
                                                                        } else {
                                                                            onIcingDesignChange?.(nextDesign);
                                                                        }
                                                                    }
                                                                    setIsColorPickerOpen(false);
                                                                }}
                                                                disabled={isSwatchDisabled}
                                                                className={`group relative flex flex-col items-center gap-1 shrink-0 transition-transform active:scale-95 ${isSwatchDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                title={color.name}
                                                            >
                                                                <div
                                                                    className={`md:w-8 md:h-8 w-[27px] h-[27px] rounded-full border shadow-sm transition-all ${
                                                                        currentColorHex.toLowerCase() === color.hex.toLowerCase()
                                                                            ? 'border-slate-300 ring-2 ring-slate-300'
                                                                            : 'border-slate-100 group-hover:shadow-md group-hover:ring-2 group-hover:ring-purple-200'
                                                                    }`}
                                                                    style={{ backgroundColor: color.hex }}
                                                                />
                                                                <span className="text-[7px] font-medium text-slate-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {color.name}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Size, Height, and Flavor Container */}
                        <div className={isTieredFlavorLayout ? 'flex flex-col gap-4 w-full mt-2 bg-transparent' : 'flex flex-row gap-4 w-full mt-2 bg-transparent'}>
                            {!isTieredFlavorLayout ? (
                                <div className="flex-1 min-w-0 flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] max-md:text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Flavor</span>
                                        <div className="flex flex-col gap-2">
                                            {cakeInfo.flavors.map((currentFlavor, index) => renderFlavorOptions(currentFlavor, index, false))}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {/* Size and Height */}
                            <div className={isTieredFlavorLayout ? 'flex-1 min-w-0 flex flex-col gap-2' : 'flex-3 min-w-0 border-l border-slate-100 pl-4 flex flex-col gap-2'}>
                                {/* Line 4: Size */}
                                {basePriceOptions && basePriceOptions.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] max-md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Size</span>
                                        <div 
                                            ref={sizeScrollRef}
                                            key={cakeInfo.type} 
                                            className="flex flex-nowrap overflow-x-auto justify-start items-center gap-2 py-1.5 px-2 scrollbar-hide"
                                        >
                                            {[...basePriceOptions]
                                                .sort((a, b) => {
                                                    const valA = parseInt(a.size.match(/\d+/)?.[0] || "0");
                                                    const valB = parseInt(b.size.match(/\d+/)?.[0] || "0");
                                                    return valA - valB;
                                                })
                                                .map((option, index) => {
                                                    const isSelected = cakeInfo.size === option.size;
                                                    const totalPrice = roundDownToNearest99(option.price + addOnPricing, option.price);
                                                    const diameter = 74 + (index * 10);
                                                    
                                                    const isSquare = cakeInfo.type.toLowerCase().includes('square');
                                                    const isRectangle = cakeInfo.type.toLowerCase().includes('rectangle');
                                                    
                                                    return (
                                                        <button
                                                            key={option.size}
                                                            data-cakesize={option.size}
                                                            onClick={() => {
                                                                onCakeInfoChange?.({ size: option.size });
                                                                setTimeout(() => scrollToCenter(sizeScrollRef.current, `[data-cakesize="${option.size.replace(/"/g, '\\"')}"]`), 50);
                                                            }}
                                                            style={{ 
                                                                width: `calc(${isRectangle ? diameter * 1.4 : diameter}px * var(--mobile-ui-scale))`,
                                                                height: `calc(${diameter}px * var(--mobile-ui-scale))`,
                                                                animationDelay: `${index * 50}ms`
                                                            }}
                                                            className={`shrink-0 flex flex-col items-center justify-center border transition-all duration-500 group relative animate-fade-in-scale opacity-0 ${
                                                                isSquare || isRectangle ? 'rounded-xl' : 'rounded-full'
                                                            } ${
                                                                isSelected 
                                                                    ? 'genie-control-selected text-purple-700 z-10 scale-105' 
                                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-300 hover:bg-slate-100/50 hover:scale-105'
                                                            }`}
                                                        >
                                                            <span className="text-[9px] font-extrabold text-center leading-none px-1 uppercase tracking-tight">{option.size.replace(' Round', '').replace(' FONDANT', '')}</span>
                                                            <span className={`text-[9px] font-bold mt-1 ${isSelected ? 'text-purple-600' : 'text-slate-400 group-hover:text-purple-400'}`}>
                                                                ₱{totalPrice.toLocaleString()}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* Line 5: Height */}
                                {!isCupcakes && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] max-md:text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                            {cakeInfo.type.toLowerCase().includes('2 tier') || cakeInfo.type.toLowerCase().includes('3 tier') ? 'Height per Cake' : 'Height'}
                                        </span>
                                        <div 
                                            ref={heightScrollRef}
                                            key={cakeInfo.type} 
                                            className="flex flex-nowrap overflow-x-auto justify-start items-center gap-3 py-1.5 px-2 scrollbar-hide"
                                        >
                                            {(THICKNESS_OPTIONS_MAP[cakeInfo.type] || []).map((thickness, index) => {
                                                const isSelected = cakeInfo.thickness === thickness;
                                                
                                                const allWidths = cakeInfo.size.match(/\d+/g) || ["6"];
                                                const baseWidth = Math.max(...allWidths.map(Number));
                                                
                                                const heightValue = parseInt(thickness) || 4;
                                                const sizeIndex = (basePriceOptions || []).findIndex(opt => opt.size === cakeInfo.size);
                                                const isRectangle = cakeInfo.type.toLowerCase().includes('rectangle');
                                                const baseRectWidth = sizeIndex >= 0 ? (74 + sizeIndex * 10) : (baseWidth * 15);
                                                const rectWidth = isRectangle ? baseRectWidth * 1.4 : baseRectWidth;
                                                const rectHeight = heightValue * 12;

                                                return (
                                                    <button
                                                        key={thickness}
                                                        data-cakethickness={thickness}
                                                        onClick={() => {
                                                            onCakeInfoChange?.({ thickness });
                                                            setTimeout(() => scrollToCenter(heightScrollRef.current, `[data-cakethickness="${thickness}"]`), 50);
                                                        }}
                                                        style={{ animationDelay: `${index * 50}ms` }}
                                                        className="flex flex-col items-center gap-2 group transition-all animate-fade-in-scale opacity-0 max-md:min-h-[44px]"
                                                    >
                                                        <div 
                                                            style={{ width: `calc(${rectWidth}px * var(--mobile-ui-scale))`, height: `calc(${rectHeight}px * var(--mobile-ui-scale))` }}
                                                            className={`rounded-lg border transition-all duration-500 flex items-center justify-center relative ${
                                                                isSelected 
                                                                    ? 'genie-control-selected text-purple-700 z-10 scale-105 shadow-sm' 
                                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-300 hover:bg-slate-100/50 hover:scale-105'
                                                            }`}
                                                        >
                                                            <span className={`text-[9px] font-black ${isSelected ? 'text-purple-600' : 'text-slate-600 group-hover:text-purple-300'} transition-colors`}>
                                                                {heightValue}&quot;
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Multi-tier Flavor Rows */}
                            {isTieredFlavorLayout ? (
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] max-md:text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Flavor</span>
                                    <div className="flex flex-col gap-2">
                                        {cakeInfo.flavors.map((currentFlavor, index) => renderFlavorOptions(currentFlavor, index, true))}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                    </div>

                </div>
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && (
                separateIcingStep ? (
                    <div className={cardClassName}>
                        <div className={itemsClassName}>
                            {icingSummaryItems}
                        </div>
                    </div>
                ) : null
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && photoStepNode && (
                <div className={cardClassName}>
                    {photoStepNode}
                </div>
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && (
                <div className={cardClassName}>
                    <CakeMessagesOptions
                        cakeMessages={cakeMessages}
                        cakeType={cakeInfo.type}
                        addCakeMessage={(position) => addCakeMessage?.(position)}
                        updateCakeMessage={updateCakeMessage}
                        removeCakeMessage={removeCakeMessage}
                    />
                </div>
            )}

            {cakeInfo && !isCupcake && !isAnalyzing && !isRejectionError && cakeTypeSelectorNode && (
                <div className={cardClassName}>
                    <div className="flex flex-col gap-2 px-1 pb-2">
                        {cakeTypeSelectorNode}
                    </div>
                </div>
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && onAdditionalInstructionsChange && (
                <div className={cardClassName}>
                    <CustomizingInstructionsPanel
                        isVisible={true}
                        additionalInstructions={additionalInstructions}
                        onAdditionalInstructionsChange={onAdditionalInstructionsChange}
                    />
                </div>
            )}
        </div>
    );
});
