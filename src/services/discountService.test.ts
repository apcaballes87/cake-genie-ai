import { beforeEach, describe, expect, it, vi } from 'vitest';

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => supabaseMock,
}));

import { validateDiscountCode } from './discountService';

const USER_ID = '10d6ca37-6ceb-4207-8d60-2ff09d703abc';
const CODE_ID = 'b1eb725d-32c9-4d6f-a806-31f72d2bc2ae';

const discountCode = {
  code_id: CODE_ID,
  code: 'WELCOME10',
  is_active: true,
  expires_at: null,
  max_uses: null,
  times_used: 0,
  minimum_order_amount: null,
  user_id: null,
  one_per_user: false,
  new_users_only: true,
  discount_percentage: 10 as number | null,
  discount_amount: null as number | null,
  max_discount_amount: null as number | null,
  applies_to_cake_types: null as string[] | null,
  free_delivery: false,
};

function discountCodeQuery(overrides: Partial<typeof discountCode> = {}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { ...discountCode, ...overrides }, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function orderHistoryQuery(count: number) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn().mockResolvedValue({ count, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function usageQuery(count: number) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.eq.mockImplementationOnce(() => query).mockResolvedValueOnce({ count, error: null });
  return query;
}

describe('validateDiscountCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, is_anonymous: false } },
    });
  });

  it('allows a new-user code after a pending checkout and filters history to settled payments', async () => {
    const codeQuery = discountCodeQuery();
    const ordersQuery = orderHistoryQuery(0);
    supabaseMock.from.mockReturnValueOnce(codeQuery).mockReturnValueOnce(ordersQuery);

    const result = await validateDiscountCode('welcome10', 1000);

    expect(result.valid).toBe(true);
    expect(ordersQuery.in).toHaveBeenCalledWith('payment_status', ['paid', 'partial', 'refunded']);
  });

  it('rejects a new-user code after a settled payment', async () => {
    supabaseMock.from
      .mockReturnValueOnce(discountCodeQuery())
      .mockReturnValueOnce(orderHistoryQuery(1));

    const result = await validateDiscountCode('welcome10', 1000);

    expect(result).toMatchObject({
      valid: false,
      message: 'This code is only for new customers',
    });
  });

  it('keeps one-per-user enforcement based on completed usage rows', async () => {
    const codeQuery = discountCodeQuery({ new_users_only: false, one_per_user: true });
    const usage = usageQuery(1);
    supabaseMock.from.mockReturnValueOnce(codeQuery).mockReturnValueOnce(usage);

    const result = await validateDiscountCode('welcome10', 1000);

    expect(result).toMatchObject({
      valid: false,
      message: 'You have already used this discount code',
    });
    expect(usage.eq).toHaveBeenNthCalledWith(1, 'discount_code_id', CODE_ID);
    expect(usage.eq).toHaveBeenNthCalledWith(2, 'user_id', USER_ID);
  });

  it('caps a percentage discount at its configured maximum', async () => {
    const codeQuery = discountCodeQuery({ discount_percentage: 50, max_discount_amount: 1500, new_users_only: false });
    supabaseMock.from.mockReturnValueOnce(codeQuery);

    const result = await validateDiscountCode('welcome10', 4000);

    expect(result).toMatchObject({
      valid: true,
      discountAmount: 1500,
      finalAmount: 2500,
    });
  });

  it('uses the eligible subtotal for cake-type-scoped codes', async () => {
    const codeQuery = discountCodeQuery({
      discount_percentage: 100,
      applies_to_cake_types: ['Bento'],
      new_users_only: false,
    });
    supabaseMock.from.mockReturnValueOnce(codeQuery);

    const result = await validateDiscountCode('welcome10', 2000, {
      eligibleSubtotal: 650,
    });

    expect(result).toMatchObject({
      valid: true,
      discountAmount: 650,
      originalAmount: 2000,
      finalAmount: 1350,
    });
  });

  it('validates private creator codes through the sanitized RPC', async () => {
    const missingCodeQuery = discountCodeQuery();
    missingCodeQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    supabaseMock.from.mockReturnValueOnce(missingCodeQuery);
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{
        valid: true,
        code_id: CODE_ID,
        discount_amount: 1500,
        original_amount: 4000,
        final_amount: 2500,
        message: 'Discount code applied successfully!',
        free_delivery: false,
        discount_type: 'percentage',
        discount_value: 50,
      }],
      error: null,
    });

    const result = await validateDiscountCode('GENIE50ABC123', 4000, {
      email: 'creator@example.com',
    });

    expect(result).toMatchObject({
      valid: true,
      discountAmount: 1500,
      finalAmount: 2500,
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('validate_creator_discount_code', expect.objectContaining({
      p_code: 'GENIE50ABC123',
      p_email: 'creator@example.com',
    }));
  });
});
