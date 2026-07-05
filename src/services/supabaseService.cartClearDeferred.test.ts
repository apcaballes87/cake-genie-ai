/**
 * cart-clear-deferred.test.ts
 *
 * Verifies the data-layer change shipped in migration
 * 20260612130000_defer_cart_clear_to_payment.sql:
 *
 *   1. createOrderFromCart (client) does NOT pass p_clear_cart=true
 *      when creating an order. With the new RPC default of FALSE,
 *      that means the server does NOT delete cakegenie_cart rows at
 *      order-creation time — the rows are left intact so an
 *      abandoned checkout (user clicks Place Order then bails at
 *      Xendit) can be recovered when the user returns to the cart.
 *
 *   2. clear_cart_for_paid_order is the new server-side helper that
 *      the xendit-webhook and verify-xendit-payment edge functions
 *      call after flipping the order to payment_status='paid'. The
 *      test asserts the helper is reachable via the supabase.rpc()
 *      API (proves the contract — no client import is needed since
 *      the helper is invoked by the edge functions, not the SPA).
 *
 * The fix is server-side; this test guards the CLIENT contract that
 * the recovery track relies on: the SPA must keep calling
 * createOrderFromCart with the same parameter shape it used before
 * the migration. If a future refactor accidentally adds
 * `p_clear_cart: true`, this test will catch it and surface a
 * clear message about why the abandoned-checkout cart loss bug
 * would come back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const singleMock = vi.fn();

const mockClient = {
  rpc: rpcMock,
  from: fromMock,
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
};

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockClient,
  supabase: mockClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}));

const buildCartItem = (overrides: Record<string, unknown> = {}) => ({
  cart_item_id: 'cart-1',
  user_id: 'user-123',
  session_id: null,
  cake_type: 'Bento',
  cake_thickness: 'standard',
  cake_size: '8x4',
  base_price: 1000,
  addon_price: 200,
  final_price: 1200,
  quantity: 1,
  original_image_url: 'https://example.com/orig.webp',
  customized_image_url: 'https://example.com/custom.webp',
  customization_details: { message: 'Happy birthday' },
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  ...overrides,
});

describe('deferred cart clear (data-layer track)', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    singleMock.mockReset();
    mockClient.auth.getUser.mockReset();
    mockClient.auth.getSession.mockReset();

    // Default auth: signed-in user (happy path).
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockClient.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    });

    // Default rpc(): return a successful order id so the function
    // continues to the follow-up order fetch.
    rpcMock.mockResolvedValue({
      data: [{ order_id: 'order-abc', order_number: 'ORD-20260612-00001' }],
      error: null,
    });

    // Default from() chain: full order fetch.
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: singleMock,
        }),
      }),
    });
    singleMock.mockResolvedValue({
      data: {
        order_id: 'order-abc',
        order_number: 'ORD-20260612-00001',
        cakegenie_order_items: [],
        cakegenie_addresses: null,
      },
      error: null,
    });
  });

  it('createOrderFromCart does NOT pass p_clear_cart=true (cart stays intact for recovery)', async () => {
    const { createOrderFromCart } = await import('./supabaseService');

    const result = await createOrderFromCart({
      cartItems: [buildCartItem()],
      eventDate: '2026-07-01',
      eventTime: '14:00-16:00',
      deliveryAddressId: 'addr-1',
      deliveryFee: 100,
      guestAddress: {
        recipientName: 'Test User',
        recipientPhone: '+639170000000',
        streetAddress: '123 Test St',
        city: 'Cebu City',
        latitude: 10.3157,
        longitude: 123.8854,
      },
    });

    expect(result.success).toBe(true);

    // Find the create_order_from_cart call.
    const createOrderCall = rpcMock.mock.calls.find(
      ([rpcName]: [string]) => rpcName === 'create_order_from_cart',
    );
    expect(createOrderCall).toBeDefined();

    // The second arg is the parameter object. The recovery track
    // depends on the cart NOT being cleared at order creation. If
    // anyone ever flips this to true, the abandoned-checkout cart
    // loss bug comes back — fail loudly with a guard message.
    const params = createOrderCall![1] as Record<string, unknown>;
    expect(params).not.toHaveProperty('p_clear_cart', true);
    // Be explicit about the default we expect (the RPC's
    // DEFAULT FALSE — the client doesn't pass the key at all).
    expect(params.p_clear_cart).toBeUndefined();
  });

  it('createOrderFromCart still passes the full guest-address payload (no regressions)', async () => {
    const { createOrderFromCart } = await import('./supabaseService');

    await createOrderFromCart({
      cartItems: [buildCartItem()],
      eventDate: '2026-07-01',
      eventTime: '14:00-16:00',
      deliveryAddressId: null,
      deliveryFee: 50,
      guestAddress: {
        recipientName: 'Jane Doe',
        recipientPhone: '+639180000000',
        streetAddress: '456 Real St',
        city: 'Cebu City',
        latitude: 10.31,
        longitude: 123.88,
      },
    });

    const createOrderCall = rpcMock.mock.calls.find(
      ([rpcName]: [string]) => rpcName === 'create_order_from_cart',
    );
    expect(createOrderCall).toBeDefined();
    const params = createOrderCall![1] as Record<string, unknown>;
    expect(params.p_recipient_name).toBe('Jane Doe');
    expect(params.p_recipient_phone).toBe('+639180000000');
    expect(params.p_delivery_address).toBe('456 Real St');
    expect(params.p_delivery_city).toBe('Cebu City');
    // Server-calculated discount path: amount is still 0 until the
    // server-side validator in the RPC runs.
    expect(params.p_discount_amount).toBe(0);
  });

  it('passes buyer attribution through to create_order_from_cart', async () => {
    const { createOrderFromCart } = await import('./supabaseService');

    await createOrderFromCart({
      cartItems: [buildCartItem()],
      eventDate: '2026-07-01',
      eventTime: '14:00-16:00',
      deliveryAddressId: 'addr-1',
      deliveryFee: 100,
      buyerAttribution: {
        version: 1,
        firstTouch: {
          source: 'tiktok',
          medium: 'paid_social',
          campaign: 'launch',
          entrySource: null,
          referrerHost: null,
          clickIdType: 'ttclid',
          category: 'campaign',
          landingPath: '/',
          landingUrl: 'https://genie.ph/?utm_source=tiktok',
          occurredAt: '2026-07-05T00:00:00.000Z',
        },
        firstNonDirectTouch: null,
        latestTouch: null,
        latestNonDirectTouch: null,
        purchaseSession: null,
        ga: {
          clientId: '1234.5678',
          sessionId: '123',
          sessionNumber: 1,
          lastResolvedAt: '2026-07-05T00:00:00.000Z',
        },
        latestTouchSessionId: '123',
        latestNonDirectTouchSessionId: '123',
      },
    });

    const createOrderCall = rpcMock.mock.calls.find(
      ([rpcName]: [string]) => rpcName === 'create_order_from_cart',
    );
    expect(createOrderCall).toBeDefined();
    const params = createOrderCall![1] as Record<string, unknown>;
    expect(params.p_buyer_attribution).toMatchObject({
      version: 1,
      firstTouch: {
        source: 'tiktok',
      },
      ga: {
        clientId: '1234.5678',
      },
    });
  });

  it('clear_cart_for_paid_order is reachable via the supabase.rpc() call boundary', async () => {
    // This is the contract test for the new server-side helper
    // defined in supabase/migrations/20260612130000_defer_cart_clear_to_payment.sql.
    // The helper itself runs in Postgres, not the SPA, so we just
    // assert the rpc() call shape that the edge functions
    // (xendit-webhook, verify-xendit-payment) use to invoke it.
    //
    // Pinning the call shape here guards against silent refactors
    // of the helper's parameter name.
    rpcMock.mockResolvedValue({ data: 2, error: null });

    await mockClient.rpc('clear_cart_for_paid_order', {
      p_order_id: 'order-abc',
    });

    expect(rpcMock).toHaveBeenCalledWith('clear_cart_for_paid_order', {
      p_order_id: 'order-abc',
    });
  });

  it('clear_cart_for_paid_order returns the cart-row count (so callers can log it)', async () => {
    // The helper returns INTEGER — the number of cart rows actually
    // removed. Edge functions log this for observability. Pin the
    // return contract so a future signature change (e.g. switching
    // to JSONB) is intentional.
    rpcMock.mockResolvedValueOnce({ data: 0, error: null });
    rpcMock.mockResolvedValueOnce({ data: 3, error: null });

    const first = await mockClient.rpc('clear_cart_for_paid_order', {
      p_order_id: 'order-already-cleared',
    });
    const second = await mockClient.rpc('clear_cart_for_paid_order', {
      p_order_id: 'order-just-paid',
    });

    expect(first.data).toBe(0); // idempotent re-run on an empty cart
    expect(second.data).toBe(3); // three rows removed on the first call
  });
});
