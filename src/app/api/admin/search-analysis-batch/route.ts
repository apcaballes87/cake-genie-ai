import { NextRequest, NextResponse } from 'next/server';

import {
  getLatestSearchAnalysisBatch,
  queueSearchAnalysisItem,
  reconcileSearchAnalysisBatch,
  submitNextSearchAnalysisBatch,
} from '@/lib/admin/searchAnalysisBatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const authorized = (req: NextRequest) => req.headers.get('x-admin-pin') === '231323';

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ run: await getLatestSearchAnalysisBatch() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load batch.' }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ item: await queueSearchAnalysisItem(await req.json()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to queue item.' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ run: await submitNextSearchAnalysisBatch(body.limit ?? 1000) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to submit batch.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.runId) return NextResponse.json({ error: 'Missing runId.' }, { status: 400 });
    return NextResponse.json(await reconcileSearchAnalysisBatch(body.runId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to reconcile batch.' }, { status: 500 });
  }
}
