import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildTranscript,
  getPendingCustomerBurst,
  parseDecision,
  runAssistantForMessage,
  type HandoffNotice,
} from '@/lib/chatbot/assistant';
import { resetChatbotSettingsCache } from '@/lib/chatbot/settings';
import { HANDOFF_HOLDING_MESSAGE, type BotDecision } from '@/lib/chatbot/guardrails';

type Row = {
  id: string;
  sender_type: 'customer' | 'merchant' | 'system';
  content: string | null;
  image_url: string | null;
  is_bot: boolean | null;
  created_at: string;
};

const row = (id: string, sender: Row['sender_type'], content: string | null, extra: Partial<Row> = {}): Row => ({
  id,
  sender_type: sender,
  content,
  image_url: null,
  is_bot: false,
  created_at: `2026-10-10T10:00:${id.padStart(2, '0')}Z`,
  ...extra,
});

function fakeSupabase({ rows, botState = 'active', enabled = true }: { rows: Row[]; botState?: string; enabled?: boolean }) {
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { enabled }, error: null }),
          single: async () => ({ data: { bot_state: botState }, error: null }),
          order: () => ({
            limit: async () => ({ data: [...rows].reverse(), error: null }),
          }),
        }),
      }),
      insert: async (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        return { error: null };
      },
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          updates.push({ table, payload });
          return { error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;

  return { client, inserts, updates };
}

const env = {} as unknown as NodeJS.ProcessEnv;
const noSleep = async () => undefined;

const run = (
  rows: Row[],
  decide: (t: string) => Promise<BotDecision>,
  opts: { botState?: string; env?: NodeJS.ProcessEnv; messageId?: string; enabled?: boolean } = {},
) => {
  resetChatbotSettingsCache();
  const fake = fakeSupabase({ rows, botState: opts.botState, enabled: opts.enabled });
  const notices: HandoffNotice[] = [];
  const decideSpy = vi.fn(decide);
  const promise = runAssistantForMessage(
    { conversationId: 'c1', messageId: opts.messageId ?? rows[rows.length - 1].id },
    { supabase: fake.client, decide: decideSpy, notifyHandoff: async (n) => void notices.push(n), sleep: noSleep, env: opts.env ?? env },
  );
  return { promise, decideSpy, notices, ...fake };
};

const confident: BotDecision = {
  action: 'reply',
  category: 'delivery_area',
  confidence: 0.95,
  reply: 'We deliver within Metro Cebu only for now.',
  reason: 'delivery area question',
};

describe('runAssistantForMessage', () => {
  it('replies to an easy question and stores it as a bot message', async () => {
    const { promise, inserts, notices } = run([row('1', 'system', 'Hi! How can we help you today?'), row('2', 'customer', 'Do you deliver to Makati?')], async () => confident);
    const outcome = await promise;

    expect(outcome.status).toBe('done');
    const reply = inserts.find((i) => i.table === 'chat_messages');
    expect(reply?.payload).toMatchObject({ is_bot: true, sender_type: 'merchant', content: confident.reply });
    expect(inserts.find((i) => i.table === 'chat_bot_events')?.payload).toMatchObject({ action: 'reply' });
    expect(notices).toHaveLength(0);
  });

  it('does nothing when the dashboard toggle is off (no model call, no writes)', async () => {
    const { promise, decideSpy, inserts } = run([row('1', 'customer', 'hello')], async () => confident, { enabled: false });
    expect(await promise).toEqual({ status: 'skipped', reason: 'bot_disabled' });
    expect(decideSpy).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it('the CHATBOT_ENABLED=false env override beats the dashboard toggle', async () => {
    const { promise, decideSpy } = run([row('1', 'customer', 'hello')], async () => confident, {
      enabled: true,
      env: { CHATBOT_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv,
    });
    expect(await promise).toEqual({ status: 'skipped', reason: 'bot_disabled' });
    expect(decideSpy).not.toHaveBeenCalled();
  });

  it('hands off refund requests without calling the model, sends the holding message once, and alerts the admin', async () => {
    const { promise, decideSpy, inserts, updates, notices } = run([row('1', 'customer', 'Refundo na lang iyan')], async () => confident);
    await promise;

    expect(decideSpy).not.toHaveBeenCalled();
    expect(inserts.find((i) => i.table === 'chat_messages')?.payload).toMatchObject({ content: HANDOFF_HOLDING_MESSAGE, is_bot: true });
    expect(updates.find((u) => u.table === 'chat_conversations')?.payload).not.toHaveProperty('bot_state');
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ category: 'complaint_refund', holdingMessageSent: true });
  });

  it('stays silent on image-only messages because the chat widget prices images itself', async () => {
    const { promise, decideSpy, inserts, notices } = run([row('1', 'customer', '', { image_url: 'https://x/y.png' })], async () => confident);
    const outcome = await promise;
    expect(outcome).toMatchObject({ status: 'done', decision: { action: 'silent', reason: 'image_handled_by_chat_pricing' } });
    expect(decideSpy).not.toHaveBeenCalled();
    expect(inserts.filter((i) => i.table === 'chat_messages')).toHaveLength(0);
    expect(notices).toHaveLength(0);
  });

  it('turns a reply that links to a made-up collection into a handoff', async () => {
    const { promise, notices, inserts } = run([row('1', 'customer', 'do you have dinosaur cakes?')], async () => ({
      ...confident,
      category: 'design_collections',
      reply: 'Yes! https://genie.ph/collections/made-up-dino-cake',
    }));
    await promise;
    expect(notices[0]?.reason).toContain('unknown_collection');
    expect(inserts.find((i) => i.table === 'chat_messages')?.payload.content).toBe(HANDOFF_HOLDING_MESSAGE);
  });

  it('allows featured collection links', async () => {
    const { promise, inserts } = run([row('1', 'customer', 'do you have minimalist cakes?')], async () => ({
      ...confident,
      category: 'design_collections',
      reply: 'Yes! Browse them here: https://genie.ph/collections/minimalist-cake',
    }));
    await promise;
    expect(inserts.find((i) => i.table === 'chat_messages')?.payload).toMatchObject({ is_bot: true });
  });

  it('downgrades a low-confidence model answer to a handoff', async () => {
    const { promise, notices, inserts } = run([row('1', 'customer', 'Can you make a pomeranian cake?')], async () => ({ ...confident, category: 'customization_general', confidence: 0.3 }));
    await promise;
    expect(notices).toHaveLength(1);
    expect(inserts.find((i) => i.table === 'chat_messages')?.payload.content).toBe(HANDOFF_HOLDING_MESSAGE);
  });

  it('hands off when the model call throws', async () => {
    const { promise, notices } = run([row('1', 'customer', 'hello')], async () => {
      throw new Error('boom');
    });
    await promise;
    expect(notices[0]).toMatchObject({ reason: 'model_error' });
  });

  it('stays silent for gibberish without writing a chat message', async () => {
    const { promise, inserts, notices } = run([row('1', 'customer', '3vd8ytk3c36i3')], async () => ({ action: 'silent', category: 'noise', confidence: 0.9, reply: '', reason: 'gibberish' }));
    await promise;
    expect(inserts.filter((i) => i.table === 'chat_messages')).toHaveLength(0);
    expect(notices).toHaveLength(0);
  });

  it('stays quiet after a human admin replied recently', async () => {
    const recent = new Date().toISOString();
    const { promise, decideSpy } = run(
      [row('1', 'customer', 'hi'), row('2', 'merchant', 'Hi ma\'am', { created_at: recent }), row('3', 'customer', 'Do you deliver to Cebu?', { created_at: new Date().toISOString() })],
      async () => confident,
    );
    expect(await promise).toEqual({ status: 'skipped', reason: 'human_recently_replied' });
    expect(decideSpy).not.toHaveBeenCalled();
  });

  it('stays quiet when an admin switched the assistant off for this chat', async () => {
    const { promise } = run([row('1', 'customer', 'hello')], async () => confident, { botState: 'off' });
    expect(await promise).toEqual({ status: 'skipped', reason: 'bot_state_off' });
  });

  it('still answers an easy question after an earlier handoff', async () => {
    const { promise, inserts } = run(
      [row('1', 'customer', 'can I order for tomorrow?'), row('2', 'merchant', HANDOFF_HOLDING_MESSAGE, { is_bot: true }), row('3', 'customer', 'Are you open?')],
      async () => confident,
      { botState: 'handed_off' },
    );
    const outcome = await promise;
    expect(outcome).toMatchObject({ status: 'done', decision: { action: 'reply' } });
    expect(inserts.find((i) => i.table === 'chat_messages')?.payload).toMatchObject({ is_bot: true, content: confident.reply });
  });

  it('does not repeat the holding message on a second handoff in a row', async () => {
    const { promise, inserts, notices } = run(
      [row('1', 'customer', 'I want a refund'), row('2', 'merchant', HANDOFF_HOLDING_MESSAGE, { is_bot: true }), row('3', 'customer', 'hello?? I want a refund')],
      async () => confident,
    );
    await promise;
    expect(inserts.filter((i) => i.table === 'chat_messages')).toHaveLength(0);
    expect(notices).toHaveLength(1);
  });

  it('lets only the newest message in a burst trigger an answer', async () => {
    const rows = [row('1', 'customer', 'hi'), row('2', 'customer', 'how much is this')];
    const { promise, decideSpy } = run(rows, async () => confident, { messageId: '1' });
    expect(await promise).toEqual({ status: 'superseded' });
    expect(decideSpy).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('collects the customer burst since the last non-customer message', () => {
    const rows = [row('1', 'customer', 'old'), row('2', 'merchant', 'answer'), row('3', 'customer', 'hi'), row('4', 'customer', 'how much')];
    expect(getPendingCustomerBurst(rows).map((r) => r.id)).toEqual(['3', '4']);
  });

  it('labels speakers in the transcript and marks images', () => {
    const transcript = buildTranscript([row('1', 'customer', ''), row('2', 'merchant', 'Hello', { is_bot: true })].map((r, i) => (i === 0 ? { ...r, image_url: 'x' } : r)));
    expect(transcript).toContain('Customer: [sent an image; the chat prices images automatically]');
    expect(transcript).toContain('Assistant: Hello');
  });

  it('parses valid decisions and rejects junk', () => {
    expect(parseDecision('{"action":"reply","category":"greeting","confidence":0.9,"reply":"Hi!","reason":"x"}')).toMatchObject({ action: 'reply', category: 'greeting' });
    expect(parseDecision('{"action":"explode"}')).toBeNull();
    expect(parseDecision('not json')).toBeNull();
    expect(parseDecision('{"action":"reply","category":"made_up","confidence":9,"reply":"x","reason":"y"}')).toMatchObject({ category: 'other', confidence: 1 });
  });
});
