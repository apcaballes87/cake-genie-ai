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
}

const MessageCard: React.FC<{
    message: CakeMessageUI;
    marker?: string;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
}> = React.memo(({ message, marker, updateCakeMessage, removeCakeMessage }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const positionLabel = message.position === 'top' ? 'Cake Top Side' : message.position === 'side' ? 'Cake Front Side' : 'Base Board';

    return (
        <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="text-[10px] font-bold text-purple-600 uppercase shrink-0 whitespace-nowrap">
                    {message.position === 'top' ? 'CAKE TOP' : message.position === 'side' ? 'CAKE FRONT' : 'BASE BOARD'}
                </div>
                <div className="text-sm font-medium text-slate-800 truncate">
                    {message.text || 'No text'}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-purple-600 font-medium hover:text-purple-700 whitespace-nowrap"
                >
                    Edit Message
                </button>
                <div
                    className="w-4 h-4 rounded-full border border-slate-300 pointer-events-none"
                    style={{ backgroundColor: message.color || '#000000' }}
                    title={message.color}
                />
                <button
                    onClick={() => {
                        if (window.confirm('Are you sure you want to delete this message?')) {
                            removeCakeMessage(message.id);
                        }
                    }}
                    className="text-slate-400 hover:text-red-500 transition-colors ml-1"
                    aria-label="Delete message"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Expanded Content - Overlay/Absolute or inline underneath for editing */}
            {isExpanded && (
                <div className="absolute left-0 right-0 mt-10 z-10 bg-white shadow-lg border border-slate-200 rounded-lg p-3 space-y-3 mx-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-slate-700">Edit Message</span>
                        <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-slate-600">
                            ✕
                        </button>
                    </div>
                    {/* Text Input */}
                    <div>
                        <label htmlFor={`msg-text-${message.id}`} className="block text-[10px] font-medium text-slate-600 mb-1">Message Text</label>
                        <input
                            id={`msg-text-${message.id}`}
                            type="text"
                            value={message.text}
                            onChange={(e) => updateCakeMessage(message.id, { text: e.target.value, isPlaceholder: false })}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder={message.originalMessage?.text || "Enter message text..."}
                        />
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className="block text-[10px] font-medium text-slate-600 mb-1">Text Color</label>
                        <ColorPalette
                            selectedColor={message.color}
                            onColorChange={(hex) => updateCakeMessage(message.id, { color: hex })}
                        />
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
    removeCakeMessage
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
                />
            ))}

            {/* Add Message buttons for missing positions */}
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

            {cakeMessages.length === 0 && missingTopMessage && missingSideMessage && missingBaseBoardMessage && (
                <p className="text-xs text-slate-500 text-center py-2">No messages detected.</p>
            )}
        </div>
    );
};

