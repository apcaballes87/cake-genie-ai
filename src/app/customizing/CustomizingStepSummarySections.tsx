'use client';

import React, { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import LazyImage from '@/components/LazyImage';
import { findClosestColor } from '@/utils/colorUtils';
import { CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, CAKE_TYPE_THUMBNAILS, FLAVOR_THUMBNAILS, SQUARE_RECT_SIZE_PATTERN } from '@/constants';
import { TrashIcon } from '@/components/icons';
import type { CakeInfoUI, CakeMessageUI, ClusteredMarker, IcingDesignUI, MainTopperType, MainTopperUI, SupportElementType, SupportElementUI } from '@/types';

type LayoutMode = 'mobile' | 'desktop';
type IcingImageType = 'top' | 'side' | 'drip' | 'borderTop' | 'borderBase' | 'gumpasteBaseBoard';

interface CustomizingStepSummarySectionsProps {
    layout: LayoutMode;
    cakeInfo: CakeInfoUI | null;
    icingDesign: IcingDesignUI | null;
    cakeMessages: CakeMessageUI[];
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
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
    onIcingTypeChange?: (newType: string) => void;
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

const renderCakeSizeOverlay = (size: string) => {
    const sizePart = size.split(' ')[0] || '';
    const tiers = sizePart.match(/\d+"/g) || [];
    if (tiers.length > 0) {
        return tiers.map((tier, index) => (
            <React.Fragment key={`${tier}-${index}`}>
                <span>&lt;- {tier} -&gt;</span><br />
            </React.Fragment>
        ));
    }
    const squareRect = sizePart.match(SQUARE_RECT_SIZE_PATTERN) || [];
    if (squareRect.length > 0) {
        return squareRect.map((dim, index) => (
            <React.Fragment key={`${dim}-${index}`}>
                <span>&lt;- {dim.replace(/\s*[xX×]\s*/g, '×')} -&gt;</span><br />
            </React.Fragment>
        ));
    }
    return <span>{size}</span>;
};

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

export const CustomizingStepSummarySections = memo(function CustomizingStepSummarySections({
    layout,
    cakeInfo,
    icingDesign,
    cakeMessages,
    mainToppers,
    supportElements,
    isAnalyzing,
    isRejectionError = false,
    activeCustomization,
    selectedItemId,
    setActiveCustomization,
    setSelectedItem,
    addCakeMessage,
    removeCakeMessage,
    openTopperSheet,
    onIcingTypeChange,
    separateIcingStep = false,
    aiChatNode,
    hideStepOne,
    hideStepFour,
    photoStepNode,
}: CustomizingStepSummarySectionsProps) {
    // Default position when "+ Add" is clicked: Bento → front (side), all others → base_board
    const defaultMessagePosition = cakeInfo?.type === 'Bento' ? 'side' : 'base_board';
    const [showIcingChoice, setShowIcingChoice] = React.useState(true);
    const isDesktop = layout === 'desktop';
    const containerClassName = isDesktop
        ? 'w-full hidden md:flex flex-row md:flex-col overflow-x-auto md:overflow-x-hidden gap-2 pb-6 md:pb-4 scrollbar-hide snap-x md:snap-none relative z-60'
        : 'w-full mt-0 flex flex-col gap-2 pb-4 md:hidden';
    const cardClassName = isDesktop
        ? 'shrink-0 md:shrink w-fit md:w-full min-w-[280px] md:min-w-0 snap-start genie-card p-2 rounded-2xl'
        : 'w-full min-w-0 genie-card p-2 rounded-2xl';
    const itemsClassName = isDesktop ? 'flex gap-[7px] pt-1 pb-1 w-max md:w-full flex-wrap' : 'flex gap-[7px] pt-1 pb-1 w-full flex-wrap';
    const stepOneItemsViewportClassName = 'w-full overflow-x-auto overflow-y-hidden scrollbar-hide';
    const stepOneItemsClassName = 'flex gap-[7px] pt-1 pb-2 w-max min-w-max flex-nowrap snap-x snap-mandatory';

    const isFondant = cakeInfo?.type.toLowerCase().includes('fondant');

    // Dynamic Step Numbering
    let currentStep = 1;
    const stepOneNumber = !hideStepOne ? currentStep++ : null;
    const icingStepNumber = (separateIcingStep && cakeInfo) ? currentStep++ : null;
    const photoStepNumber = photoStepNode ? currentStep++ : null;
    const messageStepNumber = currentStep++;
    const topperStepNumber = !hideStepFour ? currentStep++ : null;

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
                <div className={cardClassName}>
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step {stepOneNumber}: Cake Options</h3>
                    <div className={stepOneItemsViewportClassName}>
                        <div className={stepOneItemsClassName}>
                            <button onClick={() => setActiveCustomization('options')} className="group flex flex-col items-center gap-1 min-w-[60px]">
                                <div className={`w-14 h-14 rounded-xl border border-purple-100 overflow-hidden relative group-hover:border-purple-400 transition-all bg-purple-50/50 ${activeCustomization === 'options' ? 'genie-control-selected' : ''}`}>
                                    <LazyImage src={CAKE_TYPE_THUMBNAILS[cakeInfo.type]} alt={cakeInfo.type + ' Cake Design'} fill sizes="56px" imageClassName="object-contain" />
                                    <div className="absolute inset-x-0 top-0 pt-[11px] text-black text-[9px] font-bold text-center leading-tight">
                                        {cakeInfo.type}
                                    </div>
                                </div>
                                <span className="text-[10px] text-center text-slate-500 font-medium leading-[1.1] max-w-[64px] line-clamp-2 mt-0.5">Cake Type</span>
                            </button>

                            <button onClick={() => setActiveCustomization('options')} className="group flex flex-col items-center gap-1 min-w-[60px]">
                                <div className={`w-14 h-14 rounded-xl border border-purple-100 overflow-hidden relative group-hover:border-purple-400 transition-all bg-purple-50/50 ${activeCustomization === 'options' ? 'genie-control-selected' : ''}`}>
                                    <LazyImage src={CAKE_SIZE_THUMBNAILS[cakeInfo.size] || CAKE_TYPE_THUMBNAILS[cakeInfo.type]} alt={cakeInfo.size + ' Custom Cake'} fill sizes="56px" imageClassName="object-contain" />
                                    <div className="absolute inset-x-0 top-0 pt-[11px] text-black text-[9px] font-bold text-center leading-tight">{renderCakeSizeOverlay(cakeInfo.size)}</div>
                                </div>
                                <span className="text-[10px] text-center text-slate-500 font-medium leading-[1.1] max-w-[64px] line-clamp-2 mt-0.5">Cake Size</span>
                            </button>

                            <button onClick={() => setActiveCustomization('options')} className="group flex flex-col items-center gap-1 min-w-[60px]">
                                <div className={`w-14 h-14 rounded-xl border border-purple-100 overflow-hidden relative group-hover:border-purple-400 transition-all bg-purple-50/50 ${activeCustomization === 'options' ? 'genie-control-selected' : ''}`}>
                                    <LazyImage src={CAKE_THICKNESS_THUMBNAILS[cakeInfo.thickness]} alt={cakeInfo.thickness + ' Thick Cake'} fill sizes="56px" imageClassName="object-contain" />
                                </div>
                                <span className="text-[10px] text-center text-slate-500 font-medium leading-[1.1] max-w-[64px] line-clamp-2 mt-0.5">Height</span>
                            </button>

                            {cakeInfo.flavors.map((flavor, index) => (
                                <button key={`${flavor}-${index}`} onClick={() => setActiveCustomization('flavor')} className="group flex flex-col items-center gap-1 min-w-[60px]">
                                    <div className={`w-14 h-14 rounded-xl border border-purple-100 overflow-hidden relative group-hover:border-purple-400 transition-all bg-purple-50/50 ${activeCustomization === 'flavor' ? 'genie-control-selected' : ''}`}>
                                        <LazyImage src={FLAVOR_THUMBNAILS[flavor]} alt={flavor + ' Design'} fill sizes="56px" imageClassName="object-contain" />
                                        <div className="absolute inset-x-0 top-0 pt-[11px] text-black text-[9px] font-bold text-center leading-tight">
                                            {flavor.replace(/\s+Cake$/i, '')}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-center text-slate-500 font-medium leading-[1.1] max-w-[64px] line-clamp-2 mt-0.5">Flavor</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {isFondant && showIcingChoice && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-600">Change Fondant to Soft Icing?</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        onIcingTypeChange?.('soft_icing');
                                        setShowIcingChoice(false);
                                        setActiveCustomization('options');
                                    }}
                                    className="genie-btn-primary px-4 py-1.5 rounded-full text-[11px] font-bold"
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => setShowIcingChoice(false)}
                                    className="genie-btn-secondary px-4 py-1.5 rounded-full text-[11px] font-bold"
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    )}
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

                    <div className="mt-1">
                        {aiChatNode}
                    </div>
                </div>
            )}
        </div>
    );
});
