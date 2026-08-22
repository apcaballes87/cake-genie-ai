import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeCreatorPromoCode } from './promoCode';

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
});
