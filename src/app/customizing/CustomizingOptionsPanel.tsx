'use client';

import { memo } from 'react';
import { CakeBaseOptions } from '@/components/CakeBaseOptions';
import type { BasePriceInfo, CakeInfoUI } from '@/types';

interface CustomizingOptionsPanelProps {
    isVisible: boolean;
    cakeInfo: CakeInfoUI | null;
    basePriceOptions: BasePriceInfo[] | null;
    onCakeInfoChange: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    isAnalyzing: boolean;
    addOnPricing: number;
}

export const CustomizingOptionsPanel = memo(function CustomizingOptionsPanel({
    isVisible,
    cakeInfo,
    basePriceOptions,
    onCakeInfoChange,
    isAnalyzing,
    addOnPricing,
}: CustomizingOptionsPanelProps) {
    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            {cakeInfo && (
                <div className="space-y-4">
                    <CakeBaseOptions
                        cakeInfo={cakeInfo}
                        basePriceOptions={basePriceOptions}
                        onCakeInfoChange={onCakeInfoChange}
                        isAnalyzing={isAnalyzing}
                        addOnPricing={addOnPricing}
                    />
                </div>
            )}
        </div>
    );
});

CustomizingOptionsPanel.displayName = 'CustomizingOptionsPanel';