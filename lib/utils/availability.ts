// lib/utils/availability.ts

import { CakeInfoUI, MainTopperUI, SupportElementUI, IcingDesignUI, CartItem, CakeType } from '../../types';
import { fetchAvailabilitySettings } from '../../hooks/useAvailabilitySettings';

export type AvailabilityType = 'rush' | 'same-day' | 'normal';

// This is the data structure needed by the function, which can be constructed
// from either a CartItem or the state in the customizing page.
interface DesignData {
    cakeType: CakeType;
    cakeSize: string;
    icingBase: 'soft_icing' | 'fondant';
    drip: boolean;
    gumpasteBaseBoard: boolean;
    mainToppers: { type: string; description: string; }[];
    supportElements: { type: string; description: string; }[];
}

/**
 * Determines the availability of a cake design based on its complexity using a hierarchical approach.
 */
async function getDesignAvailability(design: DesignData): Promise<AvailabilityType> {
    const allItems = [...design.mainToppers, ...design.supportElements];

    // --- STEP 1: NORMAL ORDER CHECKS (1-day lead time) ---
    // Checks for structurally complex cakes or the most time-consuming decorations.
    const isStructurallyComplex = [
        '2 Tier', '3 Tier', '1 Tier Fondant', '2 Tier Fondant', '3 Tier Fondant', 'Square', 'Rectangle'
    ].includes(design.cakeType) || design.icingBase === 'fondant';

    // Truly complex, hand-sculpted or assembled items.
    const hasHighlyComplexDecorations = allItems.some(item =>
        item.type === 'edible_3d' ||      // 3D sculptures
        item.type === 'gumpaste_panel' || // Large panels
        item.type === 'edible_flowers'    // Intricate sugar flowers
    );

    if (isStructurallyComplex || hasHighlyComplexDecorations || design.drip || design.gumpasteBaseBoard) {
        return 'normal';
    }

    // --- STEP 2: SAME-DAY ORDER CHECKS (3-hour lead time) ---
    // Checks for decorations that take some prep time but not a full day.
    const hasSameDayDecorations = allItems.some(item =>
        item.type === 'edible_2d_gumpaste' || // Flat 2D cutouts
        (item.type === 'small_gumpaste' && !item.description.toLowerCase().includes('dots')) || // Small non-dot gumpaste items
        item.type === 'edible_photo' ||
        item.type === 'edible_photo_side' ||
        item.type === 'icing_doodle' // Piped doodles require more time than rush orders.
    );

    if (hasSameDayDecorations) {
        // Check if same-day is disabled via settings
        const settings = await fetchAvailabilitySettings();
        if (settings.rush_to_same_day_enabled) {
            return 'normal'; // Convert same-day to standard
        }
        return 'same-day';
    }

    // --- STEP 3: RUSH ORDER ELIGIBILITY (30-min lead time) ---
    // If we've reached this point, the cake has only the simplest decorations.
    // We now check if the base cake itself is simple enough for a rush order.
    const isRushEligibleBase =
        (design.cakeType === '1 Tier' && (design.cakeSize === '6" Round' || design.cakeSize === '8" Round')) ||
        (design.cakeType === 'Bento');

    if (isRushEligibleBase) {
        // Check if rush is disabled via settings
        const settings = await fetchAvailabilitySettings();
        if (settings.rush_to_same_day_enabled) {
            return 'normal'; // Convert rush to standard
        }
        return 'rush';
    }

    // --- STEP 4: DEFAULT FALLBACK ---
    // If the cake base is not eligible for rush (e.g., a 10" round 1-tier cake)
    // but has no complex decorations, it defaults to a standard order as a safe fallback.
    return 'normal';
}


// --- Main exported functions ---

export async function calculateCartAvailability(items: CartItem[]): Promise<AvailabilityType> {
    if (items.some(item => item.status !== 'complete')) {
        return 'normal';
    }

    const availabilityPromises = items.map(async (item): Promise<AvailabilityType> => {
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
        return await getDesignAvailability(design);
    });

    const availabilities = await Promise.all(availabilityPromises);

    if (availabilities.includes('normal')) return 'normal';
    if (availabilities.includes('same-day')) return 'same-day';
    return 'rush';
}

export async function calculateCustomizingAvailability(
    cakeInfo: CakeInfoUI,
    icingDesign: IcingDesignUI,
    mainToppers: MainTopperUI[],
    supportElements: SupportElementUI[]
): Promise<AvailabilityType> {
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
    return await getDesignAvailability(design);
}