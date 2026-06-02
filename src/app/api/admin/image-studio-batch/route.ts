import { after, NextRequest, NextResponse } from 'next/server';
import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import { getImageStudioBatchHistory, getLatestImageStudioBatch, reconcileImageStudioBatch, submitNextImageStudioBatch } from '@/lib/admin/imageStudioBatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const authorized = (req: NextRequest) => req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${protocol}://${host}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://genie.ph';
}

function scheduleImageStudioContinuation(req: NextRequest) {
  const oidcToken = req.headers.get('x-vercel-oidc-token');
  after(async () => {
    try {
      await fetch(`${getBaseUrl(req)}/api/admin/image-studio-batch/continue`, {
        method: 'POST',
        headers: {
          'x-admin-pin': ADMIN_IMAGE_STUDIO_PIN,
          ...(oidcToken ? { 'x-vercel-oidc-token': oidcToken } : {}),
        },
      });
    } catch (error) {
      console.error('[Image Studio Batch] Failed to schedule continuation:', error);
    }
  });
}

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
    const run = await submitNextImageStudioBatch(body.limit ?? 1000, req);
    scheduleImageStudioContinuation(req);
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to submit batch.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.runId) return NextResponse.json({ error: 'Missing runId.' }, { status: 400 });
    const response = await reconcileImageStudioBatch(body.runId, req);
    scheduleImageStudioContinuation(req);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to reconcile batch.' }, { status: 500 });
  }
}
