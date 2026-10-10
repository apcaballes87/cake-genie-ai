import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canAccessConversation, getChatIdentity } from '@/lib/chat/access';

const clientWithUser = (user: unknown, error: unknown = null) =>
  ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error }) } }) as unknown as SupabaseClient;

const request = (headers: Record<string, string>) => new NextRequest('http://localhost/api/chat', { headers });

describe('getChatIdentity', () => {
  it('is anonymous without a token and keeps the session header', async () => {
    const identity = await getChatIdentity(request({ 'x-chat-session': 'guest_1' }), clientWithUser(null));
    expect(identity).toEqual({ userId: null, isAdmin: false, sessionId: 'guest_1' });
  });

  it('treats an invalid token as anonymous', async () => {
    const identity = await getChatIdentity(request({ authorization: 'Bearer bad' }), clientWithUser(null, { message: 'bad jwt' }));
    expect(identity.userId).toBeNull();
    expect(identity.isAdmin).toBe(false);
  });

  it('flags only genie_role=admin as admin', async () => {
    const admin = await getChatIdentity(request({ authorization: 'Bearer t' }), clientWithUser({ id: 'u1', app_metadata: { genie_role: 'admin' } }));
    const customer = await getChatIdentity(request({ authorization: 'Bearer t' }), clientWithUser({ id: 'u2', app_metadata: { genie_role: 'customer' } }));
    expect(admin).toMatchObject({ userId: 'u1', isAdmin: true });
    expect(customer).toMatchObject({ userId: 'u2', isAdmin: false });
  });
});

describe('canAccessConversation', () => {
  const conversation = { user_id: 'owner', session_id: 'sess-1' };

  it('allows admins, the owner, and the owning session', () => {
    expect(canAccessConversation({ userId: 'x', isAdmin: true, sessionId: null }, conversation)).toBe(true);
    expect(canAccessConversation({ userId: 'owner', isAdmin: false, sessionId: null }, conversation)).toBe(true);
    expect(canAccessConversation({ userId: null, isAdmin: false, sessionId: 'sess-1' }, conversation)).toBe(true);
  });

  it('denies everyone else, including missing conversations', () => {
    expect(canAccessConversation({ userId: 'other', isAdmin: false, sessionId: 'other' }, conversation)).toBe(false);
    expect(canAccessConversation({ userId: null, isAdmin: false, sessionId: null }, conversation)).toBe(false);
    expect(canAccessConversation({ userId: null, isAdmin: true, sessionId: null }, null)).toBe(false);
  });

  it('never matches a null owner against a null identity', () => {
    expect(canAccessConversation({ userId: null, isAdmin: false, sessionId: null }, { user_id: null, session_id: null })).toBe(false);
  });
});
