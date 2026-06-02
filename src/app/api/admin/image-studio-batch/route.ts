import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import { getImageStudioBatchHistory, getLatestImageStudioBatch, reconcileImageStudioBatch, submitNextImageStudioBatch } from '@/lib/admin/imageStudioBatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const authorized = (req: NextRequest) => req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [run, history] = await Promise.all([
      getLatestImageStudioBatch(),
      getImageStudioBatchHistory(),
    ]);
    return NextResponse.json({ run, history });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load batch.' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ run: await submitNextImageStudioBatch(body.limit ?? 1000, req) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to submit batch.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.runId) return NextResponse.json({ error: 'Missing runId.' }, { status: 400 });
    return NextResponse.json(await reconcileImageStudioBatch(body.runId, req));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to reconcile batch.' }, { status: 500 });
  }
}
