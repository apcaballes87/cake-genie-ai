'use client';
import React, { useMemo, useState } from 'react';
import { MainTopperUI, SupportElementUI } from '@/types';

import { ChevronDownIcon } from './icons';
import { CakeToppersSkeleton } from './LoadingSkeletons';

interface CakeToppersOptionsProps {
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
    mode?: 'detailed' | 'summary';
    visibleSections?: 'all' | 'main' | 'support';
    onSectionClick?: (section: 'main' | 'support') => void;
}

import { TopperCard } from './TopperCard';

export const CakeToppersOptions: React.FC<CakeToppersOptionsProps> = ({
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
    mode = 'detailed',
    visibleSections = 'all',
    onSectionClick
}) => {
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [isMainExpanded, setIsMainExpanded] = useState(true);
    const [isSupportExpanded, setIsSupportExpanded] = useState(true);
    const showMainSection = visibleSections === 'all' || visibleSections === 'main';
    const showSupportSection = visibleSections === 'all' || visibleSections === 'support';
    const showDetailedSectionHeaders = visibleSections === 'all';

    const mainTopperCount = useMemo(
        () => mainToppers.reduce((sum, topper) => sum + (topper.quantity || 1), 0),
        [mainToppers]
    );

    const supportElementCount = useMemo(
        () => supportElements.reduce((sum, element) => sum + (element.quantity || 1), 0),
        [supportElements]
    );

    const buildSummary = (items: Array<MainTopperUI | SupportElementUI>) => {
        const descriptions = items.map((item) => {
            const quantity = item.quantity || 1;
            return quantity > 1 ? `${item.description} × ${quantity}` : item.description;
        });

        if (descriptions.length === 0) return 'No items selected';
        if (descriptions.length === 1) return descriptions[0];
        if (descriptions.length === 2) return `${descriptions[0]}, ${descriptions[1]}`;
        return `${descriptions[0]}, ${descriptions[1]} +${descriptions.length - 2} more`;
    };

    // Show skeleton during AI analysis
    if (isAnalyzing) {
        return <CakeToppersSkeleton />;
    }

    if (mode === 'summary') {
        return (
            <div className="space-y-2">
                {showMainSection && (
                    <button
                        type="button"
                        onClick={() => onSectionClick?.('main')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-purple-100 bg-white/90 hover:bg-purple-50/70 transition-colors text-left"
                    >
                        <div className="min-w-0 flex-1 flex items-center gap-2 text-[11px] leading-5">
                            <span className="shrink-0 font-semibold text-slate-700">
                                Main Toppers ({mainTopperCount}):
                            </span>
                            <span className="truncate text-slate-500">
                                {buildSummary(mainToppers)}
                            </span>
                        </div>
                        <ChevronDownIcon className="w-4 h-4 genie-icon -rotate-90 shrink-0" />
                    </button>
                )}

                {showSupportSection && (
                    <button
                        type="button"
                        onClick={() => onSectionClick?.('support')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-purple-100 bg-white/90 hover:bg-purple-50/70 transition-colors text-left"
                    >
                        <div className="min-w-0 flex-1 flex items-center gap-2 text-[11px] leading-5">
                            <span className="shrink-0 font-semibold text-slate-700">
                                Support Elements ({supportElementCount}):
                            </span>
                            <span className="truncate text-slate-500">
                                {buildSummary(supportElements)}
                            </span>
                        </div>
                        <ChevronDownIcon className="w-4 h-4 genie-icon -rotate-90 shrink-0" />
                    </button>
                )}

                {mainToppers.length === 0 && supportElements.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-8">No toppers or elements detected.</p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Main Toppers Section */}
            {mainToppers.length > 0 && showMainSection && (
                <div>
                    {showDetailedSectionHeaders && (
                        <button
                            onClick={() => setIsMainExpanded(!isMainExpanded)}
                            className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-purple-50 rounded-lg transition-colors group"
                        >
                            <h3 className="text-xs font-semibold text-slate-700">
                                Main Toppers ({mainTopperCount})
                            </h3>
                            <div className={`transition-transform duration-200 ${isMainExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500" />
                            </div>
                        </button>
                    )}
                    {isMainExpanded && (
                        <div className={`space-y-2 ${showDetailedSectionHeaders ? 'mt-1.5' : ''}`}>
                            {mainToppers.map((topper) => (
                                <TopperCard
                                    key={topper.id}
                                    item={topper}
                                    type="topper"
                                    marker={markerMap.get(topper.id)}
                                    expanded={expandedItemId === topper.id}
                                    onToggle={() => setExpandedItemId(expandedItemId === topper.id ? null : topper.id)}
                                    updateItem={(updates) => updateMainTopper(topper.id, updates as Partial<MainTopperUI>)}
                                    onImageReplace={(file) => onTopperImageReplace(topper.id, file)}
                                    itemPrice={itemPrices?.get(topper.id)}
                                    isAdmin={isAdmin}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Support Elements Section */}
            {supportElements.length > 0 && showSupportSection && (
                <div>
                    {showDetailedSectionHeaders && (
                        <button
                            onClick={() => setIsSupportExpanded(!isSupportExpanded)}
                            className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-purple-50 rounded-lg transition-colors group"
                        >
                            <h3 className="text-xs font-semibold text-slate-700">
                                Support Elements ({supportElementCount})
                            </h3>
                            <div className={`transition-transform duration-200 ${isSupportExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500" />
                            </div>
                        </button>
                    )}
                    {isSupportExpanded && (
                        <div className={`space-y-2 ${showDetailedSectionHeaders ? 'mt-1.5' : ''}`}>
                            {supportElements.map((element) => (
                                <TopperCard
                                    key={element.id}
                                    item={element}
                                    type="element"
                                    marker={markerMap.get(element.id)}
                                    expanded={expandedItemId === element.id}
                                    onToggle={() => setExpandedItemId(expandedItemId === element.id ? null : element.id)}
                                    updateItem={(updates) => updateSupportElement(element.id, updates as Partial<SupportElementUI>)}
                                    onImageReplace={(file) => onSupportElementImageReplace(element.id, file)}
                                    itemPrice={itemPrices?.get(element.id)}
                                    isAdmin={isAdmin}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {mainToppers.length === 0 && supportElements.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">No toppers or elements detected.</p>
            )}
        </div>
    );
};
