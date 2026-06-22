import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();

vi.mock('@/lib/ai/client', () => ({
    getAI: vi.fn(() => ({
        models: {
            generateContent,
        },
    })),
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/ai/utils', () => ({
    getDynamicTypeEnums: vi.fn(async () => ({
        mainTopperTypes: ['printout', 'toy'],
        supportElementTypes: ['support_printout', 'edible_3d_support'],
    })),
}));

import { POST } from './route';

describe('/api/ai/chat-edit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes attached reference images in the multimodal model input', async () => {
        generateContent.mockResolvedValueOnce({
            text: JSON.stringify({
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
            }),
        });

        const response = await POST(
            new Request('http://localhost/api/ai/chat-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'make the cake look like the attached sample',
                    currentAnalysis: {
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
                    referenceImages: [
                        {
                            label: 'Chat reference 1',
                            targetDescription: 'moodboard.png',
                            targetType: 'design reference',
                            image: { data: 'ref-image-1', mimeType: 'image/png' },
                        },
                    ],
                }),
            }) as never
        );

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
                                text: 'Chat reference 1 is an additional design reference labeled "moodboard.png". Use it to interpret the user\'s requested change, but preserve all other cake details unless the user explicitly asks for them to change.',
                            },
                            expect.objectContaining({
                                text: expect.stringContaining('User Prompt: make the cake look like the attached sample'),
                            }),
                        ]),
                    },
                ],
            })
        );
    });
});
