'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CakeMessageUI, CakeType } from '@/types';
import { ColorPalette } from './ColorPalette';
import { TrashIcon } from './icons';

interface CakeMessagesOptionsProps {
    cakeMessages: CakeMessageUI[];
    addCakeMessage: (position: 'top' | 'side' | 'base_board', text?: string, color?: string) => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    cakeType?: CakeType;
}

const MESSAGE_POSITION_OPTIONS = [
    { position: 'side' as const, label: 'Front' },
    { position: 'top' as const, label: 'Top' },
    { position: 'base_board' as const, label: 'Base' },
];

const getPositionLabel = (position: CakeMessageUI['position']) =>
    MESSAGE_POSITION_OPTIONS.find((option) => option.position === position)?.label || position;

const MessageRow: React.FC<{
    message: CakeMessageUI;
    availablePositions: typeof MESSAGE_POSITION_OPTIONS;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
}> = React.memo(({ message, availablePositions, updateCakeMessage, removeCakeMessage }) => {
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isColorPickerOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!colorPickerRef.current?.contains(event.target as Node)) {
                setIsColorPickerOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsColorPickerOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isColorPickerOpen]);

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(110px,0.45fr)_auto_auto] items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm max-md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="min-w-0 max-md:col-span-3">
                <label htmlFor={`msg-text-${message.id}`} className="mb-1 block text-[10px] font-bold uppercase tracking-tight text-slate-500">
                    Text
                </label>
                <input
                    id={`msg-text-${message.id}`}
                    type="text"
                    value={message.text}
                    onChange={(event) => updateCakeMessage(message.id, { text: event.target.value, isPlaceholder: false })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    placeholder={message.originalMessage?.text || 'What should it say?'}
                    autoComplete="off"
                />
            </div>

            <div className="max-md:min-w-0">
                <label htmlFor={`msg-position-${message.id}`} className="mb-1 block text-[10px] font-bold uppercase tracking-tight text-slate-500">
                    Position
                </label>
                <select
                    id={`msg-position-${message.id}`}
                    aria-label={`Position for ${message.id}`}
                    value={message.position}
                    onChange={(event) => updateCakeMessage(message.id, { position: event.target.value as CakeMessageUI['position'] })}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                    {availablePositions.map((option) => (
                        <option key={option.position} value={option.position}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <div ref={colorPickerRef} className="relative max-md:justify-self-end">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-tight text-slate-500">Color</span>
                <button
                    type="button"
                    onClick={() => setIsColorPickerOpen((isOpen) => !isOpen)}
                    className="h-8 w-8 rounded-full border-2 border-white shadow-md ring-1 ring-slate-200 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
                    style={{ backgroundColor: message.color || '#000000' }}
                    aria-label={`Choose color for ${message.id}`}
                    aria-expanded={isColorPickerOpen}
                    aria-haspopup="true"
                />
                {isColorPickerOpen && (
                    <div className="absolute bottom-full right-0 z-50 mb-2 w-52 rounded-xl border border-purple-100 bg-white p-3 shadow-[0_12px_30px_-12px_rgba(88,28,135,0.45)]">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">Choose color</span>
                            <button
                                type="button"
                                onClick={() => setIsColorPickerOpen(false)}
                                className="text-[10px] font-semibold text-slate-400 hover:text-purple-600"
                            >
                                Done
                            </button>
                        </div>
                        <ColorPalette
                            selectedColor={message.color}
                            onColorChange={(color) => updateCakeMessage(message.id, { color })}
                        />
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => {
                    if (window.confirm('Delete this message?')) removeCakeMessage(message.id);
                }}
                className="mb-1 rounded-md p-1 text-slate-300 transition-colors hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                aria-label={`Delete ${getPositionLabel(message.position)} message`}
            >
                <TrashIcon className="h-4 w-4" />
            </button>
        </div>
    );
});
MessageRow.displayName = 'MessageRow';

export const CakeMessagesOptions: React.FC<CakeMessagesOptionsProps> = ({
    cakeMessages,
    addCakeMessage,
    updateCakeMessage,
    removeCakeMessage,
    cakeType,
}) => {
    const visiblePositionOptions = useMemo(
        () => MESSAGE_POSITION_OPTIONS.filter((option) => cakeType !== 'Bento' || option.position !== 'base_board'),
        [cakeType]
    );

    const usedPositions = useMemo(() => new Set(cakeMessages.map((message) => message.position)), [cakeMessages]);

    return (
        <div className="space-y-3">
            {cakeMessages.map((message) => {
                const availablePositions = visiblePositionOptions.filter(
                    (option) => option.position === message.position || !usedPositions.has(option.position)
                );

                return (
                    <MessageRow
                        key={message.id}
                        message={message}
                        availablePositions={availablePositions}
                        updateCakeMessage={updateCakeMessage}
                        removeCakeMessage={removeCakeMessage}
                    />
                );
            })}

            {visiblePositionOptions.some((option) => !usedPositions.has(option.position)) && (
                <div className="flex justify-start pt-1">
                    <button
                        type="button"
                        onClick={() => {
                            const firstUnusedPosition = visiblePositionOptions.find((option) => !usedPositions.has(option.position));
                            if (firstUnusedPosition) addCakeMessage(firstUnusedPosition.position);
                        }}
                        className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                    >
                        + Add message
                    </button>
                </div>
            )}
        </div>
    );
};
