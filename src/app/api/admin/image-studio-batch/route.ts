import { after, NextRequest, NextResponse } from 'next/server';
import { getImageStudioBatchHistory, getLatestImageStudioBatch, reconcileImageStudioBatch, submitNextImageStudioBatch } from '@/lib/admin/imageStudioBatch';
import { forwardStaffAuthHeaders, requireChatbotStaff } from '@/lib/chatbot/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${protocol}://${host}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://genie.ph';
}

function scheduleImageStudioContinuation(req: NextRequest) {
  const oidcToken = req.headers.get('x-vercel-oidc-token');
  const staffAuthHeaders = forwardStaffAuthHeaders(req);
  after(async () => {
    try {
      await fetch(`${getBaseUrl(req)}/api/admin/image-studio-batch/continue`, {
        method: 'POST',
        headers: {
          ...staffAuthHeaders,
          ...(oidcToken ? { 'x-vercel-oidc-token': oidcToken } : {}),
        },
      });
    } catch (error) {
      console.error('[Image Studio Batch] Failed to schedule continuation:', error);
    }
  });
}

export async function GET(req: NextRequest) {
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return NextResponse.json({ error: verified.error }, { status: verified.status });
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
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return NextResponse.json({ error: verified.error }, { status: verified.status });
  try {
    const body = await req.json().catch(() => ({}));
    const selectionMode = body.selectionMode === 'completed' ? 'completed' : 'pending';
    const offset = Number.isFinite(Number(body.offset)) ? Math.max(0, Number(body.offset)) : 0;
    const run = await submitNextImageStudioBatch(body.limit ?? 1000, req, {
      selectionMode,
      offset,
    });
    scheduleImageStudioContinuation(req);
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to submit batch.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return NextResponse.json({ error: verified.error }, { status: verified.status });
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
