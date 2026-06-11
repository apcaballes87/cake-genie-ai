import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

type TableHandler = {
  onInsert?: (payload: Record<string, unknown>) => void;
  onInsertSelectSingle?: (payload: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  onSingle?: () => Promise<{ data: unknown; error: unknown }>;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onUpdateEq?: (payload: Record<string, unknown>) => Promise<{ data?: unknown; error: unknown }>;
};

const tableHandlers: Record<string, TableHandler> = {};

const fromMock = vi.fn((table: string) => {
  const handler = tableHandlers[table] ?? {};

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(async () => {
      if (handler.onSingle) {
        return handler.onSingle();
      }

      return { data: null, error: null };
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      handler.onInsert?.(payload);

      return {
        select: () => ({
          single: async () => {
            if (handler.onInsertSelectSingle) {
              return handler.onInsertSelectSingle(payload);
            }

            return { data: null, error: null };
          },
        }),
      };
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      handler.onUpdate?.(payload);

      return {
        eq: async () => {
          if (handler.onUpdateEq) {
            return handler.onUpdateEq(payload);
          }

          return { error: null };
        },
      };
    }),
  };

  return builder;
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    tableHandlers.chat_conversations = {};
    tableHandlers.chat_messages = {};
  });

  it('stores page context when creating a new conversation', async () => {
    const insertedConversationPayloads: Record<string, unknown>[] = [];
    const insertedGreetingPayloads: Record<string, unknown>[] = [];

    tableHandlers.chat_conversations.onSingle = async () => ({ data: null, error: null });
    tableHandlers.chat_conversations.onInsert = (payload) => {
      insertedConversationPayloads.push(payload);
    };
    tableHandlers.chat_conversations.onInsertSelectSingle = async () => ({
      data: { id: 'conversation-1' },
      error: null,
    });
    tableHandlers.chat_messages.onInsert = (payload) => {
      insertedGreetingPayloads.push(payload);
    };

    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_conversation',
        sessionId: 'guest_123',
        email: 'customer@example.com',
        name: 'Customer',
        pageContext: {
          url: 'https://genie.ph/customizing/pink-heart-cake',
          title: 'Pink Heart Cake | Genie',
        },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(insertedConversationPayloads).toHaveLength(1);
    expect(insertedConversationPayloads[0]).toEqual(
      expect.objectContaining({
        session_id: 'guest_123',
        customer_email: 'customer@example.com',
        customer_name: 'Customer',
        last_customer_page_url: 'https://genie.ph/customizing/pink-heart-cake',
        last_customer_page_title: 'Pink Heart Cake | Genie',
      }),
    );
    expect(insertedConversationPayloads[0].last_customer_page_seen_at).toEqual(expect.any(String));
    expect(insertedGreetingPayloads).toHaveLength(1);
    expect(insertedGreetingPayloads[0]).toEqual(
      expect.objectContaining({
        conversation_id: 'conversation-1',
        content: 'Hi! How can we help you today?',
      }),
    );
  });

  it('refreshes page context when a customer sends a message', async () => {
    const insertedMessagePayloads: Record<string, unknown>[] = [];
    const updatedConversationPayloads: Record<string, unknown>[] = [];

    tableHandlers.chat_messages.onInsert = (payload) => {
      insertedMessagePayloads.push(payload);
    };
    tableHandlers.chat_messages.onInsertSelectSingle = async () => ({
      data: { id: 'message-1' },
      error: null,
    });
    tableHandlers.chat_conversations.onUpdate = (payload) => {
      updatedConversationPayloads.push(payload);
    };
    tableHandlers.chat_conversations.onUpdateEq = async () => ({ error: null });

    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_message',
        conversationId: 'conversation-1',
        content: 'How much is this?',
        pageContext: {
          url: 'https://genie.ph/customizing/minimalist-bento-cake',
          title: 'Minimalist Bento Cake | Genie',
        },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(insertedMessagePayloads).toHaveLength(1);
    expect(insertedMessagePayloads[0]).toEqual(
      expect.objectContaining({
        conversation_id: 'conversation-1',
        content: 'How much is this?',
        sender_type: 'customer',
      }),
    );
    expect(updatedConversationPayloads).toHaveLength(1);
    expect(updatedConversationPayloads[0]).toEqual(
      expect.objectContaining({
        last_customer_page_url: 'https://genie.ph/customizing/minimalist-bento-cake',
        last_customer_page_title: 'Minimalist Bento Cake | Genie',
      }),
    );
    expect(updatedConversationPayloads[0].last_customer_page_seen_at).toEqual(expect.any(String));
  });
});
