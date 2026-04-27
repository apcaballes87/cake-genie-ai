'use client';

import React, { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { X, ChevronDown, ChevronUp, Wand2, Check } from 'lucide-react';
import { CakeBaseOptions } from '@/components/CakeBaseOptions';
import LazyImage from '@/components/LazyImage';
import { 
    getCakeTypesForIcingBase, 
    inferIcingBaseFromCakeType, 
    THICKNESS_OPTIONS_MAP,
    FLAVOR_OPTIONS
} from '@/constants';
import { findClosestColor } from '@/utils/colorUtils';
import { TrashIcon } from '@/components/icons';
import { roundDownToNearest99 } from '@/lib/utils/pricing';
import type { BasePriceInfo, CakeInfoUI, CakeMessageUI, ClusteredMarker, IcingDesignUI, MainTopperType, MainTopperUI, SupportElementType, SupportElementUI } from '@/types';

type LayoutMode = 'mobile' | 'desktop';
type IcingImageType = 'top' | 'side' | 'drip' | 'borderTop' | 'borderBase' | 'gumpasteBaseBoard';
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
    removeCakeMessage: (id: string) => void;
    updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
    updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
    onTopperImageReplace: (topperId: string, file: File) => void;
    onSupportElementImageReplace: (elementId: string, file: File) => void;
    openTopperSheet: (section?: 'main' | 'support' | null) => void;
    onCakeInfoChange?: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    onIcingTypeChange?: (newType: IcingDesignUI['base']) => void;
    addOnPricing?: number;
    separateIcingStep?: boolean;
    aiChatNode?: React.ReactNode;
    hideStepOne?: boolean;
    hideStepFour?: boolean;
    photoStepNode?: React.ReactNode;
}

const getIcingImage = (icingDesign: IcingDesignUI, type: IcingImageType, isTopSpecific = false): string => {
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
    return `${baseUrl}${prefix}${prefix === 'baseboard' ? '' : '_'}${findClosestColor(color)}.webp`;
};

const getMessagePositionLabel = (position: CakeMessageUI['position']) => (
    position === 'top' ? 'TOP' : position === 'side' ? 'FRONT' : 'BASE'
);

const buildCombinedDecorSummary = (mainToppers: MainTopperUI[], supportElements: SupportElementUI[]) => {
    const items = [...mainToppers, ...supportElements];
    if (items.length === 0) return 'No decorations detected yet';

    const descriptions = items.map((item) => {
        const quantity = item.quantity || 1;
        return quantity > 1 ? `${item.description} × ${quantity}` : item.description;
    });

    if (descriptions.length === 1) return descriptions[0];
    if (descriptions.length === 2) return `${descriptions[0]}, ${descriptions[1]}`;
    return `${descriptions[0]}, ${descriptions[1]} +${descriptions.length - 2} more`;
};

const getCombinedDecorItems = (mainToppers: MainTopperUI[], supportElements: SupportElementUI[]) => {
    return [...mainToppers, ...supportElements];
};

const topperMaterialLabelMap: Record<MainTopperType, string> = {
    edible_3d_complex: 'Gumpaste (Complex)',
    edible_3d_ordinary: 'Gumpaste (Ordinary)',
    printout: 'Printout',
    toy: 'Toy',
    figurine: 'Figurine (Simpler)',
    cardstock: 'Cardstock',
    edible_photo_top: 'Printout (Edible)',
    candle: 'Candle',
    edible_flowers: 'Edible Flowers',
    icing_doodle: 'Piped Doodles',
    icing_palette_knife: 'Palette Knife Finish',
    icing_brush_stroke: 'Brush Stroke Finish',
    icing_splatter: 'Splatter Finish',
    icing_minimalist_spread: 'Minimalist Spread',
    meringue_pop: 'Meringue Pop',
    plastic_ball: 'Plastic Ball',
};

const supportMaterialLabelMap: Record<SupportElementType, string> = {
    edible_3d_support: 'Gumpaste (3D)',
    edible_2d_support: 'Gumpaste (2D)',
    chocolates: 'Chocolates',
    sprinkles: 'Sprinkles',
    support_printout: 'Printout',
    isomalt: 'Isomalt (Sugar Glass)',
    dragees: 'Dragees (Pearls)',
    edible_flowers: 'Edible Flowers',
    edible_photo_side: 'Printout (Edible)',
    icing_doodle: 'Piped Doodles',
    icing_palette_knife: 'Palette Knife Finish',
    icing_brush_stroke: 'Brush Stroke Finish',
    icing_splatter: 'Splatter Finish',
    icing_minimalist_spread: 'Minimalist Spread',
    plastic_ball_regular: 'Plastic Ball',
    plastic_ball_disco: 'Disco Ball',
    plastic_ball: 'Plastic Ball',
    macarons: 'Macarons',
    meringue: 'Meringue',
    gumpaste_bundle: 'Gumpaste Bundle',
    candy: 'Candy',
    gumpaste_panel: 'Gumpaste Panel',
    icing_decorations: 'Icing Decorations',
    gumpaste_creations: 'Gumpaste Creations',
    marshmallows: 'Marshmallows',
    edible_3d_ordinary: 'Gumpaste (3D Ordinary)',
    fresh_flowers: 'Fresh Flowers',
    artificial_flowers: 'Artificial Flowers',
};

const getDecorationMaterialLabel = (item: MainTopperUI | SupportElementUI) => {
    if ('classification' in item) {
        return topperMaterialLabelMap[item.type] || item.type.replace(/_/g, ' ');
    }

    return supportMaterialLabelMap[item.type] || item.type.replace(/_/g, ' ');
};


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
    mainToppers,
    supportElements,
    basePriceOptions,
    isAnalyzing,
    isRejectionError = false,
    activeCustomization,
    selectedItemId,
    setActiveCustomization,
    setSelectedItem,
    addCakeMessage,
    removeCakeMessage,
    openTopperSheet,
    onCakeInfoChange,
    onIcingTypeChange,
    addOnPricing = 0,
    separateIcingStep = false,
    aiChatNode,
    hideStepOne,
    hideStepFour,
    photoStepNode,
}: CustomizingStepSummarySectionsProps) {
    // Default position when "+ Add" is clicked: Bento → front (side), all others → base_board
    const defaultMessagePosition = cakeInfo?.type === 'Bento' ? 'side' : 'base_board';
    const [showIcingChoice, setShowIcingChoice] = React.useState(true);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
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
    const containerClassName = isDesktop
        ? 'w-full hidden md:flex flex-row md:flex-col overflow-x-auto md:overflow-x-hidden gap-2 pb-6 md:pb-4 scrollbar-hide snap-x md:snap-none relative z-60'
        : 'w-full mt-0 flex flex-col gap-2 pb-4 md:hidden';
    const cardClassName = isDesktop
        ? 'shrink-0 md:shrink w-fit md:w-full min-w-[280px] md:min-w-0 snap-start genie-card p-2 rounded-2xl'
        : 'w-full min-w-0 genie-card p-2 rounded-2xl';
    const itemsClassName = isDesktop ? 'flex gap-[7px] pt-1 pb-1 w-max md:w-full flex-wrap' : 'flex gap-[7px] pt-1 pb-1 w-full flex-wrap';
    const stepOneItemsViewportClassName = 'w-full overflow-x-auto overflow-y-hidden scrollbar-hide';
    const stepOneItemsClassName = 'flex gap-2.5 pt-1 pb-2 w-max min-w-max flex-nowrap snap-x snap-mandatory';

    // Auto-correct flavors based on cake type restrictions
    React.useEffect(() => {
        if (!cakeInfo?.flavors || !onCakeInfoChange) return;

        const isBento = cakeInfo.type === 'Bento';
        const normType = cakeInfo.type.toLowerCase();
        const isStandardOrMulti = normType.includes('1 tier') || 
                                   normType.includes('2 tier') || 
                                   normType.includes('3 tier') || 
                                   normType.includes('square') || 
                                   normType.includes('rectangle');

        let hasChange = false;
        const newFlavors = [...cakeInfo.flavors];

        newFlavors.forEach((flavor, index) => {
            let isDisabled = false;
            if (isBento) {
                isDisabled = flavor !== 'Chocolate Cake';
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

    // Dynamic Step Numbering
    let currentStep = 1;
    const stepOneNumber = !hideStepOne ? currentStep++ : null;
    const icingStepNumber = (separateIcingStep && cakeInfo) ? currentStep++ : null;
    const photoStepNumber = photoStepNode ? currentStep++ : null;
    const messageStepNumber = currentStep++;
    const topperStepNumber = showAdvanced && !hideStepFour ? currentStep++ : null;
    const aiChatStepNumber = showAdvanced ? currentStep++ : null;

    const combinedDecorItems = getCombinedDecorItems(mainToppers, supportElements);
    const combinedDecorSummary = buildCombinedDecorSummary(mainToppers, supportElements);
    const icingSummaryItems = icingDesign && cakeInfo ? [
        { id: 'icing-edit-drip', description: 'Drip', label: 'Drip', alt: 'Drip', imageType: 'drip' as const, enabled: icingDesign.drip },
        { id: 'icing-edit-borderTop', description: 'Top', label: 'Top Border', alt: 'Top Border', imageType: 'borderTop' as const, enabled: icingDesign.border_top },
        { id: 'icing-edit-borderBase', description: 'Bottom', label: 'Base Border', alt: 'Base Border', imageType: 'borderBase' as const, enabled: icingDesign.border_base },
        { id: 'icing-edit-top', description: 'Top Icing', label: 'Top Icing', alt: 'Top Icing', imageType: 'top' as const, enabled: true, isTopSpecific: true },
        { id: 'icing-edit-side', description: 'Side Icing', label: 'Body Icing', alt: 'Body Icing', imageType: 'side' as const, enabled: true },
        { id: 'icing-edit-gumpasteBaseBoard', description: 'Board', label: 'Board', alt: 'Base Board', imageType: 'gumpasteBaseBoard' as const, enabled: icingDesign.gumpasteBaseBoard },
    ].filter(item => item.enabled || (activeCustomization === 'icing' && selectedItemId === item.id)).map((item) => {
        const isSelected = activeCustomization === 'icing' && selectedItemId === item.id;
        const isEnabled = item.enabled || isSelected;

        return (
            <button
                key={item.id}
                onClick={() => {
                    setActiveCustomization('icing');
                    setSelectedItem({ id: item.id, itemCategory: 'icing', description: item.description, cakeType: cakeInfo.type });
                }}
                className="group flex flex-col items-center gap-1 min-w-[60px]"
            >
                <div className={`w-14 h-14 rounded-full border border-purple-100 overflow-hidden relative group-hover:border-purple-400 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${isSelected ? 'genie-control-selected' : isEnabled ? 'ring-2 ring-purple-400' : ''}`}>
                    <LazyImage
                        src={getIcingImage(icingDesign, item.imageType, item.isTopSpecific)}
                        alt={item.alt}
                        width={36}
                        height={36}
                        containerClassName="w-full h-full flex items-center justify-center"
                        imageClassName="w-full h-full object-contain"
                    />
                </div>
                <span className="text-[10px] text-center text-slate-600 font-medium leading-tight max-w-[64px] line-clamp-2 mt-0.5">{item.label}</span>
            </button>
        );
    }) : null;

    return (
        <div className={containerClassName}>
            {cakeInfo && !isAnalyzing && !isRejectionError && !hideStepOne && (
                <div 
                    ref={stepOneCardRef} 
                    className={`${cardClassName} relative z-10`}
                >
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-1.5 px-1">Step {stepOneNumber}: Cake Options</h3>
                    
                    <div className="flex flex-col gap-2 px-1 pb-2">
                        {/* Line 1: Icing Type */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Icing Type</span>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { id: 'soft_icing', label: 'Soft Icing' },
                                    { id: 'fondant', label: 'Fondant' },
                                ].map((option) => {
                                    const isSelected = getIcingTypeValue(cakeInfo, icingDesign) === (option.id === 'fondant' ? 'Fondant' : 'Soft Icing');
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => onIcingTypeChange?.(option.id as any)}
                                            className={`flex-1 flex items-center justify-center p-2.5 rounded-xl border transition-all duration-300 ${
                                                isSelected 
                                                    ? 'border-purple-300 bg-purple-50 text-purple-700 shadow-sm ring-2 ring-purple-100' 
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-200 hover:bg-slate-100/50'
                                            }`}
                                        >
                                            <span className="text-[12px] font-bold">{option.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Line 2: Cake Type */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cake Type</span>
                            <div className="flex flex-nowrap overflow-x-auto gap-3 py-1 px-1 scrollbar-hide">
                                {(() => {
                                    const currentIcingType = getIcingTypeValue(cakeInfo, icingDesign);
                                    const allTypes = getCakeTypesForIcingBase(currentIcingType === 'Fondant' ? 'fondant' : 'soft_icing');
                                    
                                    // Normalize type by stripping " Fondant" suffix for grouping checks
                                    const normalizeForGroup = (t: string) => t.replace(/\s+Fondant$/i, '');
                                    
                                    const standardGroup = ['Bento', '1 Tier', 'Square', 'Rectangle'];
                                    const multiTierGroup = ['2 Tier', '3 Tier'];
                                    
                                    const currentBaseType = normalizeForGroup(cakeInfo.type);
                                    const isCurrentlyStandard = standardGroup.includes(currentBaseType);
                                    
                                    const filteredTypes = allTypes.filter(t => {
                                        const baseT = normalizeForGroup(t);
                                        return isCurrentlyStandard ? standardGroup.includes(baseT) : multiTierGroup.includes(baseT);
                                    });

                                    return filteredTypes.map((type) => {
                                        const isSelected = cakeInfo.type === type;
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => onCakeInfoChange?.({ type })}
                                                className={`min-h-[49px] min-w-[90px] flex-1 flex items-center justify-center px-4 rounded-xl border transition-all duration-300 ${
                                                    isSelected 
                                                        ? 'border-purple-300 bg-purple-50 text-purple-700 shadow-sm ring-2 ring-purple-100 scale-[1.02]' 
                                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-200 hover:bg-slate-100/50'
                                                }`}
                                            >
                                                <span className="text-[12px] font-bold text-center leading-none whitespace-nowrap">{type}</span>
                                            </button>
                                        );
                                    });
                                })()}
                            </div>
                        </div>


                        {/* Size, Height, and Flavor 2-Column Container */}
                        <div className="flex flex-row gap-4 w-full mt-2 bg-transparent">
                            {/* Left Column (75%) */}
                            <div className="flex-[3] min-w-0 flex flex-col gap-4">
                                {/* Line 3: Size */}
                                {basePriceOptions && basePriceOptions.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Size</span>
                                        <div 
                                            ref={sizeScrollRef}
                                            key={cakeInfo.type} 
                                            className="flex flex-nowrap overflow-x-auto justify-start items-center gap-4 py-1.5 px-2 scrollbar-hide"
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
                                                                width: isRectangle ? `${diameter * 1.4}px` : `${diameter}px`, 
                                                                height: `${diameter}px`,
                                                                animationDelay: `${index * 50}ms`
                                                            }}
                                                            className={`shrink-0 flex flex-col items-center justify-center border transition-all duration-500 group relative animate-fade-in-scale opacity-0 ${
                                                                isSquare || isRectangle ? 'rounded-xl' : 'rounded-full'
                                                            } ${
                                                                isSelected 
                                                                    ? 'border-purple-400 bg-purple-50 text-purple-700 shadow-md ring-2 ring-purple-100 z-10 scale-105' 
                                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-300 hover:bg-slate-100/50 hover:scale-105'
                                                            }`}
                                                        >
                                                            <span className="text-[11px] font-extrabold text-center leading-none px-1 uppercase tracking-tight">{option.size.replace(' Round', '')}</span>
                                                            <span className={`text-[10px] font-bold mt-1 ${isSelected ? 'text-purple-600' : 'text-slate-400 group-hover:text-purple-400'}`}>
                                                                ₱{totalPrice.toLocaleString()}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* Line 4: Height */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Height</span>
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
                                                    className="flex flex-col items-center gap-2 group transition-all animate-fade-in-scale opacity-0"
                                                >
                                                    <div 
                                                        style={{ width: `${rectWidth}px`, height: `${rectHeight}px` }}
                                                        className={`rounded-lg border-2 transition-all duration-500 flex items-center justify-center relative ${
                                                            isSelected 
                                                                ? 'bg-purple-100/50 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)] scale-110 z-10' 
                                                                : 'bg-slate-50 border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 hover:scale-105'
                                                        }`}
                                                    >
                                                        <span className={`text-[10px] font-black ${isSelected ? 'text-purple-600' : 'text-slate-600 group-hover:text-purple-300'} transition-colors`}>
                                                            {heightValue}"
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column (25%) */}
                            <div className="flex-[1] min-w-0 border-l border-slate-100 pl-4 flex flex-col gap-4">
                                {/* Line 5: Flavor */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Flavor</span>
                                    <div className="flex flex-col gap-2">
                                        {cakeInfo.flavors.map((currentFlavor, index) => (
                                            <div key={index} className="flex flex-col gap-1">
                                                {cakeInfo.flavors.length > 1 && (
                                                    <span className="text-[9px] font-medium text-slate-500 uppercase">{getStepOneFlavorLabel(index, cakeInfo.flavors.length)}</span>
                                                )}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {FLAVOR_OPTIONS.map((flavor) => {
                                                        const isSelected = currentFlavor === flavor;
                                                        
                                                        const isBento = cakeInfo.type === 'Bento';
                                                        const normType = cakeInfo.type.toLowerCase();
                                                        const isStandardOrMulti = normType.includes('1 tier') || 
                                                                                    normType.includes('2 tier') || 
                                                                                    normType.includes('3 tier') || 
                                                                                    normType.includes('square') || 
                                                                                    normType.includes('rectangle');

                                                        let isDisabled = false;
                                                        if (isBento) {
                                                            isDisabled = flavor !== 'Chocolate Cake';
                                                        } else if (isStandardOrMulti) {
                                                            isDisabled = flavor === 'Mocha Cake';
                                                        }

                                                        const flavorStyles: Record<string, { bg: string, border: string, text: string, activeBg: string, activeBorder: string, activeText: string }> = {
                                                            'Chocolate Cake': { 
                                                                bg: 'bg-[#fdf0d5]', border: 'border-[#f2cc8f]', text: 'text-[#78350f]',
                                                                activeBg: 'bg-[#DDB892]', activeBorder: 'border-[#7f5539]', activeText: 'text-white'
                                                            },
                                                            'Ube Cake': { 
                                                                bg: 'bg-[#f3e8ff]', border: 'border-[#e9d5ff]', text: 'text-[#6b21a8]',
                                                                activeBg: 'bg-[#c084fc]', activeBorder: 'border-[#7e22ce]', activeText: 'text-white'
                                                            },
                                                            'Vanilla Cake': { 
                                                                bg: 'bg-[#fffbeb]', border: 'border-[#fef3c7]', text: 'text-[#92400e]',
                                                                activeBg: 'bg-[#fde68a]', activeBorder: 'border-[#d97706]', activeText: 'text-[#92400e]'
                                                            },
                                                            'Mocha Cake': { 
                                                                bg: 'bg-[#faf3e0]', border: 'border-[#e6ccb2]', text: 'text-[#9c6644]',
                                                                activeBg: 'bg-[#e3d5ca]', activeBorder: 'border-[#9c6644]', activeText: 'text-[#5e3023]'
                                                            },
                                                        };

                                                        const style = flavorStyles[flavor] || { 
                                                            bg: 'bg-white', border: 'border-slate-100', text: 'text-slate-600',
                                                            activeBg: 'bg-purple-50', activeBorder: 'border-purple-300', activeText: 'text-purple-700'
                                                        };

                                                        return (
                                                            <button
                                                                key={flavor}
                                                                disabled={isDisabled}
                                                                onClick={() => {
                                                                    if (isDisabled) return;
                                                                    const newFlavors = [...cakeInfo.flavors];
                                                                    newFlavors[index] = flavor;
                                                                    onCakeInfoChange?.({ flavors: newFlavors });
                                                                }}
                                                                className={`min-h-[46px] min-w-[90px] flex-1 flex items-center justify-center px-3 rounded-xl border transition-all duration-300 shadow-sm ${
                                                                    isDisabled
                                                                        ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50 grayscale'
                                                                        : isSelected 
                                                                            ? `${style.activeBg} ${style.activeBorder} ${style.activeText} scale-[1.02] ring-2 ring-white/50` 
                                                                            : `${style.bg} ${style.border} ${style.text} opacity-80 hover:opacity-100 hover:scale-[1.02]`
                                                                }`}
                                                            >
                                                                <span className="text-[12px] font-bold text-center leading-none uppercase tracking-tighter">{flavor.replace(' Cake', '')}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && (
                separateIcingStep ? (
                    <div className={cardClassName}>
                        <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step {icingStepNumber}: Icing Colors</h3>
                        <div className={itemsClassName}>
                            {icingSummaryItems}
                        </div>
                    </div>
                ) : null
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && photoStepNode && (
                <div className={cardClassName}>
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step {photoStepNumber}: Upload Your Photo</h3>
                    {photoStepNode}
                </div>
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && (
                <div className={cardClassName}>
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step {messageStepNumber}: Cake Messages</h3>
                    {cakeMessages.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {cakeMessages.map((message, index) => (
                                <div
                                    key={message.id || index}
                                    className={`flex items-center gap-3 py-[9px] px-4 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors cursor-pointer group ${!message.isEnabled ? 'opacity-40' : ''}`}
                                    onClick={() => {
                                        setSelectedItem({ ...message, itemCategory: 'message' });
                                        setActiveCustomization('messages');
                                    }}
                                >
                                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider shrink-0">{getMessagePositionLabel(message.position)}</span>
                                    <span className={`text-sm font-medium truncate flex-1 ${message.text || message.originalMessage?.text ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                        {message.text || message.originalMessage?.text || 'New Message'}
                                    </span>
                                    <div className="w-4 h-4 rounded-full border border-slate-200 shrink-0 shadow-sm" style={{ backgroundColor: message.color || '#000000' }} />
                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            removeCakeMessage(message.id);
                                        }}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-1 shrink-0"
                                        aria-label="Delete message"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <div className="flex justify-center mt-2">
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setActiveCustomization('messages');
                                        setSelectedItem(null);
                                        addCakeMessage?.(defaultMessagePosition);
                                    }}
                                    className="genie-btn-secondary text-[10px] font-bold py-2 px-5 rounded-full"
                                >
                                    <span className="text-base leading-none">+</span> Add message
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center py-2">
                            <button
                                className="genie-btn-secondary text-[10px] font-bold py-2 px-5 rounded-full"
                                onClick={() => {
                                    setActiveCustomization('messages');
                                    setSelectedItem(null);
                                    addCakeMessage?.(defaultMessagePosition);
                                }}
                            >
                                <span className="text-base leading-none">+</span> Add a cake message
                            </button>
                        </div>
                    )}
                </div>
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && (
                <div className="px-1 py-1">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 group shadow-sm ${
                            showAdvanced 
                                ? 'bg-purple-50 border-purple-200 text-purple-700' 
                                : 'bg-white border-slate-100 text-slate-700 hover:border-purple-100 hover:bg-purple-50/30'
                        }`}
                        aria-expanded={showAdvanced}
                        aria-controls="advanced-customization-steps"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                                showAdvanced ? 'bg-purple-200 text-purple-600' : 'bg-slate-50 text-slate-400 group-hover:bg-purple-100 group-hover:text-purple-500'
                            }`}>
                                <Wand2 className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <span className="block text-sm font-bold leading-tight">Advanced Customization</span>
                                <span className="block text-[10px] font-medium text-slate-500 mt-0.5">
                                    {showAdvanced ? 'Hide additional options' : 'Decorations, AI chat and more'}
                                </span>
                            </div>
                        </div>
                        <div className={`transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}>
                            <ChevronDown className={`w-5 h-5 ${showAdvanced ? 'text-purple-500' : 'text-slate-300'}`} />
                        </div>
                    </button>
                </div>
            )}

            <div 
                id="advanced-customization-steps" 
                className={`flex flex-col gap-2 transition-all duration-500 ease-in-out overflow-hidden ${
                    showAdvanced ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                }`}
            >
                {cakeInfo && !isAnalyzing && !isRejectionError && !hideStepFour && (
                    <div className={cardClassName}>
                        <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step {topperStepNumber}: Cake Decorations</h3>
                        {combinedDecorItems.length > 0 ? (
                            <div className="space-y-2">
                                {combinedDecorItems.slice(0, 3).map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedItem({
                                                ...item,
                                                itemCategory: ('classification' in item ? 'topper' : 'element'),
                                            } as ClusteredMarker);
                                            openTopperSheet('classification' in item ? 'main' : 'support');
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-purple-100 bg-white/90 hover:bg-purple-50/70 transition-colors text-left"
                                    >
                                        <div className="min-w-0 flex-1 flex items-center gap-2 text-[11px] leading-5">
                                            <span className="shrink-0 font-semibold text-slate-700">
                                                {item.quantity && item.quantity > 1 ? `${item.quantity}x` : '1x'}
                                            </span>
                                            <span className="truncate text-slate-500">
                                                {item.description}{' '}
                                                <span className="text-slate-400">
                                                    ({getDecorationMaterialLabel(item)})
                                                </span>
                                            </span>
                                        </div>
                                    </button>
                                ))}

                                {combinedDecorItems.length > 3 && (
                                    <div className="flex justify-center pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedItem(null);
                                                openTopperSheet();
                                            }}
                                            className="genie-btn-secondary text-[10px] font-bold py-2 px-5 rounded-full"
                                        >
                                            Show more
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-purple-100 bg-white/90 text-left">
                                <div className="min-w-0 flex-1 flex items-center gap-2 text-[11px] leading-5">
                                    <span className="shrink-0 font-semibold text-slate-700">
                                        Decorations (0):
                                    </span>
                                    <span className="truncate text-slate-500">
                                        {combinedDecorSummary}
                                    </span>
                                </div>
                            </div>
                        )}

                        {mainToppers.some((topper) => topper.type === 'toy') && (
                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                                <span className="text-amber-500 text-sm">💡</span>
                                <p className="text-[11px] text-amber-700 leading-tight">
                                    <span className="font-semibold">Tip:</span> Switch from toy toppers to edible or printed toppers to reduce the total price!
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {cakeInfo && !isAnalyzing && !isRejectionError && aiChatNode && (
                    <div className={cardClassName}>
                        <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step {aiChatStepNumber}: AI Customization Help</h3>
                        <div className="mt-1">
                            {aiChatNode}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
