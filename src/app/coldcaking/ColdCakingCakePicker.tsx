'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import { CAKE_TYPE_THUMBNAILS } from '@/constants';
import type { CakeType, CakeThickness, CakeFlavor, IcingDesignUI } from '@/types';

const DEFAULT_THICKNESS: CakeThickness = '3 in';
const DEFAULT_FLAVOR: CakeFlavor = 'Chocolate Cake';

const DEFAULT_ICING: IcingDesignUI = {
    base: 'soft_icing',
    color_type: 'single',
    colors: { side: '#FFFFFF', top: '#FFFFFF' },
    border_top: false,
    border_base: false,
    drip: false,
    gumpasteBaseBoard: false,
    dripPrice: 0,
    gumpasteBaseBoardPrice: 0,
};

interface SizeOption {
    label: string;
    sublabel: string;
    type: CakeType;
    size: string;
}

const SIZES: SizeOption[] = [
    { label: 'Bento', sublabel: '4" Round', type: 'Bento', size: '4" Round' },
    { label: '6" Round', sublabel: '3 in height', type: '1 Tier', size: '6" Round' },
    { label: '8" Round', sublabel: '3 in height', type: '1 Tier', size: '8" Round' },
    { label: '8×8', sublabel: 'Square', type: 'Square', size: '8" Square' },
    { label: '8×12', sublabel: 'Rectangle', type: 'Rectangle', size: '8"x12"' },
    { label: '10×14', sublabel: 'Rectangle', type: 'Rectangle', size: '10"x14"' },
    { label: '12×16', sublabel: 'Rectangle', type: 'Rectangle', size: '12"x16"' },
];

const DEFAULT_INDEX = 1; // 6" Round

// Match the card/items class names used inside CustomizingStepSummarySections
const DESKTOP_CARD_CLASS = 'shrink-0 md:shrink w-fit md:w-full min-w-[280px] md:min-w-0 snap-start bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200';
const MOBILE_CARD_CLASS = 'shrink-0 w-fit min-w-[280px] snap-start bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200';
const DESKTOP_ITEMS_CLASS = 'flex gap-[7px] pt-1 pb-1 w-max md:w-full flex-wrap';
const MOBILE_ITEMS_CLASS = 'flex gap-[7px] pt-1 pb-1 w-max';

export function ColdCakingCakePicker() {
    const { handleCakeInfoChange, onIcingDesignChange, cakeInfo } = useCakeCustomization();
    const [selectedIndex, setSelectedIndex] = useState(DEFAULT_INDEX);
    const hasSetDefault = useRef(false);

    // Placeholder DOM nodes that we portal our picker card into
    const [mobilePlaceholder, setMobilePlaceholder] = useState<HTMLElement | null>(null);
    const [desktopPlaceholder, setDesktopPlaceholder] = useState<HTMLElement | null>(null);

    // Set default cakeInfo and icingDesign on mount so Steps 1 & 2 always render
    useEffect(() => {
        if (hasSetDefault.current) return;
        hasSetDefault.current = true;
        const def = SIZES[DEFAULT_INDEX];
        handleCakeInfoChange({ type: def.type, size: def.size, thickness: DEFAULT_THICKNESS, flavors: [DEFAULT_FLAVOR] });
        onIcingDesignChange(DEFAULT_ICING);
    }, [handleCakeInfoChange, onIcingDesignChange]);

    // Inject placeholder <div>s beside Step 3 in the internal step card containers,
    // then portal our picker card content into those placeholders.
    useEffect(() => {
        let mobilePlaceholderEl: HTMLElement | null = null;
        let desktopPlaceholderEl: HTMLElement | null = null;

        const injectAsFirstVisible = (container: Element, attrName: string): HTMLElement | null => {
            // Return existing placeholder if already injected
            const existing = container.querySelector(`[${attrName}]`);
            if (existing) return existing as HTMLElement;

            // Find Step 2 card — insert our picker before it so order is Step 1 → Step 2 → Step 3 → Step 4
            let step2Card: Element | null = null;
            for (const child of Array.from(container.children)) {
                const h3 = child.querySelector('h3');
                if (h3?.textContent?.includes('Step 2')) {
                    step2Card = child;
                    break;
                }
            }

            const placeholder = document.createElement('div');
            placeholder.setAttribute(attrName, '');
            if (step2Card) {
                container.insertBefore(placeholder, step2Card);
            } else {
                // Fallback: append at end
                container.appendChild(placeholder);
            }
            return placeholder;
        };

        const injectPlaceholders = () => {
            const wrapper = document.querySelector('.coldcaking-customizer-wrapper');
            if (!wrapper) return;

            const mobileContainer = wrapper.querySelector('.snap-x.mt-0');
            const desktopContainer = wrapper.querySelector('.z-60');

            if (mobileContainer && !mobilePlaceholderEl) {
                mobilePlaceholderEl = injectAsFirstVisible(mobileContainer, 'data-cc-picker-mobile');
                setMobilePlaceholder(mobilePlaceholderEl);
            }
            if (desktopContainer && !desktopPlaceholderEl) {
                desktopPlaceholderEl = injectAsFirstVisible(desktopContainer, 'data-cc-picker-desktop');
                setDesktopPlaceholder(desktopPlaceholderEl);
            }
        };

        // Watch for CustomizingClient (dynamic import) finishing its mount
        const observeTarget = document.querySelector('.coldcaking-customizer-wrapper') || document.body;
        const observer = new MutationObserver(injectPlaceholders);
        observer.observe(observeTarget, { childList: true, subtree: true });
        injectPlaceholders();

        return () => {
            observer.disconnect();
            mobilePlaceholderEl?.remove();
            desktopPlaceholderEl?.remove();
        };
    }, []);

    const handleSelect = useCallback((index: number) => {
        setSelectedIndex(index);
        const option = SIZES[index];
        handleCakeInfoChange({
            type: option.type,
            size: option.size,
            thickness: DEFAULT_THICKNESS,
            flavors: cakeInfo?.flavors?.length ? cakeInfo.flavors : [DEFAULT_FLAVOR],
        });
    }, [handleCakeInfoChange, cakeInfo]);

    const renderPickerContent = (cardClass: string, itemsClass: string) => (
        <div className={cardClass}>
            <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 1: Choose Your Cake Size</h3>
            <div className={itemsClass}>
                {SIZES.map((option, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                        <button
                            key={option.label}
                            onClick={() => handleSelect(index)}
                            className="group flex flex-col items-center gap-1 min-w-[60px]"
                        >
                            <div className={`w-14 h-14 rounded-xl border-2 overflow-hidden relative transition-all ${
                                isSelected
                                    ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50'
                                    : 'border-slate-200 group-hover:border-purple-400 bg-white'
                            }`}>
                                <img
                                    src={CAKE_TYPE_THUMBNAILS[option.type]}
                                    alt={option.label}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            </div>
                            <span className={`text-[10px] text-center font-semibold leading-tight mt-0.5 ${
                                isSelected ? 'text-purple-700' : 'text-slate-600'
                            }`}>
                                {option.label}
                            </span>
                            <span className="text-[9px] text-center text-slate-400 leading-tight">
                                {option.sublabel}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <>
            {mobilePlaceholder && createPortal(
                renderPickerContent(MOBILE_CARD_CLASS, MOBILE_ITEMS_CLASS),
                mobilePlaceholder
            )}
            {desktopPlaceholder && createPortal(
                renderPickerContent(DESKTOP_CARD_CLASS, DESKTOP_ITEMS_CLASS),
                desktopPlaceholder
            )}
        </>
    );
}
