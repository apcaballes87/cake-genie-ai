import type { CakeGenieCartItem } from '@/lib/database.types';
import { getFromIndexedDB, removeFromIndexedDB, saveToIndexedDB } from '@/lib/utils/storage';
import { CART_RETENTION_DAYS } from '@/lib/cartAuthTransfer';

const OUTBOX_KEY = 'cart-outbox-v1';
const MAX_AGE_MS = CART_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type CartOutboxStage = 'auth_owner' | 'cart_insert' | 'image_upload' | 'image_update';

export interface CartOutboxRecord {
  cartItem: CakeGenieCartItem;
  createdAt: string;
  attempts: number;
  stage: CartOutboxStage;
  lastError?: string;
  nextAttemptAt?: string;
}

function isActive(record: CartOutboxRecord): boolean {
  return Date.now() - new Date(record.createdAt).getTime() < MAX_AGE_MS;
}

async function readAll(): Promise<CartOutboxRecord[]> {
  if (typeof indexedDB === 'undefined') return [];
  const raw = await getFromIndexedDB(OUTBOX_KEY);
  if (!raw) return [];

  try {
    const records = JSON.parse(raw) as CartOutboxRecord[];
    return records.filter(isActive);
  } catch {
    return [];
  }
}

async function writeAll(records: CartOutboxRecord[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await saveToIndexedDB(OUTBOX_KEY, JSON.stringify(records.filter(isActive)));
}

export async function getCartOutbox(): Promise<CartOutboxRecord[]> {
  const records = await readAll();
  await writeAll(records);
  return records;
}

export async function putCartOutbox(record: CartOutboxRecord): Promise<void> {
  const records = await readAll();
  const next = records.filter(item => item.cartItem.cart_item_id !== record.cartItem.cart_item_id);
  next.push(record);
  await writeAll(next);
}

export async function removeCartOutbox(cartItemId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const records = await readAll();
  const next = records.filter(item => item.cartItem.cart_item_id !== cartItemId);
  if (next.length === 0) {
    await removeFromIndexedDB(OUTBOX_KEY);
    return;
  }
  await writeAll(next);
}

export async function reassignCartOutboxOwner(
  anonymousUserId: string,
  authenticatedUserId: string,
): Promise<number> {
  const records = await readAll();
  let reassignedCount = 0;
  const updatedRecords = records.map(record => {
    if (record.cartItem.user_id !== null || record.cartItem.session_id !== anonymousUserId) {
      return record;
    }

    reassignedCount += 1;
    return {
      ...record,
      cartItem: {
        ...record.cartItem,
        user_id: authenticatedUserId,
        session_id: null,
      },
    };
  });

  if (reassignedCount > 0) {
    await writeAll(updatedRecords);
  }

  return reassignedCount;
}
