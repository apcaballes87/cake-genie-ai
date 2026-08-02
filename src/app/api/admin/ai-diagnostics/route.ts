import { NextRequest, NextResponse } from 'next/server';

import { getAI, getAIClientDiagnostics } from '@/lib/ai/client';
import { requireChatbotStaff } from '@/lib/chatbot/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return NextResponse.json({ error: verified.error }, { status: verified.status });

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
