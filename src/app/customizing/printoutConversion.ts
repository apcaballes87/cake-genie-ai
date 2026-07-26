import type { MainTopperUI, SupportElementUI } from '@/types';

export interface PrintoutConversionSummary {
    toy: boolean;
    ediblePhoto: boolean;
    cardstock: boolean;
}

export type PrintoutConversionTarget =
    | { item: MainTopperUI; itemCategory: 'topper' }
    | { item: SupportElementUI; itemCategory: 'element' };

const TOY_LIKE_TYPES = new Set(['toy', 'figurine', 'plastic_ball']);

const isConvertedToyTopper = (topper: MainTopperUI) =>
    topper.isEnabled
    && topper.type === 'printout'
    && TOY_LIKE_TYPES.has(topper.printout_source_type ?? topper.original_type);

const isConvertedEdiblePhotoTopper = (topper: MainTopperUI) =>
    topper.isEnabled
    && topper.type === 'printout'
    && (topper.printout_source_type ?? topper.original_type) === 'edible_photo_top';

const isConvertedEdiblePhotoElement = (element: SupportElementUI) =>
    element.isEnabled
    && element.type === 'support_printout'
    && (element.printout_source_type ?? element.original_type) === 'edible_photo_side';

const isConvertedCardstockTopper = (topper: MainTopperUI) =>
    topper.isEnabled
    && topper.type === 'printout'
    && (topper.printout_source_type ?? topper.original_type) === 'cardstock';

export function derivePrintoutConversionSummary(
    mainToppers: MainTopperUI[] = [],
    supportElements: SupportElementUI[] = [],
): PrintoutConversionSummary {
    const toy = mainToppers.some(isConvertedToyTopper);

    const ediblePhoto = mainToppers.some(isConvertedEdiblePhotoTopper)
        || supportElements.some(isConvertedEdiblePhotoElement);

    const cardstock = mainToppers.some(isConvertedCardstockTopper);

    return { toy, ediblePhoto, cardstock };
}

export function hasPrintoutConversion(summary: PrintoutConversionSummary): boolean {
    return summary.toy || summary.ediblePhoto || summary.cardstock;
}

export function getPrintoutConversionTarget(
    mainToppers: MainTopperUI[] = [],
    supportElements: SupportElementUI[] = [],
): PrintoutConversionTarget | null {
    const toy = mainToppers.find(isConvertedToyTopper);
    if (toy) return { item: toy, itemCategory: 'topper' };

    const ediblePhotoTopper = mainToppers.find(isConvertedEdiblePhotoTopper);
    if (ediblePhotoTopper) return { item: ediblePhotoTopper, itemCategory: 'topper' };

    const ediblePhotoElement = supportElements.find(isConvertedEdiblePhotoElement);
    if (ediblePhotoElement) return { item: ediblePhotoElement, itemCategory: 'element' };

    const cardstock = mainToppers.find(isConvertedCardstockTopper);
    return cardstock ? { item: cardstock, itemCategory: 'topper' } : null;
}
