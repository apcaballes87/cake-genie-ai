'use client';

import { memo } from 'react';
import { CustomizationBottomSheet } from '../../components/CustomizationBottomSheet';

export type DetectedDecorationChoice = {
    id: string;
    itemCategory: 'topper' | 'element';
    label: string;
};

interface DetectedDecorationChoiceSheetProps {
    choices: readonly DetectedDecorationChoice[];
    bottomOffset: number;
    onChoose: (choice: DetectedDecorationChoice) => void;
    onClose: () => void;
}

const categoryLabel = (itemCategory: DetectedDecorationChoice['itemCategory']) => (
    itemCategory === 'topper' ? 'Main topper' : 'Support element'
);

export const DetectedDecorationChoiceSheet = memo(function DetectedDecorationChoiceSheet({
    choices,
    bottomOffset,
    onChoose,
    onClose,
}: DetectedDecorationChoiceSheetProps) {
    return (
        <CustomizationBottomSheet
            isOpen={choices.length > 0}
            onClose={onClose}
            title="Choose a decoration"
            style={{ bottom: `${bottomOffset}px` }}
        >
            <p className="mb-3 text-sm text-slate-600">
                More than one decoration is here. Choose the one you want to edit.
            </p>
            <div className="space-y-2">
                {choices.map((choice) => (
                    <button
                        key={`${choice.itemCategory}:${choice.id}`}
                        type="button"
                        aria-label={`Choose ${choice.label}, ${categoryLabel(choice.itemCategory)}`}
                        onClick={() => onChoose(choice)}
                        className="w-full min-h-11 rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-left transition-colors hover:border-purple-300 hover:bg-purple-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
                    >
                        <span className="block text-sm font-semibold text-slate-800">{choice.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{categoryLabel(choice.itemCategory)}</span>
                    </button>
                ))}
            </div>
        </CustomizationBottomSheet>
    );
});

DetectedDecorationChoiceSheet.displayName = 'DetectedDecorationChoiceSheet';
