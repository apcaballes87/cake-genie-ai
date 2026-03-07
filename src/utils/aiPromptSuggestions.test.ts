import { describe, expect, it } from 'vitest';
import { BasePriceInfo, CakeInfoUI, HybridAnalysisResult } from '@/types';
import { buildAiChatPromptSuggestions, shouldShowAiPromptSuggestion } from './aiPromptSuggestions';

const createAnalysis = (overrides: Partial<HybridAnalysisResult> = {}): HybridAnalysisResult => ({
    cakeType: '1 Tier',
    cakeThickness: '4 in',
    main_toppers: [],
    support_elements: [],
    cake_messages: [],
    icing_design: {
        base: 'soft_icing',
        color_type: 'single',
        colors: {
            top: '#FFC0CB',
            side: '#FFC0CB',
            drip: '#FFFFFF',
            borderTop: '#FFC0CB',
            borderBase: '#FFC0CB',
            gumpasteBaseBoardColor: '#FFFFFF',
        },
        border_top: false,
        border_base: false,
        drip: false,
        gumpasteBaseBoard: false,
    },
    ...overrides,
});

const createCakeInfo = (overrides: Partial<CakeInfoUI> = {}): CakeInfoUI => ({
    type: '1 Tier',
    thickness: '4 in',
    size: '6" Round',
    flavors: ['Chocolate Cake'],
    ...overrides,
});

const createBasePriceOptions = (...sizes: string[]): BasePriceInfo[] => sizes.map((size, index) => ({
    size,
    price: 999 + (index * 500),
}));

describe('buildAiChatPromptSuggestions', () => {
    it('builds broader suggestions across cake options, icing, messages, and toppers', () => {
        const mainTopper: HybridAnalysisResult['main_toppers'][number] & { original_type: 'printout' } = {
            type: 'printout',
            description: 'Mia name topper',
            size: 'medium',
            quantity: 1,
            group_id: 'topper-1',
            classification: 'hero',
            color: '#FFC0CB',
            original_type: 'printout',
        };

        const suggestions = buildAiChatPromptSuggestions(createAnalysis({
            cake_messages: [{ type: 'icing_script', text: 'Happy Birthday Mia', position: 'top', color: '#FFFFFF' }],
            main_toppers: [mainTopper],
            icing_design: {
                base: 'soft_icing',
                color_type: 'single',
                colors: {
                    top: '#FFC0CB',
                    side: '#FFC0CB',
                    drip: '#FFFFFF',
                    borderTop: '#FFC0CB',
                    borderBase: '#FFC0CB',
                    gumpasteBaseBoardColor: '#FFFFFF',
                },
                border_top: true,
                border_base: false,
                drip: false,
                gumpasteBaseBoard: false,
            },
        }), {
            cakeInfo: createCakeInfo(),
            basePriceOptions: createBasePriceOptions('6" Round', '8" Round'),
        });

        expect(suggestions).toContain('change the cake type from 1 Tier to ...');
        expect(suggestions).toContain('change the cake height from 4 in to ...');
        expect(suggestions).toContain('change the cake size from 6" Round to ...');
        expect(suggestions).toContain('change the cake flavor from chocolate cake to ...');
        expect(suggestions).toContain('change the pink icing to ...');
        expect(suggestions).toContain('add a ... drip on the cake');
        expect(suggestions).toContain('change the pink top border to ...');
        expect(suggestions).toContain('remove the top border');
        expect(suggestions).toContain('add a ... bottom border');
        expect(suggestions).toContain('add a ... drip on the cake');
        expect(suggestions).toContain('add a ... gumpaste covered base board');
        expect(suggestions).toContain('change the "Happy Birthday Mia" top message to ...');
        expect(suggestions).toContain('change the top message color to ...');
        expect(suggestions).toContain('remove the top message');
        expect(suggestions).toContain('add a message on the cake front saying "..."');
        expect(suggestions).toContain('add a message on the base board saying "..."');
        expect(suggestions).toContain('change the "Mia name topper" topper to fresh flowers');
        expect(suggestions).toContain('remove the "Mia name topper" topper');
        expect(suggestions).toContain('change the "Mia name topper" topper material to ...');
        expect(suggestions).toContain('replace the image of the "Mia name topper" topper');
    });

    it('uses split icing, tier flavors, and support decoration suggestions when available', () => {
        const supportElement: HybridAnalysisResult['support_elements'][number] & { original_type: 'edible_photo_side' } = {
            type: 'edible_photo_side',
            description: 'photo wrap',
            size: 'large',
            group_id: 'element-1',
            original_type: 'edible_photo_side',
        };

        const suggestions = buildAiChatPromptSuggestions(createAnalysis({
            cakeType: '2 Tier',
            cake_messages: [{ type: 'icing_script', text: 'Congrats Ava', position: 'side', color: '#000000' }],
            support_elements: [supportElement],
            icing_design: {
                base: 'soft_icing',
                color_type: 'gradient_2',
                colors: {
                    top: '#FFC0CB',
                    side: '#87CEEB',
                    drip: '#FFFFFF',
                    borderTop: '#FFC0CB',
                    borderBase: '#87CEEB',
                    gumpasteBaseBoardColor: '#FFFFFF',
                },
                border_top: false,
                border_base: true,
                drip: true,
                gumpasteBaseBoard: true,
            },
        }), {
            cakeInfo: createCakeInfo({
                type: '2 Tier',
                thickness: '5 in',
                size: '6"/8" Round',
                flavors: ['Vanilla Cake', 'Mocha Cake'],
            }),
            basePriceOptions: createBasePriceOptions('6"/8" Round', '7"/9" Round'),
        });

        expect(suggestions).toContain('change the top tier flavor from vanilla cake to ...');
        expect(suggestions).toContain('change the bottom tier flavor from mocha cake to ...');
        expect(suggestions).toContain('change the pink top icing to ...');
        expect(suggestions).toContain('change the light blue side icing to ...');
        expect(suggestions).toContain('change the white drip to ...');
        expect(suggestions).toContain('remove the drip');
        expect(suggestions).toContain('add a ... top border');
        expect(suggestions).toContain('change the light blue bottom border to ...');
        expect(suggestions).toContain('remove the bottom border');
        expect(suggestions).toContain('change the white covered base board color to ...');
        expect(suggestions).toContain('remove the gumpaste covered base board');
        expect(suggestions).toContain('add a message on the cake top saying "..."');
        expect(suggestions).toContain('change the "Congrats Ava" front message to ...');
        expect(suggestions).toContain('change the "photo wrap" support decoration material to ...');
        expect(suggestions).toContain('replace the image of the "photo wrap" support decoration');
        expect(suggestions).toContain('remove the "photo wrap" support decoration');
        expect(suggestions).not.toContain('add a ... drip on the cake');
        expect(suggestions).not.toContain('add a ... gumpaste covered base board');
    });

    it('skips unavailable bento-only options', () => {
        const suggestions = buildAiChatPromptSuggestions(createAnalysis({
            cakeType: 'Bento',
        }), {
            cakeInfo: createCakeInfo({
                type: 'Bento',
                thickness: '2 in',
                size: '4" Round',
                flavors: ['Vanilla Cake'],
            }),
            basePriceOptions: createBasePriceOptions('4" Bento'),
        });

        expect(suggestions).not.toContain('change the cake height from 2 in to ...');
        expect(suggestions).not.toContain('add a ... bottom border');
        expect(suggestions).not.toContain('add a ... gumpaste covered base board');
        expect(suggestions).not.toContain('add a message on the base board saying "..."');
    });

    it('returns an empty list when analysis data is missing', () => {
        expect(buildAiChatPromptSuggestions(null)).toEqual([]);
    });
});

describe('shouldShowAiPromptSuggestion', () => {
    it('hides cake height, size, and flavor suggestions by default', () => {
        expect(shouldShowAiPromptSuggestion('change the cake height from 4 in to ...', '')).toBe(false);
        expect(shouldShowAiPromptSuggestion('change the cake size from 6" Round to ...', '')).toBe(false);
        expect(shouldShowAiPromptSuggestion('change the cake flavor from chocolate cake to ...', '')).toBe(false);
    });

    it('shows deferred cake detail suggestions only for related queries', () => {
        expect(shouldShowAiPromptSuggestion('change the cake height from 4 in to ...', 'height')).toBe(true);
        expect(shouldShowAiPromptSuggestion('change the cake size from 6" Round to ...', 'round size')).toBe(true);
        expect(shouldShowAiPromptSuggestion('change the cake flavor from chocolate cake to ...', 'flavor')).toBe(true);
        expect(shouldShowAiPromptSuggestion('change the cake size from 6" Round to ...', 'icing')).toBe(false);
    });

    it('keeps non-deferred suggestions visible', () => {
        expect(shouldShowAiPromptSuggestion('change the pink icing to ...', '')).toBe(true);
    });
});