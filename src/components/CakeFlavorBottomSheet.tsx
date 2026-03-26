'use client';
import React, { useRef } from 'react';
import LazyImage from '@/components/LazyImage';
import { FLAVOR_OPTIONS, FLAVOR_THUMBNAILS } from '@/constants';
import { CustomizationBottomSheet } from './CustomizationBottomSheet';
import type { CakeFlavor } from '@/types';

interface CakeFlavorBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    flavors: CakeFlavor[];
    cakeType: string;
    onFlavorChange: (newFlavors: CakeFlavor[]) => void;
    actionButton?: React.ReactNode;
}

export const CakeFlavorBottomSheet: React.FC<CakeFlavorBottomSheetProps> = ({
    isOpen,
    onClose,
    flavors,
    cakeType,
    onFlavorChange,
    actionButton
}) => {
    const flavorScrollContainerRef = useRef<HTMLDivElement>(null);

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

    // Auto-scroll to selected flavor when opened
    React.useEffect(() => {
        if (isOpen && flavorScrollContainerRef.current && flavors.length > 0) {
            // Get the first selected flavor
            const selectedFlavor = flavors[0];
            if (selectedFlavor) {
                const escapedFlavor = selectedFlavor.replace(/"/g, '\\"');
                scrollToCenter(flavorScrollContainerRef.current, `[data-flavor="${escapedFlavor}"]`);
            }
        }
    }, [isOpen, flavors]);

    const isBento = cakeType === 'Bento';
    const tierCount = flavors.length;
    const tierLabels = tierCount === 2 ? ['Top Tier Flavor', 'Bottom Tier Flavor'] : tierCount === 3 ? ['Top Tier Flavor', 'Middle Tier Flavor', 'Bottom Tier Flavor'] : ['Cake Flavor'];

    return (
        <CustomizationBottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title="Cake Flavor"
            className="md:w-[calc(50%-6px)] md:max-w-none"
            wrapperClassName="md:max-w-7xl md:mx-auto md:justify-end md:px-6"
            actionButton={actionButton}
        >
            <div className="space-y-4 pb-32">
                {tierLabels.map((label, index) => {
                    const selectedFlavor = flavors[index] || flavors[0];
                    return (
                        <div key={index}>
                            {tierLabels.length > 1 && (
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-sm font-medium text-slate-800">{label}</span>
                                </div>
                            )}
                            <div className="relative">
                                <div ref={flavorScrollContainerRef} className="flex gap-2 overflow-x-auto pb-3 -mb-3 scrollbar-hide">
                                    {FLAVOR_OPTIONS.map(flavor => {
                                        const isFlavorDisabled = isBento && (flavor === 'Ube Cake' || flavor === 'Mocha Cake');
                                        const isSelected = selectedFlavor === flavor;
                                        return (
                                            <button
                                                key={flavor}
                                                data-flavor={flavor}
                                                type="button"
                                                disabled={isFlavorDisabled}
                                                onClick={() => {
                                                    if (isFlavorDisabled) return;
                                                    const newFlavors = [...flavors];
                                                    newFlavors[index] = flavor;
                                                    onFlavorChange(newFlavors);
                                                }}
                                                className={`group shrink-0 w-16 flex flex-col items-center text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-opacity ${isFlavorDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className={`relative w-full aspect-5/4 rounded-lg border-2 overflow-hidden transition-all duration-200 ${isSelected ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 bg-white group-hover:border-purple-400'}`}>
                                                    <LazyImage
                                                        src={FLAVOR_THUMBNAILS[flavor]}
                                                        alt={flavor}
                                                        fill
                                                        sizes="64px"
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
                    );
                })}
            </div>
        </CustomizationBottomSheet>
    );
};
