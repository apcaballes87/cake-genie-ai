'use client';

import React, { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import LazyImage from '@/components/LazyImage';
import { findClosestColor } from '@/utils/colorUtils';
import { CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, CAKE_TYPE_THUMBNAILS, FLAVOR_THUMBNAILS } from '@/constants';
import { CakeToppersOptions } from '@/components/CakeToppersOptions';
import { TrashIcon } from '@/components/icons';
import type { CakeInfoUI, CakeMessageUI, ClusteredMarker, IcingDesignUI, MainTopperUI, SupportElementUI } from '@/types';

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
    openTopperSheet: (section: 'main' | 'support') => void;
    onIcingTypeChange?: (newType: string) => void;
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
    const tiers = (size.split(' ')[0] || '').match(/\d+"/g) || [];
    return tiers.map((tier, index) => (
        <React.Fragment key={`${tier}-${index}`}>
            <span>&lt;- {tier} -&gt;</span><br />
        </React.Fragment>
    ));
};

export const CustomizingStepSummarySections = memo(function CustomizingStepSummarySections({
    layout,
    cakeInfo,
    icingDesign,
    cakeMessages,
    mainToppers,
    supportElements,
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
    onIcingTypeChange,
}: CustomizingStepSummarySectionsProps) {
    // Default position when "+ Add" is clicked: Bento → front (side), all others → base_board
    const defaultMessagePosition = cakeInfo?.type === 'Bento' ? 'side' : 'base_board';
    const [showIcingChoice, setShowIcingChoice] = React.useState(true);
    const isDesktop = layout === 'desktop';
    const containerClassName = isDesktop
        ? 'w-full hidden md:flex flex-row md:flex-col overflow-x-auto md:overflow-x-hidden gap-2 pb-6 md:pb-4 scrollbar-hide snap-x md:snap-none relative z-60'
        : 'w-[calc(100%+2rem)] -mx-4 px-4 mt-0 flex md:hidden overflow-x-auto gap-2 pb-4 scrollbar-hide snap-x scroll-pl-4';
    const cardClassName = isDesktop
        ? 'shrink-0 md:shrink w-fit md:w-full min-w-[280px] md:min-w-0 snap-start bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200'
        : 'shrink-0 w-fit min-w-[280px] snap-start bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200';
    const itemsClassName = isDesktop ? 'flex gap-[7px] pt-1 pb-1 w-max md:w-full flex-wrap' : 'flex gap-[7px] pt-1 pb-1 w-max';

    const isFondant = cakeInfo?.type.toLowerCase().includes('fondant');

    return (
        <div className={containerClassName}>
            {cakeInfo && !isAnalyzing && !isRejectionError && (
                <div className={cardClassName}>
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 1: Choose Your Cake Specs</h3>
                    <div className={itemsClassName}>
                        <button onClick={() => setActiveCustomization('options')} className="group flex flex-col items-center gap-1 min-w-[60px]">
                            <div className={`w-14 h-14 rounded-xl border border-slate-200 overflow-hidden relative group-hover:border-purple-400 transition-all bg-purple-50/50 ${activeCustomization === 'options' ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}>
                                <LazyImage src={CAKE_TYPE_THUMBNAILS[cakeInfo.type]} alt={cakeInfo.type} fill sizes="56px" imageClassName="object-contain" />
                            </div>
                            <span className="text-[10px] text-center text-slate-500 font-medium leading-[1.1] max-w-[64px] line-clamp-2 mt-0.5">{cakeInfo.type}</span>
                        </button>

                        <button onClick={() => setActiveCustomization('options')} className="group flex flex-col items-center gap-1 min-w-[60px]">
                            <div className={`w-14 h-14 rounded-xl border border-slate-200 overflow-hidden relative group-hover:border-purple-400 transition-all bg-purple-50/50 ${activeCustomization === 'options' ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}>
                                <LazyImage src={CAKE_SIZE_THUMBNAILS[cakeInfo.size] || CAKE_TYPE_THUMBNAILS[cakeInfo.type]} alt={cakeInfo.size} fill sizes="56px" imageClassName="object-contain" />
                                <div className="absolute inset-x-0 top-0 pt-3 text-black text-[9px] font-bold text-center leading-tight">{renderCakeSizeOverlay(cakeInfo.size)}</div>
                            </div>
                            <span className="text-[10px] text-center text-slate-500 font-medium leading-[1.1] max-w-[64px] line-clamp-2 mt-0.5">{cakeInfo.size}</span>
                        </button>

                        <button onClick={() => setActiveCustomization('options')} className="group flex flex-col items-center gap-1 min-w-[60px]">
                            <div className={`w-14 h-14 rounded-xl border border-slate-200 overflow-hidden relative group-hover:border-purple-400 transition-all bg-purple-50/50 ${activeCustomization === 'options' ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}>
                                <LazyImage src={CAKE_THICKNESS_THUMBNAILS[cakeInfo.thickness]} alt={cakeInfo.thickness} fill sizes="56px" imageClassName="object-contain" />
                            </div>
                            <span className="text-[10px] text-center text-slate-500 font-medium leading-[1.1] max-w-[64px] line-clamp-2 mt-0.5">{cakeInfo.thickness}</span>
                        </button>

                        {cakeInfo.flavors.map((flavor, index) => (
                            <button key={`${flavor}-${index}`} onClick={() => setActiveCustomization('flavor')} className="group flex flex-col items-center gap-1 min-w-[60px]">
                                <div className={`w-14 h-14 rounded-xl border border-slate-200 overflow-hidden relative group-hover:border-purple-400 transition-all bg-purple-50/50 ${activeCustomization === 'flavor' ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}>
                                    <LazyImage src={FLAVOR_THUMBNAILS[flavor]} alt={flavor} fill sizes="56px" imageClassName="object-contain" />
                                </div>
                                <span className="text-[10px] text-center text-slate-500 font-medium leading-[1.1] max-w-[64px] line-clamp-2 mt-0.5">{flavor}</span>
                            </button>
                        ))}
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
                                    className="px-4 py-1.5 rounded-full bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 transition-colors shadow-sm"
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => setShowIcingChoice(false)}
                                    className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200 transition-colors border border-slate-200"
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {cakeInfo && icingDesign && !isAnalyzing && !isRejectionError && (
                <div className={cardClassName}>
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 2: Icing Colors</h3>
                    <div className={itemsClassName}>
                        {[
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
                                    <div className={`w-14 h-14 rounded-full border border-slate-200 overflow-hidden relative group-hover:border-purple-500 transition-colors bg-white p-2.5 shadow-sm flex items-center justify-center ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : isEnabled ? 'ring-2 ring-purple-500' : ''}`}>
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
                        })}
                    </div>
                </div>
            )}

            {cakeInfo && !isAnalyzing && !isRejectionError && (
                <div className={cardClassName}>
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 3: Cake Toppers</h3>
                    <CakeToppersOptions
                        mainToppers={mainToppers}
                        supportElements={supportElements}
                        markerMap={markerMap}
                        updateMainTopper={updateMainTopper}
                        updateSupportElement={updateSupportElement}
                        onTopperImageReplace={onTopperImageReplace}
                        onSupportElementImageReplace={onSupportElementImageReplace}
                        itemPrices={itemPrices}
                        isAdmin={isAdmin}
                        isAnalyzing={isAnalyzing}
                        mode="summary"
                        onSectionClick={openTopperSheet}
                    />

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

            {cakeInfo && !isAnalyzing && !isRejectionError && (
                <div className={cardClassName}>
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 4: Cake Messages</h3>
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
                                    className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all py-2 px-5 rounded-full shadow-sm border border-purple-100 flex items-center gap-1.5"
                                >
                                    <span className="text-base leading-none">+</span> Add message
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center py-2">
                            <button
                                className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all py-2 px-5 rounded-full shadow-sm border border-purple-100 flex items-center gap-1.5"
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
        </div>
    );
});