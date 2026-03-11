'use client';

import { memo } from 'react';
import { CakeMessagesOptions } from '@/components/CakeMessagesOptions';
import { ResetIcon } from '@/components/icons';
import type { AnalysisItem, CakeMessageUI, CakeType } from '@/types';

interface CustomizingMessagesPanelProps {
    isVisible: boolean;
    hasMessageChanges: boolean;
    cakeMessages: CakeMessageUI[];
    markerMap: Map<string, string>;
    selectedMessageId?: string;
    cakeType?: CakeType;
    onItemClick: (item: AnalysisItem) => void;
    addCakeMessage: (position: 'top' | 'side' | 'base_board', text?: string, color?: string) => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
    onRevert: () => void;
}

export const CustomizingMessagesPanel = memo(function CustomizingMessagesPanel({
    isVisible,
    hasMessageChanges,
    cakeMessages,
    markerMap,
    selectedMessageId,
    cakeType,
    onItemClick,
    addCakeMessage,
    updateCakeMessage,
    removeCakeMessage,
    onRevert,
}: CustomizingMessagesPanelProps) {
    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <div className="space-y-4">
                <div className="flex justify-between items-center gap-3">
                    <p className="text-xs text-slate-500">Edit your cake message text and color, then update the design once when you&apos;re ready.</p>
                    {hasMessageChanges && (
                        <button
                            type="button"
                            onClick={onRevert}
                            className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1 shrink-0"
                        >
                            <ResetIcon className="w-3 h-3" />
                            Revert
                        </button>
                    )}
                </div>
                <CakeMessagesOptions
                    cakeMessages={cakeMessages}
                    markerMap={markerMap}
                    onItemClick={onItemClick}
                    addCakeMessage={addCakeMessage}
                    updateCakeMessage={updateCakeMessage}
                    removeCakeMessage={removeCakeMessage}
                    selectedMessageId={selectedMessageId}
                    cakeType={cakeType}
                />
            </div>
        </div>
    );
});

CustomizingMessagesPanel.displayName = 'CustomizingMessagesPanel';