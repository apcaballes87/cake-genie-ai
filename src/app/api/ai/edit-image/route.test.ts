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

describe('/api/ai/edit-image', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls the Gemini 3.1 Flash Image model for image edits', async () => {
        generateContent.mockResolvedValueOnce({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                inlineData: {
                                    data: 'generated-image',
                                    mimeType: 'image/png',
                                },
                            },
                        ],
                    },
                },
            ],
        });

        const response = await POST(
            new Request('http://localhost/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Make it pink',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        expect(generateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gemini-3.1-flash-image-preview',
                config: expect.objectContaining({
                    responseModalities: ['TEXT', 'IMAGE'],
                    abortSignal: expect.any(AbortSignal),
                }),
            })
        );
    });

    it('uses Gemini 2.5 Flash Image when the request explicitly prefers the icing-only model', async () => {
        generateContent.mockResolvedValueOnce({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                inlineData: {
                                    data: 'generated-image',
                                    mimeType: 'image/png',
                                },
                            },
                        ],
                    },
                },
            ],
        });

        const response = await POST(
            new Request('http://localhost/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Change just the icing to mint green',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                    preferredModel: 'gemini-2.5-flash-image',
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        expect(generateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gemini-2.5-flash-image',
                config: expect.objectContaining({
                    responseModalities: ['TEXT', 'IMAGE'],
                }),
            })
        );
    });

    it('retries with the default model when the color-only attempt returns no image', async () => {
        generateContent
            .mockResolvedValueOnce({
                candidates: [],
            })
            .mockResolvedValueOnce({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    inlineData: {
                                        data: 'fallback-image',
                                        mimeType: 'image/png',
                                    },
                                },
                            ],
                        },
                    },
                ],
            });

        const response = await POST(
            new Request('http://localhost/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Change just the icing to mint green',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                    preferredModel: 'gemini-2.5-flash-image',
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        expect(generateContent).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                model: 'gemini-2.5-flash-image',
                config: expect.objectContaining({
                    responseModalities: ['TEXT', 'IMAGE'],
                }),
            })
        );
        expect(generateContent).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                model: 'gemini-3.1-flash-image-preview',
                config: expect.objectContaining({
                    responseModalities: ['TEXT', 'IMAGE'],
                }),
            })
        );
        await expect(response.json()).resolves.toEqual({
            imageData: 'fallback-image',
            mimeType: 'image/png',
            model: 'gemini-3.1-flash-image-preview',
        });
    });

    it('returns 429 with a friendly message when Gemini reports quota exhaustion via status', async () => {
        generateContent.mockRejectedValueOnce(
            Object.assign(new Error('quota exceeded'), { status: 429 })
        );

        const response = await POST(
            new Request('http://localhost/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Make it pink',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                }),
            }) as never
        );

        expect(response.status).toBe(429);
        await expect(response.json()).resolves.toEqual({
            error: 'AI image editing is temporarily unavailable due to quota limits. Please try again later.',
        });
    });

    it('returns 429 when Gemini only exposes RESOURCE_EXHAUSTED in the message body', async () => {
        generateContent.mockRejectedValueOnce(
            new Error('{"error":{"code":429,"message":"Resource has been exhausted (e.g. check quota).","status":"RESOURCE_EXHAUSTED"}}')
        );

        const response = await POST(
            new Request('http://localhost/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Add flowers',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                }),
            }) as never
        );

        expect(response.status).toBe(429);
        await expect(response.json()).resolves.toEqual({
            error: 'AI image editing is temporarily unavailable due to quota limits. Please try again later.',
        });
    });

    it('accepts image bytes returned through response.data', async () => {
        generateContent.mockResolvedValueOnce({
            data: 'generated-image-from-data',
            mimeType: 'image/jpeg',
            candidates: [],
        });

        const response = await POST(
            new Request('http://localhost/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Add drip',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            imageData: 'generated-image-from-data',
            mimeType: 'image/jpeg',
            model: 'gemini-3.1-flash-image-preview',
        });
    });

    it('returns the model text when Gemini responds without image data', async () => {
        // The default path now also runs the color-only retry scaffolding,
        // so `generateContent` can be called twice. We use `mockResolvedValue`
        // (not `mockResolvedValueOnce`) so the same text response is returned
        // for both attempts, and the second attempt's text surfaces as 400.
        generateContent.mockResolvedValue({
            text: 'Could not complete the requested edit.',
            candidates: [],
        });

        const response = await POST(
            new Request('http://localhost/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Remove message',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                }),
            }) as never
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'AI returned text instead of an image. Could not complete the requested edit.',
        });
    });

    it('preserves non-quota failures as 500s with the underlying message', async () => {
        generateContent.mockRejectedValueOnce(new Error('Unexpected Gemini failure'));

        const response = await POST(
            new Request('http://localhost/api/ai/edit-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Add flowers',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                }),
            }) as never
        );

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: 'Unexpected Gemini failure',
        });
    });
});
