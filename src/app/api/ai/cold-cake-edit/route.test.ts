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
});
