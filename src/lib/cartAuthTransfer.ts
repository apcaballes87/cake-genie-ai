import type { SupabaseClient, User } from '@supabase/supabase-js';

export const CART_RETENTION_DAYS = 30;
export const CART_AUTH_TRANSFER_TTL_MS = 10 * 60 * 1000;

const CART_AUTH_TRANSFER_STORAGE_KEY = 'pending_cart_auth_transfer_v1';

type PendingCartAuthTransfer = {
  token: string;
  expiresAt: string;
};

export type ClaimedCartAuthTransfer = {
  sourceAnonymousUserId: string;
  updatedCount: number;
  alreadyClaimed: boolean;
};

function isPendingTransfer(value: unknown): value is PendingCartAuthTransfer {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PendingCartAuthTransfer>;
  return typeof candidate.token === 'string'
    && candidate.token.length >= 32
    && typeof candidate.expiresAt === 'string'
    && Number.isFinite(new Date(candidate.expiresAt).getTime());
}

function readRawPendingCartAuthTransfer(): PendingCartAuthTransfer | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(CART_AUTH_TRANSFER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isPendingTransfer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingCartAuthTransfer(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(CART_AUTH_TRANSFER_STORAGE_KEY);
}

export function getPendingCartAuthTransfer(): PendingCartAuthTransfer | null {
  const pending = readRawPendingCartAuthTransfer();
  if (!pending) return null;

  if (new Date(pending.expiresAt).getTime() <= Date.now()) {
    clearPendingCartAuthTransfer();
    return null;
  }

  return pending;
}

function storePendingCartAuthTransfer(transfer: PendingCartAuthTransfer): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CART_AUTH_TRANSFER_STORAGE_KEY, JSON.stringify(transfer));
}

export async function beginCartAuthTransfer(
  supabase: SupabaseClient,
  user: User | null,
): Promise<{ created: boolean; error: Error | null }> {
  if (!user?.is_anonymous) return { created: false, error: null };

  if (getPendingCartAuthTransfer()) return { created: false, error: null };

  const { data, error } = await supabase.rpc('begin_anonymous_cart_transfer');
  if (error) return { created: false, error: new Error(error.message) };

  const result = data as { token?: unknown; expires_at?: unknown } | null;
  if (typeof result?.token !== 'string' || typeof result.expires_at !== 'string') {
    return { created: false, error: new Error('Could not prepare the cart for sign-in.') };
  }

  const expiresAt = new Date(result.expires_at);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { created: false, error: new Error('Could not prepare the cart for sign-in.') };
  }

  storePendingCartAuthTransfer({ token: result.token, expiresAt: expiresAt.toISOString() });
  return { created: true, error: null };
}

export async function claimCartAuthTransfer(
  supabase: SupabaseClient,
  token: string,
): Promise<{ data: ClaimedCartAuthTransfer | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('claim_anonymous_cart_transfer', { p_token: token });
  if (error) return { data: null, error: new Error(error.message) };

  const result = data as {
    success?: unknown;
    source_anonymous_user_id?: unknown;
    updated_count?: unknown;
    already_claimed?: unknown;
  } | null;

  if (result?.success !== true || typeof result.source_anonymous_user_id !== 'string') {
    return { data: null, error: new Error('Could not restore the cart after sign-in.') };
  }

  return {
    data: {
      sourceAnonymousUserId: result.source_anonymous_user_id,
      updatedCount: Number(result.updated_count || 0),
      alreadyClaimed: result.already_claimed === true,
    },
    error: null,
  };
}
