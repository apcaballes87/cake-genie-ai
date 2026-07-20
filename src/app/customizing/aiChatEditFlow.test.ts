import { describe, expect, it, vi } from 'vitest';
import type { AiChatCustomizationSnapshot, AiChatEditResponse } from './aiChatEditContract';
import { executeAiChatEditFlow } from './aiChatEditFlow';

const buildCurrentState = (): AiChatCustomizationSnapshot => ({
    cakeInfo: {
        type: '1 Tier',
        thickness: '3 in',
        size: '6" Round',
        flavors: ['Ube Cake'],
    },
    icingDesign: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { side: '#FFFFFF', top: '#FFFFFF' },
        border_top: false,
        border_base: false,
        drip: false,
        gumpasteBaseBoard: false,
        dripPrice: 100,
        gumpasteBaseBoardPrice: 100,
    },
    mainToppers: [],
    supportElements: [],
    cakeMessages: [],
    additionalInstructions: '',
    analysisResult: {
        cakeType: '1 Tier',
        cakeThickness: '3 in',
        cakeSize: '6" Round',
        main_toppers: [],
        support_elements: [],
        cake_messages: [],
        icing_design: {
            base: 'soft_icing',
            color_type: 'single',
            colors: { side: '#FFFFFF', top: '#FFFFFF' },
            border_top: false,
            border_base: false,
            drip: false,
            gumpasteBaseBoard: false,
        },
    },
});

const fondantResponse: AiChatEditResponse = {
    outcome: 'design_change',
    patch: { icing: { base: 'fondant' } },
    actions: [],
};

describe('executeAiChatEditFlow', () => {
    it('waits for interpretation before applying state or starting one image edit', async () => {
        let resolveInterpretation!: (response: AiChatEditResponse) => void;
        const interpret = vi.fn(() => new Promise<AiChatEditResponse>(resolve => {
            resolveInterpretation = resolve;
        }));
        const applyState = vi.fn();
        const editImage = vi.fn(async () => undefined);

        const flowPromise = executeAiChatEditFlow({
            currentState: buildCurrentState(),
            interpret,
            applyState,
            editImage,
            runAction: vi.fn(),
        });

        await Promise.resolve();
        expect(applyState).not.toHaveBeenCalled();
        expect(editImage).not.toHaveBeenCalled();

        resolveInterpretation(fondantResponse);
        const result = await flowPromise;

        expect(applyState).toHaveBeenCalledTimes(1);
        expect(editImage).toHaveBeenCalledTimes(1);
        expect(result.editResult?.nextState.icingDesign.base).toBe('fondant');
        expect(result.editResult?.nextState.cakeInfo.flavors).toEqual(['Ube Cake']);
    });

    it.each(['restriction', 'clarification', 'noop'] as const)(
        'does not apply state or edit an image for %s outcomes',
        async outcome => {
            const applyState = vi.fn();
            const editImage = vi.fn();
            const response: AiChatEditResponse = {
                outcome,
                actions: [],
                ...(outcome === 'noop' ? {} : { message: 'Cannot apply that request.' }),
            };

            const result = await executeAiChatEditFlow({
                currentState: buildCurrentState(),
                interpret: async () => response,
                applyState,
                editImage,
                runAction: vi.fn(),
            });

            expect(result.effectiveOutcome).toBe(outcome);
            expect(applyState).not.toHaveBeenCalled();
            expect(editImage).not.toHaveBeenCalled();
        },
    );

    it('runs action-only requests without image generation', async () => {
        const runAction = vi.fn();
        const editImage = vi.fn();

        await executeAiChatEditFlow({
            currentState: buildCurrentState(),
            interpret: async () => ({
                outcome: 'action_only',
                actions: [{ type: 'add_to_cart' }],
            }),
            applyState: vi.fn(),
            editImage,
            runAction,
        });

        expect(runAction).toHaveBeenCalledWith({ type: 'add_to_cart' });
        expect(editImage).not.toHaveBeenCalled();
    });

    it('does not automatically retry an image failure or run mixed actions afterward', async () => {
        const editImage = vi.fn(async () => {
            throw new Error('image failed');
        });
        const runAction = vi.fn();

        await expect(executeAiChatEditFlow({
            currentState: buildCurrentState(),
            interpret: async () => ({
                ...fondantResponse,
                actions: [{ type: 'add_to_cart' }],
            }),
            applyState: vi.fn(),
            editImage,
            runAction,
        })).rejects.toThrow('image failed');

        expect(editImage).toHaveBeenCalledTimes(1);
        expect(runAction).not.toHaveBeenCalled();
    });

    it('treats an identical design patch as a no-op', async () => {
        const applyState = vi.fn();
        const editImage = vi.fn();

        const result = await executeAiChatEditFlow({
            currentState: buildCurrentState(),
            interpret: async () => ({
                outcome: 'design_change',
                patch: { icing: { base: 'soft_icing' } },
                actions: [],
            }),
            applyState,
            editImage,
            runAction: vi.fn(),
        });

        expect(result.effectiveOutcome).toBe('noop');
        expect(applyState).not.toHaveBeenCalled();
        expect(editImage).not.toHaveBeenCalled();
    });
});
