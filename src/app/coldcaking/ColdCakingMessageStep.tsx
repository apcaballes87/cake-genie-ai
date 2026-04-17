'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TrashIcon } from '@/components/icons';
import { useCakeCustomization } from '@/contexts/CustomizationContext';
import type { CakeMessageUI } from '@/types';

const DESKTOP_CARD_CLASS = 'shrink-0 md:shrink w-fit md:w-full min-w-[280px] md:min-w-0 snap-start bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200 h-full';
const MOBILE_CARD_CLASS = 'w-full min-w-0 bg-white/70 backdrop-blur-lg p-2 rounded-2xl shadow-lg border border-slate-200';

const getPositionLabel = (position: CakeMessageUI['position']) =>
    position === 'top' ? 'TOP' : position === 'side' ? 'FRONT' : 'BASE';

export function ColdCakingMessageStep() {
    const { cakeMessages, cakeInfo, onCakeMessageChange, updateCakeMessage, removeCakeMessage } = useCakeCustomization();
    const [mobilePlaceholder, setMobilePlaceholder] = useState<HTMLElement | null>(null);
    const [desktopPlaceholder, setDesktopPlaceholder] = useState<HTMLElement | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');

    const defaultPosition: CakeMessageUI['position'] = cakeInfo?.type === 'Bento' ? 'side' : 'base_board';

    const addMessage = useCallback(() => {
        const newMessage: CakeMessageUI = {
            id: crypto.randomUUID(),
            type: 'gumpaste_letters',
            text: '',
            position: defaultPosition,
            color: '#000000',
            isEnabled: true,
            price: 0,
        };
        onCakeMessageChange([...cakeMessages, newMessage]);
        setEditingId(newMessage.id);
        setEditingText('');
    }, [cakeMessages, onCakeMessageChange, defaultPosition]);

    const saveEdit = useCallback((id: string) => {
        updateCakeMessage(id, { text: editingText });
        setEditingId(null);
    }, [updateCakeMessage, editingText]);

    useEffect(() => {
        let mobilePlaceholderEl: HTMLElement | null = null;
        let desktopPlaceholderEl: HTMLElement | null = null;
        let hiddenCards: HTMLElement[] = [];

        const inject = (container: Element, attrName: string): HTMLElement | null => {
            const existing = container.querySelector(`[${attrName}]`);
            if (existing) return existing as HTMLElement;

            let step4Card: HTMLElement | null = null;
            for (const child of Array.from(container.children)) {
                const h3 = child.querySelector('h3');
                if (h3?.textContent?.includes('Step 4')) {
                    step4Card = child as HTMLElement;
                    break;
                }
            }

            if (!step4Card) return null;

            step4Card.style.display = 'none';
            hiddenCards.push(step4Card);

            const placeholder = document.createElement('div');
            placeholder.setAttribute(attrName, '');
            placeholder.style.display = 'flex';
            placeholder.style.flexDirection = 'column';
            placeholder.style.alignSelf = 'stretch';
            container.insertBefore(placeholder, step4Card);
            return placeholder;
        };

        const injectPlaceholders = () => {
            const wrapper = document.querySelector('.coldcaking-customizer-wrapper');
            if (!wrapper) return;

            const mobileContainer = wrapper.querySelector('.mt-0.flex-col');
            const desktopContainer = wrapper.querySelector('.z-60');

            if (mobileContainer && !mobilePlaceholderEl) {
                mobilePlaceholderEl = inject(mobileContainer, 'data-cc-message-mobile');
                if (mobilePlaceholderEl) setMobilePlaceholder(mobilePlaceholderEl);
            }
            if (desktopContainer && !desktopPlaceholderEl) {
                desktopPlaceholderEl = inject(desktopContainer, 'data-cc-message-desktop');
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
            hiddenCards.forEach(el => { el.style.display = ''; });
        };
    }, []);

    const renderCard = (cardClass: string) => (
        <div className={cardClass}>
            <h3 className="text-[13px] font-semibold text-slate-800 mb-2 px-1">Step 4: Cake Message</h3>
            {cakeMessages.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {cakeMessages.map((message, index) => (
                        <div key={message.id || index}>
                            {editingId === message.id ? (
                                <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-purple-50 border border-purple-200">
                                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider shrink-0">
                                        {getPositionLabel(message.position)}
                                    </span>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={editingText}
                                        onChange={e => setEditingText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') saveEdit(message.id);
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                        onBlur={() => saveEdit(message.id)}
                                        className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400 placeholder:italic"
                                        placeholder="Type your message..."
                                    />
                                    <button
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => saveEdit(message.id)}
                                        className="text-[10px] font-bold text-purple-600 shrink-0 py-1 px-2 hover:bg-purple-100 rounded-lg transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className={`flex items-center gap-3 py-[9px] px-4 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors cursor-pointer group ${!message.isEnabled ? 'opacity-40' : ''}`}
                                    onClick={() => {
                                        setEditingId(message.id);
                                        setEditingText(message.text || '');
                                    }}
                                >
                                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider shrink-0">
                                        {getPositionLabel(message.position)}
                                    </span>
                                    <span className={`text-sm font-medium truncate flex-1 ${message.text ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                        {message.text || 'Tap to type message...'}
                                    </span>
                                    <div
                                        className="w-4 h-4 rounded-full border border-slate-200 shrink-0 shadow-sm"
                                        style={{ backgroundColor: message.color || '#000000' }}
                                    />
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            removeCakeMessage(message.id);
                                        }}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-1 shrink-0"
                                        aria-label="Delete message"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="flex justify-center mt-2">
                        <button
                            onClick={e => { e.stopPropagation(); addMessage(); }}
                            className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all py-2 px-5 rounded-full shadow-sm border border-purple-100 flex items-center gap-1.5"
                        >
                            <span className="text-base leading-none">+</span> Add message
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex justify-center py-2">
                    <button
                        onClick={addMessage}
                        className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all py-2 px-5 rounded-full shadow-sm border border-purple-100 flex items-center gap-1.5"
                    >
                        <span className="text-base leading-none">+</span> Add a cake message
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
