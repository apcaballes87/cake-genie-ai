// services/pricingService.ts
import { MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, AddOnPricing, Size, CakeInfoUI, CakeType } from '@/types';

// ============================================================================
// DYNAMIC PRICING ENGINE (V5 - Gumpaste Overhaul)
// ============================================================================

// --- Helper Functions ---

function getEdible3DComplexPrice(size: Size): number {
    if (size === 'large') return 600;
    if (size === 'medium') return 400;
    if (size === 'small') return 200;
    if (size === 'tiny') return 100;
    return 0;
}

function getEdible3DOrdinaryPrice(size: Size): number {
    if (size === 'large') return 200;
    if (size === 'medium') return 100;
    if (size === 'small') return 50;
    if (size === 'tiny') return 20;
    return 0;
}

function getSupportGumpastePrice(size: Size): number { // This is now for edible_3d_support
    if (size === 'large') return 300;
    if (size === 'medium') return 200;
    if (size === 'small') return 100;
    if (size === 'tiny') return 50;
    return 0;
}

// NEW function for edible_2d_support
function getEdible2DSupportPrice(size: Size): number {
    if (size === 'large') return 150;
    if (size === 'medium') return 100;
    if (size === 'small') return 50;
    if (size === 'tiny') return 20;
    return 0;
}


function extractTierCount(cakeType: CakeType): number {
    if (cakeType.includes('3 Tier')) return 3;
    if (cakeType.includes('2 Tier')) return 2;
    return 1;
}

// --- Main Calculation Logic ---

export const calculatePrice = (
    uiState: {
        mainToppers: MainTopperUI[],
        supportElements: SupportElementUI[],
        cakeMessages: CakeMessageUI[],
        icingDesign: IcingDesignUI,
        cakeInfo: CakeInfoUI,
    }
): { addOnPricing: AddOnPricing; itemPrices: Map<string, number> } => {

    const { mainToppers, supportElements, cakeMessages, icingDesign, cakeInfo } = uiState;
    const breakdown: { item: string; price: number; }[] = [];

    const itemPrices = new Map<string, number>();
    let heroGumpasteTotal = 0;
    let supportGumpasteRawTotal = 0;
    let nonGumpasteTotal = 0;

    const GUMPASTE_ALLOWANCE = 100;

    // --- Process All Main Toppers in a Single Loop ---
    mainToppers.forEach(topper => {
        if (!topper.isEnabled) {
            itemPrices.set(topper.id, 0);
            return;
        }

        let price = 0;

        switch (topper.type) {
            case 'edible_3d_complex':
                price = getEdible3DComplexPrice(topper.size) * topper.quantity;
                heroGumpasteTotal += price;
                break;
            case 'edible_3d_ordinary':
                price = getEdible3DOrdinaryPrice(topper.size) * topper.quantity;
                heroGumpasteTotal += price;
                break;

            case 'meringue_pop':
                price = 20 * topper.quantity;
                nonGumpasteTotal += price;
                break;
            case 'icing_doodle':
                if (topper.description?.toLowerCase().includes('intricate') || topper.description?.toLowerCase().includes('complex')) {
                    price = cakeInfo.type === 'Bento' ? 50 : 100;
                    nonGumpasteTotal += price;
                }
                break;
            case 'icing_palette_knife':
                const isIntricateMain = topper.description?.toLowerCase().includes('intricate');
                if (topper.size === 'large' && isIntricateMain) {
                    const tierCount = extractTierCount(cakeInfo.type);
                    price = 100 * tierCount;
                } else {
                    price = 0; // All other cases are free
                }
                nonGumpasteTotal += price;
                break;
            case 'plastic_ball':
                if (topper.size === 'tiny') {
                    price = 0;
                } else {
                    const lowerDescPB = topper.description?.toLowerCase() || '';
                    if (lowerDescPB.includes('disco ball')) {
                        // Price disco balls at 50 pesos each
                        price = 50 * topper.quantity;
                    } else { // Regular plastic balls
                        // Price normal balls at 100 pesos per 3 pieces
                        price = Math.ceil(topper.quantity / 3) * 100;
                    }
                }
                nonGumpasteTotal += price;
                break;
            case 'toy':
                // High-Detail Toys pricing based on size
                if (topper.size === 'large') price = 200;
                else if (topper.size === 'medium') price = 150;
                else price = 100; // 'small' or 'partial'
                price *= topper.quantity;
                nonGumpasteTotal += price;
                break;
            case 'figurine':
                // Simpler Figurines pricing based on size
                if (topper.size === 'large') price = 90;
                else if (topper.size === 'medium') price = 70;
                else price = 50; // 'small' or 'partial'
                price *= topper.quantity;
                nonGumpasteTotal += price;
                break;
            case 'printout':
                price = 0;
                break;
            case 'edible_photo_top':
                price = 50; // Flat price for top edible photo
                nonGumpasteTotal += price;
                break;
            case 'cardstock':
                // Cardstock pricing based on size
                if (topper.size === 'large') price = 100;
                else if (topper.size === 'medium') price = 60;
                else price = 25; // 'small' or 'partial'
                price *= topper.quantity;
                nonGumpasteTotal += price;
                break;
            case 'candle':
                const digits = topper.description?.match(/\d/g) || [];
                const digitCount = Math.max(1, digits.length);
                price = digitCount * 25; // 25 per digit
                nonGumpasteTotal += price;
                break;
            default:
                price = 0;
        }

        itemPrices.set(topper.id, price);
        if (price > 0) {
            breakdown.push({ item: topper.description, price });
        }
    });

    // --- Process Support Elements ---
    supportElements.forEach(element => {
        if (!element.isEnabled) {
            itemPrices.set(element.id, 0);
            return;
        }

        let price = 0;
        switch (element.type) {
            case 'edible_3d_support':
                price = getSupportGumpastePrice(element.size);
                supportGumpasteRawTotal += price;
                break;
            case 'edible_2d_support':
                price = getEdible2DSupportPrice(element.size); // Use new function
                supportGumpasteRawTotal += price;
                break;

            // --- Legacy gumpaste types are removed, logic for other types remains ---

            case 'icing_doodle':
                if (element.description?.toLowerCase().includes('intricate') || element.description?.toLowerCase().includes('complex')) {
                    price = cakeInfo.type === 'Bento' ? 50 : 100;
                    // Note: As per old logic, this was not part of allowance. Keeping it that way unless specified.
                    // To make it eligible, change to: supportGumpasteRawTotal += price;
                    nonGumpasteTotal += price;
                }
                break;

            case 'icing_palette_knife':
                const isIntricateSupport = element.description?.toLowerCase().includes('intricate');
                if (element.size === 'large' && isIntricateSupport) { // Changed from 'heavy'
                    const tierCount = extractTierCount(cakeInfo.type);
                    price = 100 * tierCount;
                } else {
                    price = 0; // All other cases are free
                }
                nonGumpasteTotal += price;
                break;

            case 'chocolates':
                if (element.size === 'large') price = 200; // Changed from 'heavy'
                else if (element.size === 'medium') price = 100;
                else if (element.size === 'small') price = 50; // Changed from 'light'
                nonGumpasteTotal += price;
                break;

            case 'sprinkles':
            case 'dragees':
                if (element.size === 'large') price = 100; // Changed from 'heavy'
                supportGumpasteRawTotal += price; // MOVED TO ALLOWANCE BUCKET
                break;

            case 'isomalt':
                const isComplex = element.description?.toLowerCase().includes('complex') || element.description?.toLowerCase().includes('elaborate');
                price = isComplex ? 500 : 200;
                nonGumpasteTotal += price;
                break;

            case 'edible_photo_side':
                if (element.size === 'large') price = 300;
                else if (element.size === 'medium') price = 200;
                else if (element.size === 'small') price = 100;
                else if (element.size === 'tiny') price = 50;
                nonGumpasteTotal += price;
                break;

            case 'edible_flowers': // Kept for non-gumpaste flowers if any
                if (element.size === 'large') price = 300;
                else if (element.size === 'medium') price = 200;
                else if (element.size === 'small') price = 100;
                nonGumpasteTotal += price; // Assuming these might not be gumpaste, e.g., real flowers
                break;

            default:
                price = 0;
        }

        itemPrices.set(element.id, price);
        if (price > 0) {
            breakdown.push({ item: element.description, price });
        }
    });

    // --- Process Cake Messages and Icing ---
    cakeMessages.forEach(message => {
        let price = 0;
        if (message.isEnabled && message.type === 'cardstock') {
            price = 100;
            nonGumpasteTotal += price;
            breakdown.push({ item: `"${message.text}" (Cardstock)`, price });
        }
        itemPrices.set(message.id, price);
    });

    if (icingDesign.drip) {
        const tierCount = extractTierCount(cakeInfo.type);
        const dripPrice = 100 * tierCount;
        nonGumpasteTotal += dripPrice;
        breakdown.push({ item: `Drip Effect (${tierCount > 1 ? `${tierCount} tiers` : '1 tier'})`, price: dripPrice });
        itemPrices.set('icing_drip', dripPrice);
    } else {
        itemPrices.set('icing_drip', 0);
    }

    if (icingDesign.gumpasteBaseBoard) {
        const baseBoardPrice = 100;
        nonGumpasteTotal += baseBoardPrice; // No longer eligible for allowance
        breakdown.push({ item: "Gumpaste Covered Base Board", price: baseBoardPrice });
        itemPrices.set('icing_gumpasteBaseBoard', baseBoardPrice);
    } else {
        itemPrices.set('icing_gumpasteBaseBoard', 0);
    }

    // --- Final Calculation ---
    const allowanceApplied = Math.min(GUMPASTE_ALLOWANCE, supportGumpasteRawTotal);
    const supportGumpasteCharge = Math.max(0, supportGumpasteRawTotal - GUMPASTE_ALLOWANCE);

    if (allowanceApplied > 0) {
        breakdown.push({ item: "Gumpaste Allowance", price: -allowanceApplied });
    }

    const addOnPrice = heroGumpasteTotal + supportGumpasteCharge + nonGumpasteTotal;

    return {
        addOnPricing: {
            addOnPrice,
            breakdown,
        },
        itemPrices,
    };
};