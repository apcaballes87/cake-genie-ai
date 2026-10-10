import { NextResponse } from 'next/server';
import { syncOpenAIAdsCatalog } from '@/lib/openaiAds/feedSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    return NextResponse.json(await syncOpenAIAdsCatalog());
  } catch (error) {
    console.error('[OpenAI Ads catalog sync]', error instanceof Error ? error.message : 'sync failed');
    return NextResponse.json(
      { error: 'OpenAI Ads catalog sync failed; check server configuration and logs.' },
      { status: 500 },
    );
  }
}
