/**
 * IndexNow Service
 * Facilitates instant indexing by notifying search engines of content changes.
 */

import { normalizeIndexNowUrls, submitIndexNow } from '../lib/indexNow';

/**
 * Notifies IndexNow participating search engines of updated URLs.
 * @param urls A single URL or an array of URLs to notify.
 * @returns A promise that resolves when the notification is sent.
 */
export const notifyIndexNow = async (urls: string | string[]): Promise<void> => {
    const urlList = normalizeIndexNowUrls(urls);

    if (urlList.length === 0) return;

    try {
        if (typeof window === 'undefined') {
            const results = await submitIndexNow(urlList);

            results.forEach((result) => {
                if (!result.ok) {
                    console.warn(
                        `IndexNow notification failed for ${result.endpoint}: ${result.status ?? 'ERR'} ${result.statusText ?? result.error ?? ''}`
                    );
                } else {
                    console.log(`IndexNow notification successful for ${result.endpoint}`);
                }
            });

            return;
        }

        const response = await fetch('/api/indexnow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({ urls: urlList }),
            keepalive: true,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.warn(`IndexNow notification failed via /api/indexnow: ${response.status} ${errorText}`);
            return;
        }

        const data = (await response.json().catch(() => null)) as { results?: Array<{ endpoint: string; ok: boolean }> } | null;
        data?.results?.filter((result) => !result.ok).forEach((result) => {
            console.warn(`IndexNow notification failed for ${result.endpoint}`);
        });
    } catch (error) {
        console.error('Error sending IndexNow notification:', error);
    }
};

