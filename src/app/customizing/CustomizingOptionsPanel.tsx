'use client';

import { memo } from 'react';
import { CakeBaseOptions } from '@/components/CakeBaseOptions';
import type { BasePriceInfo, CakeInfoUI, IcingDesignUI } from '@/types';

interface CustomizingOptionsPanelProps {
    isVisible: boolean;
    cakeInfo: CakeInfoUI | null;
    basePriceOptions: BasePriceInfo[] | null;
    icingDesign: IcingDesignUI | null;
    onCakeInfoChange: (updates: Partial<CakeInfoUI>, options?: { isSystemCorrection?: boolean }) => void;
    onIcingBaseChange: (base: IcingDesignUI['base']) => void;
    isAnalyzing: boolean;
    addOnPricing: number;
}

export const CustomizingOptionsPanel = memo(function CustomizingOptionsPanel({
    isVisible,
    cakeInfo,
    basePriceOptions,
    icingDesign,
    onCakeInfoChange,
    onIcingBaseChange,
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
                        icingBase={icingDesign?.base ?? null}
                        onCakeInfoChange={onCakeInfoChange}
                        onIcingBaseChange={onIcingBaseChange}
                        isAnalyzing={isAnalyzing}
                        addOnPricing={addOnPricing}
                    />
                </div>
            )}
        </div>
    );
});

CustomizingOptionsPanel.displayName = 'CustomizingOptionsPanel';
