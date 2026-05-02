import { describe, expect, it, vi } from 'vitest';

import {
  inspectExistingSignupDiscount,
  findReusableExistingDiscountCode,
  generateUniqueSignupDiscountCode,
  isDiscountCodeReusable,
} from './signupDiscount';

function createSupabaseMock(handlers: Record<string, () => unknown>) {
  return {
    from(table: string) {
      const handler = handlers[table];
      if (!handler) {
        throw new Error(`Unexpected table: ${table}`);
      }
      return handler();
    },
  };
}

describe('signupDiscount helpers', () => {
  it('rejects codes that have already reached their usage limit', () => {
    expect(
      isDiscountCodeReusable({
        code: 'GENIETEST1',
        is_active: true,
        expires_at: null,
        max_uses: 1,
        times_used: 1,
      })
    ).toBe(false);
  });

  it('ignores newsletter subscriber codes that are missing from discount_codes', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { discount_code: 'GENIESTALE' } })
      .mockResolvedValueOnce({ data: null });

    const supabase = createSupabaseMock({
      cakegenie_newsletter_subscribers: () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      }),
      discount_codes: () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      }),
    });

    await expect(
      findReusableExistingDiscountCode(supabase as never, { email: 'hello@example.com' })
    ).resolves.toBeNull();
  });

  it('returns the subscriber code when the backing discount row is still usable', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { discount_code: 'geniegood' } })
      .mockResolvedValueOnce({
        data: {
          code: 'GENIEGOOD',
          is_active: true,
          expires_at: null,
          max_uses: 1,
          times_used: 0,
        },
      });

    const supabase = createSupabaseMock({
      cakegenie_newsletter_subscribers: () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      }),
      discount_codes: () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      }),
    });

    await expect(
      findReusableExistingDiscountCode(supabase as never, { email: 'hello@example.com' })
    ).resolves.toBe('GENIEGOOD');
  });

  it('blocks reissuing a signup code that has already been used', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { discount_code: 'GENIEUSED' } })
      .mockResolvedValueOnce({
        data: {
          code: 'GENIEUSED',
          is_active: true,
          expires_at: null,
          max_uses: 1,
          times_used: 1,
        },
      });

    const supabase = createSupabaseMock({
      cakegenie_newsletter_subscribers: () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      }),
      discount_codes: () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      }),
    });

    await expect(
      inspectExistingSignupDiscount(supabase as never, { email: 'hello@example.com' })
    ).resolves.toEqual({
      status: 'blocked',
      message: 'This signup discount has already been used.',
    });
  });

  it('keeps retrying until it finds a unique generated code', async () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5);

    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { code: 'GENIEAAAAAAA' } })
      .mockResolvedValueOnce({ data: null });

    const supabase = createSupabaseMock({
      discount_codes: () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      }),
    });

    await expect(generateUniqueSignupDiscountCode(supabase as never)).resolves.toBe('GENIESSSSSSS');

    randomSpy.mockRestore();
  });
});
