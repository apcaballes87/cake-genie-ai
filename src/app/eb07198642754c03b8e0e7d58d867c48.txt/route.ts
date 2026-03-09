import { NextResponse } from 'next/server';

/**
 * IndexNow key verification route.
 * Search engines will request this file to verify ownership of the domain.
 * The filename must match the key, and the content must also be the key.
 */
export const GET = () => {
    const key = 'eb07198642754c03b8e0e7d58d867c48';
    return new NextResponse(key, {
        headers: {
            'Content-Type': 'text/plain',
        },
    });
};
