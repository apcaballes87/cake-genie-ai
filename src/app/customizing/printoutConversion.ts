import type { MainTopperUI, SupportElementUI } from '@/types';

export interface PrintoutConversionSummary {
    toy: boolean;
    ediblePhoto: boolean;
    cardstock: boolean;
}

const TOY_LIKE_TYPES = new Set(['toy', 'figurine', 'plastic_ball']);

export function derivePrintoutConversionSummary(
    mainToppers: MainTopperUI[] = [],
    supportElements: SupportElementUI[] = [],
): PrintoutConversionSummary {
    const toy = mainToppers.some((topper) =>
        topper.isEnabled
        && topper.type === 'printout'
        && TOY_LIKE_TYPES.has(topper.printout_source_type ?? topper.original_type)
    );

    const ediblePhoto = mainToppers.some((topper) =>
        topper.isEnabled
        && topper.type === 'printout'
        && (topper.printout_source_type ?? topper.original_type) === 'edible_photo_top'
    ) || supportElements.some((element) =>
        element.isEnabled
        && element.type === 'support_printout'
        && (element.printout_source_type ?? element.original_type) === 'edible_photo_side'
    );

    const cardstock = mainToppers.some((topper) =>
        topper.isEnabled
        && topper.type === 'printout'
        && (topper.printout_source_type ?? topper.original_type) === 'cardstock'
    );

    return { toy, ediblePhoto, cardstock };
}

export function hasPrintoutConversion(summary: PrintoutConversionSummary): boolean {
    return summary.toy || summary.ediblePhoto || summary.cardstock;
}
