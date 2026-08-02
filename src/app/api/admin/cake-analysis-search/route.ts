import { NextRequest, NextResponse } from 'next/server';

import { normalizeAiRouteError } from '@/lib/ai/routeError';
import {
  CakeAnalysisSearchError,
  replaceCakeAnalysisByHash,
  searchCakeAnalysisResults,
} from '@/lib/admin/cakeAnalysisSearch';
import { adminCorsHeaders, requireChatbotStaff } from '@/lib/chatbot/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

function corsHeaders(req: NextRequest): HeadersInit {
  return adminCorsHeaders(req, ['GET', 'POST']);
}

function json(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const verified = await requireChatbotStaff(req);
  if (!verified.staff) return json(req, { error: verified.error }, verified.status);

  const query = req.nextUrl.searchParams.get('q')?.trim() || '';
  const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 30, 30);
  const offset = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get('offset') || '0', 10) || 0);

  if (!query) {
    return json(req, { data: [], total: 0, query: '', limit, offset });
  }

  try {
    const result = await searchCakeAnalysisResults(query, limit, offset);
    return json(req, { ...result, query, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cake search failed.';
    const status = error instanceof CakeAnalysisSearchError ? error.status : 500;
    return json(req, { error: message }, status);
  }
}

export async function POST(req: NextRequest) {
  const verified = await requireChatbotStaff(req, ['owner', 'admin']);
  if (!verified.staff) return json(req, { error: verified.error }, verified.status);

  try {
    const body = await req.json().catch(() => ({}));
    const pHash = typeof body?.pHash === 'string' ? body.pHash.trim() : '';
    if (!pHash) return json(req, { error: 'Missing required field: pHash' }, 400);

    const item = await replaceCakeAnalysisByHash(pHash, req);
    return json(req, { updated: true, item });
  } catch (error) {
    if (error instanceof CakeAnalysisSearchError) {
      return json(req, { error: error.message }, error.status);
    }

    const normalized = normalizeAiRouteError(error, {
      defaultMessage: 'Failed to re-run AI cake analysis.',
      quotaMessage: 'AI cake analysis is temporarily unavailable due to quota limits. Please try again later.',
      authorizationMessage: 'AI cake analysis is not authorized. Please check the AI provider configuration and try again.',
    });

    return json(req, { error: normalized.message }, normalized.status);
  }
}
