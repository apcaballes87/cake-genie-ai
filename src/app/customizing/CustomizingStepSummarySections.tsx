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
import { getIcingBucketName } from '@/utils/colorUtils';
import { getIcingImage, type IcingImageType } from '@/utils/icingImage';
import { TrashIcon, MagicSparkleIcon } from '@/components/icons';
import { roundDownToNearest99 } from '@/lib/utils/pricing';
import type { BasePriceInfo, CakeInfoUI, CakeMessageUI, ClusteredMarker, IcingDesignUI, IcingGroup, MainTopperType, MainTopperUI, SupportElementType, SupportElementUI } from '@/types';

type LayoutMode = 'mobile' | 'desktop';
type StepOneItemKind = 'type' | 'size' | 'height' | 'flavor' | 'icing';
type MaskStatus = 'idle' | 'generating' | 'ready' | 'error';

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
    onIcingDesignChange?: (newDesign: IcingDesignUI) => void;
    addOnPricing?: number;
    separateIcingStep?: boolean;
    aiChatNode?: React.ReactNode;
    hideStepOne?: boolean;
    hideStepFour?: boolean;
    photoStepNode?: React.ReactNode;
    onUpdateDesign?: (instruction?: string, colorMeta?: { hex: string; name: string }) => void;
    isUpdatingDesign?: boolean;
    dirtyFields?: Set<string>;
    originalCakeType?: string | null;
    /** When provided, the main color swatch row uses the mask-based instant recolor
     *  instead of calling onUpdateDesign (Gemini) for icing body color changes. */
    onIcingColorRecolor?: (hex: string, name: string) => void;
    /** When provided, a "Fix Mask" button is shown at the end of the color swatch row
     *  to let users regenerate the icing mask for better quality. */
    onRegenerateMask?: () => void;
    /** Disables the mask overlay, reverting to the original un-recolored image.
     *  Called when the user clicks the same color again (toggle), the main circle, or the default color. */
    onDisableMask?: () => void;
    /** Whether the mask recolor overlay is currently active (showing a recolored image). */
    isMaskActive?: boolean;
    /** When true, shows a pulsing 'Loading Different Icing Colors' hint below the color swatches
     *  while the AI icing mask is being generated silently in the background. */
    isGeneratingMask?: boolean;
    /** Disables swatch clicks while the studio background edit is in flight (avoids stale
     *  recolors on top of a pre-existing studio edit). */
    isStudioBackgroundEditingPending?: boolean;
    /** Status of the mask overlay; used to render a hint (pulse / error) and gate swatch clicks. */
    maskStatus?: MaskStatus;
}

const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
    if (!element || typeof window === 'undefined') {
        return null;
    }

    let currentParent = element.parentElement;

    while (currentParent) {
        const { overflowY } = window.getComputedStyle(currentParent);
        const canScrollVertically = /(auto|scroll|overlay)/.test(overflowY);

        if (canScrollVertically && currentParent.scrollHeight > currentParent.clientHeight + 1) {
            return currentParent;
        }

        currentParent = currentParent.parentElement;
    }

    return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
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
    edible_photo_print: 'Printout (Edible)',
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
    edible_photo_print: 'Printout (Edible)',
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
    satin_ribbon: 'Satin/Organza Ribbon',
};

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
    removeCakeMessage,
    updateMainTopper,
    updateSupportElement,
    onTopperImageReplace,
    onSupportElementImageReplace,
    openTopperSheet,
    onCakeInfoChange,
    onIcingTypeChange,
    onIcingDesignChange,
    addOnPricing = 0,
    separateIcingStep = false,
    aiChatNode,
    hideStepOne,
    hideStepFour,
    photoStepNode,
    onUpdateDesign,
    isUpdatingDesign,
    dirtyFields,
    originalCakeType,
    onIcingColorRecolor,
    onRegenerateMask,
    onDisableMask,
    isMaskActive = false,
    isGeneratingMask = false,
    isStudioBackgroundEditingPending = false,
    maskStatus = 'idle',
}: CustomizingStepSummarySectionsProps) {
    // Default position when "+ Add" is clicked: Bento → front (side), all others → base_board
    const defaultMessagePosition = cakeInfo?.type === 'Bento' ? 'side' : 'base_board';
    const [showIcingChoice, setShowIcingChoice] = React.useState(true);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const stepOneCardRef = React.useRef<HTMLDivElement | null>(null);
    const advancedSectionRef = React.useRef<HTMLDivElement | null>(null);
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

    React.useEffect(() => {
        if (!showAdvanced || layout !== 'desktop' || !advancedSectionRef.current) {
            return;
        }

        const scrollAdvancedIntoView = () => {
            const advancedSection = advancedSectionRef.current;
            if (!advancedSection) {
                return;
            }

            const scrollParent = findScrollableParent(advancedSection);
            const targetElement = advancedSection.firstElementChild instanceof HTMLElement
                ? advancedSection.firstElementChild
                : advancedSection;

            if (!scrollParent || scrollParent === document.scrollingElement) {
                targetElement.scrollIntoView({
                    block: 'start',
                    inline: 'nearest',
                    behavior: 'smooth',
                });
                return;
            }

            const parentRect = scrollParent.getBoundingClientRect();
            const targetRect = targetElement.getBoundingClientRect();
            const targetTop = scrollParent.scrollTop + (targetRect.top - parentRect.top) - 16;

            scrollParent.scrollTo({
                top: Math.max(0, targetTop),
                behavior: 'smooth',
            });
        };

        const animationFrame = requestAnimationFrame(scrollAdvancedIntoView);
        const followUpTimeout = window.setTimeout(scrollAdvancedIntoView, 220);

        return () => {
            cancelAnimationFrame(animationFrame);
            window.clearTimeout(followUpTimeout);
        };
    }, [showAdvanced, layout]);

    const isDesktop = layout === 'desktop';
    const cakeType = cakeInfo?.type?.toLowerCase() || '';
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
            ? 'shrink-0 min-h-[37px] min-w-[92px] flex items-center justify-center px-2 rounded-xl border transition-all duration-300 shadow-sm'
            : 'min-h-[37px] min-w-[90px] flex-1 flex items-center justify-center px-3 py-1 rounded-xl border transition-all duration-300 shadow-sm';

        return (
            <div key={index} className="flex flex-col gap-1">
                {currentFlavors.length > 1 && (
                    <span className="text-[9px] font-medium text-slate-500 uppercase">{getStepOneFlavorLabel(index, currentFlavors.length)}</span>
                )}
                <div className={rowClassName}>
                    {FLAVOR_OPTIONS.map((flavor) => {
                        const isSelected = currentFlavor === flavor;

                        const isBento = currentCakeType === 'Bento';
                        const normType = currentCakeType.toLowerCase();
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
                                <span className="text-[9px] font-bold text-center leading-none uppercase tracking-tighter">{flavor.replace(' Cake', '')}</span>
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

    const combinedDecorItems = getCombinedDecorItems(mainToppers, supportElements);
    const combinedDecorSummary = buildCombinedDecorSummary(mainToppers, supportElements);
    const mainColorOptionsNode = cakeInfo ? (
        <div className={`${cardClassName} max-md:py-1 max-md:px-1.5`}>
            <div className="flex items-center gap-2 px-1 pb-0.5 md:gap-3">
                {/* Color toggle switch — ON shows chosen color, OFF shows gray */}
                {onIcingColorRecolor || onDisableMask ? (() => {
                    const activeColor = icingDesign?.colors?.side || icingDesign?.colors?.top || '#FFFFFF';
                    const handleToggle = () => {
                        if (isMaskActive) {
                            onDisableMask?.();
                        } else {
                            const colorName = getIcingBucketName(activeColor);
                            onIcingColorRecolor?.(activeColor, colorName);
                        }
                    };
                    const isToggleDisabled = isUpdatingDesign || isStudioBackgroundEditingPending || maskStatus === 'generating';
                    return (
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                Icing
                            </span>
                            <button
                                type="button"
                                onClick={handleToggle}
                                disabled={isToggleDisabled}
                                aria-label={isMaskActive ? 'Turn off icing recolor' : 'Turn on icing recolor'}
                                title={isMaskActive ? 'Turn off icing recolor' : 'Turn on icing recolor'}
                                className={`relative w-[52px] h-[28px] md:w-[60px] md:h-[32px] rounded-full shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-300 ${isToggleDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                style={{ backgroundColor: isMaskActive ? activeColor : '#cbd5e1' }}
                            >
                                {/* Knob */}
                                <span
                                    className="absolute top-[3px] md:top-[4px] w-[22px] h-[22px] md:w-[24px] md:h-[24px] rounded-full bg-white shadow transition-all duration-300"
                                    style={{ left: isMaskActive ? 'calc(100% - 25px)' : '3px' }}
                                />
                            </button>
                        </div>
                    );
                })() : (
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Main</span>
                        <div
                            className="md:w-10 md:h-10 w-[34px] h-[34px] rounded-full border-2 border-white shadow-md ring-1 ring-slate-100 shrink-0"
                            style={{ backgroundColor: icingDesign?.colors?.side || icingDesign?.colors?.top || '#FFFFFF' }}
                        />
                    </div>
                )}

                <div className="w-px md:h-10 h-[34px] bg-slate-100 shrink-0" />

                <div className="flex-1 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-1 py-0.5 px-1">
                        {THEME_COLORS.map((color) => {
                            const currentColorHex = icingDesign?.colors?.side || icingDesign?.colors?.top || '#FFFFFF';
                            const currentColorName = getIcingBucketName(currentColorHex);
                            const isSwatchDisabled = isUpdatingDesign || isStudioBackgroundEditingPending || maskStatus === 'generating';

                            return (
                                <button
                                    key={color.name}
                                    onClick={() => {
                                        if (isSwatchDisabled) return;
                                        if (icingDesign && onIcingDesignChange) {
                                            onIcingDesignChange({
                                                ...icingDesign,
                                                colors: {
                                                    ...icingDesign.colors,
                                                    top: color.hex,
                                                    side: color.hex,
                                                },
                                            });
                                        }
                                        if (onIcingColorRecolor) {
                                            // Mask-based instant recolor — no Gemini call needed.
                                            onIcingColorRecolor(color.hex, color.name);
                                        } else {
                                            const instruction = currentColorName
                                                ? `Change the dominant color of the cake from ${currentColorName} to ${color.name}.`
                                                : `Change the dominant color theme of the cake to ${color.name}.`;
                                            onUpdateDesign?.(instruction, { hex: color.hex, name: color.name });
                                        }
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
                        {onRegenerateMask && (
                            <button
                                type="button"
                                onClick={onRegenerateMask}
                                disabled={isUpdatingDesign || isStudioBackgroundEditingPending || maskStatus === 'generating'}
                                className={`group relative flex flex-col items-center gap-1 shrink-0 transition-transform active:scale-95 ${isUpdatingDesign || isStudioBackgroundEditingPending || maskStatus === 'generating' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Regenerate icing mask for better quality"
                            >
                                <div className="md:w-8 md:h-8 w-[27px] h-[27px] rounded-full border border-dashed border-slate-300 shadow-sm flex items-center justify-center bg-slate-50 group-hover:border-purple-300 group-hover:bg-purple-50 transition-all">
                                    <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </div>
                                <span className="text-[7px] font-medium text-slate-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                    Fix
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    ) : null;
    const cakeTypeSelectorNode = cakeInfo ? (() => {
        const currentIcingType = getIcingTypeValue(cakeInfo, icingDesign);
        const allTypes = getCakeTypesForIcingBase(currentIcingType === 'Fondant' ? 'fondant' : 'soft_icing');

        // Keep the current family grouping intact so shape changes stay scoped.
        const normalizeForGroup = (type: string) => type.replace(/\s+Fondant$/i, '');
        const standardGroup = ['Bento', '1 Tier', 'Square', 'Rectangle'];
        const multiTierGroup = ['2 Tier', '3 Tier'];
        const currentBaseType = normalizeForGroup(cakeInfo.type);
        const isCurrentlyStandard = standardGroup.includes(currentBaseType);

        const filteredTypes = allTypes.filter((type) => {
            const baseType = normalizeForGroup(type);
            return isCurrentlyStandard ? standardGroup.includes(baseType) : multiTierGroup.includes(baseType);
        });

        return (
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cake Type</span>
                <div className="flex flex-nowrap overflow-x-auto gap-3 py-1 px-1 scrollbar-hide">
                    {filteredTypes.map((type) => {
                        const isSelected = cakeInfo.type === type;

                        return (
                            <button
                                key={type}
                                onClick={() => onCakeInfoChange?.({ type })}
                                className={`min-h-[32px] min-w-[90px] flex-1 flex items-center justify-center px-2 rounded-xl border transition-all duration-300 ${
                                    isSelected
                                        ? 'genie-control-selected text-purple-700 scale-[1.02]'
                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-200 hover:bg-slate-100/50'
                                }`}
                            >
                                <span className="text-[9px] font-bold text-center leading-none whitespace-nowrap">{type}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    })() : null;
    const cakeTypeUpdateNode = cakeInfo ? (() => {
        const normalizeType = (type: string) => type.replace(/\s+Fondant$/i, '').trim();
        const currentBaseType = normalizeType(cakeInfo.type);
        const originalBaseType = originalCakeType ? normalizeType(originalCakeType) : null;
        const isTypeDirty = originalBaseType && currentBaseType !== originalBaseType;
        const isUpdateableType = ['Bento', '1 Tier', 'Square', 'Rectangle'].includes(currentBaseType);

        if (!isTypeDirty || !isUpdateableType) {
            return null;
        }

        return (
            <div className="mt-3 px-1 animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col items-center">
                <button
                    onClick={() => onUpdateDesign?.()}
                    disabled={isUpdatingDesign}
                    className="w-auto px-8 py-2 rounded-full genie-btn-primary flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.98] group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-linear-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                    {isUpdatingDesign ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="font-bold text-[10px] tracking-tight uppercase">Updating...</span>
                        </>
                    ) : (
                        <>
                            <MagicSparkleIcon className="w-3.5 h-3.5 text-white group-hover:rotate-12 transition-transform" />
                            <span className="font-bold text-[10px] tracking-tight uppercase italic whitespace-nowrap">Update design changes</span>
                        </>
                    )}
                </button>
                <p className="text-[9px] text-slate-400 mt-1.5 text-center font-medium italic opacity-80">
                    ✨ This will update the cake shape/type using AI
                </p>
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
            {cakeInfo && !isAnalyzing && !isRejectionError && mainColorOptionsNode}

            {/* Pulsing hint shown while AI icing mask generates silently in background,
                or a red error banner when the mask generation fails. */}
            {cakeInfo && !isAnalyzing && !isRejectionError && (() => {
                const showPulse = isGeneratingMask || maskStatus === 'generating';
                const showError = maskStatus === 'error';
                const isVisible = showPulse || showError;
                if (!isVisible) return null;
                return (
                    <p
                        className={`text-center text-[10px] font-medium tracking-wide transition-opacity duration-700 ${
                            showError
                                ? 'text-red-600'
                                : 'text-purple-600 animate-pulse'
                        } ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}
                        aria-live={showError ? 'assertive' : 'polite'}
                        role={showError ? 'alert' : undefined}
                    >
                        {showError
                            ? '⚠️ Couldn\'t load different icing colors. Tap the Fix button to retry.'
                            : '✨ Loading Different Icing Colors'}
                    </p>
                );
            })()}

            {cakeInfo && !isAnalyzing && !isRejectionError && !hideStepOne && (
                <div 
                    ref={stepOneCardRef} 
                    className={`${cardClassName} relative z-10`}
                >
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
                                            onClick={() => onIcingTypeChange?.(option.id as IcingDesignUI['base'])}
                                            className={`flex-1 min-h-[32px] flex items-center justify-center px-2.5 py-0.5 rounded-xl border transition-all duration-300 ${
                                                isSelected 
                                                    ? 'genie-control-selected text-purple-700 scale-[1.02]' 
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-purple-200 hover:bg-slate-100/50'
                                            }`}
                                        >
                                            <span className="text-[9px] font-bold">{option.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Size, Height, and Flavor Container */}
                        <div className={isTieredFlavorLayout ? 'flex flex-col gap-4 w-full mt-2 bg-transparent' : 'flex flex-row gap-4 w-full mt-2 bg-transparent'}>
                            {!isTieredFlavorLayout ? (
                                <div className="flex-1 min-w-0 flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Flavor</span>
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
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Size</span>
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
                                                                width: isRectangle ? `${diameter * 1.4}px` : `${diameter}px`, 
                                                                height: `${diameter}px`,
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
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                                                    className="flex flex-col items-center gap-2 group transition-all animate-fade-in-scale opacity-0"
                                                >
                                                    <div 
                                                        style={{ width: `${rectWidth}px`, height: `${rectHeight}px` }}
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
                            </div>

                            {/* Multi-tier Flavor Rows */}
                            {isTieredFlavorLayout ? (
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Flavor</span>
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
                                    {showAdvanced ? 'Hide additional options' : 'Cake type, decorations, AI chat and more'}
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
                ref={advancedSectionRef}
                id="advanced-customization-steps" 
                aria-hidden={!showAdvanced}
                className={`flex flex-col gap-2 transition-all duration-500 ease-in-out ${
                    showAdvanced ? 'max-h-[2000px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 pointer-events-none overflow-hidden'
                }`}
            >
                {cakeInfo && !isAnalyzing && !isRejectionError && cakeTypeSelectorNode && (
                    <div className={cardClassName}>
                        <div className="flex flex-col gap-2 px-1 pb-2">
                            {cakeTypeSelectorNode}
                            {cakeTypeUpdateNode}
                        </div>
                    </div>
                )}

                {cakeInfo && !isAnalyzing && !isRejectionError && !hideStepFour && (
                    <div className={cardClassName}>
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
                        <div className="mt-1">
                            {aiChatNode}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
