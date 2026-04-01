'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ColdCakingPhotoStepProps {
    onUploadClick: () => void;
    hasPhoto: boolean;
    onDeletePhoto?: () => void;
}

const DESKTOP_CARD_CLASS = 'shrink-0 md:shrink w-fit md:w-full min-w-[280px] md:min-w-0 snap-start bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200 h-full';
const MOBILE_CARD_CLASS = 'shrink-0 w-fit min-w-[280px] snap-start bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200 h-full';

export function ColdCakingPhotoStep({ onUploadClick, hasPhoto, onDeletePhoto }: ColdCakingPhotoStepProps) {
    const [mobilePlaceholder, setMobilePlaceholder] = useState<HTMLElement | null>(null);
    const [desktopPlaceholder, setDesktopPlaceholder] = useState<HTMLElement | null>(null);

    useEffect(() => {
        let mobilePlaceholderEl: HTMLElement | null = null;
        let desktopPlaceholderEl: HTMLElement | null = null;
        let hiddenStep3Cards: HTMLElement[] = [];

        const inject = (container: Element, attrName: string): HTMLElement | null => {
            const existing = container.querySelector(`[${attrName}]`);
            if (existing) return existing as HTMLElement;

            // Find and hide the original Step 3 (Cake Toppers) card
            let step3Card: HTMLElement | null = null;
            for (const child of Array.from(container.children)) {
                const h3 = child.querySelector('h3');
                if (h3?.textContent?.includes('Step 3')) {
                    step3Card = child as HTMLElement;
                    break;
                }
            }

            if (!step3Card) return null;

            step3Card.style.display = 'none';
            hiddenStep3Cards.push(step3Card);

            // Insert our placeholder in its place — flex column so h-full resolves on the inner card
            const placeholder = document.createElement('div');
            placeholder.setAttribute(attrName, '');
            placeholder.style.display = 'flex';
            placeholder.style.flexDirection = 'column';
            placeholder.style.alignSelf = 'stretch';
            container.insertBefore(placeholder, step3Card);
            return placeholder;
        };

        const injectPlaceholders = () => {
            const wrapper = document.querySelector('.coldcaking-customizer-wrapper');
            if (!wrapper) return;

            const mobileContainer = wrapper.querySelector('.snap-x.mt-0');
            const desktopContainer = wrapper.querySelector('.z-60');

            if (mobileContainer && !mobilePlaceholderEl) {
                mobilePlaceholderEl = inject(mobileContainer, 'data-cc-photo-mobile');
                if (mobilePlaceholderEl) setMobilePlaceholder(mobilePlaceholderEl);
            }
            if (desktopContainer && !desktopPlaceholderEl) {
                desktopPlaceholderEl = inject(desktopContainer, 'data-cc-photo-desktop');
                if (desktopPlaceholderEl) setDesktopPlaceholder(desktopPlaceholderEl);
            }
        };

        const observeTarget = document.querySelector('.coldcaking-customizer-wrapper') || document.body;
        const observer = new MutationObserver(injectPlaceholders);
        observer.observe(observeTarget, { childList: true, subtree: true });
        injectPlaceholders();

        return () => {
            observer.disconnect();
            mobilePlaceholderEl?.remove();
            desktopPlaceholderEl?.remove();
            // Restore hidden Step 3 cards on unmount
            hiddenStep3Cards.forEach(el => { el.style.display = ''; });
        };
    }, []);

    const renderCard = (cardClass: string) => (
        <div className={cardClass}>
            <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 3: Upload Your Photo</h3>
            {hasPhoto ? (
                <div className="flex flex-row items-center justify-center gap-2 py-1">
                    <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-green-50 border border-green-200">
                        <span className="text-green-500 text-sm">✓</span>
                        <span className="text-[11px] font-semibold text-green-700">Photo uploaded</span>
                    </div>
                    {onDeletePhoto && (
                        <button
                            onClick={onDeletePhoto}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete photo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM3 6h14v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6zm3 3a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h4a1 1 0 100-2h-4z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={onUploadClick}
                        className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all py-2 px-5 rounded-full shadow-sm border border-purple-100 flex items-center gap-1.5"
                    >
                        <span className="text-base leading-none">↑</span> Change photo
                    </button>
                </div>
            ) : (
                <div className="flex justify-center py-2">
                    <button
                        onClick={onUploadClick}
                        className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all py-2 px-5 rounded-full shadow-sm border border-purple-100 flex items-center gap-1.5"
                    >
                        <span className="text-base leading-none">+</span> Upload photo
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            {mobilePlaceholder && createPortal(renderCard(MOBILE_CARD_CLASS), mobilePlaceholder)}
            {desktopPlaceholder && createPortal(renderCard(DESKTOP_CARD_CLASS), desktopPlaceholder)}
        </>
    );
}
