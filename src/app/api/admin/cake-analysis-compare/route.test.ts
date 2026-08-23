import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRunCakeAnalysisWithVersion = vi.fn();

vi.mock('@/lib/admin/promptComparison', () => ({
    PromptComparisonError: class PromptComparisonError extends Error {
        status: number;
        constructor(message: string, status: number) {
            super(message);
            this.status = status;
        }
    },
    runCakeAnalysisWithVersion: (...args: unknown[]) => mockRunCakeAnalysisWithVersion(...args),
}));

vi.mock('@/lib/ai/routeError', () => ({
    normalizeAiRouteError: (error: unknown) => ({
        message: error instanceof Error ? error.message : 'AI error',
        status: 500,
    }),
}));

vi.mock('@/lib/admin/imageStudio', () => ({
    ADMIN_IMAGE_STUDIO_PIN: '231323',
}));

describe('/api/admin/cake-analysis-compare', () => {
    beforeEach(() => {
        vi.resetModules();
        mockRunCakeAnalysisWithVersion.mockReset();
    });

    it('rejects requests without the admin pin', async () => {
        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/admin/cake-analysis-compare', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pHash: 'abc', promptVersion: '3.35' }),
        }));

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Unauthorized' });
        expect(mockRunCakeAnalysisWithVersion).not.toHaveBeenCalled();
    });

    it('requires a pHash', async () => {
        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/admin/cake-analysis-compare', {
            method: 'POST',
            headers: { 'x-admin-pin': '231323', 'content-type': 'application/json' },
            body: JSON.stringify({ promptVersion: '3.35' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Missing required field: pHash' });
        expect(mockRunCakeAnalysisWithVersion).not.toHaveBeenCalled();
    });

    it('requires a promptVersion', async () => {
        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/admin/cake-analysis-compare', {
            method: 'POST',
            headers: { 'x-admin-pin': '231323', 'content-type': 'application/json' },
            body: JSON.stringify({ pHash: 'abc' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Missing required field: promptVersion' });
        expect(mockRunCakeAnalysisWithVersion).not.toHaveBeenCalled();
    });

    it('returns the comparison result on success', async () => {
        const mockResult = {
            p_hash: 'abc',
            slug: 'birthday-cake',
            analysis_json: { cakeType: '2 Tier' },
            price: 1399,
            prompt_version: '3.35',
            is_rejected: false,
        };
        mockRunCakeAnalysisWithVersion.mockResolvedValue(mockResult);

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/admin/cake-analysis-compare', {
            method: 'POST',
            headers: { 'x-admin-pin': '231323', 'content-type': 'application/json' },
            body: JSON.stringify({ pHash: 'abc', promptVersion: '3.35' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(mockResult);
        expect(mockRunCakeAnalysisWithVersion).toHaveBeenCalledWith('abc', '3.35', request);
    });

    it('returns the PromptComparisonError status when a known error is thrown', async () => {
        const mod = await import('@/lib/admin/promptComparison');
        mockRunCakeAnalysisWithVersion.mockRejectedValue(
            new mod.PromptComparisonError('No cache row exists for this cake item.', 404),
        );

        const { POST } = await import('./route');
        const request = new NextRequest('http://localhost/api/admin/cake-analysis-compare', {
            method: 'POST',
            headers: { 'x-admin-pin': '231323', 'content-type': 'application/json' },
            body: JSON.stringify({ pHash: 'abc', promptVersion: '3.35' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'No cache row exists for this cake item.' });
    });
});
