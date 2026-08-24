import { describe, expect, it, vi } from 'vitest';
import { handleCreatorApplicationEmail } from './handler';

const environment = {
  resendApiKey: 're_test_key',
  serviceRoleKey: 'legacy-service-role-key',
  secretKeys: JSON.stringify({ default: 'sb_secret_test' }),
};

const serviceRoleToken = 'legacy-service-role-key';
const secretKey = 'sb_secret_test';

const payload = {
  creatorId: '11111111-1111-4111-8111-111111111111',
  name: 'Test Creator',
  recipientEmail: 'creator@example.com',
  bentoCode: 'GENIEBENTO12345678',
  voucherCode: 'GENIE50ABCDEF12',
  referralCode: 'TESTCREATOR',
  referralLink: 'https://genie.ph/TESTCREATOR',
};

const authorizedRequest = (body?: unknown, method = 'POST') => new Request('https://example.supabase.co/functions/v1/send-creator-application-email', {
  method,
  headers: { apikey: secretKey, 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const legacyAuthorizedRequest = (body?: unknown, method = 'GET') => new Request('https://example.supabase.co/functions/v1/send-creator-application-email', {
  method,
  headers: { Authorization: `Bearer ${serviceRoleToken}`, 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('send-creator-application-email handler', () => {
  it('rejects callers without a configured server key', async () => {
    const response = await handleCreatorApplicationEmail(
      new Request('https://example.supabase.co/functions/v1/send-creator-application-email', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      environment,
      vi.fn(),
    );

    expect(response.status).toBe(401);
  });

  it('accepts a Supabase secret key through apikey without a bearer header', async () => {
    const response = await handleCreatorApplicationEmail(authorizedRequest(undefined, 'GET'), environment, vi.fn());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, configured: true });
  });

  it('validates POST payloads before calling Resend', async () => {
    const fetchMock = vi.fn();
    const response = await handleCreatorApplicationEmail(
      authorizedRequest({ ...payload, voucherCode: '<invalid>' }),
      environment,
      fetchMock,
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the requested Resend fields and idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const response = await handleCreatorApplicationEmail(authorizedRequest(payload), environment, fetchMock);
    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(response.status).toBe(200);
    expect(url).toBe('https://api.resend.com/emails');
    expect(request.headers.Authorization).toBe('Bearer re_test_key');
    expect(request.headers['Idempotency-Key']).toBe('creator-application/11111111-1111-4111-8111-111111111111');
    expect(request.headers['User-Agent']).toBe('genie-ph-creator-application-email/1.0');
    expect(body).toMatchObject({
      from: 'Genie PH <orders@mail.genie.ph>',
      to: ['creator@example.com'],
      subject: 'Your Genie.ph Creator UGC Collab Codes',
    });
    expect(body.text).toContain('FREE BENTO CODE: GENIEBENTO12345678');
  });

  it('returns a safe provider failure without exposing the provider response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('secret provider details', { status: 422 }));
    const response = await handleCreatorApplicationEmail(authorizedRequest(payload), environment, fetchMock);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ success: false, error: 'Email provider rejected the message.' });
  });

  it('supports an authenticated no-send health check', async () => {
    const response = await handleCreatorApplicationEmail(legacyAuthorizedRequest(), environment, vi.fn());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, configured: true });
  });
});
