import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), updatedPayloads: [] as Record<string, unknown>[] }));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const CONVERSATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

vi.mock('@supabase/supabase-js', () => {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.order = async () => ({ data: [], error: null });
  builder.maybeSingle = async () => ({ data: { id: CONVERSATION_ID, user_id: null, session_id: 'guest_123' }, error: null });
  builder.single = async () => ({ data: { id: CONVERSATION_ID, user_id: null, session_id: 'guest_123' }, error: null });
  builder.insert = (payload: Record<string, unknown>) => {
    mocks.updatedPayloads.push(payload);
    return { select: () => ({ single: async () => ({ data: { id: 'm1' }, error: null }) }) };
  };
  builder.update = (payload: Record<string, unknown>) => {
    mocks.updatedPayloads.push(payload);
    return { eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }), then: (r: (v: unknown) => void) => r({ error: null }) }) };
  };
  return { createClient: vi.fn(() => ({ from: () => builder, auth: { getUser: mocks.getUser } })) };
});

const params = { params: Promise.resolve({ id: CONVERSATION_ID }) };

const patch = (headers: Record<string, string>, body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/chat/${CONVERSATION_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('/api/chat/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updatedPayloads.length = 0;
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
  });

  it('does not let the public reply as the merchant', async () => {
    const { PATCH } = await import('./route');
    const response = await PATCH(patch({}, { action: 'send_merchant_reply', content: 'Your refund is approved' }), params);

    expect(response.status).toBe(403);
    expect(mocks.updatedPayloads).toHaveLength(0);
  });

  it('does not let a guest holding the session id act as admin', async () => {
    const { PATCH } = await import('./route');
    const response = await PATCH(patch({ 'x-chat-session': 'guest_123' }, { action: 'update_status', status: 'archived' }), params);
    expect(response.status).toBe(403);
  });

  it('does not let a signed-in customer act as admin', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'customer', app_metadata: {} } }, error: null });
    const { PATCH } = await import('./route');
    const response = await PATCH(patch({ Authorization: 'Bearer t' }, { action: 'set_bot_state', botState: 'off' }), params);
    expect(response.status).toBe(403);
  });

  it('lets a dashboard admin reply', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin', app_metadata: { genie_role: 'admin' } } }, error: null });
    const { PATCH } = await import('./route');
    const response = await PATCH(patch({ Authorization: 'Bearer t' }, { action: 'send_merchant_reply', content: 'Hello!' }), params);

    expect(response.status).toBe(200);
    expect(mocks.updatedPayloads.some((p) => p.sender_type === 'merchant' && p.content === 'Hello!')).toBe(true);
  });

  it('hides a conversation from callers without access (GET)', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest(`http://localhost/api/chat/${CONVERSATION_ID}`, { headers: { 'x-chat-session': 'other' } }),
      params,
    );
    expect(response.status).toBe(404);
  });
});
