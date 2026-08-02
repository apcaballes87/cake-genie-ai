import { NextRequest, NextResponse } from 'next/server';

import {
  getLatestSearchAnalysisBatch,
  getSearchAnalysisBatchHistory,
  queueSearchAnalysisItem,
  reconcileSearchAnalysisBatch,
  submitNextSearchAnalysisBatch,
} from '@/lib/admin/searchAnalysisBatch';
import { requireChatbotStaff } from '@/lib/chatbot/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return NextResponse.json({ error: verified.error }, { status: verified.status });
  try {
    const [run, history] = await Promise.all([
      getLatestSearchAnalysisBatch(),
      getSearchAnalysisBatchHistory(),
    ]);
    return NextResponse.json({ run, history });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load batch.' }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return NextResponse.json({ error: verified.error }, { status: verified.status });
  try { return NextResponse.json({ item: await queueSearchAnalysisItem(await req.json()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to queue item.' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return NextResponse.json({ error: verified.error }, { status: verified.status });
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ run: await submitNextSearchAnalysisBatch(body.limit ?? 1000, req) });
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
    return NextResponse.json(await reconcileSearchAnalysisBatch(body.runId, req));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to reconcile batch.' }, { status: 500 });
  }
}
