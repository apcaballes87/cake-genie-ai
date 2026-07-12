import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ value: null as string | null }));

vi.mock('@/lib/utils/storage', () => ({
  getFromIndexedDB: vi.fn(async () => storage.value),
  saveToIndexedDB: vi.fn(async (_key: string, value: string) => {
    storage.value = value;
  }),
  removeFromIndexedDB: vi.fn(async () => {
    storage.value = null;
  }),
}));

import { getCartOutbox, reassignCartOutboxOwner } from './cartOutbox';

describe('cart outbox ownership', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', { value: {}, configurable: true });
    storage.value = JSON.stringify([
      {
        cartItem: {
          cart_item_id: 'anonymous-pending-item',
          user_id: null,
          session_id: 'anonymous-user',
        },
        createdAt: new Date().toISOString(),
        attempts: 0,
        stage: 'auth_owner',
      },
      {
        cartItem: {
          cart_item_id: 'other-item',
          user_id: null,
          session_id: 'other-anonymous-user',
        },
        createdAt: new Date().toISOString(),
        attempts: 0,
        stage: 'auth_owner',
      },
    ]);
  });

  it('reassigns only records belonging to the claimed anonymous owner', async () => {
    await expect(reassignCartOutboxOwner('anonymous-user', 'registered-user')).resolves.toBe(1);

    const records = await getCartOutbox();
    expect(records[0].cartItem).toMatchObject({
      user_id: 'registered-user',
      session_id: null,
    });
    expect(records[1].cartItem).toMatchObject({
      user_id: null,
      session_id: 'other-anonymous-user',
    });
  });
});
