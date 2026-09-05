import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

        const productSlugs = urlList.flatMap((url) => {
            const match = new URL(url).pathname.match(/^\/customizing\/([^/]+)\/?$/);
            return match ? [decodeURIComponent(match[1])] : [];
        });
        let publishedSlugs = new Set<string>();
        if (productSlugs.length) {
            const supabase = await createClient();
            const { data, error } = await supabase.from('cakegenie_analysis_cache')
                .select('slug').eq('seo_status', 'published').in('slug', productSlugs);
            if (error) throw error;
            publishedSlugs = new Set((data || []).map(row => row.slug));
        }
        const eligibleUrls = urlList.filter(url => {
            const match = new URL(url).pathname.match(/^\/customizing\/([^/]+)\/?$/);
            return !match || publishedSlugs.has(decodeURIComponent(match[1]));
        });
        if (!eligibleUrls.length) {
            return NextResponse.json({ error: 'No published URLs are eligible.' }, { status: 400 });
        }
        const results = await submitIndexNow(eligibleUrls);
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
