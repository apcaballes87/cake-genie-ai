'use client';
import React, { useMemo } from 'react';
import { CakeMessageUI, CakeType } from '@/types';
// import { AnalysisItem } from '@/app/customizing/page';
type AnalysisItem = any; // Temporary fix until page is migrated
import { ColorPalette } from './ColorPalette';
import LazyImage from './LazyImage';
import { TrashIcon, CheckCircleIcon, BackIcon } from './icons';

interface CakeMessagesOptionsProps {
    cakeMessages: CakeMessageUI[];
    markerMap: Map<string, string>;
    onItemClick: (item: AnalysisItem) => void;
    addCakeMessage: (position: 'top' | 'side' | 'base_board', text?: string, color?: string) => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    selectedMessageId?: string;
    cakeType?: CakeType;
}

const MESSAGE_POSITION_OPTIONS = [
    {
        position: 'top' as const,
        label: 'Top',
        title: 'Cake Top',
        subtitle: 'Cake top',
        thumbnail: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/msg_top.webp',
    },
    {
        position: 'side' as const,
        label: 'Front',
        title: 'Cake Front',
        subtitle: 'Cake front',
        thumbnail: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/msg_front.webp',
    },
    {
        position: 'base_board' as const,
        label: 'Base',
        title: 'Cake Base',
        subtitle: 'Base board',
        thumbnail: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/msg_base.webp',
    },
];

const MessageEditor: React.FC<{
    message: CakeMessageUI;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    onBack?: () => void;
    autoFocus?: boolean;
    title: string;
}> = React.memo(({ message, updateCakeMessage, removeCakeMessage, onBack, autoFocus, title }) => {
    const textInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (autoFocus && message && textInputRef.current) {
            const timer = window.setTimeout(() => {
                textInputRef.current?.focus();
            }, 100);

            return () => window.clearTimeout(timer);
        }
    }, [autoFocus, message]);

    return (
        <div className="w-full bg-white border border-purple-100 rounded-2xl p-4 space-y-4 shadow-sm animate-fade-in mt-1 mb-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <div className="flex items-center gap-2">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1 hover:bg-slate-50 rounded-full text-slate-400 hover:text-purple-600 transition-colors"
                        >
                            <BackIcon className="w-3 h-4" />
                        </button>
                    )}
                    <span className="text-xs font-bold text-slate-800">Edit {title} Message</span>
                </div>
                <button
                    onClick={() => {
                        if (window.confirm('Delete this message?')) {
                            removeCakeMessage(message.id);
                        }
                    }}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                    aria-label={`Delete ${title} message`}
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>

            <div>
                <label htmlFor={`msg-text-${message.id}`} className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1.5 ml-1">Message Content</label>
                <input
                    id={`msg-text-${message.id}`}
                    ref={textInputRef}
                    type="text"
                    value={message.text}
                    onChange={(e) => updateCakeMessage(message.id, { text: e.target.value, isPlaceholder: false })}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none bg-slate-50/50"
                    placeholder={message.originalMessage?.text || 'What should it say?'}
                />
            </div>

            <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-2 ml-1">Text Color</label>
                <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 mb-2">
                    <ColorPalette
                        selectedColor={message.color}
                        onColorChange={(hex) => updateCakeMessage(message.id, { color: hex })}
                    />
                </div>
            </div>
        </div>
    );
});
MessageEditor.displayName = 'MessageEditor';

export const CakeMessagesOptions: React.FC<CakeMessagesOptionsProps> = ({
    cakeMessages,
    addCakeMessage,
    updateCakeMessage,
    removeCakeMessage,
    onItemClick,
    selectedMessageId,
    cakeType,
}) => {
    const messagesByPosition = useMemo(() => {
        return new Map(cakeMessages.map((message) => [message.position, message]));
    }, [cakeMessages]);

    const visiblePositionOptions = useMemo(() => {
        return MESSAGE_POSITION_OPTIONS.filter((option) => cakeType !== 'Bento' || option.position !== 'base_board');
    }, [cakeType]);

    const selectedMessage = useMemo(() => {
        return cakeMessages.find(m => m.id === selectedMessageId);
    }, [cakeMessages, selectedMessageId]);

    return (
        <div className="space-y-4">
            {/* Position thumbnails in 1 row - hidden when editing */}
            {!selectedMessage && (
                <div className="grid grid-cols-3 gap-3.5 max-w-[240px] py-2">
                    {visiblePositionOptions.map((option) => {
                        const message = messagesByPosition.get(option.position);
                        const hasMessage = !!message;

                        return (
                            <button
                                key={option.position}
                                onClick={() => {
                                    if (hasMessage) {
                                        onItemClick({ ...message, itemCategory: 'message' });
                                    } else {
                                        addCakeMessage(option.position);
                                    }
                                }}
                                className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${hasMessage
                                        ? 'border-purple-200 bg-white'
                                        : 'border-slate-100 bg-white hover:border-purple-200 hover:bg-slate-50'
                                    }`}
                            >
                                <div className="relative w-full aspect-square overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                                    <LazyImage
                                        src={option.thumbnail}
                                        alt={option.label}
                                        fill
                                        sizes="80px"
                                        imageClassName="object-cover"
                                    />
                                    {hasMessage && (
                                        <div className="absolute top-1 right-1 bg-purple-600 rounded-full shadow-sm">
                                            <CheckCircleIcon className="w-3.5 h-3.5 text-white p-0.5" />
                                        </div>
                                    )}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tight text-slate-500`}>
                                    {option.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Editor for the selected message */}
            {selectedMessage && (
                <MessageEditor
                    message={selectedMessage}
                    title={MESSAGE_POSITION_OPTIONS.find(o => o.position === selectedMessage.position)?.label || ''}
                    updateCakeMessage={updateCakeMessage}
                    removeCakeMessage={removeCakeMessage}
                    onBack={() => {
                        onItemClick({ id: 'messages-main', itemCategory: 'action' } as any);
                    }}
                    autoFocus={true}
                />
            )}

            {!selectedMessageId && cakeMessages.length > 0 && (
                <p className="text-center text-[10px] text-slate-400 font-medium py-2">
                    Select a thumbnail above to edit its message
                </p>
            )}
        </div>
    );
};
