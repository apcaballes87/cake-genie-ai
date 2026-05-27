import { beforeEach, describe, expect, it, vi } from 'vitest';

const { afterMock, runImageStudioJob } = vi.hoisted(() => ({
    afterMock: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
    }),
    runImageStudioJob: vi.fn(),
}));

vi.mock('next/server', async () => {
    const actual = await vi.importActual<typeof import('next/server')>('next/server');
    return {
        ...actual,
        after: afterMock,
    };
});

vi.mock('@/lib/admin/imageStudioJob', () => ({
    runImageStudioJob,
}));

import { POST } from './route';

describe('/api/ai/trigger-studio-edit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runImageStudioJob.mockResolvedValue({
            cacheRow: null,
            durationMs: 123,
            persistedToCacheRow: true,
            publicUrl: 'https://example.com/studio.webp',
            storagePath: 'admin/image-studio/example.webp',
        });
    });

    it('returns 400 when pHash is missing', async () => {
        const response = await POST(
            new Request('http://localhost/api/ai/trigger-studio-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }) as never
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'pHash is required',
        });
        expect(runImageStudioJob).not.toHaveBeenCalled();
    });

    it('runs the legacy cache-row studio job when only pHash is provided', async () => {
        const response = await POST(
            new Request('http://localhost/api/ai/trigger-studio-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pHash: 'abc123',
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        expect(afterMock).toHaveBeenCalledTimes(1);
        expect(runImageStudioJob).toHaveBeenCalledWith(
            expect.objectContaining({
                pHash: 'abc123',
                inlineOriginalImage: null,
                requireExistingRow: true,
                waitForCacheRow: false,
            })
        );
    });

    it('starts the direct-from-upload studio job and waits for the cache row later', async () => {
        const response = await POST(
            new Request('http://localhost/api/ai/trigger-studio-edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pHash: 'def456',
                    originalImage: {
                        data: 'base64-image-data',
                        mimeType: 'image/webp',
                    },
                }),
            }) as never
        );

        expect(response.status).toBe(200);
        expect(afterMock).toHaveBeenCalledTimes(1);
        expect(runImageStudioJob).toHaveBeenCalledWith(
            expect.objectContaining({
                pHash: 'def456',
                inlineOriginalImage: {
                    data: 'base64-image-data',
                    mimeType: 'image/webp',
                },
                requireExistingRow: false,
                waitForCacheRow: true,
            })
        );
    });
});
