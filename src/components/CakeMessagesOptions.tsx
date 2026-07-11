'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
    onRequestDelete: (message: CakeMessageUI) => void;
}> = React.memo(({ message, availablePositions, updateCakeMessage, onRequestDelete }) => {
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const inputValue = message.originalMessage?.text === message.text ? '' : message.text;

    useLayoutEffect(() => {
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const oneLineHeight = 34;
        const maxHeight = 54;
        textarea.style.height = `${oneLineHeight}px`;

        if (!inputValue.trim()) {
            textarea.style.overflowY = 'hidden';
            return;
        }

        textarea.style.height = 'auto';
        const nextHeight = Math.min(Math.max(textarea.scrollHeight, oneLineHeight), maxHeight);
        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [inputValue]);

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
        <div className="flex min-w-0 items-start gap-2 py-0.5">
            <div className="min-w-0 flex-1">
                <label htmlFor={`msg-text-${message.id}`} className="sr-only">Text</label>
                <textarea
                    id={`msg-text-${message.id}`}
                    ref={textAreaRef}
                    rows={1}
                    value={inputValue}
                    onChange={(event) => updateCakeMessage(message.id, { text: event.target.value })}
                    className="h-[34px] max-h-[54px] w-full min-w-0 resize-none rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs leading-5 outline-none transition-all placeholder:font-medium placeholder:italic placeholder:text-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    placeholder={message.originalMessage?.text || 'What should it say?'}
                    autoComplete="off"
                />
            </div>

            <div className="flex h-[34px] shrink-0 items-center">
                <label htmlFor={`msg-position-${message.id}`} className="sr-only">Position</label>
                <select
                    id={`msg-position-${message.id}`}
                    aria-label={`Position for ${message.id}`}
                    value={message.position}
                    onChange={(event) => updateCakeMessage(message.id, { position: event.target.value as CakeMessageUI['position'] })}
                    className="h-[34px] w-[65px] rounded-lg border border-slate-200 bg-slate-50/50 px-1.5 text-[11px] outline-none transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                    {availablePositions.map((option) => (
                        <option key={option.position} value={option.position}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <div ref={colorPickerRef} className="relative flex h-[34px] shrink-0 items-center">
                <button
                    type="button"
                    onClick={() => setIsColorPickerOpen((isOpen) => !isOpen)}
                    className="h-7 w-7 rounded-full border-2 border-white shadow-md ring-1 ring-slate-200 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
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
                onClick={() => onRequestDelete(message)}
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                aria-label={`Delete ${getPositionLabel(message.position)} message`}
            >
                <TrashIcon className="h-5 w-5" />
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
    const [messagePendingDelete, setMessagePendingDelete] = useState<CakeMessageUI | null>(null);
    const visiblePositionOptions = useMemo(
        () => MESSAGE_POSITION_OPTIONS.filter((option) => cakeType !== 'Bento' || option.position !== 'base_board'),
        [cakeType]
    );

    const usedPositions = useMemo(() => new Set(cakeMessages.map((message) => message.position)), [cakeMessages]);

    useEffect(() => {
        if (!messagePendingDelete) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMessagePendingDelete(null);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [messagePendingDelete]);

    return (
        <div className="space-y-[3px]">
            <h3 className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                CAKE MESSAGE
            </h3>

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
                        onRequestDelete={setMessagePendingDelete}
                    />
                );
            })}

            {visiblePositionOptions.some((option) => !usedPositions.has(option.position)) && (
                <div className="flex justify-center pt-1">
                    <button
                        type="button"
                        onClick={() => {
                            const firstUnusedPosition = visiblePositionOptions.find((option) => !usedPositions.has(option.position));
                            if (firstUnusedPosition) addCakeMessage(firstUnusedPosition.position);
                        }}
                        className="rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                    >
                        + Add message
                    </button>
                </div>
            )}

            {messagePendingDelete && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[1px]"
                    role="presentation"
                    onClick={() => setMessagePendingDelete(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-message-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="delete-message-title" className="text-base font-bold text-slate-800">Delete message?</h2>
                        <p className="mt-2 text-sm leading-5 text-slate-500">
                            This will remove the {getPositionLabel(messagePendingDelete.position).toLowerCase()} message from the cake.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setMessagePendingDelete(null)}
                                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    removeCakeMessage(messagePendingDelete.id);
                                    setMessagePendingDelete(null);
                                }}
                                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                            >
                                Delete message
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
