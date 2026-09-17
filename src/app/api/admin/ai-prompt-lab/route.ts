import { NextRequest, NextResponse } from 'next/server';

import {
  AiPromptLabError,
  getAiPromptLabConfiguration,
  runAiPromptLabAnalysis,
} from '@/lib/admin/aiPromptLab';
import { ADMIN_IMAGE_STUDIO_PIN } from '@/lib/admin/imageStudio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Two-step experiments can legitimately make two independent 120-second AI calls.
export const maxDuration = 300;

function corsHeaders(req: NextRequest): HeadersInit {
  const configuredOrigin = process.env.ADMIN_DASHBOARD_ORIGIN?.trim();
  const requestOrigin = req.headers.get('origin');
  const allowedOrigin = configuredOrigin
    ? requestOrigin === configuredOrigin ? requestOrigin : configuredOrigin
    : '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin',
    Vary: 'Origin',
  };
}

function json(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

function authorized(req: NextRequest) {
  return req.headers.get('x-admin-pin') === ADMIN_IMAGE_STUDIO_PIN;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return json(req, { error: 'Unauthorized' }, 401);
  try {
    return json(req, await getAiPromptLabConfiguration());
  } catch (error) {
    console.error('[AI Prompt Lab] Failed to load configuration:', error);
    return json(req, { error: 'Failed to load AI Prompt Lab configuration.' }, 500);
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return json(req, { error: 'Unauthorized' }, 401);
  try {
    const body: unknown = await req.json();
    return json(req, await runAiPromptLabAnalysis(body, req));
  } catch (error) {
    if (error instanceof AiPromptLabError) return json(req, { error: error.message }, error.status);
    console.error('[AI Prompt Lab] Failed to run analysis:', error);
    return json(req, { error: 'Failed to run AI Prompt Lab analysis.' }, 500);
  }
}
