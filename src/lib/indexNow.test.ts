import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { normalizeIndexNowUrls, submitIndexNow } from './indexNow';

describe('indexNow helpers', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('normalizes, filters, and deduplicates URLs', () => {
        expect(
            normalizeIndexNowUrls([
                'https://genie.ph/customizing/cake-1',
                ' https://genie.ph/customizing/cake-1 ',
                'http://genie.ph/customizing/cake-2',
                'https://www.genie.ph/customizing/cake-3',
                'not-a-url',
            ])
        ).toEqual(['https://genie.ph/customizing/cake-1']);
    });

    it('submits the normalized payload to all IndexNow endpoints', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200, statusText: 'OK' }));

        const results = await submitIndexNow('https://genie.ph/customizing/cake-1');

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenNthCalledWith(
            1,
            'https://www.bing.com/indexnow',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    host: 'genie.ph',
                    key: 'eb07198642754c03b8e0e7d58d867c48',
                    keyLocation: 'https://genie.ph/eb07198642754c03b8e0e7d58d867c48.txt',
                    urlList: ['https://genie.ph/customizing/cake-1'],
                }),
            })
        );
        expect(results).toEqual([
            {
                endpoint: 'https://www.bing.com/indexnow',
                ok: true,
                status: 200,
                statusText: 'OK',
            },
            {
                endpoint: 'https://search.yandex.ru/indexnow',
                ok: true,
                status: 200,
                statusText: 'OK',
            },
        ]);
    });
});
