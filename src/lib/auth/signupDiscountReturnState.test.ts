import { describe, expect, it } from 'vitest';
import {
  PENDING_SIGNUP_DISCOUNT_MAX_AGE_MS,
  getCurrentRelativeUrl,
  parsePendingSignupDiscount,
  serializePendingSignupDiscount,
} from './signupDiscountReturnState';

describe('signup discount return state', () => {
  it('preserves pathname, query parameters, and hash', () => {
    expect(getCurrentRelativeUrl({
      pathname: '/customizing/example',
      search: '?size=8&height=4',
      hash: '#checkout',
    })).toBe('/customizing/example?size=8&height=4#checkout');
  });

  it('parses a fresh internal return state', () => {
    const now = 1_000_000;
    const raw = serializePendingSignupDiscount({
      source: 'bubble',
      returnTo: '/customizing/example?size=8',
      createdAt: now - 1_000,
    });

    expect(parsePendingSignupDiscount(raw, now)).toEqual({
      source: 'bubble',
      returnTo: '/customizing/example?size=8',
      createdAt: now - 1_000,
    });
  });

  it('rejects expired, future-dated, malformed, and external return states', () => {
    const now = 1_000_000;
    expect(parsePendingSignupDiscount(JSON.stringify({
      source: 'bubble',
      returnTo: '/customizing/example',
      createdAt: now - PENDING_SIGNUP_DISCOUNT_MAX_AGE_MS - 1,
    }), now)).toBeNull();
    expect(parsePendingSignupDiscount(JSON.stringify({
      source: 'bubble',
      returnTo: '/customizing/example',
      createdAt: now + 1,
    }), now)).toBeNull();
    expect(parsePendingSignupDiscount(JSON.stringify({
      source: 'bubble',
      returnTo: 'https://evil.example/',
      createdAt: now,
    }), now)).toBeNull();
    expect(parsePendingSignupDiscount('not-json', now)).toBeNull();
  });

  it('keeps legacy popup markers compatible without creating a bubble redirect target', () => {
    expect(parsePendingSignupDiscount('popup', 10)).toEqual({
      source: 'popup',
      returnTo: '/',
      createdAt: 10,
    });
    expect(parsePendingSignupDiscount('bubble', 10)).toEqual({
      source: 'bubble',
      returnTo: '',
      createdAt: 10,
    });
  });
});
