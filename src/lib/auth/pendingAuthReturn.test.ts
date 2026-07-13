import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingAuthReturn,
  PENDING_AUTH_RETURN_KEY,
  readPendingAuthReturn,
  writePendingAuthReturn,
} from './pendingAuthReturn';

describe('pending auth return state', () => {
  beforeEach(() => window.localStorage.clear());

  it('stores and reads a valid internal destination', () => {
    writePendingAuthReturn('/cart?from=checkout#payment');
    expect(readPendingAuthReturn()).toBe('/cart?from=checkout#payment');
  });

  it('rejects external and expired destinations', () => {
    writePendingAuthReturn('https://evil.example');
    expect(window.localStorage.getItem(PENDING_AUTH_RETURN_KEY)).toBeNull();

    window.localStorage.setItem(PENDING_AUTH_RETURN_KEY, JSON.stringify({
      returnTo: '/cart',
      createdAt: Date.now() - 31 * 60 * 1000,
    }));
    expect(readPendingAuthReturn()).toBeNull();
  });

  it('clears a consumed destination', () => {
    writePendingAuthReturn('/cart');
    clearPendingAuthReturn();
    expect(readPendingAuthReturn()).toBeNull();
  });
});
