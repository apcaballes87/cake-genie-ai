'use client';
// components/FloatingResultPanel.tsx
import React from 'react';
import { ClusteredMarker, AnalysisItem } from '@/types';

interface FloatingResultPanelProps {
    selectedItem: ClusteredMarker | null;
    onClose: () => void;
}

export const FloatingResultPanel: React.FC<FloatingResultPanelProps> = ({
    selectedItem,
    onClose,
}) => {
    // This component now primarily handles Icing items if they are selected via markers.
    // Toppers and Elements are handled in their own modals.

    if (!selectedItem) return null;

    // If selected item is a topper or element, we shouldn't be here (logic should be in page.tsx to open modal)
    // But if we are, we just show a message or nothing.
    const isTopperOrElement = (item: AnalysisItem) => item.itemCategory === 'topper' || item.itemCategory === 'element';

    if ('isCluster' in selectedItem && selectedItem.isCluster) {
        // Filter out toppers/elements from cluster view here if needed, or just show basic info
        const relevantItems = selectedItem.items.filter((i: any) => !isTopperOrElement(i));
        if (relevantItems.length === 0) return null;
    } else if (isTopperOrElement(selectedItem as AnalysisItem)) {
        return null;
    }

    return (
        <div className="absolute top-full left-0 mt-2 w-full z-30">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4 relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
                >
                    <span className="sr-only">Close</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-sm text-slate-500">
                    {/* Placeholder for any remaining marker functionality */}
                    Selected item details...
                </div>
            </div>
        </div>
    );
};