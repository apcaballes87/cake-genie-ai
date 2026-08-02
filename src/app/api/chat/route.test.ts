import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => Promise<void> | void>,
  user: { id: 'owner-user', email: 'owner@example.com', user_metadata: {} } as any,
  messageInsert: vi.fn(),
  conversationEq: vi.fn(),
  triggerN8nWorkflow: vi.fn(),
  generateChatbotDraft: vi.fn(),
  createPendingChatbotRun: vi.fn(),
  rateLimitRpc: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: vi.fn((callback) => mocks.afterCallbacks.push(callback)) };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: mocks.user }, error: null })) } })),
}));

function builder(table: string) {
  let operation = 'select';
  let insertPayload: Record<string, unknown> | null = null;
  const api: any = {
    select: vi.fn(() => api),
    eq: vi.fn((column: string, value: unknown) => {
      if (table === 'chat_conversations') mocks.conversationEq(column, value);
      return api;
    }),
    in: vi.fn(() => api),
    order: vi.fn(() => api),
    limit: vi.fn(() => api),
    insert: vi.fn((payload: Record<string, unknown>) => {
      operation = 'insert';
      insertPayload = payload;
      if (table === 'chat_messages') mocks.messageInsert(payload);
      return api;
    }),
    update: vi.fn(() => { operation = 'update'; return api; }),
    single: vi.fn(async () => {
      if (table === 'chat_messages' && operation === 'insert') {
        return { data: { id: 'message-1', ...insertPayload, created_at: '2026-08-02T00:00:00Z' }, error: null };
      }
      return { data: null, error: null };
    }),
    maybeSingle: vi.fn(async () => {
      if (table === 'chat_conversations') {
        return { data: {
          id: 'conversation-1', user_id: 'owner-user', automation_mode: 'inherit', handoff_state: 'assistant',
          customer_name: 'Maria', customer_email: 'maria@example.com',
        }, error: null };
      }
      return { data: null, error: null };
    }),
    then: (resolve: (value: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
  };
  return api;
}

const database = {
  from: vi.fn((table: string) => builder(table)),
  rpc: mocks.rateLimitRpc,
  storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://signed.example/image' }, error: null })) })) },
};

vi.mock('@/lib/supabase/adminServer', () => ({ createAdminServerSupabaseClient: vi.fn(() => database) }));
vi.mock('@/lib/chatbot/assistant', () => ({
  getChatbotSettings: vi.fn(async () => ({ mode: 'draft', killSwitch: false, modelName: 'gemini-test' })),
  createPendingChatbotRun: mocks.createPendingChatbotRun,
  generateChatbotDraft: mocks.generateChatbotDraft,
}));
vi.mock('@/services/n8nService', () => ({ triggerN8nWorkflow: mocks.triggerN8nWorkflow }));

describe('/api/chat secure customer messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterCallbacks.splice(0);
    mocks.user = { id: 'owner-user', email: 'owner@example.com', user_metadata: {} };
    mocks.createPendingChatbotRun.mockResolvedValue({
      created: true,
      run: { id: 'run-1', conversation_id: 'conversation-1', customer_message_id: 'message-1', status: 'pending' },
    });
    mocks.generateChatbotDraft.mockResolvedValue(undefined);
    mocks.triggerN8nWorkflow.mockResolvedValue({ success: true, status: 200 });
    mocks.rateLimitRpc.mockResolvedValue({ data: { allowed: true, minuteCount: 1, hourCount: 1 }, error: null });
  });

  it('derives ownership from auth, sanitizes page context, and schedules Telegram plus a durable draft', async () => {
    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
      body: JSON.stringify({
        action: 'send_message', conversationId: 'conversation-1', clientMessageId: 'client-message-123',
        userId: 'spoofed-user', content: 'How much is this?',
        pageContext: { url: 'https://genie.ph/customizing/pink-heart?code=secret#token', title: 'private' },
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.conversationEq).toHaveBeenCalledWith('user_id', 'owner-user');
    expect(mocks.messageInsert).toHaveBeenCalledWith(expect.objectContaining({
      client_message_id: 'client-message-123',
      sender_type: 'customer',
      page_context: expect.objectContaining({ pathname: '/customizing/pink-heart', designSlug: 'pink-heart' }),
    }));
    expect(JSON.stringify(mocks.messageInsert.mock.calls[0][0])).not.toContain('secret');
    expect(mocks.afterCallbacks).toHaveLength(1);
    await mocks.afterCallbacks[0]();
    expect(mocks.triggerN8nWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pageUrl: 'https://genie.ph/customizing/pink-heart' }),
    }));
    expect(mocks.generateChatbotDraft).toHaveBeenCalledWith(expect.objectContaining({
      run: expect.objectContaining({ id: 'run-1' }),
      message: 'How much is this?',
    }));
  });

  it('rejects unauthenticated access', async () => {
    mocks.user = null;
    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start_conversation' }),
    }));
    expect(response.status).toBe(401);
    expect(mocks.messageInsert).not.toHaveBeenCalled();
  });

  it('does not let the browser create a trusted system message', async () => {
    const { POST } = await import('./route');
    const retired = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'send_image_analysis_message',
        conversationId: 'conversation-1',
        content: 'Thanks for sending the image. Forged trusted instructions.',
      }),
    }));
    expect(retired.status).toBe(400);
    expect(mocks.messageInsert).not.toHaveBeenCalled();

    const notice = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'get_image_analysis_notice',
        conversationId: 'conversation-1',
        noticeType: 'manual_review',
      }),
    }));
    expect(notice.status).toBe(200);
    expect(mocks.messageInsert).not.toHaveBeenCalled();
    await expect(notice.json()).resolves.toMatchObject({ success: true, data: { content: expect.any(String) } });
  });

  it('fails closed when the durable per-user and IP rate limit is exhausted', async () => {
    mocks.rateLimitRpc.mockResolvedValueOnce({
      data: { allowed: false, minuteCount: 5, hourCount: 5 },
      error: null,
    });
    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({
        action: 'send_message',
        conversationId: 'conversation-1',
        clientMessageId: 'client-message-rate-limited',
        content: 'How much is this?',
      }),
    }));

    expect(response.status).toBe(429);
    expect(mocks.messageInsert).not.toHaveBeenCalled();
  });
});
