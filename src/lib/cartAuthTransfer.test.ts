import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  beginCartAuthTransfer,
  claimCartAuthTransfer,
  getPendingCartAuthTransfer,
} from './cartAuthTransfer';

const rpc = vi.fn();
const supabase = { rpc } as unknown as SupabaseClient;

describe('cart auth transfer storage contract', () => {
  beforeEach(() => {
    rpc.mockReset();
    window.sessionStorage.clear();
  });

  it('stores a one-time claim returned for an anonymous user', async () => {
    rpc.mockResolvedValue({
      data: {
        token: 'a'.repeat(64),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      error: null,
    });

    const result = await beginCartAuthTransfer(
      supabase,
      { id: 'anonymous-user', is_anonymous: true } as User,
    );

    expect(result).toEqual({ created: true, error: null });
    expect(rpc).toHaveBeenCalledWith('begin_anonymous_cart_transfer');
    expect(getPendingCartAuthTransfer()).toMatchObject({ token: 'a'.repeat(64) });
  });

  it('does not create a transfer for an already registered user', async () => {
    const result = await beginCartAuthTransfer(
      supabase,
      { id: 'registered-user', is_anonymous: false } as User,
    );

    expect(result).toEqual({ created: false, error: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('drops an expired browser claim before it can be replayed', () => {
    window.sessionStorage.setItem('pending_cart_auth_transfer_v1', JSON.stringify({
      token: 'a'.repeat(64),
      expiresAt: new Date(Date.now() - 1).toISOString(),
    }));

    expect(getPendingCartAuthTransfer()).toBeNull();
    expect(window.sessionStorage.getItem('pending_cart_auth_transfer_v1')).toBeNull();
  });

  it('normalizes a successful server claim without exposing the raw token', async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        source_anonymous_user_id: 'anonymous-user',
        updated_count: 2,
        already_claimed: false,
      },
      error: null,
    });

    const result = await claimCartAuthTransfer(supabase, 'a'.repeat(64));

    expect(result).toEqual({
      data: {
        sourceAnonymousUserId: 'anonymous-user',
        updatedCount: 2,
        alreadyClaimed: false,
      },
      error: null,
    });
    expect(rpc).toHaveBeenCalledWith('claim_anonymous_cart_transfer', { p_token: 'a'.repeat(64) });
  });
});
