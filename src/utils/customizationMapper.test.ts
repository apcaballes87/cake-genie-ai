import { describe, expect, it } from 'vitest';

import { mapAnalysisToState } from './customizationMapper';
import type { HybridAnalysisResult } from '@/types';

describe('mapAnalysisToState', () => {
    it('normalizes historical Fondant thicknesses at hydration without mutating cache data', () => {
        const cachedAnalysis = {
            cakeType: '1 Tier Fondant',
            cakeThickness: '4 in',
            main_toppers: [],
            support_elements: [],
            cake_messages: [],
            icing_design: {
                base: 'fondant',
                color_type: 'single',
                colors: { side: '#FFFFFF', top: '#FFFFFF' },
                drip: false,
                border_top: false,
                border_base: false,
                gumpasteBaseBoard: false,
            },
        } satisfies HybridAnalysisResult;

        const state = mapAnalysisToState(cachedAnalysis);

        expect(state.cakeInfo?.thickness).toBe('5 in');
        expect(state.analysisResult?.cakeThickness).toBe('5 in');
        expect(cachedAnalysis.cakeThickness).toBe('4 in');
    });

    it('normalizes legacy cached sizes without changing the cache object', () => {
        const cachedAnalysis = {
            cakeType: '1 Tier',
            cakeThickness: '4 in',
            main_toppers: [{
                type: 'edible_3d_ordinary',
                material: 'edible_fondant',
                size: 'small',
                quantity: 1,
                group_id: 'old_small_figure',
                classification: 'hero',
                description: 'legacy small fondant figure',
            }],
            support_elements: [{
                type: 'edible_2d_support',
                material: 'edible_fondant',
                size: 'xsmall',
                group_id: 'old_xsmall_star',
                description: 'legacy extra small star',
            }],
            cake_messages: [],
            icing_design: {
                base: 'soft_icing',
                color_type: 'single',
                colors: { side: '#FFFFFF', top: '#FFFFFF' },
                drip: false,
                border_top: false,
                border_base: false,
                gumpasteBaseBoard: false,
            },
        } satisfies HybridAnalysisResult;

        const state = mapAnalysisToState(cachedAnalysis);

        expect(state.mainToppers?.[0].size).toBe('medium');
        expect(state.supportElements?.[0].size).toBe('small');
        expect(state.analysisResult?.analysis_size_schema).toBe('three_band_v1');
        expect(cachedAnalysis.main_toppers[0].size).toBe('small');
        expect(cachedAnalysis.support_elements[0].size).toBe('xsmall');
        expect(cachedAnalysis.analysis_size_schema).toBeUndefined();
    });

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

    it('preserves conditioned wafer-paper waves without photo-wrap conversion', () => {
        const state = mapAnalysisToState({
            cakeType: '2 Tier',
            cakeThickness: '4 in',
            main_toppers: [],
            support_elements: [{
                type: 'edible_photo_side_wave',
                material: 'waferpaper',
                color: '#FFFFFF',
                size: 'large',
                quantity: 3,
                group_id: 'conditioned_waferpaper_vertical_wave_side_wrap',
                description: 'conditioned white wafer paper vertical waves around the cake sides',
            }],
            cake_messages: [],
            icing_design: {
                base: 'soft_icing',
                color_type: 'single',
                colors: { top: '#FFFFFF', side: '#FFFFFF' },
                border_top: false,
                border_base: false,
                drip: false,
                gumpasteBaseBoard: false,
            },
        } satisfies HybridAnalysisResult);

        expect(state.supportElements?.[0]).toMatchObject({
            original_type: 'edible_photo_side_wave',
            type: 'edible_photo_side_wave',
            quantity: 3,
        });
    });
});
