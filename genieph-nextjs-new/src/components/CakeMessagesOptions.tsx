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
        <div className="w-full bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Header - Collapsible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-slate-50 transition-colors"
            >
                {marker && (
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-600 text-[10px] font-bold rounded-full">
                        {marker}
                    </div>
                )}
                <div className="flex-grow">
                    <div className="text-xs font-medium text-slate-800">"{message.text}"</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{positionLabel}</div>
                </div>
                <PencilIcon className="w-4 h-4 text-slate-400" />
            </button>

            {/* Expanded Content - Message Customization */}
            {isExpanded && (
                <div className="px-2 pb-2 space-y-3 border-t border-slate-100">
                    {/* Text Input */}
                    <div>
                        <label htmlFor={`msg-text-${message.id}`} className="block text-[10px] font-medium text-slate-600 mb-1">Message Text</label>
                        <input
                            id={`msg-text-${message.id}`}
                            type="text"
                            value={message.text}
                            onChange={(e) => updateCakeMessage(message.id, { text: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Enter message text..."
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

                    {/* Toggle Enable/Disable */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <label className="text-xs font-medium text-slate-700">Show Message</label>
                        <button
                            type="button"
                            onClick={() => updateCakeMessage(message.id, { isEnabled: !message.isEnabled })}
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${message.isEnabled ? 'bg-purple-600' : 'bg-slate-300'}`}
                            aria-pressed={message.isEnabled}
                        >
                            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${message.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Delete Button */}
                    <button
                        type="button"
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this message?')) {
                                removeCakeMessage(message.id);
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                        <TrashIcon className="w-4 h-4" />
                        Delete Message
                    </button>
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
            {missingTopMessage && (
                <button
                    type="button"
                    onClick={() => addCakeMessage('top')}
                    className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                >
                    <span className="text-base">+</span> Add Message (Cake Top Side)
                </button>
            )}

            {missingSideMessage && (
                <button
                    type="button"
                    onClick={() => addCakeMessage('side')}
                    className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                >
                    <span className="text-base">+</span> Add Message (Cake Front Side)
                </button>
            )}

            {missingBaseBoardMessage && (
                <button
                    type="button"
                    onClick={() => addCakeMessage('base_board')}
                    className="w-full text-left bg-white border border-dashed border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-xs flex items-center gap-2"
                >
                    <span className="text-base">+</span> Add Message (Base Board)
                </button>
            )}

            {cakeMessages.length === 0 && missingTopMessage && missingSideMessage && missingBaseBoardMessage && (
                <p className="text-xs text-slate-500 text-center py-2">No messages detected.</p>
            )}
        </div>
    );
};

