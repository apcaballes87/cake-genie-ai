// lib/utils/availability.ts

import { CakeInfoUI, MainTopperUI, SupportElementUI, IcingDesignUI, CartItem, CakeType } from '../../types';

export type AvailabilityType = 'rush' | 'same-day' | 'normal';

// This is the data structure needed by the function, which can be constructed
// from either a CartItem or the state in the customizing page.
interface DesignData {
    cakeType: CakeType;
    cakeSize: string;
    icingBase: 'soft_icing' | 'fondant';
    drip: boolean;
    gumpasteBaseBoard: boolean;
    mainToppers: { type: string; description?: string; }[];
    supportElements: { type: string; description?: string; }[];
}

/**
 * Determines the availability of a cake design based on its complexity using a hierarchical approach.
 */
function getDesignAvailability(design: DesignData): AvailabilityType {
    const allItems = [...design.mainToppers, ...design.supportElements];

    // --- STEP 1: NORMAL ORDER CHECKS (1-day lead time) ---
    // Checks for structurally complex cakes or the most time-consuming decorations.
    const isStructurallyComplex = [
        '2 Tier', '3 Tier', '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant', 'Square', 'Rectangle'
    ].includes(design.cakeType) || design.icingBase === 'fondant';

    // Truly complex, hand-sculpted or assembled items.
    const hasHighlyComplexDecorations = allItems.some(item =>
        ['edible_3d_complex', 'edible_3d_ordinary'].includes(item.type) || // 3D sculptures (was 'edible_3d')
        item.type === 'edible_2d_support' || // Large panels (was 'gumpaste_panel')
        item.type === 'edible_flowers'    // Intricate sugar flowers
    );

    if (isStructurallyComplex || hasHighlyComplexDecorations || design.drip || design.gumpasteBaseBoard) {
        return 'normal';
    }

    // --- STEP 2: SAME-DAY ORDER CHECKS (3-hour lead time) ---
    // Checks for decorations that take some prep time but not a full day.
    const hasSameDayDecorations = allItems.some(item =>
        item.type === 'edible_2d_support' || // Flat 2D cutouts (was 'edible_2d_gumpaste')
        (item.type === 'edible_3d_support' && item.description && !item.description.toLowerCase().includes('dots')) || // Small non-dot gumpaste items (was 'small_gumpaste')
        item.type === 'edible_photo_top' ||
        item.type === 'edible_photo_side' ||
        item.type === 'icing_doodle' // Piped doodles require more time than rush orders.
    );

    if (hasSameDayDecorations) {
        return 'same-day';
    }

    // --- STEP 3: RUSH ORDER ELIGIBILITY (30-min lead time) ---
    // If we've reached this point, the cake has only the simplest decorations.
    // We now check if the base cake itself is simple enough for a rush order.
    const isRushEligibleBase =
        (design.cakeType === '1 Tier' && (design.cakeSize === '6" Round' || design.cakeSize === '8" Round')) ||
        (design.cakeType === 'Bento');

    if (isRushEligibleBase) {
        return 'rush';
    }

    // --- STEP 4: DEFAULT FALLBACK ---
    // If the cake base is not eligible for rush (e.g., a 10" round 1-tier cake)
    // but has no complex decorations, it defaults to a standard order as a safe fallback.
    return 'normal';
}


// --- Main exported functions ---

export function calculateCartAvailability(items: CartItem[]): AvailabilityType {
    // If any item has an error, default to normal as a safe fallback.
    if (items.some(item => item.status === 'error')) {
        return 'normal';
    }

    // Calculate availability for all items, including 'pending' ones,
    // as they contain all necessary details for the calculation.
    const availabilities = items.map((item): AvailabilityType => {
        // Map CartItem string type back to CakeType enum
        const stringToCakeType: Record<string, CakeType> = {
            '1 Tier (Soft icing)': '1 Tier',
            '2 Tier (Soft icing)': '2 Tier',
            '3 Tier (Soft icing)': '3 Tier',
            '1 Tier Fondant': '1 Tier Fondant',
            '2 Tier Fondant': '2 Tier Fondant',
            '3 Tier Fondant': '3 Tier Fondant',
            'Square': 'Square',
            'Rectangle': 'Rectangle',
            'Bento': 'Bento'
        };
        const cakeType = stringToCakeType[item.type] || item.type as CakeType;

        const design: DesignData = {
            cakeType: cakeType,
            cakeSize: item.size,
            icingBase: item.type.includes('Fondant') ? 'fondant' : 'soft_icing',
            drip: item.details.icingDesign.drip,
            gumpasteBaseBoard: item.details.icingDesign.gumpasteBaseBoard,
            mainToppers: item.details.mainToppers,
            supportElements: item.details.supportElements,
        };
        return getDesignAvailability(design);
    });

    // The most restrictive availability determines the cart's overall availability.
    if (availabilities.includes('normal')) return 'normal';
    if (availabilities.includes('same-day')) return 'same-day';

    // If no 'normal' or 'same-day' items, it must be 'rush' (or empty, which also qualifies as 'rush').
    return 'rush';
}

export function calculateCustomizingAvailability(
    cakeInfo: CakeInfoUI,
    icingDesign: IcingDesignUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[]
): AvailabilityType {
    // Map customizing state to DesignData, ensuring we only consider enabled items.
    const design: DesignData = {
        cakeType: cakeInfo.type,
        cakeSize: cakeInfo.size,
        icingBase: icingDesign.base,
        drip: icingDesign.drip,
        gumpasteBaseBoard: icingDesign.gumpasteBaseBoard,
        mainToppers: mainToppers.filter(t => t.isEnabled),
        supportElements: supportElements.filter(s => s.isEnabled),
    };
    return getDesignAvailability(design);
}