import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();

vi.mock('@/lib/ai/client', () => ({
    getAI: vi.fn(() => ({
        models: { generateContent },
    })),
}));

import { POST } from './route';

describe('/api/ai/cold-cake-edit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateContent.mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{
                        inlineData: {
                            data: 'generated-cake',
                            mimeType: 'image/webp',
                        },
                    }],
                },
            }],
        });
    });

    it('instructs the model to contain the entire uploaded image without cropping it', async () => {
        const response = await POST(new Request('http://localhost/api/ai/cold-cake-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseImage: { data: 'base-cake', mimeType: 'image/webp' },
                overlayImage: { data: 'full-selfie', mimeType: 'image/png' },
            }),
        }) as never);

        expect(response.status).toBe(200);

        const modelCall = generateContent.mock.calls[0][0];
        const requestPrompt = modelCall.contents[0].parts[2].text as string;
        expect(modelCall.config.systemInstruction).toContain('Show all of Image 2');
        expect(modelCall.config.systemInstruction).toContain('NEVER crop, trim, zoom into, stretch, warp, or cut off any part of Image 2');
        expect(modelCall.config.systemInstruction).toContain('using a contain fit');
        expect(requestPrompt).toContain('Show the COMPLETE Image 2');
        expect(requestPrompt).toContain('leaving a margin is required over cropping');
        expect(requestPrompt).toContain('one physical edible print attached flat');
    });

    it('falls back to Gemini 2.5 when the primary image model is quota-limited', async () => {
        generateContent
            .mockRejectedValueOnce(Object.assign(new Error('quota exceeded'), { status: 429 }))
            .mockResolvedValueOnce({
                candidates: [{
                    content: {
                        parts: [{ inlineData: { data: 'fallback-cake', mimeType: 'image/png' } }],
                    },
                }],
            });

        const response = await POST(new Request('http://localhost/api/ai/cold-cake-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseImage: { data: 'base-cake', mimeType: 'image/webp' },
                overlayImage: { data: 'full-selfie', mimeType: 'image/png' },
            }),
        }) as never);

        expect(response.status).toBe(200);
        expect(generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({
            model: 'gemini-3.1-flash-lite-image',
        }));
        expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({
            model: 'gemini-2.5-flash-image',
        }));
        await expect(response.json()).resolves.toEqual({
            imageData: 'fallback-cake',
            mimeType: 'image/png',
        });
    });

    it('preserves the quota response when both image models are unavailable', async () => {
        generateContent
            .mockRejectedValueOnce(Object.assign(new Error('quota exceeded'), { status: 429 }))
            .mockRejectedValueOnce(Object.assign(new Error('quota exceeded'), { status: 429 }));

        const response = await POST(new Request('http://localhost/api/ai/cold-cake-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseImage: { data: 'base-cake', mimeType: 'image/webp' },
                overlayImage: { data: 'full-selfie', mimeType: 'image/png' },
            }),
        }) as never);

        expect(response.status).toBe(429);
        await expect(response.json()).resolves.toEqual({
            error: 'AI image editing is temporarily unavailable due to quota limits. Please try again later.',
        });
    });
});
