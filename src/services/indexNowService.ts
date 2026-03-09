/**
 * IndexNow Service
 * Facilitates instant indexing by notifying search engines of content changes.
 */

const INDEXNOW_KEY = 'eb07198642754c03b8e0e7d58d867c48';
const HOST = 'genie.ph';
const ENDPOINTS = [
    'https://www.bing.com/indexnow',
    'https://search.yandex.ru/indexnow',
];

/**
 * Notifies IndexNow participating search engines of updated URLs.
 * @param urls A single URL or an array of URLs to notify.
 * @returns A promise that resolves when the notification is sent.
 */
export const notifyIndexNow = async (urls: string | string[]): Promise<void> => {
    const urlList = Array.isArray(urls) ? urls : [urls];

    if (urlList.length === 0) return;

    const payload = {
        host: HOST,
        key: INDEXNOW_KEY,
        urlList: urlList,
    };

    try {
        const promises = ENDPOINTS.map(async (endpoint) => {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.warn(`IndexNow notification failed for ${endpoint}: ${response.status} ${response.statusText}`);
            } else {
                console.log(`IndexNow notification successful for ${endpoint}`);
            }
        });

        await Promise.allSettled(promises);
    } catch (error) {
        console.error('Error sending IndexNow notification:', error);
    }
};
