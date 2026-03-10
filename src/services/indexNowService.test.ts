import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyIndexNow } from './indexNowService';

describe('notifyIndexNow', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('posts valid URLs to the internal API route in the browser', async () => {
        vi.mocked(fetch).mockResolvedValue(
            new Response(JSON.stringify({ success: true, results: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        await notifyIndexNow([
            'https://genie.ph/customizing/cake-1',
            'https://example.com/not-allowed',
        ]);

        expect(fetch).toHaveBeenCalledWith(
            '/api/indexnow',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    urls: ['https://genie.ph/customizing/cake-1'],
                }),
                keepalive: true,
            })
        );
    });
});
