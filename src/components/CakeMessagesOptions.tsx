'use client';
import React, { useMemo, useState } from 'react';
import { CakeMessageUI } from '@/types';
// import { AnalysisItem } from '@/app/customizing/page';
type AnalysisItem = any; // Temporary fix until page is migrated
import { ColorPalette } from './ColorPalette';
import { TrashIcon, PencilIcon } from './icons';

interface CakeMessagesOptionsProps {
    cakeMessages: CakeMessageUI[];
    markerMap: Map<string, string>;
    onItemClick: (item: AnalysisItem) => void;
    addCakeMessage: (position: 'top' | 'side' | 'base_board') => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    selectedMessageId?: string;
}

const MessageCard: React.FC<{
    message: CakeMessageUI;
    marker?: string;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    isSelected?: boolean;
}> = React.memo(({ message, marker, updateCakeMessage, removeCakeMessage, isSelected }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const textInputRef = React.useRef<HTMLInputElement>(null);

    // Auto-expand when selected and auto-focus the text input
    React.useEffect(() => {
        if (isSelected && !isExpanded) {
            setIsExpanded(true);
        }
    }, [isSelected]);

    React.useEffect(() => {
        if (isExpanded && isSelected && textInputRef.current) {
            // Small delay to ensure the input is rendered
            setTimeout(() => {
                textInputRef.current?.focus();
            }, 100);
        }
    }, [isExpanded, isSelected]);

    const positionLabel = message.position === 'top' ? 'Cake Top Side' : message.position === 'side' ? 'Cake Front Side' : 'Base Board';

    return (
        <div className="flex flex-col gap-2 relative">
            {/* Main Message Card */}
            <div
                className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 transition-all ${isSelected ? 'ring-2 ring-purple-100 border-purple-200' : ''}`}
            >
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-0.5">
                        {message.position === 'top' ? 'CAKE TOP' : message.position === 'side' ? 'CAKE FRONT' : 'BASE BOARD'}
                    </div>
                    <div className="text-sm font-semibold text-slate-800 truncate">
                        {message.text || <span className="text-slate-400 italic font-normal">No text added</span>}
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isExpanded
                                ? 'bg-purple-100 text-purple-700'
                                : 'text-purple-600 hover:bg-purple-50'
                            }`}
                    >
                        {isExpanded ? 'Done' : 'Edit'}
                    </button>
                    <div
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200"
                        style={{ backgroundColor: message.color || '#000000' }}
                        title={message.color}
                    />
                    <button
                        onClick={() => {
                            if (window.confirm('Delete this message?')) {
                                removeCakeMessage(message.id);
                            }
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        aria-label="Delete message"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Inline Edit Panel (Accordion style) */}
            {isExpanded && (
                <div className="w-full bg-white border border-slate-100 rounded-xl p-4 space-y-4 shadow-sm animate-in slide-in-from-top-2 duration-200 z-10">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                        <span className="text-xs font-bold text-slate-800">Customize Message</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <PencilIcon className="w-3 h-3" />
                            Editing
                        </div>
                    </div>

                    {/* Text Input */}
                    <div>
                        <label htmlFor={`msg-text-${message.id}`} className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1.5 ml-1">Message Content</label>
                        <input
                            id={`msg-text-${message.id}`}
                            ref={textInputRef}
                            type="text"
                            value={message.text}
                            onChange={(e) => updateCakeMessage(message.id, { text: e.target.value, isPlaceholder: false })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none bg-slate-50/50"
                            placeholder={message.originalMessage?.text || "What should it say?"}
                        />
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-2 ml-1">Text Color</label>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                            <ColorPalette
                                selectedColor={message.color}
                                onColorChange={(hex) => updateCakeMessage(message.id, { color: hex })}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
MessageCard.displayName = 'MessageCard';

export const CakeMessagesOptions: React.FC<CakeMessagesOptionsProps> = ({
    cakeMessages,
    markerMap,
    onItemClick,
    addCakeMessage,
    updateCakeMessage,
    removeCakeMessage,
    selectedMessageId
}) => {
    // Determine which message positions are missing
    const existingPositions = useMemo(() => {
        return new Set(cakeMessages.map(msg => msg.position));
    }, [cakeMessages]);

    const missingTopMessage = !existingPositions.has('top');
    const missingSideMessage = !existingPositions.has('side');
    const missingBaseBoardMessage = !existingPositions.has('base_board');

    return (
        <div className="space-y-2.5">
            {cakeMessages.length > 0 && cakeMessages.map((message) => (
                <MessageCard
                    key={message.id}
                    message={message}
                    marker={markerMap.get(message.id)}
                    updateCakeMessage={updateCakeMessage}
                    removeCakeMessage={removeCakeMessage}
                    isSelected={selectedMessageId === message.id}
                />
            ))}

            {/* Add Message buttons for missing positions - only show when no specific message is selected */}
            {!selectedMessageId && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {missingTopMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage('top')}
                            className="text-[11px] font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                            <span>+ Add message</span> <span className="text-slate-400">(Top)</span>
                        </button>
                    )}

                    {missingSideMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage('side')}
                            className="text-[11px] font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                            <span>+ Add message</span> <span className="text-slate-400">(Front)</span>
                        </button>
                    )}

                    {missingBaseBoardMessage && (
                        <button
                            type="button"
                            onClick={() => addCakeMessage('base_board')}
                            className="text-[11px] font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                            <span>+ Add message</span> <span className="text-slate-400">(Board)</span>
                        </button>
                    )}
                </div>
            )}

            {cakeMessages.length === 0 && missingTopMessage && missingSideMessage && missingBaseBoardMessage && (
                <p className="text-xs text-slate-500 text-center py-2">No messages detected.</p>
            )}
        </div>
    );
};

