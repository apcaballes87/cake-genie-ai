'use client';

import { memo, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { CustomizationBottomSheet } from '../../components/CustomizationBottomSheet';
import { MagicSparkleIcon } from '../../components/icons';
import {
    STICKY_ADD_TO_CART_AVAILABILITY_OFFSET_PX,
    STICKY_ADD_TO_CART_BASE_OFFSET_PX,
    STICKY_ADD_TO_CART_PRINTOUT_OFFSET_PX,
} from './stickyBarLayout';

interface CustomizingEditorSheetProps {
    isOpen: boolean;
    activeCustomization: string | null;
    activeTopperSection: 'main' | 'support' | null;
    showAvailabilityOffset: boolean;
    showPrintoutOffset: boolean;
    hasCakeInfoChanges: boolean;
    hasPendingVisualChanges: boolean;
    isUpdatingDesign: boolean;
    hasOriginalImageData: boolean;
    isEmpty?: boolean;
    hideStickyBar?: boolean;
    hideAiChat?: boolean;
    onClose: () => void;
    onApplyOptions: () => void;
    onApplyPendingDesignChanges: () => void;
    children: ReactNode;
}

function getEditorTitle(activeCustomization: string | null, activeTopperSection: 'main' | 'support' | null) {
    if (activeCustomization === 'options') return 'Cake Options';
    if (activeCustomization === 'flavor') return 'Cake Flavor';
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
    showPrintoutOffset,
    hasCakeInfoChanges,
    hasPendingVisualChanges,
    isUpdatingDesign,
    hasOriginalImageData,
    isEmpty,
    hideStickyBar,
    hideAiChat,
    onClose,
    onApplyOptions,
    onApplyPendingDesignChanges,
    children,
}: CustomizingEditorSheetProps) {
    const title = getEditorTitle(activeCustomization, activeTopperSection);
    const bottomOffset = hideStickyBar
        ? 0
        : STICKY_ADD_TO_CART_BASE_OFFSET_PX 
          + (showAvailabilityOffset ? STICKY_ADD_TO_CART_AVAILABILITY_OFFSET_PX : 0)
          + (showPrintoutOffset ? STICKY_ADD_TO_CART_PRINTOUT_OFFSET_PX : 0);

    const isOptionsSheet = activeCustomization === 'options';
    const isVisualSheet = activeCustomization === 'icing' || activeCustomization === 'toppers' || activeCustomization === 'photos';
    const disableOptionsAction = !hasCakeInfoChanges;
    const disableVisualAction = isUpdatingDesign || !hasOriginalImageData || !hasPendingVisualChanges || Boolean(isEmpty);

    const actionButton = isOptionsSheet
        ? (
            <button
                onClick={onApplyOptions}
                disabled={disableOptionsAction}
                className="w-full genie-btn-primary font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <MagicSparkleIcon className="w-5 h-5" />
                Apply Changes
            </button>
        )
        : isVisualSheet
            ? (
                <button
                    onClick={onApplyPendingDesignChanges}
                    disabled={disableVisualAction}
                    className="w-full genie-btn-primary font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
            )
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
