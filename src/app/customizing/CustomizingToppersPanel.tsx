'use client';

import { memo } from 'react';
import { CakeToppersOptions } from '@/components/CakeToppersOptions';
import type { MainTopperUI, SupportElementUI } from '@/types';

interface CustomizingToppersPanelProps {
    isVisible: boolean;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    markerMap: Map<string, string>;
    updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
    updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
    onTopperImageReplace: (topperId: string, file: File) => void;
    onSupportElementImageReplace: (elementId: string, file: File) => void;
    itemPrices?: Map<string, number>;
    isAdmin?: boolean;
    isAnalyzing?: boolean;
    visibleSections?: 'all' | 'main' | 'support';
}

export const CustomizingToppersPanel = memo(function CustomizingToppersPanel({
    isVisible,
    mainToppers,
    supportElements,
    markerMap,
    updateMainTopper,
    updateSupportElement,
    onTopperImageReplace,
    onSupportElementImageReplace,
    itemPrices,
    isAdmin,
    isAnalyzing,
    visibleSections = 'all',
}: CustomizingToppersPanelProps) {
    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <CakeToppersOptions
                mainToppers={mainToppers}
                supportElements={supportElements}
                markerMap={markerMap}
                updateMainTopper={updateMainTopper}
                updateSupportElement={updateSupportElement}
                onTopperImageReplace={onTopperImageReplace}
                onSupportElementImageReplace={onSupportElementImageReplace}
                itemPrices={itemPrices}
                isAdmin={isAdmin}
                isAnalyzing={isAnalyzing}
                visibleSections={visibleSections}
            />
        </div>
    );
});

CustomizingToppersPanel.displayName = 'CustomizingToppersPanel';