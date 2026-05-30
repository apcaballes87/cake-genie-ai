'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { CloseIcon } from './icons';
import { ShieldCheck } from 'lucide-react';
import { CakeBaseOptions } from './CakeBaseOptions';
import { CakeFlavorBottomSheet } from './CakeFlavorBottomSheet';
import { usePricing } from '@/hooks/usePricing';
import { DEFAULT_THICKNESS_MAP, DEFAULT_SIZE_MAP, FLAVOR_OPTIONS, FLAVOR_THUMBNAILS, TEMPORARILY_DISABLED_FLAVORS } from '@/constants';
import LazyImage from '@/components/LazyImage';
import type { CakeInfoUI, CakeType, CakeFlavor } from '@/types';

interface PreSelectionModalProps {
    isOpen: boolean;
    isAnalyzing?: boolean;
    onClose: () => void;
    onApply: (cakeInfo: CakeInfoUI) => void;
}

const getFlavorCount = (type: CakeType): number => {
    if (type.includes('2 Tier')) return 2;
    if (type.includes('3 Tier')) return 3;
    return 1;
};

const getDefaultCakeInfo = (): CakeInfoUI => ({
    type: '1 Tier',
    thickness: DEFAULT_THICKNESS_MAP['1 Tier'],
    size: DEFAULT_SIZE_MAP['1 Tier'],
    flavors: ['Chocolate Cake'],
});

export const PreSelectionModal: React.FC<PreSelectionModalProps> = ({ isOpen, isAnalyzing = true, onClose, onApply }) => {
    const [show, setShow] = useState(false);
    const [localCakeInfo, setLocalCakeInfo] = useState<CakeInfoUI>(getDefaultCakeInfo);
    const [isFlavorSheetOpen, setIsFlavorSheetOpen] = useState(false);

    // Reset local state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalCakeInfo(getDefaultCakeInfo());
            setIsFlavorSheetOpen(false);
            setTimeout(() => setShow(true), 10);
        } else {
            setShow(false);
        }
    }, [isOpen]);

    const handleLocalCakeInfoChange = useCallback((updates: Partial<CakeInfoUI>) => {
        setLocalCakeInfo(prev => {
            const newState = { ...prev, ...updates };

            if (updates.type && updates.type !== prev.type) {
                const newType = updates.type;
                newState.thickness = DEFAULT_THICKNESS_MAP[newType];
                newState.size = DEFAULT_SIZE_MAP[newType];
                const newFlavorCount = getFlavorCount(newType);
                newState.flavors = Array(newFlavorCount).fill('Chocolate Cake') as CakeFlavor[];
            }

            return newState;
        });
    }, []);

    const handleFlavorChange = useCallback((newFlavors: CakeFlavor[]) => {
        setLocalCakeInfo(prev => ({ ...prev, flavors: newFlavors }));
    }, []);

    // Fetch base price options for the locally selected type+thickness
    const { basePriceOptions } = usePricing({
        analysisResult: null,
        mainToppers: [],
        supportElements: [],
        cakeMessages: [],
        icingDesign: null,
        cakeInfo: localCakeInfo,
        onCakeInfoCorrection: (updates) => {
            setLocalCakeInfo(prev => ({ ...prev, ...updates }));
        },
        analysisId: null,
    });

    const handleClose = useCallback(() => {
        setShow(false);
        setTimeout(onClose, 200);
    }, [onClose]);

    const handleApply = useCallback(() => {
        setShow(false);
        setTimeout(() => onApply(localCakeInfo), 200);
    }, [onApply, localCakeInfo]);

    if (!isOpen) return null;

    const isBento = localCakeInfo.type === 'Bento';
    const tierCount = localCakeInfo.flavors.length;
    const tierLabels = tierCount === 2
        ? ['Top Tier', 'Bottom Tier']
        : tierCount === 3
            ? ['Top Tier', 'Middle Tier', 'Bottom Tier']
            : ['Flavor'];

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 pb-[120px] transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
                aria-modal="true"
                role="dialog"
            >
                <div
                    className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[70vh] transition-all duration-200 ${show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 pt-5 pb-2 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            {/* Trust Badge */}
                            <div className="bg-green-600/90 text-white px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 scale-90 sm:scale-100 origin-left transition-transform">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <div className="flex flex-col -space-y-0.5">
                                    <span className="text-[9px] font-bold leading-tight whitespace-nowrap">Guaranteed Price</span>
                                    <span className="text-[6px] text-green-100 font-medium uppercase tracking-wider whitespace-nowrap">Real cakeshop data</span>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"
                                aria-label="Close"
                            >
                                <CloseIcon />
                            </button>
                        </div>
                        <h2 className="text-base font-semibold text-slate-800">Select Your Cake Options</h2>
                        {isAnalyzing && (
                            <div className="mt-1.5">
                                <div className="w-full bg-slate-200 rounded-full h-2 relative overflow-hidden">
                                    <div className="h-full bg-linear-to-r from-pink-500 to-purple-600 progress-bar-fill" />
                                </div>
                                <p className="text-[9px] text-slate-500 mt-1 font-medium">Analyzing design elements & pricing...</p>
                            </div>
                        )}
                    </div>

                    {/* Scrollable body */}
                    <div className="overflow-y-auto px-5 pb-2 flex-1 min-h-0">
                        <CakeBaseOptions
                            cakeInfo={localCakeInfo}
                            basePriceOptions={basePriceOptions}
                            onCakeInfoChange={handleLocalCakeInfoChange}
                            isAnalyzing={false}
                            addOnPricing={0}
                            hidePrices
                            compact
                        />

                        {/* Flavor selection inline */}
                        <div className="mt-1.5">
                            <label className="block text-[11px] font-medium text-slate-700 mb-1">Cake Flavor</label>
                            <div className="space-y-1.5">
                                {tierLabels.map((label, index) => {
                                    const selectedFlavor = localCakeInfo.flavors[index] || localCakeInfo.flavors[0];
                                    return (
                                        <div key={index}>
                                            {tierLabels.length > 1 && (
                                                <span className="text-[11px] font-medium text-slate-600 mb-1 block">{label}</span>
                                            )}
                                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                {FLAVOR_OPTIONS.map(flavor => {
                                                    const isDisabled = TEMPORARILY_DISABLED_FLAVORS.includes(flavor) || (isBento && flavor === 'Ube Cake');
                                                    const isSelected = selectedFlavor === flavor;
                                                    return (
                                                        <button
                                                            key={flavor}
                                                            type="button"
                                                            disabled={isDisabled}
                                                            onClick={() => {
                                                                if (isDisabled) return;
                                                                const newFlavors = [...localCakeInfo.flavors];
                                                                newFlavors[index] = flavor;
                                                                handleFlavorChange(newFlavors);
                                                            }}
                                                            className={`group shrink-0 w-[43px] flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-opacity ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${isSelected ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}>
                                                                <LazyImage
                                                                    src={FLAVOR_THUMBNAILS[flavor]}
                                                                    alt=""
                                                                    fill
                                                                    sizes="43px"
                                                                    imageClassName={`object-cover transition-all ${isDisabled ? 'filter grayscale' : ''}`}
                                                                />
                                                            </div>
                                                            <span className="mt-1.5 text-[8px] font-medium text-slate-700 leading-tight">{flavor}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 px-5 py-3 border-t border-slate-100 shrink-0">
                        <button
                            onClick={handleClose}
                            className="flex-1 py-2 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-xs"
                        >
                            Skip
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex-1 py-2 px-4 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors text-xs"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
