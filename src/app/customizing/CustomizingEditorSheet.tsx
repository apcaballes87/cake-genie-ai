'use client';

import { memo, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { CustomizationBottomSheet } from '../../components/CustomizationBottomSheet';
import { MagicSparkleIcon } from '../../components/icons';

interface CustomizingEditorSheetProps {
    isOpen: boolean;
    activeCustomization: string | null;
    activeTopperSection: 'main' | 'support' | null;
    showAvailabilityOffset: boolean;
    showWarningOffset: boolean;
    hasCakeInfoChanges: boolean;
    hasPendingVisualChanges: boolean;
    isUpdatingDesign: boolean;
    hasOriginalImageData: boolean;
    onClose: () => void;
    onApplyOptions: () => void;
    onApplyPendingDesignChanges: () => void;
    children: ReactNode;
}

function getEditorTitle(activeCustomization: string | null, activeTopperSection: 'main' | 'support' | null) {
    if (activeCustomization === 'options') return 'Cake Options';
    if (activeCustomization === 'icing') return 'Icing Colors';
    if (activeCustomization === 'messages') return 'Cake Messages';
    if (activeCustomization === 'toppers') {
        if (activeTopperSection === 'main') return 'Main Toppers';
        if (activeTopperSection === 'support') return 'Support Elements';
        return 'Cake Toppers';
    }
    if (activeCustomization === 'photos') return 'Edible Photos';
    return 'Customize';
}

export const CustomizingEditorSheet = memo(function CustomizingEditorSheet({
    isOpen,
    activeCustomization,
    activeTopperSection,
    showAvailabilityOffset,
    showWarningOffset,
    hasCakeInfoChanges,
    hasPendingVisualChanges,
    isUpdatingDesign,
    hasOriginalImageData,
    onClose,
    onApplyOptions,
    onApplyPendingDesignChanges,
    children,
}: CustomizingEditorSheetProps) {
    const title = getEditorTitle(activeCustomization, activeTopperSection);
    const bottomOffset = 67 + (showAvailabilityOffset ? 38 : 0) + (showWarningOffset ? 38 : 0);

    const actionButton = activeCustomization === 'options'
        ? (hasCakeInfoChanges ? (
            <button
                onClick={onApplyOptions}
                className="w-full bg-purple-600 text-purple-50 font-bold py-3 rounded-xl hover:shadow-lg hover:bg-purple-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
                <MagicSparkleIcon className="w-5 h-5" />
                Apply Changes
            </button>
        ) : null)
        : (activeCustomization === 'icing' || activeCustomization === 'messages' || activeCustomization === 'toppers' || activeCustomization === 'photos')
            ? ((hasPendingVisualChanges || isUpdatingDesign) ? (
                <button
                    onClick={onApplyPendingDesignChanges}
                    disabled={isUpdatingDesign || !hasOriginalImageData}
                    className="w-full bg-purple-600 text-purple-50 font-bold py-3 rounded-xl hover:shadow-lg hover:bg-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isUpdatingDesign ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Updating Design...
                        </>
                    ) : (
                        <>
                            <MagicSparkleIcon className="w-5 h-5" />
                            Apply All Changes
                        </>
                    )}
                </button>
            ) : null)
            : null;

    return (
        <CustomizationBottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            style={{ bottom: `${bottomOffset}px` }}
            wrapperClassName="md:max-w-7xl md:mx-auto md:justify-end md:px-6"
            className="md:w-[calc(50%-6px)] md:max-w-none"
            actionButton={actionButton}
        >
            {children}
        </CustomizationBottomSheet>
    );
});

CustomizingEditorSheet.displayName = 'CustomizingEditorSheet';