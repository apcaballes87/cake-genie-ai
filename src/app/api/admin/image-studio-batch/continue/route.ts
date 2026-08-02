import { after, NextRequest, NextResponse } from 'next/server';

import { continueImageStudioBatch } from '@/lib/admin/imageStudioBatch';
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

function scheduleNextContinuation(req: NextRequest) {
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
      console.error('[Image Studio Batch] Failed to schedule next continuation:', error);
    }
  });
}

export async function POST(req: NextRequest) {
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return NextResponse.json({ error: verified.error }, { status: verified.status });

  try {
    const response = await continueImageStudioBatch(req);
    if (response.active && !response.waitingForProvider) {
      scheduleNextContinuation(req);
    }
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to continue batch.' }, { status: 500 });
  }
}
