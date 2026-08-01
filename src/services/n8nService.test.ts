import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { triggerN8nWorkflow } from './n8nService';

const originalEnvironment = {
  customerChatUrl: process.env.N8N_CUSTOMER_CHAT_WEBHOOK_URL,
  customerChatSecret: process.env.N8N_CUSTOMER_CHAT_WEBHOOK_SECRET,
  genericUrl: process.env.N8N_WEBHOOK_URL,
  genericSecret: process.env.N8N_WEBHOOK_SECRET,
};

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('triggerN8nWorkflow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('accepted', { status: 200 })));
  });

  afterEach(() => {
    restoreEnvironmentVariable('N8N_CUSTOMER_CHAT_WEBHOOK_URL', originalEnvironment.customerChatUrl);
    restoreEnvironmentVariable('N8N_CUSTOMER_CHAT_WEBHOOK_SECRET', originalEnvironment.customerChatSecret);
    restoreEnvironmentVariable('N8N_WEBHOOK_URL', originalEnvironment.genericUrl);
    restoreEnvironmentVariable('N8N_WEBHOOK_SECRET', originalEnvironment.genericSecret);
    vi.unstubAllGlobals();
  });

  it('routes customer-chat events to the dedicated authenticated webhook', async () => {
    process.env.N8N_CUSTOMER_CHAT_WEBHOOK_URL = 'https://n8n.example.com/webhook/customer-chat';
    process.env.N8N_CUSTOMER_CHAT_WEBHOOK_SECRET = 'customer-chat-secret';
    process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/generic';
    process.env.N8N_WEBHOOK_SECRET = 'generic-secret';

    const result = await triggerN8nWorkflow({
      event: 'customer_chat.message_created',
      data: { conversationId: 'conversation-1' },
    });

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/customer-chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-n8n-secret': 'customer-chat-secret',
        }),
      }),
    );
  });

  it('keeps the generic webhook fallback for existing integrations', async () => {
    delete process.env.N8N_CUSTOMER_CHAT_WEBHOOK_URL;
    delete process.env.N8N_CUSTOMER_CHAT_WEBHOOK_SECRET;
    process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/generic';
    process.env.N8N_WEBHOOK_SECRET = 'generic-secret';

    const result = await triggerN8nWorkflow({
      event: 'customer_chat.message_created',
    });

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/generic',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-n8n-secret': 'generic-secret',
        }),
      }),
    );
  });
});
