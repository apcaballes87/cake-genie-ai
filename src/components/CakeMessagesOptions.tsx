'use client';
import React, { useMemo } from 'react';
import { CakeMessageUI, CakeType } from '@/types';
// import { AnalysisItem } from '@/app/customizing/page';
type AnalysisItem = any; // Temporary fix until page is migrated
import { ColorPalette } from './ColorPalette';
import LazyImage from './LazyImage';
import { TrashIcon } from './icons';

interface CakeMessagesOptionsProps {
    cakeMessages: CakeMessageUI[];
    markerMap: Map<string, string>;
    onItemClick: (item: AnalysisItem) => void;
    addCakeMessage: (position: 'top' | 'side' | 'base_board') => void;
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

const MessageEditorCard: React.FC<{
    position: CakeMessageUI['position'];
    title: string;
    subtitle: string;
    thumbnail: string;
    message?: CakeMessageUI;
    addCakeMessage: (position: 'top' | 'side' | 'base_board') => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    autoFocus?: boolean;
}> = React.memo(({ position, title, subtitle, thumbnail, message, addCakeMessage, updateCakeMessage, removeCakeMessage, autoFocus }) => {
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
        <div className={`w-full bg-white border rounded-xl p-4 space-y-4 shadow-sm transition-all ${autoFocus ? 'border-purple-200 ring-2 ring-purple-100' : 'border-slate-100'}`}>
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-xs font-bold text-slate-800">{title}</span>
                {message ? (
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
                ) : (
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Optional</span>
                )}
            </div>

            {message ? (
                <>
                    <div>
                        <label htmlFor={`msg-text-${message.id}`} className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1.5 ml-1">Message Content</label>
                        <input
                            id={`msg-text-${message.id}`}
                            ref={textInputRef}
                            type="text"
                            value={message.text}
                            onChange={(e) => updateCakeMessage(message.id, { text: e.target.value, isPlaceholder: false })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none bg-slate-50/50"
                            placeholder={message.originalMessage?.text || 'What should it say?'}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-2 ml-1">Text Color</label>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                            <ColorPalette
                                selectedColor={message.color}
                                onColorChange={(hex) => updateCakeMessage(message.id, { color: hex })}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                        <LazyImage
                            src={thumbnail}
                            alt={`Add message ${title.toLowerCase()} thumbnail`}
                            fill
                            sizes="64px"
                            imageClassName="object-cover"
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-700">No message yet</div>
                        <div className="text-xs text-slate-500">Add a message for the {subtitle}.</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => addCakeMessage(position)}
                        className="shrink-0 rounded-lg bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                        aria-label={`Add message (${title})`}
                    >
                        + Add message
                    </button>
                </div>
            )}
        </div>
    );
});
MessageEditorCard.displayName = 'MessageEditorCard';

export const CakeMessagesOptions: React.FC<CakeMessagesOptionsProps> = ({
    cakeMessages,
    addCakeMessage,
    updateCakeMessage,
    removeCakeMessage,
    selectedMessageId,
    cakeType,
}) => {
    const messagesByPosition = useMemo(() => {
        return new Map(cakeMessages.map((message) => [message.position, message]));
    }, [cakeMessages]);

    const visiblePositionOptions = useMemo(() => {
        return MESSAGE_POSITION_OPTIONS.filter((option) => cakeType !== 'Bento' || option.position !== 'base_board');
    }, [cakeType]);

    return (
        <div className="space-y-3">
            {visiblePositionOptions.map((option) => {
                const message = messagesByPosition.get(option.position);

                return (
                    <MessageEditorCard
                        key={option.position}
                        position={option.position}
                        title={option.title}
                        subtitle={option.subtitle}
                        thumbnail={option.thumbnail}
                        message={message}
                        addCakeMessage={addCakeMessage}
                        updateCakeMessage={updateCakeMessage}
                        removeCakeMessage={removeCakeMessage}
                        autoFocus={selectedMessageId === message?.id}
                    />
                );
            })}
        </div>
    );
};

