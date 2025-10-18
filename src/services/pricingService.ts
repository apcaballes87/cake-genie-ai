// services/pricingService.ts
import { HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, AddOnPricing, MainTopperType, SupportElementType, Size, Coverage } from '../types';

// --- Pricing Rules from Master Prompt ---

const getEdible3DPrice = (description: string, size: Size): number => {
    const lower = description.toLowerCase();
    
    if (lower.includes('human') || lower.includes('figure') || lower.includes('character')) {
        return { large: 800, medium: 600, small: 300, partial: 100 }[size];
    }
    if (lower.includes('animal') || lower.includes('vehicle') || lower.includes('building')) {
        return { large: 500, medium: 400, small: 200, partial: 75 }[size];
    }
    if (lower.includes('rainbow')) return 400; // Size independent
    if (lower.includes('bow')) {
        return { large: 300, medium: 200, small: 100, partial: 50 }[size];
    }
    // Low complexity (default for 3D): e.g., detailed flowers, abstract shapes
    return { large: 400, medium: 300, small: 150, partial: 50 }[size];
};

const getTieredGroupPrice = (basePrice: number, quantity: number): number => {
    if (quantity <= 0) return 0;
    const itemsPerTier = 4;
    const tiers = Math.ceil(quantity / itemsPerTier);
    return basePrice * tiers;
};

const getPanelPrice = (coverage: Coverage): number => {
    return { heavy: 300, medium: 200, light: 100, none: 0 }[coverage];
};

const getChocolatePrice = (coverage: Coverage): number => {
    return { heavy: 300, medium: 200, light: 100, none: 0 }[coverage];
};


// --- Main Calculation Logic ---

const GUMPASTE_TOPPER_TYPES: MainTopperType[] = ['edible_3d', 'figurine', 'edible_2d_gumpaste'];
const GUMPASTE_SUPPORT_TYPES: SupportElementType[] = ['gumpaste_panel', 'small_gumpaste'];

export const calculatePrice = (
    analysis: HybridAnalysisResult,
    uiState: {
        mainToppers: MainTopperUI[],
        supportElements: SupportElementUI[],
        cakeMessages: CakeMessageUI[],
        icingDesign: IcingDesignUI,
    }
): AddOnPricing => {

    const GUMPASTE_ALLOWANCE = 200;
    
    let heroGumpasteTotal = 0;
    let supportGumpasteRawTotal = 0;
    let nonGumpasteTotal = 0;
    const breakdown: { item: string; price: number; }[] = [];

    // 1. Process Main Toppers
    const enabledToppers = uiState.mainToppers.filter(t => t.isEnabled);
    const topperGroups = enabledToppers.reduce((acc, topper) => {
        (acc[topper.group_id] = acc[topper.group_id] || []).push(topper);
        return acc;
    }, {} as Record<string, MainTopperUI[]>);

    Object.values(topperGroups).forEach(group => {
        if (group.length === 0) return;
        const first = group[0];
        const totalQuantity = group.reduce((sum, item) => sum + item.quantity, 0);
        let price = 0;
        
        const isNumberInDescription = /\b\d+\b|number/i.test(first.description);
        // FIX: The check for number toppers should only apply to gumpaste items, not all toppers.
        const isGumpasteNumberTopper = (GUMPASTE_TOPPER_TYPES.includes(first.type)) && isNumberInDescription;

        if (!isGumpasteNumberTopper) { // Only skip pricing if it's a gumpaste number topper.
            switch (first.type) {
                case 'edible_3d':
                case 'figurine':
                    price = group.reduce((sum, item) => sum + (getEdible3DPrice(item.description, item.size) * item.quantity), 0);
                    break;
                case 'edible_2d_gumpaste':
                     const basePrice2D = { large: 250, medium: 150, small: 100, partial: 50 }[first.size];
                     price = getTieredGroupPrice(basePrice2D, totalQuantity);
                     break;
                case 'toy':
                    price = 100 * totalQuantity;
                    break;
                case 'cardstock':
                case 'edible_photo':
                    price = first.type === 'cardstock' ? 100 : 200; // One price for the whole group
                    break;
                case 'printout':
                    price = 0;
                    break;
            }
        }
        
        const isGumpasteGroup = GUMPASTE_TOPPER_TYPES.includes(first.type);
        if (isGumpasteGroup) {
            if (first.classification === 'hero') {
                heroGumpasteTotal += price;
            } else { // 'support'
                supportGumpasteRawTotal += price;
            }
        } else {
            nonGumpasteTotal += price;
        }

        if (price > 0) {
            let breakdownLabel = `${first.description}`;
            if (totalQuantity > 1 && group.length === 1) {
                 breakdownLabel = `${first.description} (x${totalQuantity})`;
            } else if (totalQuantity > 1) {
                 breakdownLabel = `Set of ${totalQuantity} ${first.description}`;
            }
            breakdown.push({ item: breakdownLabel, price });
        }

        const pricePerItem = totalQuantity > 0 ? price / totalQuantity : 0;
        group.forEach(item => { item.price = pricePerItem * item.quantity; });
    });

    // 2. Process Support Elements
    const supportGroups = uiState.supportElements.filter(s => s.isEnabled).reduce((acc, el) => {
        (acc[el.group_id] = acc[el.group_id] || []).push(el);
        return acc;
    }, {} as Record<string, SupportElementUI[]>);

    Object.values(supportGroups).forEach(group => {
        if (group.length === 0) return;
        const first = group[0];
        let price = 0;
        switch (first.type) {
            case 'gumpaste_panel':
            case 'small_gumpaste':
                price = getPanelPrice(first.coverage);
                break;
            case 'chocolates':
                price = getChocolatePrice(first.coverage);
                break;
            case 'sprinkles':
                price = first.coverage === 'heavy' ? 100 : 0;
                break;
            case 'isomalt':
                 price = { heavy: 300, medium: 200, light: 100, none: 0 }[first.coverage];
                 break;
            case 'edible_photo_side':
                 price = 200;
                 break;
            case 'support_printout':
                price = 0;
                break;
        }
        
        if(price > 0) {
            const isGumpasteGroup = GUMPASTE_SUPPORT_TYPES.includes(first.type);
            if (isGumpasteGroup) {
                supportGumpasteRawTotal += price;
            } else {
                nonGumpasteTotal += price;
            }
            breakdown.push({ item: first.description, price });
        }
        
        group.forEach(item => { item.price = price / group.length; });
    });

    // 3. Icing work & other
    if (uiState.icingDesign.drip) {
        nonGumpasteTotal += uiState.icingDesign.dripPrice;
        breakdown.push({ item: "Drip Icing", price: uiState.icingDesign.dripPrice });
    }
    if (uiState.icingDesign.gumpasteBaseBoard) {
        const baseBoardPrice = 100;
        // Gumpaste board is subject to allowance
        supportGumpasteRawTotal += baseBoardPrice;
        breakdown.push({ item: "Gumpaste Covered Base Board", price: baseBoardPrice });
    }
    uiState.cakeMessages.forEach(msg => { if (msg.isEnabled) { msg.price = 0; }});


    // 4. Apply allowance and finalize
    const supportGumpasteCharge = Math.max(0, supportGumpasteRawTotal - GUMPASTE_ALLOWANCE);
    const allowanceApplied = supportGumpasteRawTotal - supportGumpasteCharge;

    if (allowanceApplied > 0) {
        breakdown.push({ item: "Gumpaste Allowance", price: -allowanceApplied });
    }
    
    const addOnPrice = heroGumpasteTotal + supportGumpasteCharge + nonGumpasteTotal;

    return {
        addOnPrice,
        breakdown,
    };
};