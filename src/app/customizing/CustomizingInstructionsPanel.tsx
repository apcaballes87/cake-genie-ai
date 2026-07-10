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
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Additional Instructions</h3>
                </div>
                <textarea
                    aria-label="Additional Instructions"
                    value={additionalInstructions}
                    onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
                    placeholder="e.g. Please make the colors exactly as in the photo, or make the topper slightly taller..."
                    className="w-full h-28 resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
            </div>
        </div>
    );
});

CustomizingInstructionsPanel.displayName = 'CustomizingInstructionsPanel';
