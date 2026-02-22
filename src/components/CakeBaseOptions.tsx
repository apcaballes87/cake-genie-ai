'use client';
import React, { useRef } from 'react';
import LazyImage from '@/components/LazyImage';
import { CakeInfoUI, BasePriceInfo, CakeType } from '@/types';
import { CAKE_TYPES, THICKNESS_OPTIONS_MAP, CAKE_TYPE_THUMBNAILS, CAKE_SIZE_THUMBNAILS, CAKE_THICKNESS_THUMBNAILS, FLAVOR_OPTIONS, FLAVOR_THUMBNAILS } from '@/constants';
import { CakeBaseSkeleton } from './LoadingSkeletons';
import { roundDownToNearest99 } from '@/lib/utils/pricing';

interface CakeBaseOptionsProps {
    cakeInfo: CakeInfoUI | null;
    basePriceOptions: BasePriceInfo[] | null;
    onCakeInfoChange: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    isAnalyzing: boolean;
    addOnPricing: number;
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
    onCakeInfoChange,
    isAnalyzing,
    addOnPricing
}) => {
    const cakeTypeScrollContainerRef = useRef<HTMLDivElement>(null);
    const cakeThicknessScrollContainerRef = useRef<HTMLDivElement>(null);
    const cakeSizeScrollContainerRef = useRef<HTMLDivElement>(null);

    // Helper to scroll selected item to center
    const scrollToCenter = (container: HTMLDivElement, selector: string) => {
        const selectedElement = container.querySelector(selector) as HTMLElement;
        if (selectedElement) {
            const containerWidth = container.offsetWidth;
            const elementWidth = selectedElement.offsetWidth;
            const elementLeft = selectedElement.offsetLeft;

            // Calculate center position
            const scrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);

            container.scrollTo({
                left: scrollLeft,
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

    const currentThicknessOptions = THICKNESS_OPTIONS_MAP[cakeInfo.type] || [];
    const tierCount = cakeInfo.flavors.length;
    const tierLabels = tierCount === 2 ? ['Top Tier Flavor', 'Bottom Tier Flavor'] : tierCount === 3 ? ['Top Tier Flavor', 'Middle Tier Flavor', 'Bottom Tier Flavor'] : ['Cake Flavor'];

    if (isAnalyzing) return <CakeBaseSkeleton />;

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cake Type</label>
                <div className="relative">
                    <div ref={cakeTypeScrollContainerRef} className="flex gap-2 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                        {CAKE_TYPES.map(type => (
                            <button
                                key={type}
                                data-caketype={type}
                                type="button"
                                onClick={() => onCakeInfoChange({ type })}
                                className="group shrink-0 w-20 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
                            >
                                <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.type === type ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}>
                                    <LazyImage
                                        src={CAKE_TYPE_THUMBNAILS[type]}
                                        alt={cakeTypeDisplayMap[type]}
                                        fill
                                        sizes="80px"
                                        imageClassName="object-cover"
                                    />
                                </div>
                                <span className="mt-2 text-[10px] font-medium text-slate-700 leading-tight">{cakeTypeDisplayMap[type]}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cake Height (All tiers)</label>
                <div className="relative">
                    <div ref={cakeThicknessScrollContainerRef} className="flex gap-2 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                        {currentThicknessOptions.map(thickness => (
                            <button
                                key={thickness}
                                data-cakethickness={thickness}
                                type="button"
                                onClick={() => onCakeInfoChange({ thickness })}
                                className="group shrink-0 w-20 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
                            >
                                <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.thickness === thickness ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}>
                                    <LazyImage
                                        src={CAKE_THICKNESS_THUMBNAILS[thickness]}
                                        alt={`${thickness} height`}
                                        fill
                                        sizes="80px"
                                        imageClassName="object-cover"
                                    />
                                </div>
                                <span className="mt-2 text-[10px] font-semibold text-slate-800 leading-tight">{thickness}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {basePriceOptions && basePriceOptions.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Size (Diameter)</label>
                    {basePriceOptions.length === 1 ? (
                        <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg flex items-center justify-between">
                            <span className="text-sm font-semibold text-purple-800">{basePriceOptions[0].size}</span>
                            <span className="text-sm font-bold text-purple-800">₱{basePriceOptions[0].price.toLocaleString()}</span>
                        </div>
                    ) : (
                        <div className="relative">
                            <div ref={cakeSizeScrollContainerRef} className="flex gap-2 overflow-x-auto pb-3 -mb-3 scrollbar-hide px-1">
                                {basePriceOptions.map(option => (
                                    <button
                                        key={option.size}
                                        data-cakesize={option.size}
                                        type="button"
                                        onClick={() => onCakeInfoChange({ size: option.size })}
                                        className="group shrink-0 w-20 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
                                    >
                                        <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.size === option.size ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}>
                                            <LazyImage
                                                src={CAKE_SIZE_THUMBNAILS[option.size] || CAKE_TYPE_THUMBNAILS[cakeInfo.type]}
                                                alt={option.size}
                                                fill
                                                sizes="80px"
                                                imageClassName="object-cover"
                                            />
                                            <div className="absolute inset-x-0 top-0 pt-4 text-black text-[10px] font-bold text-center leading-tight">
                                                {(() => {
                                                    const sizePart = option.size?.split(' ')[0] || '';
                                                    const tiers = sizePart?.match(/\d+"/g) || [];
                                                    return (
                                                        <div>
                                                            {tiers.map((tier, index) => (
                                                                <React.Fragment key={index}>
                                                                    <span>&lt;- {tier} -&gt;</span><br />
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center mt-2">
                                            <span className="text-[10px] font-semibold text-slate-800 leading-tight">{option.size}</span>
                                            <span className="text-[10px] font-bold text-purple-700 leading-tight">₱{roundDownToNearest99(option.price + addOnPricing, option.price).toLocaleString()}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-2 pt-1">
                {tierLabels.map((label, index) => {
                    return (
                        <div key={index}>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-slate-800">{label}</span>
                            </div>
                            <div className="mt-1.5">
                                <div className="relative">
                                    <div className="flex gap-2 overflow-x-auto pb-3 -mb-3 scrollbar-hide">
                                        {FLAVOR_OPTIONS.map(flavor => {
                                            const isBento = cakeInfo.type === 'Bento';
                                            const isFlavorDisabled = isBento && (flavor === 'Ube Cake' || flavor === 'Mocha Cake');
                                            return (
                                                <button
                                                    key={flavor}
                                                    type="button"
                                                    disabled={isFlavorDisabled}
                                                    onClick={() => {
                                                        if (isFlavorDisabled) return;
                                                        const newFlavors = [...cakeInfo.flavors];
                                                        newFlavors[index] = flavor;
                                                        onCakeInfoChange({ flavors: newFlavors });
                                                    }}
                                                    className={`group shrink-0 w-20 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-opacity ${isFlavorDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${cakeInfo.flavors[index] === flavor ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}>
                                                        <LazyImage
                                                            src={FLAVOR_THUMBNAILS[flavor]}
                                                            alt={flavor}
                                                            fill
                                                            sizes="80px"
                                                            imageClassName={`object-cover transition-all ${isFlavorDisabled ? 'filter grayscale' : ''}`}
                                                        />
                                                    </div>
                                                    <span className="mt-2 text-[10px] font-medium text-slate-700 leading-tight">{flavor}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
