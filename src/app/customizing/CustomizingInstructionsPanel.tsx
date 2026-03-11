'use client';

import { memo } from 'react';

interface CustomizingInstructionsPanelProps {
    isVisible: boolean;
    additionalInstructions: string;
    onAdditionalInstructionsChange: (value: string) => void;
}

export const CustomizingInstructionsPanel = memo(function CustomizingInstructionsPanel({
    isVisible,
    additionalInstructions,
    onAdditionalInstructionsChange,
}: CustomizingInstructionsPanelProps) {
    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <div className="p-4 space-y-3">
                <p className="text-xs text-slate-500">Any special requests or details we should know about? Describe them here!</p>
                <textarea
                    value={additionalInstructions}
                    onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
                    placeholder="e.g. Please make the colors exactly as in the photo, or Make the topper slightly taller..."
                    className="w-full h-32 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow resize-none"
                />
            </div>
        </div>
    );
});

CustomizingInstructionsPanel.displayName = 'CustomizingInstructionsPanel';