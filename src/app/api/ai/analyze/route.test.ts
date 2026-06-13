import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGenerateContent = vi.fn();
const mockGetOrCreatePromptCache = vi.fn();
const mockGetActivePromptDetails = vi.fn();
const mockGetDynamicTypeEnums = vi.fn();

vi.mock('@/lib/ai/client', () => ({
    getAI: vi.fn(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    })),
    getOrCreatePromptCache: (...args: unknown[]) => mockGetOrCreatePromptCache(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => ({})),
}));

vi.mock('@/services/prompts/promptLoader', () => ({
    getActivePromptDetails: (...args: unknown[]) => mockGetActivePromptDetails(...args),
}));

vi.mock('@/lib/ai/utils', () => ({
    getDynamicTypeEnums: (...args: unknown[]) => mockGetDynamicTypeEnums(...args),
}));

describe('POST /api/ai/analyze', () => {
    beforeEach(() => {
        vi.resetModules();
        mockGenerateContent.mockReset();
        mockGetOrCreatePromptCache.mockReset();
        mockGetActivePromptDetails.mockReset();
        mockGetDynamicTypeEnums.mockReset();
        mockGetActivePromptDetails.mockResolvedValue({
            promptText: 'Analyze this cake',
            version: '1.0',
        });
        mockGetDynamicTypeEnums.mockResolvedValue({
            styles: [],
            icings: [],
        });
        mockGenerateContent.mockResolvedValue({
            text: JSON.stringify({
                title: 'Ocean Mermaid Cake',
                rejection: { isRejected: false },
            }),
        });
    });

    it('rejects requests if imageData or mimeType is missing', async () => {
        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.error).toContain('Missing required fields');
    });

    it('processes successfully for admin requests without a Turnstile check', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue('mock-cache-name');

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            headers: {
                'x-admin-pin': '231323',
            },
            body: JSON.stringify({
                imageData: 'base64-data',
                mimeType: 'image/png',
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.title).toBe('Ocean Mermaid Cake');
    });

    it('processes successfully for public requests without requiring a Turnstile token', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null); // Force uncached path for test coverage

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'base64-data',
                mimeType: 'image/png',
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.title).toBe('Ocean Mermaid Cake');
    });

    it('reuses cached prompt details and enum config across hot requests', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue('mock-cache-name');

        const { POST } = await import('./route');
        const makeRequest = () =>
            new NextRequest('http://localhost/api/ai/analyze', {
                method: 'POST',
                body: JSON.stringify({
                    imageData: 'base64-data',
                    mimeType: 'image/png',
                }),
            });

        const firstResponse = await POST(makeRequest());
        const secondResponse = await POST(makeRequest());

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(mockGetActivePromptDetails).toHaveBeenCalledTimes(1);
        expect(mockGetDynamicTypeEnums).toHaveBeenCalledTimes(1);
        expect(mockGetOrCreatePromptCache).toHaveBeenCalledTimes(1);
    });
});
