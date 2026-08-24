import { corsHeaders } from '../_shared/cors.ts';
import {
  buildResendEmailRequest,
  validateCreatorApplicationEmailPayload,
} from './email.ts';

export type CreatorApplicationEmailEnvironment = {
  resendApiKey: string;
  serviceRoleKey?: string;
  secretKeys?: string;
  authenticated?: boolean;
};

type FetchLike = typeof fetch;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getBearerToken(request: Request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

function getConfiguredSecretKeys(secretKeys: string | undefined) {
  if (!secretKeys) return [];

  try {
    const parsed = JSON.parse(secretKeys) as unknown;
    if (!parsed || typeof parsed !== 'object') return [];
    return Object.values(parsed).filter((value): value is string => typeof value === 'string' && value.length > 0);
  } catch {
    return [];
  }
}

function isAuthorizedRequest(request: Request, environment: CreatorApplicationEmailEnvironment) {
  const apiKey = request.headers.get('apikey')?.trim();
  const bearerToken = getBearerToken(request)?.trim();
  const configuredKeys = [
    environment.serviceRoleKey,
    ...getConfiguredSecretKeys(environment.secretKeys),
  ].filter((value): value is string => Boolean(value));

  return [apiKey, bearerToken].some((candidate) => candidate && configuredKeys.includes(candidate));
}

export async function handleCreatorApplicationEmail(
  request: Request,
  environment: CreatorApplicationEmailEnvironment,
  fetchImpl: FetchLike = fetch,
) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!environment.authenticated && !isAuthorizedRequest(request, environment)) {
    return jsonResponse({ success: false, error: 'Unauthorized.' }, 401);
  }

  if (request.method === 'GET') {
    return jsonResponse({ success: true, configured: Boolean(environment.resendApiKey) }, 200);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
  }

  if (!environment.resendApiKey) {
    return jsonResponse({ success: false, error: 'Email provider is not configured.' }, 500);
  }

  let payload;
  try {
    payload = validateCreatorApplicationEmailPayload(await request.json());
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid email request.',
    }, 400);
  }

  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${environment.resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `creator-application/${payload.creatorId}`,
        'User-Agent': 'genie-ph-creator-application-email/1.0',
      },
      body: JSON.stringify(buildResendEmailRequest(payload)),
    });

    if (!response.ok) {
      console.error('Resend rejected creator application email:', {
        creatorId: payload.creatorId,
        status: response.status,
      });
      return jsonResponse({ success: false, error: 'Email provider rejected the message.' }, 502);
    }

    const result = await response.json().catch(() => ({}));
    return jsonResponse({ success: true, emailId: result?.id || null }, 200);
  } catch (error) {
    console.error('Creator application email request failed:', {
      creatorId: payload.creatorId,
      message: error instanceof Error ? error.message : 'Unknown Resend request error',
    });
    return jsonResponse({ success: false, error: 'Email provider request failed.' }, 502);
  }
}
