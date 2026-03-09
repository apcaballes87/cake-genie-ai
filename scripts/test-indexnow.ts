import { notifyIndexNow } from '../src/services/indexNowService';

/**
 * Verification script for IndexNow.
 * Tests if the notification service can be called.
 */
async function verify() {
    console.log('--- IndexNow Verification ---');

    const testUrl = 'https://genie.ph/customizing/test-slug-123';
    console.log(`Sending test notification for: ${testUrl}`);

    try {
        // We're just testing the function call and internal logic
        // The actual HTTP request to Bing will be made, but we'll log the response status
        await notifyIndexNow(testUrl);
        console.log('Verification script finished.');
    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verify();
