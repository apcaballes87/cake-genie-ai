import { describe, expect, it } from 'vitest';
import {
  buildBuyerAttributionJourney,
  sanitizeLandingPagePath,
  type BuyerAttributionAuditOrder,
} from './buyerAttributionAudit';

function order(
  orderId: string,
  createdAt: string,
  sessionNumber: number,
  overrides: Partial<BuyerAttributionAuditOrder> = {},
): BuyerAttributionAuditOrder {
  return {
    order_id: orderId,
    order_number: orderId,
    user_id: 'buyer-1',
    created_at: createdAt,
    payment_status: 'paid',
    order_status: 'confirmed',
    total_amount: 1000,
    buyer_first_touch_source: 'google',
    buyer_first_touch_platform: 'google',
    buyer_first_touch_confidence: 'explicit_utm',
    buyer_first_touch_landing_path: '/search',
    buyer_purchase_session_source: 'google',
    buyer_purchase_session_platform: 'google',
    buyer_purchase_session_confidence: 'explicit_utm',
    buyer_attribution: {
      firstTouch: { source: 'google', platform: 'google', confidence: 'explicit_utm', landingPagePath: '/search' },
      purchaseSession: { source: 'google', platform: 'google', confidence: 'explicit_utm' },
      ga: { sessionNumber },
    },
    ga_purchase_mirrored_at: null,
    ...overrides,
  };
}

describe('buyer attribution audit journey', () => {
  it('calculates sessions before purchase, purchase ordinal, and lifetime count', () => {
    const rows = buildBuyerAttributionJourney([
      order('order-2', '2026-08-20T10:00:00.000Z', 4),
      order('order-1', '2026-08-10T10:00:00.000Z', 2),
      order('order-3', '2026-08-21T10:00:00.000Z', 5),
      order('order-other', '2026-08-11T10:00:00.000Z', 1, { user_id: 'buyer-2' }),
    ]);

    expect(rows.filter((row) => row.user_id === 'buyer-1').map((row) => ({
      order: row.order_id,
      sessions: row.sessionsBeforePurchase,
      ordinal: row.purchaseOrdinal,
      lifetime: row.lifetimePurchaseCount,
    }))).toEqual([
      { order: 'order-1', sessions: 1, ordinal: 1, lifetime: 3 },
      { order: 'order-2', sessions: 3, ordinal: 2, lifetime: 3 },
      { order: 'order-3', sessions: 4, ordinal: 3, lifetime: 3 },
    ]);
  });

  it('sanitizes query strings and absolute landing URLs to paths', () => {
    expect(sanitizeLandingPagePath('/collections/bento-cake?gclid=secret')).toBe('/collections/bento-cake');
    expect(sanitizeLandingPagePath('https://genie.ph/search?image=https%3A%2F%2Fexample.com%2Fcake.png')).toBe('/search');
    expect(sanitizeLandingPagePath('')).toBeNull();
  });

  it('falls back to explicit unknown click-id families for legacy rows', () => {
    const [row] = buildBuyerAttributionJourney([
      order('legacy-order', '2026-08-20T10:00:00.000Z', 1, {
        buyer_first_touch_source: 'google',
        buyer_first_touch_platform: null,
        buyer_first_touch_confidence: null,
        buyer_first_touch_landing_path: null,
        buyer_attribution: {
          firstTouch: {
            source: 'google',
            clickIdType: 'gclid',
            landingPath: '/?gclid=secret',
          },
          purchaseSession: null,
          ga: { sessionNumber: 1 },
        },
      }),
    ]);

    expect(row.firstTouchPlatform).toBe('google_unknown');
    expect(row.firstTouchConfidence).toBe('click_id');
    expect(row.firstLandingPage).toBe('/');
  });
});
