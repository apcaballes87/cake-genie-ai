import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeCreatorPromoCode } from './promoCode';

const { createClientMock, rpcMock, emailFetchMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  rpcMock: vi.fn(),
  emailFetchMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

const originalCreatorEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  applicationsOpen: process.env.NEXT_PUBLIC_CREATOR_APPLICATIONS_OPEN,
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_CREATOR_APPLICATIONS_OPEN = 'true';
});

afterEach(() => {
  if (originalCreatorEnv.supabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalCreatorEnv.supabaseUrl;

  if (originalCreatorEnv.serviceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalCreatorEnv.serviceKey;

  if (originalCreatorEnv.applicationsOpen === undefined) delete process.env.NEXT_PUBLIC_CREATOR_APPLICATIONS_OPEN;
  else process.env.NEXT_PUBLIC_CREATOR_APPLICATIONS_OPEN = originalCreatorEnv.applicationsOpen;

  vi.resetModules();
  createClientMock.mockReset();
  rpcMock.mockReset();
  emailFetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('creator promo codes', () => {
  it('normalizes handles and editable codes to uppercase alphanumeric values', () => {
    expect(normalizeCreatorPromoCode('@rawan.ph!')).toBe('RAWANPH');
    expect(normalizeCreatorPromoCode('My Custom-Code')).toBe('MYCUSTOMCODE');
  });

  it('blocks creator applications while the program is closed without touching Supabase', async () => {
    process.env.NEXT_PUBLIC_CREATOR_APPLICATIONS_OPEN = 'false';

    const { submitCreatorApplication } = await import('./actions');
    const result = await submitCreatorApplication({
      name: 'Test Creator',
      email: 'creator@example.com',
      contact_number: '09170000000',
      address: 'Cebu City',
      content_niche: 'Food',
      tiktok_handle: '@testcreator',
      promo_code: 'TESTCREATOR',
      agreed_to_terms: true,
    });

    expect(result).toEqual({
      success: false,
      error: 'We’re already full for the Xdeal Collab Program for September. We’ll open applications again next month for October. You’ll be the first to know when applications open—we’ll message and email you.',
      code: 'PROGRAM_CLOSED',
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(emailFetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['the server Supabase URL is missing', undefined, 'test-service-role-key'],
    ['the server Supabase service key is missing', 'https://example.supabase.co', undefined],
    ['the server Supabase URL is invalid', 'not-a-url', 'test-service-role-key'],
  ])('returns a friendly failure when %s', async (_caseName, supabaseUrl, serviceKey) => {
    if (supabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;

    if (serviceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

    if (supabaseUrl === 'not-a-url') {
      createClientMock.mockImplementation(() => {
        throw new Error('Invalid supabaseUrl');
      });
    }

    const { submitCreatorApplication } = await import('./actions');
    const result = await submitCreatorApplication({
      name: 'Test Creator',
      email: 'creator@example.com',
      contact_number: '09170000000',
      address: 'Cebu City',
      content_niche: 'Food',
      tiktok_handle: '@testcreator',
      promo_code: 'TESTCREATOR',
      agreed_to_terms: true,
    });

    expect(result).toEqual({
      success: false,
      error: 'Creator applications are temporarily unavailable.',
      code: 'DATABASE_ERROR',
    });
  });

  it('converts an unavailable creator RPC into a clear failure result', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    createClientMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.submit_creator_application',
        details: null,
        hint: null,
      },
    });

    const { submitCreatorApplication } = await import('./actions');
    const result = await submitCreatorApplication({
      name: 'Test Creator',
      email: 'creator@example.com',
      contact_number: '09170000000',
      address: 'Cebu City',
      content_niche: 'Food',
      tiktok_handle: '@testcreator',
      promo_code: 'TESTCREATOR',
      agreed_to_terms: true,
    });

    expect(result).toEqual({
      success: false,
      error: 'Creator applications are temporarily unavailable. Please try again later.',
      code: 'DATABASE_ERROR',
    });
    expect(emailFetchMock).not.toHaveBeenCalled();
  });

  it('maps missing pgcrypto function resolution to a temporary-unavailable result', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    createClientMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '42883',
        message: 'function gen_random_bytes(integer) does not exist',
        details: null,
        hint: 'No function matches the given name and argument types.',
      },
    });

    const { submitCreatorApplication } = await import('./actions');
    const result = await submitCreatorApplication({
      name: 'Test Creator',
      email: 'creator@example.com',
      contact_number: '09170000000',
      address: 'Cebu City',
      content_niche: 'Food',
      tiktok_handle: '@testcreator',
      promo_code: 'TESTCREATOR',
      agreed_to_terms: true,
    });

    expect(result).toEqual({
      success: false,
      error: 'Creator applications are temporarily unavailable. Please try again later.',
      code: 'DATABASE_ERROR',
    });
  });

  it('sends the generated codes to the creator email after the RPC succeeds', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    createClientMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({
      data: [{
        creator_id: '11111111-1111-4111-8111-111111111111',
        referral_code: 'TESTCREATOR',
        bento_code: 'GENIEBENTO12345678',
        voucher_code: 'GENIE50ABCDEF12',
      }],
      error: null,
    });
    vi.stubGlobal('fetch', emailFetchMock);
    emailFetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, emailId: 'email-123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { submitCreatorApplication } = await import('./actions');
    const result = await submitCreatorApplication({
      name: 'Test Creator',
      email: 'Creator@Example.com',
      contact_number: '09170000000',
      address: 'Cebu City',
      content_niche: 'Food',
      tiktok_handle: '@testcreator',
      promo_code: 'TESTCREATOR',
      agreed_to_terms: true,
    });

    expect(result).toEqual({
      success: true,
      creatorId: '11111111-1111-4111-8111-111111111111',
      referralCode: 'TESTCREATOR',
      bentoCode: 'GENIEBENTO12345678',
      voucherCode: 'GENIE50ABCDEF12',
    });
    expect(emailFetchMock).toHaveBeenCalledWith('https://example.supabase.co/functions/v1/send-creator-application-email', {
      method: 'POST',
      headers: {
        apikey: 'test-service-role-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creatorId: '11111111-1111-4111-8111-111111111111',
        name: 'Test Creator',
        recipientEmail: 'creator@example.com',
        bentoCode: 'GENIEBENTO12345678',
        voucherCode: 'GENIE50ABCDEF12',
        referralCode: 'TESTCREATOR',
        referralLink: 'https://genie.ph/TESTCREATOR',
      }),
    });
  });

  it('keeps the application successful when email delivery fails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    createClientMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({
      data: [{
        creator_id: '22222222-2222-4222-8222-222222222222',
        referral_code: 'EMAILFAIL',
        bento_code: 'GENIEBENTO12345678',
        voucher_code: 'GENIE50ABCDEF12',
      }],
      error: null,
    });
    vi.stubGlobal('fetch', emailFetchMock);
    emailFetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Edge Function unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { submitCreatorApplication } = await import('./actions');
    const result = await submitCreatorApplication({
      name: 'Test Creator',
      email: 'creator@example.com',
      contact_number: '09170000000',
      address: 'Cebu City',
      content_niche: 'Food',
      tiktok_handle: '@testcreator',
      promo_code: 'EMAILFAIL',
      agreed_to_terms: true,
    });

    expect(result).toMatchObject({
      success: true,
      creatorId: '22222222-2222-4222-8222-222222222222',
    });
    expect(emailFetchMock).toHaveBeenCalledTimes(1);
  });
});
