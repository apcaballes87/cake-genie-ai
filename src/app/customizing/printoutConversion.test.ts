import { describe, expect, it } from 'vitest';
import type { MainTopperUI, SupportElementUI } from '@/types';
import { derivePrintoutConversionSummary, hasPrintoutConversion } from './printoutConversion';

const topper = (original_type: MainTopperUI['original_type'], type: MainTopperUI['type'] = 'printout', isEnabled = true) => ({
    id: original_type,
    type,
    original_type,
    description: original_type,
    size: 'medium',
    quantity: 1,
    group_id: original_type,
    classification: 'hero',
    isEnabled,
    price: 0,
}) as MainTopperUI;

const support = (original_type: SupportElementUI['original_type'], type: SupportElementUI['type'] = 'support_printout') => ({
    id: original_type,
    type,
    original_type,
    description: original_type,
    size: 'medium',
    group_id: original_type,
    classification: 'support',
    isEnabled: true,
    price: 0,
}) as SupportElementUI;

describe('derivePrintoutConversionSummary', () => {
    it.each(['toy', 'figurine', 'plastic_ball'] as const)('detects %s as toy conversion', (originalType) => {
        expect(derivePrintoutConversionSummary([topper(originalType)])).toEqual({ toy: true, ediblePhoto: false, cardstock: false });
    });

    it('detects top and side edible-photo conversions', () => {
        expect(derivePrintoutConversionSummary([topper('edible_photo_top')], [support('edible_photo_side')])).toEqual({
            toy: false,
            ediblePhoto: true,
            cardstock: false,
        });
    });

    it('detects cardstock topper conversion', () => {
        expect(derivePrintoutConversionSummary([topper('cardstock')])).toEqual({ toy: false, ediblePhoto: false, cardstock: true });
    });

    it('ignores disabled items and items that are already printouts', () => {
        const summary = derivePrintoutConversionSummary([
            topper('toy', 'printout', false),
            topper('printout'),
        ]);

        expect(summary).toEqual({ toy: false, ediblePhoto: false, cardstock: false });
        expect(hasPrintoutConversion(summary)).toBe(false);
    });
});
