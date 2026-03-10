const INDEXNOW_KEY = 'eb07198642754c03b8e0e7d58d867c48';
const INDEXNOW_HOST = 'genie.ph';
const INDEXNOW_ENDPOINTS = [
    'https://www.bing.com/indexnow',
    'https://search.yandex.ru/indexnow',
] as const;

export interface IndexNowResult {
    endpoint: string;
    ok: boolean;
    status?: number;
    statusText?: string;
    error?: string;
}

export const normalizeIndexNowUrls = (urls: string | string[]): string[] => {
    const urlList = Array.isArray(urls) ? urls : [urls];

    return Array.from(
        new Set(
            urlList
                .map((url) => url.trim())
                .filter(Boolean)
                .filter((url) => {
                    try {
                        const parsedUrl = new URL(url);
                        return parsedUrl.protocol === 'https:' && parsedUrl.hostname === INDEXNOW_HOST;
                    } catch {
                        return false;
                    }
                })
        )
    );
};

export const submitIndexNow = async (urls: string | string[]): Promise<IndexNowResult[]> => {
    const urlList = normalizeIndexNowUrls(urls);

    if (urlList.length === 0) return [];

    const payload = {
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
        urlList,
    };

    const results = await Promise.allSettled(
        INDEXNOW_ENDPOINTS.map(async (endpoint) => {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify(payload),
            });

            return {
                endpoint,
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
            } satisfies IndexNowResult;
        })
    );

    return results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }

        return {
            endpoint: INDEXNOW_ENDPOINTS[index],
            ok: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        } satisfies IndexNowResult;
    });
};
