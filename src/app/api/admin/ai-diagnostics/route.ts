import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';
import { getAI, getAIClientDiagnostics } from '@/lib/ai/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest) {
  return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let initializationError: string | null = null;

  try {
    getAI(req);
  } catch (error) {
    initializationError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json({
    diagnostics: getAIClientDiagnostics(req),
    initializationError,
  });
}
