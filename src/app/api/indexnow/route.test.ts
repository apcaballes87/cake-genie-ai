import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/indexNow', () => ({
    normalizeIndexNowUrls: vi.fn(),
    submitIndexNow: vi.fn(),
}));

import { POST } from './route';
import { normalizeIndexNowUrls, submitIndexNow } from '@/lib/indexNow';

describe('/api/indexnow', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns 400 when no valid URLs are provided', async () => {
        vi.mocked(normalizeIndexNowUrls).mockReturnValue([]);

        const response = await POST(
            new Request('http://localhost/api/indexnow', {
                method: 'POST',
                body: JSON.stringify({ urls: ['https://example.com/nope'] }),
                headers: { 'Content-Type': 'application/json' },
            })
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'At least one valid https://genie.ph URL is required.',
        });
    });

    it('returns success when at least one endpoint succeeds', async () => {
        vi.mocked(normalizeIndexNowUrls).mockReturnValue(['https://genie.ph/customizing/cake-1']);
        vi.mocked(submitIndexNow).mockResolvedValue([
            { endpoint: 'https://www.bing.com/indexnow', ok: true, status: 200, statusText: 'OK' },
        ]);

        const response = await POST(
            new Request('http://localhost/api/indexnow', {
                method: 'POST',
                body: JSON.stringify({ urls: ['https://genie.ph/customizing/cake-1'] }),
                headers: { 'Content-Type': 'application/json' },
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            results: [
                { endpoint: 'https://www.bing.com/indexnow', ok: true, status: 200, statusText: 'OK' },
            ],
        });
    });
});
