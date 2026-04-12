'use client';

import { memo } from 'react';
import { CakeToppersOptions } from '@/components/CakeToppersOptions';
import type { AnalysisItem, MainTopperUI, SupportElementUI } from '@/types';

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
    selectedTopperItem?: Extract<AnalysisItem, { itemCategory: 'topper' | 'element' }> | null;
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
    selectedTopperItem = null,
}: CustomizingToppersPanelProps) {
    const filteredMainToppers = selectedTopperItem?.itemCategory === 'topper'
        ? mainToppers.filter((topper) => topper.id === selectedTopperItem.id)
        : selectedTopperItem?.itemCategory === 'element'
            ? []
            : mainToppers;
    const filteredSupportElements = selectedTopperItem?.itemCategory === 'element'
        ? supportElements.filter((element) => element.id === selectedTopperItem.id)
        : selectedTopperItem?.itemCategory === 'topper'
            ? []
            : supportElements;
    const effectiveVisibleSections = selectedTopperItem?.itemCategory === 'topper'
        ? 'main'
        : selectedTopperItem?.itemCategory === 'element'
            ? 'support'
            : visibleSections;

    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <CakeToppersOptions
                mainToppers={filteredMainToppers}
                supportElements={filteredSupportElements}
                markerMap={markerMap}
                updateMainTopper={updateMainTopper}
                updateSupportElement={updateSupportElement}
                onTopperImageReplace={onTopperImageReplace}
                onSupportElementImageReplace={onSupportElementImageReplace}
                itemPrices={itemPrices}
                isAdmin={isAdmin}
                isAnalyzing={isAnalyzing}
                visibleSections={effectiveVisibleSections}
            />
        </div>
    );
});

CustomizingToppersPanel.displayName = 'CustomizingToppersPanel';
