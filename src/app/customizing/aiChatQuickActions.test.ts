import { describe, expect, it } from 'vitest';
import type { MainTopperUI, SupportElementUI } from '@/types';
import {
    applyAiChatQuickActionMaterial,
    getAiChatQuickActionMode,
    getAiChatQuickActionSelectedAction,
    getTopperMaterialTargets,
} from './aiChatQuickActions';

const topper = (type: MainTopperUI['type'], originalType = type, isEnabled = true): MainTopperUI => ({
    id: `${type}-${originalType}`,
    type,
    original_type: originalType,
    description: type,
    size: 'medium',
    quantity: 1,
    group_id: type,
    classification: 'hero',
    isEnabled,
    price: 0,
});

const support = (type: SupportElementUI['type'], originalType = type, isEnabled = true): SupportElementUI => ({
    id: `${type}-${originalType}`,
    type,
    original_type: originalType,
    description: type,
    size: 'medium',
    group_id: type,
    isEnabled,
    price: 0,
});

describe('getAiChatQuickActionMode', () => {
    it('shows edible-photo replacement for an enabled edible photo top', () => {
        expect(getAiChatQuickActionMode([topper('edible_photo_top')])).toBe('edible-photo');
    });

    it('keeps toy actions after a toy has been converted to printout', () => {
        expect(getAiChatQuickActionMode([topper('printout', 'toy')])).toBe('toy-toppers');
    });

    it('does not treat support-only plastic balls as toy toppers', () => {
        expect(getAiChatQuickActionMode([], [support('plastic_ball')])).toBeNull();
        expect(getAiChatQuickActionMode([], [support('support_printout', 'plastic_ball')])).toBeNull();
    });

    it('includes edible support decorations in the edible quick-action mode', () => {
        expect(getAiChatQuickActionMode([], [support('edible_3d_support')])).toBe('edible-toppers');
    });

    it('shows edible topper actions for edible craft toppers', () => {
        expect(getAiChatQuickActionMode([topper('edible_2d_complex')])).toBe('edible-toppers');
    });

    it('gives edible-photo replacement priority over other topper groups', () => {
        expect(getAiChatQuickActionMode([
            topper('toy'),
            topper('edible_3d_ordinary'),
            topper('edible_photo_top'),
        ])).toBe('edible-photo');
    });

    it('keeps material controls available when every source topper is disabled', () => {
        const disabledToy = topper('printout', 'toy', false);

        expect(getAiChatQuickActionMode([disabledToy])).toBe('toy-toppers');
        expect(getAiChatQuickActionSelectedAction([disabledToy], 'toy-toppers')).toBeNull();
    });

    it('selects the bulk action matching the current material across every target row', () => {
        expect(getAiChatQuickActionSelectedAction([topper('edible_3d_complex')], 'edible-toppers')).toBe('edible');
        expect(getAiChatQuickActionSelectedAction(
            [topper('printout', 'toy')],
            'toy-toppers',
            [support('support_printout', 'plastic_ball')],
        )).toBe('printout');
    });

    it('selects printout for a printout converted from an edible topper', () => {
        expect(getAiChatQuickActionSelectedAction(
            [topper('printout', 'edible_3d_complex')],
            'edible-toppers',
        )).toBe('printout');
    });

    it('does not select a bulk action for mixed materials', () => {
        expect(getAiChatQuickActionSelectedAction([
            topper('toy'),
            topper('printout', 'toy'),
        ], 'toy-toppers')).toBeNull();
    });
});

describe('getTopperMaterialTargets', () => {
    it('targets Toy Story character toppers without pulling in decorative support balls', () => {
        const mainToppers = [
            { ...topper('printout', 'toy'), id: 'woody', printout_source_type: 'toy' as const },
            { ...topper('printout', 'figurine'), id: 'buzz', printout_source_type: 'figurine' as const },
            topper('printout'),
        ];
        const supportElements = [support('plastic_ball'), support('sprinkles')];

        const targets = getTopperMaterialTargets(mainToppers, supportElements, 'toy-toppers');

        expect(targets.mainToppers.map((item) => item.id)).toEqual(['woody', 'buzz']);
        expect(targets.supportElements).toEqual([]);
    });
});

describe('applyAiChatQuickActionMaterial', () => {
    it('converts every toy-source main row to edible and leaves support decorations untouched', () => {
        const result = applyAiChatQuickActionMaterial(
            [
                { ...topper('printout', 'toy', false), printout_source_type: 'toy' },
                topper('edible_2d_complex'),
            ],
            [
                { ...support('support_printout', 'plastic_ball', false), printout_source_type: 'plastic_ball' },
                support('sprinkles'),
            ],
            'toy-toppers',
            'edible',
        );

        expect(result.changed).toBe(true);
        expect(result.mainToppers[0]).toMatchObject({
            type: 'edible_3d_complex',
            isEnabled: true,
            original_type: 'toy',
            printout_source_type: 'toy',
        });
        expect(result.supportElements[0]).toMatchObject({
            type: 'support_printout',
            isEnabled: false,
            original_type: 'plastic_ball',
            printout_source_type: 'plastic_ball',
        });
        expect(result.mainToppers[1]).toEqual(topper('edible_2d_complex'));
        expect(result.supportElements[1]).toEqual(support('sprinkles'));
    });

    it('restores the original toy and edible material types for matching rows', () => {
        const toyResult = applyAiChatQuickActionMaterial(
            [{ ...topper('printout', 'figurine'), printout_source_type: 'figurine' }],
            [{ ...support('support_printout', 'plastic_ball_disco'), printout_source_type: 'plastic_ball_disco' }],
            'toy-toppers',
            'toy',
        );
        const edibleResult = applyAiChatQuickActionMaterial(
            [{ ...topper('printout', 'edible_2d_complex'), printout_source_type: 'edible_2d_complex' }],
            [{ ...support('support_printout', 'edible_3d_support'), printout_source_type: 'edible_3d_support' }],
            'edible-toppers',
            'edible',
        );

        expect(toyResult.mainToppers[0]).toMatchObject({ type: 'figurine', isEnabled: true });
        expect(toyResult.supportElements[0]).toMatchObject({ type: 'support_printout', isEnabled: true });
        expect(edibleResult.mainToppers[0]).toMatchObject({ type: 'edible_2d_complex', isEnabled: true });
        expect(edibleResult.supportElements[0]).toMatchObject({ type: 'edible_3d_support', isEnabled: true });
    });

    it('converts edible main and support rows to their printout types with source metadata', () => {
        const result = applyAiChatQuickActionMaterial(
            [topper('edible_3d_complex')],
            [support('edible_2d_support')],
            'edible-toppers',
            'printout',
        );

        expect(result.mainToppers[0]).toMatchObject({
            type: 'printout',
            isEnabled: true,
            printout_source_type: 'edible_3d_complex',
        });
        expect(result.supportElements[0]).toMatchObject({
            type: 'support_printout',
            isEnabled: true,
            printout_source_type: 'edible_2d_support',
        });
    });

    it('does not generate an update for an already-selected material state', () => {
        const mainToppers = [topper('edible_3d_complex')];
        const supportElements = [support('edible_3d_support')];

        const result = applyAiChatQuickActionMaterial(
            mainToppers,
            supportElements,
            'edible-toppers',
            'edible',
        );

        expect(result).toEqual({ mainToppers, supportElements, changed: false });
    });

    it('treats an auto-converted Toy Story state as selected printout with no price candidate change', () => {
        const mainToppers = [
            { ...topper('printout', 'toy'), id: 'woody', printout_source_type: 'toy' as const },
            { ...topper('printout', 'figurine'), id: 'buzz', printout_source_type: 'figurine' as const },
        ];
        const supportElements = [support('plastic_ball')];

        expect(getAiChatQuickActionSelectedAction(mainToppers, 'toy-toppers', supportElements)).toBe('printout');
        expect(applyAiChatQuickActionMaterial(
            mainToppers,
            supportElements,
            'toy-toppers',
            'printout',
        )).toEqual({ mainToppers, supportElements, changed: false });
    });

    it('clears the bulk selection when one target toggle or material differs', () => {
        const printouts = [
            { ...topper('printout', 'toy'), id: 'woody' },
            { ...topper('printout', 'toy'), id: 'buzz' },
        ];

        expect(getAiChatQuickActionSelectedAction(
            [{ ...printouts[0], isEnabled: false }, printouts[1]],
            'toy-toppers',
        )).toBeNull();
        expect(getAiChatQuickActionSelectedAction(
            [{ ...printouts[0], type: 'edible_3d_complex' }, printouts[1]],
            'toy-toppers',
        )).toBeNull();
    });

    it('re-enables every target and selects the clicked material', () => {
        const mainToppers = [
            { ...topper('printout', 'toy', false), id: 'woody' },
            { ...topper('printout', 'toy'), id: 'buzz' },
        ];

        const edibleState = applyAiChatQuickActionMaterial(
            mainToppers,
            [],
            'toy-toppers',
            'edible',
        );

        expect(edibleState.mainToppers.every((item) => item.isEnabled)).toBe(true);
        expect(getAiChatQuickActionSelectedAction(
            edibleState.mainToppers,
            'toy-toppers',
        )).toBe('edible');
    });
});
