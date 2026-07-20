import { describe, expect, it } from 'vitest';
import type {
    AiChatCustomizationSnapshot,
    AiChatEditResponse,
} from './aiChatEditContract';
import {
    applyAiChatEdit,
    validateAiChatEditResponse,
} from './aiChatEditContract';

const makeSnapshot = (
    overrides: Partial<AiChatCustomizationSnapshot> = {},
): AiChatCustomizationSnapshot => {
    const cakeInfo = overrides.cakeInfo ?? {
        type: '1 Tier',
        thickness: '4 in',
        size: '6" Round',
        flavors: ['Chocolate Cake'],
    };
    const mainToppers = overrides.mainToppers ?? [
        {
            id: 'topper-1',
            type: 'edible_3d_complex',
            original_type: 'toy',
            printout_source_type: 'toy',
            description: 'dinosaur topper',
            material: 'gumpaste',
            size: 'medium',
            quantity: 1,
            group_id: 'dinosaur',
            classification: 'hero',
            color: '#008000',
            original_color: '#0000FF',
            isEnabled: false,
            price: 250,
            replacementImage: { data: 'preserve-me', mimeType: 'image/png' },
        },
    ];
    const supportElements = overrides.supportElements ?? [
        {
            id: 'support-1',
            type: 'sprinkles',
            original_type: 'sprinkles',
            description: 'gold sprinkles',
            material: 'sugar',
            size: 'small',
            group_id: 'sprinkles',
            color: '#FFD700',
            original_color: '#FFD700',
            isEnabled: true,
            price: 50,
            replacementImage: { data: 'support-image', mimeType: 'image/jpeg' },
        },
    ];
    const cakeMessages = overrides.cakeMessages ?? [
        {
            id: 'message-1',
            type: 'icing_script',
            text: 'Happy Birthday',
            position: 'top',
            color: '#000000',
            isEnabled: false,
            price: 75,
            useDefaultColor: true,
            originalMessage: {
                type: 'icing_script',
                text: 'Original message',
                position: 'top',
                color: '#FFFFFF',
            },
        },
    ];
    const icingDesign = overrides.icingDesign ?? {
        base: 'soft_icing',
        color_type: 'single',
        colors: {
            side: '#FFFFFF',
            top: '#FFFFFF',
            gumpasteBaseBoardColor: '#FFD700',
        },
        border_top: true,
        border_base: true,
        drip: false,
        gumpasteBaseBoard: true,
        dripPrice: 125,
        gumpasteBaseBoardPrice: 225,
    };
    const analysisResult = overrides.analysisResult ?? {
        cakeType: cakeInfo.type,
        cakeThickness: cakeInfo.thickness,
        cakeSize: cakeInfo.size,
        main_toppers: mainToppers,
        support_elements: supportElements,
        cake_messages: cakeMessages,
        icing_design: icingDesign,
        keyword: 'dinosaur cake',
        seo_title: 'Preserved SEO title',
    };

    return {
        cakeInfo,
        mainToppers,
        supportElements,
        cakeMessages,
        icingDesign,
        additionalInstructions: overrides.additionalInstructions ?? 'Keep refrigerated',
        analysisResult,
    };
};

const designResponse = (patch: NonNullable<AiChatEditResponse['patch']>): AiChatEditResponse => ({
    outcome: 'design_change',
    patch,
    actions: [],
});

describe('validateAiChatEditResponse', () => {
    it('accepts the constrained wire contract with a stable existing target ID', () => {
        const current = makeSnapshot();
        const result = validateAiChatEditResponse(
            designResponse({
                icing: { base: 'fondant', colors: { side: '#FF69B4' } },
                topperOperations: [{
                    operation: 'update',
                    id: 'topper-1',
                    changes: { type: 'printout' },
                }],
            }),
            current,
        );

        expect(result.success).toBe(true);
    });

    it('rejects open enums, malformed HEX colors, unknown keys, and invalid outcomes', () => {
        const result = validateAiChatEditResponse({
            outcome: 'changed',
            actions: [],
            patch: {
                cake: { family: '4 Tier', thickness: 'standard' },
                icing: { base: 'buttercream', colors: { side: 'pink', drip: '#FFFFFF' } },
            },
            analysis_json: {},
        });

        expect(result).toMatchObject({ success: false, kind: 'invalid' });
        if (!result.success) {
            expect(result.errors.join(' ')).toContain('outcome');
            expect(result.errors.join(' ')).toContain('family');
            expect(result.errors.join(' ')).toContain('six-digit HEX');
            expect(result.errors.join(' ')).toContain('not supported');
        }
    });

    it('classifies missing, unknown, duplicate, or multiply-targeted IDs as ambiguous', () => {
        const current = makeSnapshot({
            mainToppers: [
                makeSnapshot().mainToppers[0],
                { ...makeSnapshot().mainToppers[0], description: 'duplicate stable id' },
            ],
        });
        const result = validateAiChatEditResponse(
            designResponse({
                topperOperations: [
                    { operation: 'remove', id: 'topper-1' },
                    { operation: 'update', id: 'topper-1', changes: { description: 'new' } },
                    { operation: 'remove', id: 'missing-id' },
                ],
            }),
            current,
        );

        expect(result).toMatchObject({ success: false, kind: 'ambiguous_target' });
    });

    it('enforces outcome semantics for action-only, restrictions, clarifications, and no-op', () => {
        expect(validateAiChatEditResponse({ outcome: 'action_only', actions: [] }).success).toBe(false);
        expect(validateAiChatEditResponse({ outcome: 'restriction', actions: [] }).success).toBe(false);
        expect(validateAiChatEditResponse({ outcome: 'clarification', actions: [], message: 'Which topper?' }).success).toBe(true);
        expect(validateAiChatEditResponse({
            outcome: 'action_only',
            actions: [{ type: 'update_instructions', content: 'Pickup at 10am' }],
        }).success).toBe(true);
        expect(validateAiChatEditResponse({ outcome: 'noop', actions: [] }).success).toBe(true);
        expect(validateAiChatEditResponse({
            outcome: 'restriction',
            actions: [{ type: 'add_to_cart' }],
            message: 'That option is unavailable.',
        }).success).toBe(false);
        expect(validateAiChatEditResponse({
            outcome: 'clarification',
            actions: [],
            message: 'Which topper?',
            patch: { icing: { drip: true } },
        }).success).toBe(false);
        expect(validateAiChatEditResponse({
            outcome: 'noop',
            actions: [{ type: 'add_to_cart' }],
        }).success).toBe(false);
        expect(validateAiChatEditResponse({
            outcome: 'action_only',
            actions: [{ type: 'add_to_cart' }],
            patch: { icing: { drip: true } },
        }).success).toBe(false);
    });
});

describe('applyAiChatEdit', () => {
    it('converts soft icing to fondant through the shared type/size rules without resetting state', () => {
        const current = makeSnapshot();
        const result = applyAiChatEdit(current, designResponse({ icing: { base: 'fondant' } }));

        expect(result.nextState.cakeInfo).toEqual({
            type: '1 Tier Fondant',
            thickness: '5 in',
            size: '6" Round Fondant',
            flavors: ['Chocolate Cake'],
        });
        expect(result.nextState.icingDesign.base).toBe('fondant');
        expect(result.nextState.mainToppers[0]).toEqual(current.mainToppers[0]);
        expect(result.nextState.mainToppers[0].replacementImage).toEqual({
            data: 'preserve-me',
            mimeType: 'image/png',
        });
        expect(result.nextState.mainToppers[0].isEnabled).toBe(false);
        expect(result.nextState.supportElements[0]).toEqual(current.supportElements[0]);
        expect(result.nextState.cakeMessages[0]).toEqual(current.cakeMessages[0]);
        expect(result.nextState.icingDesign.dripPrice).toBe(125);
        expect(result.nextState.additionalInstructions).toBe('Keep refrigerated');
        expect(result.changedPaths).toEqual(expect.arrayContaining([
            'cakeInfo.type',
            'cakeInfo.size',
            'cakeInfo.thickness',
            'icingDesign.base',
        ]));
        expect(result.requiresImageEdit).toBe(true);
        expect(result.syncedAnalysisResult).toMatchObject({
            cakeType: '1 Tier Fondant',
            cakeThickness: '5 in',
            cakeSize: '6" Round Fondant',
            keyword: 'dinosaur cake',
            seo_title: 'Preserved SEO title',
        });
    });

    it.each([
        ['2 Tier', '2 Tier Fondant'],
        ['3 Tier', '3 Tier Fondant'],
        ['Square', 'Square Fondant'],
        ['Rectangle', 'Rectangle Fondant'],
    ] as const)('maps the %s family to %s for fondant', (softType, fondantType) => {
        const current = makeSnapshot({
            cakeInfo: {
                type: softType,
                thickness: '4 in',
                size: softType === 'Square' ? '8x8' : softType === 'Rectangle' ? '8x12' : '6"/8" Round',
                flavors: softType === '2 Tier'
                    ? ['Chocolate Cake', 'Ube Cake']
                    : softType === '3 Tier'
                        ? ['Chocolate Cake', 'Ube Cake', 'Vanilla Cake']
                        : ['Chocolate Cake'],
            },
        });

        const result = applyAiChatEdit(current, designResponse({ icing: { base: 'fondant' } }));

        expect(result.nextState.cakeInfo.type).toBe(fondantType);
        expect(result.nextState.cakeInfo.flavors).toEqual(current.cakeInfo.flavors);
        expect(result.nextState.cakeInfo.thickness).toBe('5 in');
        if (softType === 'Square' || softType === 'Rectangle') {
            expect(result.nextState.cakeInfo.size).toBe(current.cakeInfo.size);
        } else {
            expect(result.nextState.cakeInfo.size).toContain('Fondant');
        }
    });

    it('converts fondant back to soft icing while retaining a thickness valid for the destination', () => {
        const current = makeSnapshot({
            cakeInfo: {
                type: '2 Tier Fondant',
                thickness: '5 in',
                size: '6"/8" Round Fondant',
                flavors: ['Ube Cake', 'Vanilla Cake'],
            },
            icingDesign: {
                ...makeSnapshot().icingDesign,
                base: 'fondant',
            },
        });

        const result = applyAiChatEdit(current, designResponse({ icing: { base: 'soft_icing' } }));

        expect(result.nextState.cakeInfo).toEqual({
            type: '2 Tier',
            thickness: '5 in',
            size: '6"/8" Round',
            flavors: ['Ube Cake', 'Vanilla Cake'],
        });
        expect(result.nextState.icingDesign.base).toBe('soft_icing');
    });

    it('matches the manual control by converting Bento to the default 1 Tier Fondant option', () => {
        const current = makeSnapshot({
            cakeInfo: {
                type: 'Bento',
                thickness: '2 in',
                size: '4" Round',
                flavors: ['Vanilla Cake'],
            },
        });

        const result = applyAiChatEdit(current, designResponse({ icing: { base: 'fondant' } }));

        expect(result.nextState.cakeInfo).toEqual({
            type: '1 Tier Fondant',
            thickness: '5 in',
            size: '6" Round Fondant',
            flavors: ['Vanilla Cake'],
        });
        expect(result.nextState.icingDesign.base).toBe('fondant');
    });

    it('normalizes an explicitly requested thickness that the destination type does not support', () => {
        const current = makeSnapshot();

        const result = applyAiChatEdit(current, designResponse({
            cake: { family: 'Square', thickness: '6 in' },
        }));

        expect(result.nextState.cakeInfo.type).toBe('Square');
        expect(result.nextState.cakeInfo.thickness).toBe('4 in');
        expect(result.changedPaths).toContain('cakeInfo.type');
        expect(result.changedPaths).not.toContain('cakeInfo.thickness');
    });

    it('resizes flavor slots only when the tier count changes and preserves existing selections', () => {
        const current = makeSnapshot({
            cakeInfo: {
                type: '2 Tier',
                thickness: '4 in',
                size: '6"/8" Round',
                flavors: ['Chocolate Cake', 'Ube Cake'],
            },
        });

        const result = applyAiChatEdit(current, designResponse({ cake: { family: '3 Tier' } }));

        expect(result.nextState.cakeInfo.flavors).toEqual(['Chocolate Cake', 'Ube Cake', 'Ube Cake']);
        expect(result.changedPaths).toContain('cakeInfo.flavors');
    });

    it('changes only requested icing fields and keeps IDs, prices, enabled state, and metadata intact', () => {
        const current = makeSnapshot();
        const result = applyAiChatEdit(current, designResponse({
            icing: {
                colorType: 'multicolor',
                colors: { side: '#FF69B4' },
                drip: true,
                borderBase: false,
            },
        }));

        expect(result.nextState.icingDesign).toEqual({
            ...current.icingDesign,
            color_type: 'multicolor',
            colors: { ...current.icingDesign.colors, side: '#FF69B4' },
            drip: true,
            border_base: false,
        });
        expect(result.nextState.cakeInfo).toEqual(current.cakeInfo);
        expect(result.nextState.mainToppers).toEqual(current.mainToppers);
        expect(result.changedPaths).toEqual([
            'icingDesign.color_type',
            'icingDesign.colors.side',
            'icingDesign.drip',
            'icingDesign.border_base',
        ]);
    });

    it('applies targeted add/update/remove operations without regenerating unaffected records', () => {
        const current = makeSnapshot();
        current.mainToppers[0] = { ...current.mainToppers[0], printout_source_type: undefined };
        const ids = ['topper-new', 'message-new'];
        const result = applyAiChatEdit(current, designResponse({
            topperOperations: [
                {
                    operation: 'update',
                    id: 'topper-1',
                    changes: { description: 'blue dinosaur', type: 'printout' },
                },
                {
                    operation: 'add',
                    item: {
                        type: 'printout',
                        description: 'rainbow topper',
                        size: 'small',
                        quantity: 1,
                        groupId: 'rainbow',
                        classification: 'hero',
                    },
                },
            ],
            supportOperations: [{ operation: 'remove', id: 'support-1' }],
            messageOperations: [
                { operation: 'update', id: 'message-1', changes: { color: '#FF0000' } },
                {
                    operation: 'add',
                    item: {
                        type: 'cardstock',
                        text: 'Thirty',
                        position: 'top',
                        color: '#FFD700',
                    },
                },
            ],
        }), { createId: () => ids.shift()! });

        expect(result.nextState.mainToppers).toHaveLength(2);
        expect(result.nextState.mainToppers[0]).toMatchObject({
            id: 'topper-1',
            description: 'blue dinosaur',
            type: 'printout',
            original_type: 'toy',
            printout_source_type: 'edible_3d_complex',
            isEnabled: false,
            price: 250,
            replacementImage: { data: 'preserve-me', mimeType: 'image/png' },
        });
        expect(result.nextState.mainToppers[1]).toMatchObject({
            id: 'topper-new',
            group_id: 'rainbow',
            type: 'printout',
            original_type: 'printout',
            isEnabled: true,
            price: 0,
        });
        expect(result.nextState.supportElements).toEqual([]);
        expect(result.nextState.cakeMessages[0]).toMatchObject({
            id: 'message-1',
            color: '#FF0000',
            isEnabled: false,
            useDefaultColor: true,
            originalMessage: { text: 'Original message' },
        });
        expect(result.nextState.cakeMessages[1]).toMatchObject({
            id: 'message-new',
            text: 'Thirty',
            isEnabled: true,
            price: 0,
        });
    });

    it('returns a true no-op for identical design values and non-design outcomes', () => {
        const current = makeSnapshot();
        const identical = applyAiChatEdit(current, designResponse({
            icing: { base: 'soft_icing', colors: { side: '#FFFFFF' } },
        }));
        const actionOnly = applyAiChatEdit(current, {
            outcome: 'action_only',
            actions: [{ type: 'add_to_cart' }],
        });

        expect(identical.changedPaths).toEqual([]);
        expect(identical.requiresImageEdit).toBe(false);
        expect(actionOnly.changedPaths).toEqual([]);
        expect(actionOnly.requiresImageEdit).toBe(false);
        expect(actionOnly.nextState).toEqual(current);
    });
});
