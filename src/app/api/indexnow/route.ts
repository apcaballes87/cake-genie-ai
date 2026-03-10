import { NextResponse } from 'next/server';
import { normalizeIndexNowUrls, submitIndexNow } from '@/lib/indexNow';

type IndexNowRequestBody = {
    urls?: string | string[];
    url?: string;
};

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as IndexNowRequestBody;
        const urlInput = body.urls ?? body.url ?? [];
        const urlList = normalizeIndexNowUrls(urlInput);

        if (urlList.length === 0) {
            return NextResponse.json(
                { error: 'At least one valid https://genie.ph URL is required.' },
                { status: 400 }
            );
        }

        const results = await submitIndexNow(urlList);
        const success = results.some((result) => result.ok);

        if (!success) {
            console.warn('IndexNow submission failed for all endpoints:', results);
            return NextResponse.json({ success: false, results }, { status: 502 });
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('IndexNow route error:', error);
        return NextResponse.json(
            { error: 'Failed to submit IndexNow notification.' },
            { status: 500 }
        );
    }
}
