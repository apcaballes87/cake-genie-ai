import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeCreatorPromoCode } from './promoCode';

const { createClientMock, rpcMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

const originalCreatorEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

afterEach(() => {
  if (originalCreatorEnv.supabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalCreatorEnv.supabaseUrl;

  if (originalCreatorEnv.serviceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalCreatorEnv.serviceKey;

  vi.resetModules();
  createClientMock.mockReset();
  rpcMock.mockReset();
});

describe('creator promo codes', () => {
  it('normalizes handles and editable codes to uppercase alphanumeric values', () => {
    expect(normalizeCreatorPromoCode('@rawan.ph!')).toBe('RAWANPH');
    expect(normalizeCreatorPromoCode('My Custom-Code')).toBe('MYCUSTOMCODE');
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
  });
});
