import React from 'react';
import { X } from 'lucide-react';

interface SegmentationItem {
    mask: any;
    label?: string;
    confidence: number;
    group_id?: string;
}

interface SegmentationBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    items: SegmentationItem[];
    selectedId: string | null;
    onSelectItem: (groupId: string | null) => void;
}

export const SegmentationBottomSheet: React.FC<SegmentationBottomSheetProps> = ({
    isOpen,
    onClose,
    items,
    selectedId,
    onSelectItem
}) => {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl z-50 max-h-[60vh] flex flex-col animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            Detected Components
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {items.length} {items.length === 1 ? 'component' : 'components'} found
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Content - Scrollable List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Clear Selection Option */}
                    <button
                        onClick={() => onSelectItem(null)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedId === null
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-900">Show All</p>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Display all detected components
                                </p>
                            </div>
                            {selectedId === null && (
                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                            )}
                        </div>
                    </button>

                    {/* Individual Items */}
                    {items.map((item, index) => {
                        const groupId = item.group_id || `object_${index}`;
                        const isSelected = selectedId === groupId;
                        const label = item.label || `Component ${index + 1}`;

                        return (
                            <button
                                key={groupId}
                                onClick={() => onSelectItem(groupId)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-900 capitalize">
                                                {label.replace(/_/g, ' ')}
                                            </p>
                                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                                {Math.round(item.confidence * 100)}%
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            Component #{index + 1}
                                        </p>
                                    </div>
                                    {isSelected && (
                                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer Hint */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-center text-gray-600">
                        💡 Tap a component to highlight it on the image
                    </p>
                </div>
            </div>
        </>
    );
};
