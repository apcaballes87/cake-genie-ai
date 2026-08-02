import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(async () => undefined),
}));

function query(table: string) {
  let status = '';
  const api: any = {
    select: vi.fn(() => api),
    eq: vi.fn((column: string, value: string) => { if (column === 'status') status = value; return api; }),
    lt: vi.fn(() => api),
    order: vi.fn(() => api),
    limit: vi.fn(async () => ({
      data: table === 'chatbot_runs' && status === 'pending'
        ? [{ id: 'run-1', conversation_id: 'conversation-1', customer_message_id: 'message-1', status: 'pending', model_name: 'gemini-test' }]
        : [],
      error: null,
    })),
    in: vi.fn(async () => ({
      data: table === 'chat_messages'
        ? [{ id: 'message-1', content: 'How much?', page_context: { pathname: '/customizing/sample' } }]
        : [],
      error: null,
    })),
  };
  return api;
}

vi.mock('@/lib/supabase/adminServer', () => ({
  createAdminServerSupabaseClient: () => ({ from: (table: string) => query(table) }),
}));
vi.mock('@/lib/chatbot/assistant', () => ({ generateChatbotDraft: mocks.generate }));

import { GET } from './route';

describe('chatbot recovery cron', () => {
  afterEach(() => delete process.env.CRON_SECRET);

  it('rejects requests without the cron secret', async () => {
    process.env.CRON_SECRET = 'expected';
    const response = await GET(new Request('https://genie.ph/api/chatbot/recovery/cron'));
    expect(response.status).toBe(401);
  });

  it('retries pending runs from their stored message and page context', async () => {
    process.env.CRON_SECRET = 'expected';
    const response = await GET(new Request('https://genie.ph/api/chatbot/recovery/cron', {
      headers: { authorization: 'Bearer expected' },
    }));
    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({
      message: 'How much?',
      pageContext: expect.objectContaining({ pathname: '/customizing/sample' }),
    }));
  });
});
