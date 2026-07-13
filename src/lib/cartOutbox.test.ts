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

import { CartOutboxError, getCartOutbox, reassignCartOutboxOwner } from './cartOutbox';

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

  it('rejects malformed outbox data instead of silently discarding it', async () => {
    storage.value = JSON.stringify({ not: 'an array' });

    await expect(getCartOutbox()).rejects.toMatchObject<CartOutboxError>({ code: 'corrupt' });
  });

  it('fails a stalled IndexedDB read within the bounded storage timeout', async () => {
    vi.useFakeTimers();
    const storageModule = await import('@/lib/utils/storage');
    vi.mocked(storageModule.getFromIndexedDB).mockImplementationOnce(() => new Promise(() => {}));

    const pendingRead = expect(getCartOutbox()).rejects.toMatchObject<CartOutboxError>({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(1_500);

    await pendingRead;
    vi.useRealTimers();
  });
});
