import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGenerateContent = vi.fn();
const mockGetOrCreatePromptCache = vi.fn();

vi.mock('@/lib/ai/client', () => ({
    getAI: vi.fn(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    })),
    getOrCreatePromptCache: (...args: any[]) => mockGetOrCreatePromptCache(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => ({})),
}));

vi.mock('@/services/prompts/promptLoader', () => ({
    getActivePromptDetails: vi.fn().mockResolvedValue({
        promptText: 'Analyze this cake',
        version: '1.0',
    }),
}));

vi.mock('@/lib/ai/utils', () => ({
    getDynamicTypeEnums: vi.fn().mockResolvedValue({
        styles: [],
        icings: [],
    }),
}));

const mockVerifyTurnstileToken = vi.fn().mockResolvedValue({ success: true });
vi.mock('@/lib/security/turnstile', () => ({
    verifyTurnstileToken: (...args: any[]) => mockVerifyTurnstileToken(...args),
}));

describe('POST /api/ai/analyze', () => {
    beforeEach(() => {
        vi.resetModules();
        mockGenerateContent.mockReset();
        mockGetOrCreatePromptCache.mockReset();
        mockVerifyTurnstileToken.mockReset();

        mockVerifyTurnstileToken.mockResolvedValue({ success: true });
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

    it('rejects if Turnstile verification fails for non-admin request', async () => {
        mockVerifyTurnstileToken.mockResolvedValue({
            success: false,
            error: 'Security verification failed.',
        });

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'base64-data',
                mimeType: 'image/png',
                turnstileToken: 'invalid-token',
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.error).toBe('Security verification failed.');
        expect(mockVerifyTurnstileToken).toHaveBeenCalledWith('invalid-token', undefined);
    });

    it('bypasses Turnstile check if x-admin-pin header is valid', async () => {
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
        expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
    });

    it('processes successfully if Turnstile verification succeeds', async () => {
        mockGetOrCreatePromptCache.mockResolvedValue(null); // Force uncached path for test coverage

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({
                imageData: 'base64-data',
                mimeType: 'image/png',
                turnstileToken: 'valid-token',
            }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.title).toBe('Ocean Mermaid Cake');
        expect(mockVerifyTurnstileToken).toHaveBeenCalledWith('valid-token', undefined);
    });
});
