import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetChatbotSettingsCache } from '@/lib/chatbot/settings';

const notificationMocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => void | Promise<void>>,
  triggerN8nWorkflow: vi.fn(),
  runAssistantForMessage: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();

  return {
    ...actual,
    after: vi.fn((callback: () => void | Promise<void>) => {
      notificationMocks.afterCallbacks.push(callback);
    }),
  };
});

vi.mock('@/lib/chatbot/assistant', () => ({
  runAssistantForMessage: notificationMocks.runAssistantForMessage,
}));

vi.mock('@/services/n8nService', () => ({
  triggerN8nWorkflow: notificationMocks.triggerN8nWorkflow,
}));

const CONVERSATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

type TableHandler = {
  onInsert?: (payload: Record<string, unknown>) => void;
  onInsertSelectSingle?: (payload: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  onSingle?: () => Promise<{ data: unknown; error: unknown }>;
  onMaybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
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
    maybeSingle: vi.fn(async () => {
      if (handler.onMaybeSingle) {
        return handler.onMaybeSingle();
      }

      return { data: null, error: null };
    }),
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

      const eqResult = {
        select: vi.fn(() => ({
          single: async () => {
            if (handler.onUpdateEq) {
              const res = await handler.onUpdateEq(payload);
              return { data: res.data ?? null, error: res.error ?? null };
            }
            return { data: null, error: null };
          }
        })),
        then: (resolve: (value: { error: unknown }) => void) => {
          if (handler.onUpdateEq) {
            handler.onUpdateEq(payload).then((res) => resolve({ error: res?.error || null }));
          } else {
            resolve({ error: null });
          }
        }
      };

      return {
        eq: vi.fn(() => eqResult),
      };
    }),
  };

  return builder;
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: fromMock,
    auth: { getUser: notificationMocks.getUser },
  })),
}));

const guestHeaders = { 'Content-Type': 'application/json', 'x-chat-session': 'guest_123' };

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationMocks.afterCallbacks.splice(0);
    notificationMocks.triggerN8nWorkflow.mockResolvedValue({ success: true, status: 200 });

    resetChatbotSettingsCache();
    // Anonymous by default: no valid bearer token.
    notificationMocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });

    tableHandlers.chat_conversations = {
      // The guest session `guest_123` owns this conversation.
      onMaybeSingle: async () => ({
        data: { id: CONVERSATION_ID, user_id: null, session_id: 'guest_123' },
        error: null,
      }),
    };
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
      data: { id: CONVERSATION_ID },
      error: null,
    });
    tableHandlers.chat_messages.onInsert = (payload) => {
      insertedGreetingPayloads.push(payload);
    };

    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: guestHeaders,
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
        conversation_id: CONVERSATION_ID,
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
    tableHandlers.chat_conversations.onSingle = async () => ({
      data: {
        customer_name: 'Maria Santos',
        customer_email: 'maria@example.com',
        last_customer_page_url: 'https://genie.ph/customizing/older-cake',
        last_customer_page_title: 'Older Cake | Genie',
      },
      error: null,
    });

    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({
        action: 'send_message',
        conversationId: CONVERSATION_ID,
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
        conversation_id: CONVERSATION_ID,
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
    // One after() for the admin notification, one for the assistant.
    expect(notificationMocks.afterCallbacks).toHaveLength(2);

    await notificationMocks.afterCallbacks[0]();
    await notificationMocks.afterCallbacks[1]();

    expect(notificationMocks.runAssistantForMessage).toHaveBeenCalledTimes(1);
    expect(notificationMocks.runAssistantForMessage).toHaveBeenCalledWith(
      { conversationId: CONVERSATION_ID, messageId: 'message-1' },
      expect.objectContaining({ notifyHandoff: expect.any(Function) }),
    );
    expect(notificationMocks.triggerN8nWorkflow).toHaveBeenCalledTimes(1);
    expect(notificationMocks.triggerN8nWorkflow).toHaveBeenCalledWith({
      event: 'customer_chat.message_created',
      data: {
        messageId: 'message-1',
        conversationId: CONVERSATION_ID,
        senderType: 'customer',
        content: 'How much is this?',
        imageUrl: null,
        customerName: 'Maria Santos',
        customerEmail: 'maria@example.com',
        pageUrl: 'https://genie.ph/customizing/minimalist-bento-cake',
        pageTitle: 'Minimalist Bento Cake | Genie',
        createdAt: expect.any(String),
      },
      metadata: {
        notificationChannel: 'telegram',
      },
    });
  });

  it('does not schedule a notification when the customer message insert fails', async () => {
    tableHandlers.chat_messages.onInsertSelectSingle = async () => ({
      data: null,
      error: { message: 'Insert failed' },
    });

    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({
        action: 'send_message',
        conversationId: CONVERSATION_ID,
        content: 'Hello',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(notificationMocks.afterCallbacks).toHaveLength(0);
    expect(notificationMocks.triggerN8nWorkflow).not.toHaveBeenCalled();
  });

  it('links the verified user, email and name to a conversation found via the guest session', async () => {
    const updatedConversationPayloads: Record<string, unknown>[] = [];
    notificationMocks.getUser.mockResolvedValue({
      data: { user: { id: 'new-user-id', app_metadata: {} } },
      error: null,
    });

    // First query is by user_id and finds nothing; the second is by session_id.
    let queryCount = 0;
    tableHandlers.chat_conversations.onSingle = async () => {
      queryCount++;
      if (queryCount === 1) {
        return { data: null, error: { message: 'Not found' } };
      }
      return {
        data: {
          id: 'existing-conversation-id',
          user_id: null,
          session_id: 'guest_123',
          customer_email: null,
          customer_name: null,
        },
        error: null,
      };
    };
    tableHandlers.chat_conversations.onUpdate = (payload) => {
      updatedConversationPayloads.push(payload);
    };
    tableHandlers.chat_conversations.onUpdateEq = async () => ({
      data: { id: 'existing-conversation-id' },
      error: null,
    });

    const { POST } = await import('./route');
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { ...guestHeaders, Authorization: 'Bearer valid-token' },
      body: JSON.stringify({
        action: 'start_conversation',
        sessionId: 'guest_123',
        email: 'guest@example.com',
        name: 'Guest User',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(updatedConversationPayloads).toHaveLength(1);
    expect(updatedConversationPayloads[0]).toEqual(
      expect.objectContaining({
        user_id: 'new-user-id',
        customer_email: 'guest@example.com',
        customer_name: 'Guest User',
      }),
    );
    expect(updatedConversationPayloads[0]).not.toHaveProperty('session_id');
  });

  it('ignores a user id typed into the request body', async () => {
    const insertedConversationPayloads: Record<string, unknown>[] = [];
    tableHandlers.chat_conversations.onSingle = async () => ({ data: null, error: { message: 'Not found' } });
    tableHandlers.chat_conversations.onInsert = (payload) => {
      insertedConversationPayloads.push(payload);
    };
    tableHandlers.chat_conversations.onInsertSelectSingle = async () => ({ data: { id: CONVERSATION_ID }, error: null });

    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({ action: 'start_conversation', userId: 'victim-user-id', sessionId: 'guest_123' }),
    }));

    expect(response.status).toBe(201);
    expect(insertedConversationPayloads[0].user_id).toBeNull();
  });

  it('never opens a conversation just because the typed-in email matches', async () => {
    const updatedConversationPayloads: Record<string, unknown>[] = [];
    const insertedConversationPayloads: Record<string, unknown>[] = [];

    // Even if an email-matching conversation existed, no query may reach it.
    tableHandlers.chat_conversations.onSingle = async () => ({ data: null, error: { message: 'Not found' } });
    tableHandlers.chat_conversations.onUpdate = (payload) => {
      updatedConversationPayloads.push(payload);
    };
    tableHandlers.chat_conversations.onInsert = (payload) => {
      insertedConversationPayloads.push(payload);
    };
    tableHandlers.chat_conversations.onInsertSelectSingle = async () => ({ data: { id: CONVERSATION_ID }, error: null });

    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-chat-session': 'new-session-id' },
      body: JSON.stringify({
        action: 'start_conversation',
        sessionId: 'new-session-id',
        email: 'someone-elses@example.com',
        name: 'Attacker',
      }),
    }));

    expect(response.status).toBe(201);
    expect(updatedConversationPayloads).toHaveLength(0);
    expect(insertedConversationPayloads).toHaveLength(1);
    expect(insertedConversationPayloads[0]).toEqual(expect.objectContaining({ user_id: null, session_id: 'new-session-id' }));
  });

  it('tells the widget the assistant is about to answer when it is on and active for the chat', async () => {
    tableHandlers.chatbot_settings = { onMaybeSingle: async () => ({ data: { enabled: true }, error: null }) };
    tableHandlers.chat_conversations.onMaybeSingle = async () => ({
      data: { id: CONVERSATION_ID, user_id: null, session_id: 'guest_123', bot_state: 'active' },
      error: null,
    });
    tableHandlers.chat_messages.onInsertSelectSingle = async () => ({ data: { id: 'message-1' }, error: null });

    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({ action: 'send_message', conversationId: CONVERSATION_ID, content: 'do you deliver to Makati?' }),
    }));

    expect((await response.json()).assistantPending).toBe(true);
  });

  it.each([
    ['the assistant is switched off', { enabled: false }, 'active', 'do you deliver?'],
    ['the chat was handed to a human', { enabled: true }, 'handed_off', 'do you deliver?'],
    ['the message is only an image', { enabled: true }, 'active', '   '],
  ])('does not claim the assistant is typing when %s', async (_label, setting, botState, content) => {
    tableHandlers.chatbot_settings = { onMaybeSingle: async () => ({ data: setting, error: null }) };
    tableHandlers.chat_conversations.onMaybeSingle = async () => ({
      data: { id: CONVERSATION_ID, user_id: null, session_id: 'guest_123', bot_state: botState },
      error: null,
    });
    tableHandlers.chat_messages.onInsertSelectSingle = async () => ({ data: { id: 'message-1' }, error: null });

    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: guestHeaders,
      body: JSON.stringify({ action: 'send_message', conversationId: CONVERSATION_ID, content, imageUrl: content.trim() ? undefined : 'https://x/y.png' }),
    }));

    expect((await response.json()).assistantPending).toBe(false);
  });

  it('rejects messages for a conversation the caller does not own', async () => {
    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-chat-session': 'someone-elses-session' },
      body: JSON.stringify({ action: 'send_message', conversationId: CONVERSATION_ID, content: 'hi' }),
    }));

    expect(response.status).toBe(404);
    expect(notificationMocks.afterCallbacks).toHaveLength(0);
  });

  it('rejects messages that carry no proof of ownership at all', async () => {
    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_message', conversationId: CONVERSATION_ID, content: 'hi' }),
    }));

    expect(response.status).toBe(404);
  });
});

describe('GET /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationMocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
    tableHandlers.chat_conversations = {
      onMaybeSingle: async () => ({
        data: { id: CONVERSATION_ID, user_id: null, session_id: 'guest_123' },
        error: null,
      }),
    };
    tableHandlers.chat_messages = {};
  });

  it('refuses to list every conversation to the public', async () => {
    const { GET } = await import('./route');
    const response = await GET(new NextRequest('http://localhost/api/chat'));
    expect(response.status).toBe(403);
  });

  it('refuses to list every conversation to a signed-in customer', async () => {
    notificationMocks.getUser.mockResolvedValue({ data: { user: { id: 'customer', app_metadata: {} } }, error: null });
    const { GET } = await import('./route');
    const response = await GET(new NextRequest('http://localhost/api/chat', { headers: { Authorization: 'Bearer customer-token' } }));
    expect(response.status).toBe(403);
  });

  it('lets a dashboard admin list conversations', async () => {
    notificationMocks.getUser.mockResolvedValue({ data: { user: { id: 'admin', app_metadata: { genie_role: 'admin' } } }, error: null });
    const { GET } = await import('./route');
    const response = await GET(new NextRequest('http://localhost/api/chat', { headers: { Authorization: 'Bearer admin-token' } }));
    expect(response.status).not.toBe(403);
  });

  it('hides a conversation from callers without its session id', async () => {
    const { GET } = await import('./route');
    const response = await GET(new NextRequest(`http://localhost/api/chat?conversation_id=${CONVERSATION_ID}`, {
      headers: { 'x-chat-session': 'wrong-session' },
    }));
    expect(response.status).toBe(404);
  });

  it('returns messages to the guest session that owns the conversation', async () => {
    const { GET } = await import('./route');
    const response = await GET(new NextRequest(`http://localhost/api/chat?conversation_id=${CONVERSATION_ID}`, {
      headers: { 'x-chat-session': 'guest_123' },
    }));
    expect(response.status).not.toBe(404);
    expect(response.status).not.toBe(403);
  });
});
