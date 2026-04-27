'use client';
import React, { useRef } from 'react';
import LazyImage from '@/components/LazyImage';
import { CakeInfoUI, BasePriceInfo, CakeType, IcingDesign } from '@/types';
import {
    THICKNESS_OPTIONS_MAP,
    CAKE_TYPE_THUMBNAILS,
    CAKE_SIZE_THUMBNAILS,
    CAKE_THICKNESS_THUMBNAILS,
    SQUARE_RECT_SIZE_PATTERN,
    getCakeTypesForIcingBase,
    inferIcingBaseFromCakeType,
} from '@/constants';
import { CakeBaseSkeleton } from './LoadingSkeletons';
import { roundDownToNearest99 } from '@/lib/utils/pricing';

interface CakeBaseOptionsProps {
    cakeInfo: CakeInfoUI | null;
    basePriceOptions: BasePriceInfo[] | null;
    icingBase?: IcingDesign['base'] | null;
    onCakeInfoChange: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    onIcingBaseChange?: (base: IcingDesign['base']) => void;
    isAnalyzing: boolean;
    addOnPricing: number;
    hidePrices?: boolean;
    compact?: boolean;
    visibleSections?: Array<'icing' | 'type' | 'size' | 'height'>;
    showSectionLabels?: boolean;
}

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)', '2 Tier': '2 Tier (Soft icing)', '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant', '2 Tier Fondant': '2 Tier Fondant', '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square', 'Rectangle': 'Rectangle', 'Bento': 'Bento',
    'Square Fondant': 'Square Fondant', 'Rectangle Fondant': 'Rectangle Fondant',
};

export const CakeBaseOptions: React.FC<CakeBaseOptionsProps> = ({
    cakeInfo,
    basePriceOptions,
    icingBase,
    onCakeInfoChange,
    onIcingBaseChange,
    isAnalyzing,
    addOnPricing,
    hidePrices = false,
    compact = false,
    visibleSections,
    showSectionLabels = true,
}) => {
    const cakeTypeScrollContainerRef = useRef<HTMLDivElement>(null);
    const cakeThicknessScrollContainerRef = useRef<HTMLDivElement>(null);
    const cakeSizeScrollContainerRef = useRef<HTMLDivElement>(null);

    // Helper to scroll selected item to center
    const scrollToCenter = (container: HTMLDivElement, selector: string) => {
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

    // Auto-scroll effects
    React.useEffect(() => {
        if (cakeTypeScrollContainerRef.current && cakeInfo?.type) {
            scrollToCenter(cakeTypeScrollContainerRef.current, `[data-caketype="${cakeInfo.type}"]`);
        }
    }, [cakeInfo?.type]);

    React.useEffect(() => {
        if (cakeThicknessScrollContainerRef.current && cakeInfo?.thickness) {
            scrollToCenter(cakeThicknessScrollContainerRef.current, `[data-cakethickness="${cakeInfo.thickness}"]`);
        }
    }, [cakeInfo?.thickness]);

    React.useEffect(() => {
        if (cakeSizeScrollContainerRef.current && cakeInfo?.size) {
            // Escape double quotes for the attribute selector
            const escapedSize = cakeInfo.size.replace(/"/g, '\\"');
            scrollToCenter(cakeSizeScrollContainerRef.current, `[data-cakesize="${escapedSize}"]`);
        }
    }, [cakeInfo?.size]);

    if (!cakeInfo) return null;

    const resolvedIcingBase = icingBase ?? inferIcingBaseFromCakeType(cakeInfo.type);
    const visibleCakeTypes = getCakeTypesForIcingBase(resolvedIcingBase);
    const currentThicknessOptions = THICKNESS_OPTIONS_MAP[cakeInfo.type] || [];
    const shouldShowSection = (section: 'icing' | 'type' | 'size' | 'height') => !visibleSections || visibleSections.includes(section);

    if (isAnalyzing) return <CakeBaseSkeleton />;

    const thumbWidth = compact ? 'w-[54px]' : 'w-16';
    const thumbSizes = compact ? '54px' : '64px';
    const labelSize = compact ? 'text-[11px]' : 'text-sm';
    const thumbText = compact ? 'text-[8px]' : 'text-[10px]';
    const sectionGap = compact ? 'space-y-1.5' : 'space-y-3';
    const labelMargin = compact ? 'mb-1' : 'mb-1.5';
    const icingChoiceText = compact ? 'text-[11px]' : 'text-sm';
    const renderSectionLabel = (label: string) => (
        showSectionLabels ? <label className={`block ${labelSize} font-medium text-slate-700 ${labelMargin}`}>{label}</label> : null
    );

    return (
        <div className={sectionGap}>
            {shouldShowSection('icing') && (
                <div>
                    {renderSectionLabel('Icing Type')}
                <div className="grid grid-cols-2 gap-2">
                    {([
                        { id: 'soft_icing', label: 'Soft Icing' },
                        { id: 'fondant', label: 'Fondant' },
                    ] as const).map((option) => {
                        const isSelected = resolvedIcingBase === option.id;

                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => onIcingBaseChange?.(option.id)}
                                className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 genie-focus ${
                                    isSelected
                                        ? 'genie-control-selected'
                                        : 'border-purple-100 bg-white hover:border-purple-300'
                                }`}
                                aria-pressed={isSelected}
                            >
                                <span className={`block ${icingChoiceText} font-semibold ${isSelected ? 'text-purple-800' : 'text-slate-700'}`}>
                                    {option.label}
                                </span>
                                <span className="mt-1 block text-[11px] text-slate-500">
                                    {option.id === 'soft_icing' ? 'Bento, tiered, square, or rectangle cakes' : 'Tiered, square, and rectangle fondant cakes'}
                                </span>
                            </button>
                        );
                    })}
                </div>
                </div>
            )}
            {shouldShowSection('type') && (
                <div>
                    {renderSectionLabel('Cake Type')}
                <div className="relative">
                    <div ref={cakeTypeScrollContainerRef} className="flex gap-2 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                        {visibleCakeTypes.map(type => (
                            <button
                                key={type}
                                data-caketype={type}
                                type="button"
                                onClick={(e) => {
                                    onCakeInfoChange({ type });
                                    const target = e.currentTarget;
                                    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 50);
                                }}
                                className={`group shrink-0 ${thumbWidth} flex flex-col items-center text-center rounded-lg genie-focus`}
                            >
                                <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.type === type ? 'genie-control-selected' : 'border-purple-100 bg-white group-hover:border-purple-400'}`}>
                                    <LazyImage
                                        src={CAKE_TYPE_THUMBNAILS[type]}
                                        alt={cakeTypeDisplayMap[type]}
                                        fill
                                        sizes={thumbSizes}
                                        imageClassName="object-cover"
                                    />
                                </div>
                                <span className={`mt-1.5 ${thumbText} font-medium text-slate-700 leading-tight`}>{cakeTypeDisplayMap[type]}</span>
                            </button>
                        ))}
                    </div>
                </div>
                </div>
            )}
            {shouldShowSection('size') && basePriceOptions && basePriceOptions.length > 0 && (
                <div>
                    {renderSectionLabel('Size (Diameter)')}
                    {basePriceOptions.length === 1 ? (
                        <div className="p-3 genie-control-selected rounded-lg flex items-center justify-between">
                            <span className="text-sm font-semibold text-purple-800">{basePriceOptions[0].size}</span>
                            {!hidePrices && <span className="text-sm font-bold text-purple-800">₱{basePriceOptions[0].price.toLocaleString()}</span>}
                        </div>
                    ) : (
                        <div className="relative">
                            <div ref={cakeSizeScrollContainerRef} className="flex gap-2 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                                {basePriceOptions.map(option => (
                                    <button
                                        key={option.size}
                                        data-cakesize={option.size}
                                        type="button"
                                        onClick={(e) => {
                                            onCakeInfoChange({ size: option.size });
                                            const target = e.currentTarget;
                                            setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 50);
                                        }}
                                        className={`group shrink-0 ${thumbWidth} flex flex-col items-center text-center rounded-lg genie-focus`}
                                    >
                                        <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.size === option.size ? 'genie-control-selected' : 'border-purple-100 bg-white group-hover:border-purple-400'}`}>
                                            <LazyImage
                                                src={CAKE_SIZE_THUMBNAILS[option.size] || CAKE_TYPE_THUMBNAILS[cakeInfo.type]}
                                                alt={option.size}
                                                fill
                                                sizes={thumbSizes}
                                                imageClassName="object-cover"
                                            />
                                            <div className={`absolute inset-x-0 top-0 pt-4 text-black ${thumbText} font-bold text-center leading-tight`}>
                                                {(() => {
                                                    const sizePart = option.size?.split(' ')[0] || '';
                                                    const tiers = sizePart?.match(/\d+"/g) || [];
                                                    if (tiers.length > 0) {
                                                        return (
                                                            <div>
                                                                {tiers.map((tier, index) => (
                                                                    <React.Fragment key={index}>
                                                                        <span>&lt;- {tier} -&gt;</span><br />
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    const squareRect = sizePart.match(SQUARE_RECT_SIZE_PATTERN) || [];
                                                    if (squareRect.length > 0) {
                                                        return (
                                                            <div>
                                                                {squareRect.map((dim, index) => (
                                                                    <React.Fragment key={index}>
                                                                        <span>&lt;- {dim.replace(/\s*[xX×]\s*/g, '×')} -&gt;</span><br />
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    return <span>{option.size}</span>;
                                                })()}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center mt-1.5">
                                            <span className={`${thumbText} font-semibold text-slate-800 leading-tight`}>{option.size}</span>
                                            {!hidePrices && <span className={`${thumbText} font-bold text-purple-700 leading-tight`}>₱{roundDownToNearest99(option.price + addOnPricing, option.price).toLocaleString()}</span>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {shouldShowSection('height') && (
                <div>
                    {renderSectionLabel(cakeInfo.type.toLowerCase().includes('2 tier') || cakeInfo.type.toLowerCase().includes('3 tier') ? 'Height per Cake' : 'Cake Height (All tiers)')}
                <div className="relative">
                    <div ref={cakeThicknessScrollContainerRef} className="flex gap-2 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                        {currentThicknessOptions.map(thickness => (
                            <button
                                key={thickness}
                                data-cakethickness={thickness}
                                type="button"
                                onClick={(e) => {
                                    onCakeInfoChange({ thickness });
                                    const target = e.currentTarget;
                                    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 50);
                                }}
                                className={`group shrink-0 ${thumbWidth} flex flex-col items-center text-center rounded-lg genie-focus`}
                            >
                                <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.thickness === thickness ? 'genie-control-selected' : 'border-purple-100 bg-white group-hover:border-purple-400'}`}>
                                    <LazyImage
                                        src={CAKE_THICKNESS_THUMBNAILS[thickness]}
                                        alt={`${thickness} height`}
                                        fill
                                        sizes={thumbSizes}
                                        imageClassName="object-cover"
                                    />
                                </div>
                                <span className={`mt-1.5 ${thumbText} font-semibold text-slate-800 leading-tight`}>{thickness}</span>
                            </button>
                        ))}
                    </div>
                </div>
                </div>
            )}

        </div>
    );
};
