'use client';

import { memo } from 'react';
import { CakeMessagesOptions } from '@/components/CakeMessagesOptions';
import type { CakeMessageUI, CakeType } from '@/types';

interface CustomizingMessagesPanelProps {
    isVisible: boolean;
    cakeMessages: CakeMessageUI[];
    cakeType?: CakeType;
    addCakeMessage: (position: 'top' | 'side' | 'base_board', text?: string, color?: string) => void;
    updateCakeMessage: (id: string, updates: Partial<CakeMessageUI>) => void;
    removeCakeMessage: (id: string) => void;
}

export const CustomizingMessagesPanel = memo(function CustomizingMessagesPanel({
    isVisible,
    cakeMessages,
    cakeType,
    addCakeMessage,
    updateCakeMessage,
    removeCakeMessage,
}: CustomizingMessagesPanelProps) {
    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <div className="space-y-4">
                <CakeMessagesOptions
                    cakeMessages={cakeMessages}
                    addCakeMessage={addCakeMessage}
                    updateCakeMessage={updateCakeMessage}
                    removeCakeMessage={removeCakeMessage}
                    cakeType={cakeType}
                />
            </div>
        </div>
    );
});

CustomizingMessagesPanel.displayName = 'CustomizingMessagesPanel';
