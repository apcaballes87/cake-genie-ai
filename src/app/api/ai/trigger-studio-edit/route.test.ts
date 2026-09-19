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

    it('does not run a cache-row studio job while upload image editing is disabled', async () => {
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
        await expect(response.json()).resolves.toMatchObject({ success: true, skipped: true });
        expect(afterMock).not.toHaveBeenCalled();
        expect(runImageStudioJob).not.toHaveBeenCalled();
    });

    it('does not run a direct-from-upload studio job while image editing is disabled', async () => {
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
        await expect(response.json()).resolves.toMatchObject({ success: true, skipped: true });
        expect(afterMock).not.toHaveBeenCalled();
        expect(runImageStudioJob).not.toHaveBeenCalled();
    });
});
