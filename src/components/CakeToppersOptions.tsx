'use client';
import React, { useState, useRef } from 'react';
import { MainTopperUI, SupportElementUI, MainTopperType, SupportElementType } from '@/types';

import { PencilIcon, PhotoIcon, TrashIcon, Loader2, ResetIcon, ChevronDownIcon } from './icons';
import { ColorPalette } from './ColorPalette';
import { MultiColorEditor } from './MultiColorEditor';
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
    isAnalyzing
}) => {
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [isMainExpanded, setIsMainExpanded] = useState(true);
    const [isSupportExpanded, setIsSupportExpanded] = useState(true);

    // Show skeleton during AI analysis
    if (isAnalyzing) {
        return <CakeToppersSkeleton />;
    }

    return (
        <div className="space-y-3">
            {/* Main Toppers Section */}
            {mainToppers.length > 0 && (
                <div>
                    <button
                        onClick={() => setIsMainExpanded(!isMainExpanded)}
                        className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-slate-50 rounded-lg transition-colors group"
                    >
                        <h3 className="text-xs font-semibold text-slate-700">
                            Main Toppers ({mainToppers.reduce((sum, t) => sum + t.quantity, 0)})
                        </h3>
                        <div className={`transition-transform duration-200 ${isMainExpanded ? 'rotate-0' : '-rotate-90'}`}>
                            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500" />
                        </div>
                    </button>
                    {isMainExpanded && (
                        <div className="space-y-2 mt-1.5">
                            {mainToppers.map((topper) => (
                                <TopperCard
                                    key={topper.id}
                                    item={topper}
                                    type="topper"
                                    marker={markerMap.get(topper.id)}
                                    expanded={expandedItemId === topper.id}
                                    onToggle={() => setExpandedItemId(expandedItemId === topper.id ? null : topper.id)}
                                    updateItem={(updates) => updateMainTopper(topper.id, updates)}
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
            {supportElements.length > 0 && (
                <div>
                    <button
                        onClick={() => setIsSupportExpanded(!isSupportExpanded)}
                        className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-slate-50 rounded-lg transition-colors group"
                    >
                        <h3 className="text-xs font-semibold text-slate-700">
                            Support Elements ({supportElements.length})
                        </h3>
                        <div className={`transition-transform duration-200 ${isSupportExpanded ? 'rotate-0' : '-rotate-90'}`}>
                            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-500" />
                        </div>
                    </button>
                    {isSupportExpanded && (
                        <div className="space-y-2 mt-1.5">
                            {supportElements.map((element) => (
                                <TopperCard
                                    key={element.id}
                                    item={element}
                                    type="element"
                                    marker={markerMap.get(element.id)}
                                    expanded={expandedItemId === element.id}
                                    onToggle={() => setExpandedItemId(expandedItemId === element.id ? null : element.id)}
                                    updateItem={(updates) => updateSupportElement(element.id, updates)}
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

