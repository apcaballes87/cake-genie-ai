import { NextResponse } from 'next/server';
import { runSeoBatchWorker } from '@/lib/seo/seoBatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    return NextResponse.json(await runSeoBatchWorker(request));
  } catch (error) {
    console.error('[SEO batch]', error);
    return NextResponse.json({ error: 'SEO batch processing failed; inspect server logs.' }, { status: 500 });
  }
}
