import { NextResponse } from 'next/server';
import { runDelayedImageStudioWorker } from '@/lib/admin/delayedImageStudio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const configuredLimit = Number(process.env.DELAYED_STUDIO_BATCH_LIMIT || '100');
    return NextResponse.json(await runDelayedImageStudioWorker(request, {
      limit: Number.isFinite(configuredLimit) ? configuredLimit : 100,
    }));
  } catch (error) {
    console.error('[Delayed Studio batch]', error);
    return NextResponse.json(
      { error: 'Delayed Studio processing failed; inspect server logs.' },
      { status: 500 },
    );
  }
}
