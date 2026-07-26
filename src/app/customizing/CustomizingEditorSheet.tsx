'use client';

import { memo, type ReactNode } from 'react';
import { CustomizationBottomSheet } from '../../components/CustomizationBottomSheet';
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
    hideStickyBar?: boolean;
    hideAiChat?: boolean;
    onClose: () => void;
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
    hideStickyBar,
    hideAiChat,
    onClose,
    children,
}: CustomizingEditorSheetProps) {
    const title = getEditorTitle(activeCustomization, activeTopperSection);
    const bottomOffset = hideStickyBar
        ? 0
        : STICKY_ADD_TO_CART_BASE_OFFSET_PX 
          + (showAvailabilityOffset ? STICKY_ADD_TO_CART_AVAILABILITY_OFFSET_PX : 0)
          + (showPrintoutOffset ? STICKY_ADD_TO_CART_PRINTOUT_OFFSET_PX : 0);

    return (
        <CustomizationBottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            style={{ bottom: `${bottomOffset}px` }}
            wrapperClassName="md:max-w-7xl md:mx-auto md:justify-end md:px-6"
            className="md:w-[calc(50%-6px)] md:max-w-none"
        >
            {children}
        </CustomizationBottomSheet>
    );
});

CustomizingEditorSheet.displayName = 'CustomizingEditorSheet';
