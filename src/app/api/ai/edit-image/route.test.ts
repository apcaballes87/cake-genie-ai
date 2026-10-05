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
        generateContent.mockReset();
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
                model: 'gemini-3.1-flash-lite-image',
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
                model: 'gemini-3.1-flash-lite-image',
                config: expect.objectContaining({
                    responseModalities: ['TEXT', 'IMAGE'],
                }),
            })
        );
        await expect(response.json()).resolves.toEqual({
            imageData: 'fallback-image',
            mimeType: 'image/png',
            model: 'gemini-3.1-flash-lite-image',
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
            model: 'gemini-3.1-flash-lite-image',
        });
    });

    it('includes uploaded replacement reference images in the model input', async () => {
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
                    prompt: 'Replace the topper using Replacement reference 1',
                    originalImage: { data: 'abc123', mimeType: 'image/png' },
                    referenceImages: [
                        {
                            label: 'Replacement reference 1',
                            targetDescription: 'graduation topper',
                            targetType: 'main topper',
                            image: { data: 'ref-image-1', mimeType: 'image/jpeg' },
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
                                    data: 'abc123',
                                    mimeType: 'image/png',
                                },
                            },
                            {
                                inlineData: {
                                    data: 'ref-image-1',
                                    mimeType: 'image/jpeg',
                                },
                            },
                            {
                                text: 'Replacement reference 1 is for the main topper "graduation topper". Use it only for that specific target and preserve all other decorations.',
                            },
                            {
                                text: 'Replace the topper using Replacement reference 1',
                            },
                        ]),
                    },
                ],
            })
        );
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

    it('sanitizes unexpected failures instead of exposing provider internals', async () => {
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
            error: 'Failed to edit image. Please try again.',
        });
    });
    const editRequest = () => new Request('http://localhost/api/ai/edit-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Make the topper pink', originalImage: { data: 'abc123', mimeType: 'image/png' } }),
    }) as never;

    it('retries an empty generation once and returns the generated image', async () => {
        generateContent.mockResolvedValueOnce({ candidates: [{ finishReason: 'NO_IMAGE' }] })
            .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ inlineData: { data: 'edited', mimeType: 'image/png' } }] } }] });
        const response = await POST(editRequest());
        expect(response.status).toBe(200);
        expect(generateContent).toHaveBeenCalledTimes(2);
        expect((await response.json()).imageData).toBe('edited');
    });

    it('returns an explicit provider block without retrying it', async () => {
        generateContent.mockResolvedValueOnce({ candidates: [{ finishReason: 'IMAGE_RECITATION' }] });
        const response = await POST(editRequest());
        expect(response.status).toBe(422);
        expect(generateContent).toHaveBeenCalledTimes(1);
        expect(await response.json()).toMatchObject({ code: 'AI_CONTENT_BLOCKED', reason: 'IMAGE_RECITATION' });
    });

    it('reports an unavailable image after at most two empty generations', async () => {
        generateContent.mockResolvedValue({ candidates: [] });
        const response = await POST(editRequest());
        expect(response.status).toBe(502);
        expect(generateContent).toHaveBeenCalledTimes(2);
        expect(await response.json()).toMatchObject({ code: 'AI_NO_IMAGE' });
    });

});
