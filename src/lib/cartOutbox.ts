import type { CakeGenieCartItem } from '@/lib/database.types';
import { getFromIndexedDB, removeFromIndexedDB, saveToIndexedDB } from '@/lib/utils/storage';
import { CART_RETENTION_DAYS } from '@/lib/cartAuthTransfer';
import { withTimeout } from '@/lib/utils/timeout';

const OUTBOX_KEY = 'cart-outbox-v1';
const MAX_AGE_MS = CART_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const INDEXED_DB_TIMEOUT_MS = 1_500;

export type CartOutboxStage = 'outbox_write' | 'auth' | 'auth_owner' | 'cart_insert' | 'image_upload' | 'image_update';
export type CartOutboxSourceSurface = 'customizer' | 'shared_design' | 'unknown';

export interface CartOutboxRecord {
  cartItem: CakeGenieCartItem;
  createdAt: string;
  attempts: number;
  stage: CartOutboxStage;
  sourceSurface?: CartOutboxSourceSurface;
  lastError?: string;
  nextAttemptAt?: string;
}

export class CartOutboxError extends Error {
  readonly code: 'timeout' | 'storage' | 'corrupt';

  constructor(code: 'timeout' | 'storage' | 'corrupt', message: string) {
    super(message);
    this.name = 'CartOutboxError';
    this.code = code;
  }
}

function isActive(record: CartOutboxRecord): boolean {
  return Date.now() - new Date(record.createdAt).getTime() < MAX_AGE_MS;
}

async function readAll(): Promise<CartOutboxRecord[]> {
  if (typeof indexedDB === 'undefined') return [];
  let raw: string | null;
  try {
    raw = await withTimeout(
      getFromIndexedDB(OUTBOX_KEY, { throwOnError: true }),
      INDEXED_DB_TIMEOUT_MS,
      'Cart outbox read timed out',
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new CartOutboxError('timeout', error.message);
    }
    throw new CartOutboxError('storage', 'Cart outbox could not be read');
  }
  if (!raw) return [];

  try {
    const records = JSON.parse(raw) as CartOutboxRecord[];
    if (!Array.isArray(records)) throw new Error('Cart outbox must be an array');
    return records.filter(isActive);
  } catch {
    throw new CartOutboxError('corrupt', 'Cart outbox data is invalid');
  }
}

async function writeAll(records: CartOutboxRecord[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await withTimeout(
      saveToIndexedDB(OUTBOX_KEY, JSON.stringify(records.filter(isActive)), { throwOnError: true }),
      INDEXED_DB_TIMEOUT_MS,
      'Cart outbox write timed out',
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new CartOutboxError('timeout', error.message);
    }
    throw new CartOutboxError('storage', 'Cart outbox could not be written');
  }
}

export async function getCartOutbox(): Promise<CartOutboxRecord[]> {
  // Reads must stay bounded and side-effect free. Expired records are removed
  // on the next successful write instead of making page hydration wait for a
  // second IndexedDB transaction.
  return readAll();
}

export async function putCartOutbox(record: CartOutboxRecord): Promise<void> {
  await withCartOutboxStoreLock(async () => {
    const records = await readAll();
    const next = records.filter(item => item.cartItem.cart_item_id !== record.cartItem.cart_item_id);
    next.push(record);
    await writeAll(next);
  });
}

export async function removeCartOutbox(cartItemId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await withCartOutboxStoreLock(async () => {
    const records = await readAll();
    const next = records.filter(item => item.cartItem.cart_item_id !== cartItemId);
    if (next.length === 0) {
      try {
        await withTimeout(
          removeFromIndexedDB(OUTBOX_KEY, { throwOnError: true }),
          INDEXED_DB_TIMEOUT_MS,
          'Cart outbox delete timed out',
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new CartOutboxError('timeout', error.message);
        }
        throw new CartOutboxError('storage', 'Cart outbox could not be deleted');
      }
      return;
    }
    await writeAll(next);
  });
}

type CartOutboxLock = {
  request: <R>(name: string, options: { ifAvailable: boolean }, callback: (lock: unknown) => Promise<R>) => Promise<R>;
};

async function withCartOutboxLock<T>(
  lockName: string,
  task: () => Promise<T>,
  ifAvailable = true,
): Promise<T | null> {
  if (typeof navigator !== 'undefined') {
    const locks = (navigator as Navigator & { locks?: CartOutboxLock }).locks;

    if (locks) {
      return locks.request(lockName, { ifAvailable }, async lock => {
        if (!lock) return null;
        return task();
      });
    }
  }

  if (typeof window === 'undefined') return task();

  const storageKey = `cakegenie-${lockName}`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const leaseUntil = Date.now() + INDEXED_DB_TIMEOUT_MS + 500;
  try {
    while (true) {
      const current = window.localStorage.getItem(storageKey);
      const parsed = current ? JSON.parse(current) as { leaseUntil?: number } : null;
      if (!parsed || typeof parsed.leaseUntil !== 'number' || parsed.leaseUntil <= Date.now()) break;
      if (ifAvailable) return null;
      const remainingLeaseMs = parsed.leaseUntil - Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.min(100, remainingLeaseMs)));
    }

    window.localStorage.setItem(storageKey, JSON.stringify({ token, leaseUntil }));
    const confirmed = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as { token?: string };
    if (confirmed.token !== token) return null;

    try {
      return await task();
    } finally {
      const owner = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as { token?: string };
      if (owner.token === token) window.localStorage.removeItem(storageKey);
    }
  } catch {
    // Private browsing or disabled storage should not make the cart unusable.
    return task();
  }
}

export async function withCartOutboxRecordLock<T>(
  cartItemId: string,
  task: () => Promise<T>,
): Promise<T | null> {
  return withCartOutboxLock(`cakegenie-cart-outbox-${cartItemId}`, task);
}

async function withCartOutboxStoreLock<T>(task: () => Promise<T>): Promise<T | null> {
  return withCartOutboxLock('cakegenie-cart-outbox-store', task, false);
}

export async function reassignCartOutboxOwner(
  anonymousUserId: string,
  authenticatedUserId: string,
): Promise<number> {
  const reassignedCount = await withCartOutboxStoreLock(async () => {
    const records = await readAll();
    let count = 0;
    const updatedRecords = records.map(record => {
      if (record.cartItem.user_id !== null || record.cartItem.session_id !== anonymousUserId) {
        return record;
      }

      count += 1;
      return {
        ...record,
        cartItem: {
          ...record.cartItem,
          user_id: authenticatedUserId,
          session_id: null,
        },
      };
    });

    if (count > 0) await writeAll(updatedRecords);
    return count;
  });

  return reassignedCount || 0;
}
