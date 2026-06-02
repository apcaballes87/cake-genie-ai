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

describe('/api/ai/validate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('retries chat validation with the stable model when the chat model fails', async () => {
        generateContent
            .mockRejectedValueOnce(new Error('chat model failed'))
            .mockResolvedValueOnce({
                text: JSON.stringify({ classification: 'not_a_cake' }),
            });

        const response = await POST(
            new Request('http://localhost/api/ai/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageData: 'abc123',
                    mimeType: 'image/png',
                    useCase: 'chat',
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ classification: 'not_a_cake' });
        expect(generateContent).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ model: 'gemini-2.5-flash' })
        );
        expect(generateContent).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ model: 'gemini-3-flash-preview' })
        );
    });

    it('retries chat validation with the stable model when the chat model returns invalid JSON', async () => {
        generateContent
            .mockResolvedValueOnce({ text: 'not-json' })
            .mockResolvedValueOnce({
                text: JSON.stringify({ classification: 'payment_receipt' }),
            });

        const response = await POST(
            new Request('http://localhost/api/ai/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageData: 'abc123',
                    mimeType: 'image/png',
                    useCase: 'chat',
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ classification: 'payment_receipt' });
        expect(generateContent).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ model: 'gemini-2.5-flash' })
        );
        expect(generateContent).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ model: 'gemini-3-flash-preview' })
        );
    });

    it('keeps non-chat validation on the stable model without retrying', async () => {
        generateContent.mockResolvedValueOnce({
            text: JSON.stringify({ classification: 'valid_single_cake' }),
        });

        const response = await POST(
            new Request('http://localhost/api/ai/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageData: 'abc123',
                    mimeType: 'image/png',
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ classification: 'valid_single_cake' });
        expect(generateContent).toHaveBeenCalledTimes(1);
        expect(generateContent).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'gemini-3-flash-preview' })
        );
    });

    it('returns 504 when the AI request is aborted by the timeout signal', async () => {
        const abortError = new Error('This operation was aborted');
        abortError.name = 'AbortError';
        generateContent.mockRejectedValueOnce(abortError);

        const response = await POST(
            new Request('http://localhost/api/ai/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageData: 'abc123',
                    mimeType: 'image/png',
                }),
            }) as never
        );

        expect(response.status).toBe(504);
        const body = await response.json();
        expect(body.error).toMatch(/timed out/i);
    });
});
