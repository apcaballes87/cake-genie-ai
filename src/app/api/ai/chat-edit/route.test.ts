import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();

vi.mock('@/lib/ai/client', () => ({
    getAI: vi.fn(() => ({
        models: {
            generateContent,
        },
    })),
}));

import { POST } from './route';

const currentCustomization = {
    cakeInfo: {
        type: '1 Tier',
        thickness: '4 in',
        size: '6" Round',
        flavors: ['Chocolate Cake'],
    },
    mainToppers: [
        {
            id: 'topper-1',
            isEnabled: true,
            price: 100,
            type: 'printout',
            original_type: 'printout',
            description: 'Happy birthday topper',
            size: 'medium',
            quantity: 1,
            group_id: 'topper-group-1',
            classification: 'hero',
        },
    ],
    supportElements: [
        {
            id: 'support-1',
            isEnabled: true,
            price: 50,
            type: 'sprinkles',
            original_type: 'sprinkles',
            description: 'Gold sprinkles',
            size: 'small',
            group_id: 'support-group-1',
        },
    ],
    cakeMessages: [
        {
            id: 'message-1',
            isEnabled: true,
            price: 0,
            type: 'icing_script',
            text: 'Happy Birthday',
            position: 'top',
            color: '#000000',
        },
    ],
    icingDesign: {
        base: 'soft_icing',
        color_type: 'single',
        colors: { side: '#FFFFFF', top: '#FFFFFF' },
        drip: false,
        border_top: false,
        border_base: false,
        gumpasteBaseBoard: false,
        dripPrice: 0,
        gumpasteBaseBoardPrice: 0,
    },
    additionalInstructions: '',
    analysisResult: {
        cakeType: '1 Tier',
        cakeThickness: '4 in',
        main_toppers: [],
        support_elements: [],
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
    },
};

const callRoute = (overrides: Record<string, unknown> = {}) => POST(
    new Request('http://localhost/api/ai/chat-edit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-ai-trace-id': 'route-test-trace',
        },
        body: JSON.stringify({
            prompt: 'please change to fondant',
            currentCustomization,
            ...overrides,
        }),
    }) as never,
);

describe('/api/ai/chat-edit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the constrained patch schema and returns a valid Fondant patch directly', async () => {
        const modelResponse = {
            outcome: 'design_change',
            patch: { icing: { base: 'fondant' } },
            actions: [],
        };
        generateContent.mockResolvedValueOnce({ text: JSON.stringify(modelResponse) });

        const response = await callRoute();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(modelResponse);

        const modelCall = generateContent.mock.calls[0][0];
        expect(modelCall.model).toBe('gemini-2.5-flash');
        expect(modelCall.config.temperature).toBe(0);
        expect(modelCall.config.responseMimeType).toBe('application/json');
        expect(modelCall.config.systemInstruction).toContain(
            '"please change to fondant" means patch.icing.base = "fondant"',
        );
        expect(modelCall.config.systemInstruction).toContain(
            'application deterministically maps the current family to its Fondant cake type',
        );
        expect(
            modelCall.config.responseSchema.properties.patch.properties.icing.properties.base.enum,
        ).toEqual(['soft_icing', 'fondant']);
        expect(
            modelCall.config.responseSchema.properties.patch.properties.cake.properties.family.enum,
        ).toEqual([
            '1 Tier',
            '2 Tier',
            '3 Tier',
            'Square',
            'Rectangle',
            'Bento',
            'Cupcake',
            'Bento Cupcake Set',
        ]);
        expect(modelCall.contents[0].parts.at(-1).text).toContain('CURRENT CUSTOMIZATION');
        expect(modelCall.contents[0].parts.at(-1).text).toContain('"id": "topper-1"');
    });

    it('includes attached reference images in the multimodal model input', async () => {
        generateContent.mockResolvedValueOnce({
            text: JSON.stringify({
                outcome: 'design_change',
                patch: { icing: { colors: { side: '#FFC0CB', top: '#FFC0CB' } } },
                actions: [],
            }),
        });

        const response = await callRoute({
            prompt: 'make the cake look like the attached sample',
            referenceImages: [
                {
                    label: 'Chat reference 1',
                    targetDescription: 'moodboard.png',
                    targetType: 'design reference',
                    image: { data: 'ref-image-1', mimeType: 'image/png' },
                },
            ],
        });

        expect(response.status).toBe(200);
        expect(generateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                contents: [
                    {
                        role: 'user',
                        parts: expect.arrayContaining([
                            {
                                inlineData: {
                                    data: 'ref-image-1',
                                    mimeType: 'image/png',
                                },
                            },
                            {
                                text: 'Chat reference 1 is an additional design reference labeled "moodboard.png". Use it only to interpret the requested change.',
                            },
                            expect.objectContaining({
                                text: expect.stringContaining('CUSTOMER REQUEST:\nmake the cake look like the attached sample'),
                            }),
                        ]),
                    },
                ],
            }),
        );
    });

    it('accepts stable-ID targeted updates without regenerating complete arrays', async () => {
        const modelResponse = {
            outcome: 'design_change',
            patch: {
                messageOperations: [
                    {
                        operation: 'update',
                        id: 'message-1',
                        changes: { text: 'Congratulations' },
                    },
                ],
            },
            actions: [],
        };
        generateContent.mockResolvedValueOnce({ text: JSON.stringify(modelResponse) });

        const response = await callRoute({ prompt: 'change the message to Congratulations' });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(modelResponse);
    });

    it('rejects semantically invalid closed-enum output with a safe 502', async () => {
        generateContent.mockResolvedValueOnce({
            text: JSON.stringify({
                outcome: 'design_change',
                patch: { icing: { base: 'buttercream' } },
                actions: [],
            }),
        });

        const response = await callRoute();

        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({
            error: 'AI returned an invalid cake design update.',
        });
    });

    it('turns an update whose ID does not identify one existing target into clarification', async () => {
        generateContent.mockResolvedValueOnce({
            text: JSON.stringify({
                outcome: 'design_change',
                patch: {
                    topperOperations: [
                        {
                            operation: 'update',
                            id: 'invented-topper-id',
                            changes: { description: 'Blue number topper' },
                        },
                    ],
                },
                actions: [],
            }),
        });

        const response = await callRoute({ prompt: 'change the topper to blue' });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            outcome: 'clarification',
            actions: [],
            message: 'I could not identify exactly one cake detail to change. Please tell me which specific item you mean.',
        });
    });

    it('returns restriction responses without a design patch', async () => {
        const modelResponse = {
            outcome: 'restriction',
            actions: [],
            message: 'Bento cakes do not support bottom borders.',
        };
        generateContent.mockResolvedValueOnce({ text: JSON.stringify(modelResponse) });

        const response = await callRoute({
            prompt: 'add a bottom border',
            currentCustomization: {
                ...currentCustomization,
                cakeInfo: { ...currentCustomization.cakeInfo, type: 'Bento' },
            },
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(modelResponse);
    });

    it('returns supported action-only responses with constrained action types', async () => {
        const modelResponse = {
            outcome: 'action_only',
            actions: [
                { type: 'update_instructions', content: 'Pickup tomorrow at 10am.' },
                { type: 'add_to_cart' },
            ],
        };
        generateContent.mockResolvedValueOnce({ text: JSON.stringify(modelResponse) });

        const response = await callRoute({
            prompt: 'pickup tomorrow at 10am and add to cart',
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(modelResponse);
        const modelCall = generateContent.mock.calls[0][0];
        expect(
            modelCall.config.responseSchema.properties.actions.items.properties.type.enum,
        ).toEqual(['add_to_cart', 'update_instructions']);
    });

    it('rejects the legacy currentAnalysis request shape', async () => {
        const response = await callRoute({
            currentCustomization: undefined,
            currentAnalysis: currentCustomization.analysisResult,
        });

        expect(response.status).toBe(400);
        expect(generateContent).not.toHaveBeenCalled();
    });
});
