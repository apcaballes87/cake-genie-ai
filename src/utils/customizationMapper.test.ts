import { describe, expect, it } from 'vitest';

import { mapAnalysisToState } from './customizationMapper';
import type { HybridAnalysisResult } from '@/types';

describe('mapAnalysisToState', () => {
    it('records stable source material when toys are automatically converted to printouts', () => {
        const state = mapAnalysisToState({
            cakeType: '1 Tier',
            cakeThickness: '4 in',
            main_toppers: [{
                type: 'toy',
                material: 'plastic',
                size: 'medium',
                quantity: 1,
                group_id: 'character',
                classification: 'hero',
                description: 'character figure',
            }],
            support_elements: [],
            cake_messages: [],
        } satisfies HybridAnalysisResult);

        expect(state.mainToppers?.[0]).toMatchObject({
            type: 'printout',
            original_type: 'toy',
            printout_source_type: 'toy',
        });
    });

    it('preserves edible side photo wraps as edible by default', () => {
        const state = mapAnalysisToState({
            cakeType: '2 Tier',
            cakeThickness: '4 in',
            main_toppers: [],
            support_elements: [
                {
                    x: 0,
                    y: 0,
                    type: 'edible_photo_side',
                    material: 'waferpaper',
                    size: 'large',
                    quantity: 1,
                    description: 'manga panel side wrap',
                },
            ],
            cake_messages: [],
            icing_design: {
                base: 'soft_icing',
                color_type: 'single',
                colors: {
                    top: '#FFFFFF',
                    side: '#FFFFFF',
                },
                border_top: false,
                border_base: false,
                drip: false,
                gumpasteBaseBoard: false,
            },
        } satisfies HybridAnalysisResult);

        expect(state.supportElements?.[0]).toMatchObject({
            original_type: 'edible_photo_side',
            type: 'edible_photo_side',
        });
    });
});
