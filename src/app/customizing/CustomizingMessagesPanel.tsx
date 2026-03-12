'use client';

import { memo } from 'react';
import { CakeMessagesOptions } from '@/components/CakeMessagesOptions';
import { ResetIcon } from '@/components/icons';
import type { AnalysisItem, CakeMessageUI, CakeType } from '@/types';

interface CustomizingMessagesPanelProps {
    isVisible: boolean;
    cakeMessages: CakeMessageUI[];
    markerMap: Map<string, string>;
    selectedMessageId?: string;
    cakeType?: CakeType;
    onItemClick: (item: AnalysisItem) => void;
    addCakeMessage: (position: 'top' | 'side' | 'base_board', text?: string, color?: string) => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
}

export const CustomizingMessagesPanel = memo(function CustomizingMessagesPanel({
    isVisible,
    cakeMessages,
    markerMap,
    selectedMessageId,
    cakeType,
    onItemClick,
    addCakeMessage,
    updateCakeMessage,
    removeCakeMessage,
}: CustomizingMessagesPanelProps) {
    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <div className="space-y-4">
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