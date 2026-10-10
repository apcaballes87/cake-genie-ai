import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAnthropic } from '@/lib/ai/claudeClient';
import { getChatbotCollections, type ChatbotCollection } from '@/lib/chatbot/collections';
import { buildSystemPrompt } from '@/lib/chatbot/knowledge';
import { isChatbotEnabled } from '@/lib/chatbot/settings';
import { FEATURED_COLLECTION_LINKS } from '@/lib/seo/priorityCollections';
import {
  BOT_CATEGORIES,
  DEFAULT_AUTO_CATEGORIES,
  DEFAULT_MIN_CONFIDENCE,
  HANDOFF_HOLDING_MESSAGE,
  applyDecisionPolicy,
  findForcedHandoff,
  findInvalidReplyLink,
  getSkipReason,
  parseCategoryList,
  type BotCategory,
  type BotDecision,
} from '@/lib/chatbot/guardrails';

const DEFAULT_MODEL = 'claude-haiku-5-5';
const DEFAULT_DEBOUNCE_MS = 4000;
const MODEL_TIMEOUT_MS = 12000;
const HISTORY_LIMIT = 14;

type ChatRow = {
  id: string;
  sender_type: 'customer' | 'merchant' | 'system';
  content: string | null;
  image_url: string | null;
  is_bot: boolean | null;
  created_at: string;
};

export type HandoffNotice = {
  conversationId: string;
  messageId: string;
  category: BotCategory;
  reason: string;
  customerText: string;
  hasImage: boolean;
  holdingMessageSent: boolean;
};

export type AssistantDeps = {
  supabase: SupabaseClient;
  decide?: (transcript: string, collections: ChatbotCollection[]) => Promise<BotDecision>;
  notifyHandoff?: (notice: HandoffNotice) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  env?: NodeJS.ProcessEnv;
};

export type AssistantOutcome =
  | { status: 'skipped'; reason: string }
  | { status: 'superseded' }
  | { status: 'done'; decision: BotDecision };

const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['reply', 'handoff', 'silent'] },
    category: { type: 'string', enum: [...BOT_CATEGORIES] },
    confidence: { type: 'number' },
    reply: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['action', 'category', 'confidence', 'reply', 'reason'],
  additionalProperties: false,
} as const;

function handoffDecision(category: BotCategory, reason: string): BotDecision {
  return { action: 'handoff', category, confidence: 1, reply: '', reason };
}

function isBotCategory(value: unknown): value is BotCategory {
  return typeof value === 'string' && (BOT_CATEGORIES as readonly string[]).includes(value);
}

export function parseDecision(raw: string): BotDecision | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const value = parsed as Record<string, unknown>;
  const action = value.action;
  if (action !== 'reply' && action !== 'handoff' && action !== 'silent') {
    return null;
  }

  return {
    action,
    category: isBotCategory(value.category) ? value.category : 'other',
    confidence: typeof value.confidence === 'number' ? Math.min(1, Math.max(0, value.confidence)) : 0,
    reply: typeof value.reply === 'string' ? value.reply.trim().slice(0, 1200) : '',
    reason: typeof value.reason === 'string' ? value.reason.slice(0, 300) : '',
  };
}

export async function decideWithClaude(
  transcript: string,
  collections: ChatbotCollection[] = [],
  env: NodeJS.ProcessEnv = process.env,
): Promise<BotDecision> {
  const anthropic = getAnthropic();
  const model = env.CHATBOT_MODEL?.trim() || DEFAULT_MODEL;

  const buildParams = (withSchema: boolean): Anthropic.MessageCreateParamsNonStreaming => ({
    model,
    max_tokens: 600,
    output_config: {
      effort: 'low',
      ...(withSchema ? { format: { type: 'json_schema', schema: DECISION_SCHEMA as unknown as Record<string, unknown> } } : {}),
    },
    system: [
      {
        type: 'text',
        text: withSchema
          ? buildSystemPrompt(collections)
          : `${buildSystemPrompt(collections)}\n\nRespond with only one JSON object matching this JSON Schema:\n${JSON.stringify(DECISION_SCHEMA)}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: transcript }],
  });

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create(buildParams(true), { timeout: MODEL_TIMEOUT_MS });
  } catch (error) {
    if (!(error instanceof Anthropic.BadRequestError)) {
      throw error;
    }
    response = await anthropic.messages.create(buildParams(false), { timeout: MODEL_TIMEOUT_MS });
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1');

  const decision = parseDecision(text);
  if (!decision) {
    return handoffDecision('other', 'unparseable_model_output');
  }
  return decision;
}

export function buildTranscript(rows: ChatRow[]): string {
  const lines = rows.map((row) => {
    const who = row.sender_type === 'customer'
      ? 'Customer'
      : row.sender_type === 'system'
        ? 'System'
        : row.is_bot
          ? 'Assistant'
          : 'Team';
    const body = [(row.content ?? '').trim(), row.image_url ? '[sent an image; the chat prices images automatically]' : ''].filter(Boolean).join(' ');
    return body ? `${who}: ${body}` : null;
  });

  return [
    'Conversation so far (oldest first). Decide how to handle the customer\'s LATEST message(s).',
    '<conversation>',
    ...lines.filter((line): line is string => Boolean(line)),
    '</conversation>',
  ].join('\n');
}

/** Customer messages since the last non-customer message, i.e. the burst we are answering. */
export function getPendingCustomerBurst(rowsOldestFirst: ChatRow[]): ChatRow[] {
  const burst: ChatRow[] = [];
  for (let index = rowsOldestFirst.length - 1; index >= 0; index -= 1) {
    const row = rowsOldestFirst[index];
    if (row.sender_type === 'customer') {
      burst.unshift(row);
    } else if (row.sender_type === 'merchant' || burst.length > 0) {
      break;
    }
  }
  return burst;
}

export async function runAssistantForMessage(
  { conversationId, messageId }: { conversationId: string; messageId: string },
  deps: AssistantDeps,
): Promise<AssistantOutcome> {
  const env = deps.env ?? process.env;
  const { supabase } = deps;
  const enabled = await isChatbotEnabled(supabase, env);

  if (!enabled) {
    return { status: 'skipped', reason: 'bot_disabled' };
  }

  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const debounceMs = Number.isFinite(Number(env.CHATBOT_DEBOUNCE_MS)) && env.CHATBOT_DEBOUNCE_MS
    ? Number(env.CHATBOT_DEBOUNCE_MS)
    : DEFAULT_DEBOUNCE_MS;
  await sleep(debounceMs);

  const [conversationResult, messagesResult] = await Promise.all([
    supabase.from('chat_conversations').select('bot_state').eq('id', conversationId).single(),
    supabase
      .from('chat_messages')
      .select('id, sender_type, content, image_url, is_bot, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  // Fail closed: if the bot columns are missing or the read fails, never act.
  if (conversationResult.error || messagesResult.error || !messagesResult.data) {
    console.warn('[chat-assistant] Skipping; could not load state:', conversationResult.error?.message ?? messagesResult.error?.message);
    return { status: 'skipped', reason: 'state_unavailable' };
  }

  const rows = [...(messagesResult.data as ChatRow[])].reverse();
  const latestCustomer = [...rows].reverse().find((row) => row.sender_type === 'customer');
  if (!latestCustomer || latestCustomer.id !== messageId) {
    return { status: 'superseded' };
  }

  const lastHumanReply = [...rows].reverse().find((row) => row.sender_type === 'merchant' && !row.is_bot);
  const skipReason = getSkipReason({
    enabled,
    botState: (conversationResult.data as { bot_state: string | null } | null)?.bot_state ?? null,
    lastHumanReplyAt: lastHumanReply?.created_at ?? null,
    botReplyCount: rows.filter((row) => row.is_bot).length,
  });

  const burst = getPendingCustomerBurst(rows);
  const customerText = burst.map((row) => (row.content ?? '').trim()).filter(Boolean).join('\n');
  const hasImage = burst.some((row) => Boolean(row.image_url));

  const logEvent = async (decision: BotDecision | null, action: string, extra: Record<string, unknown> = {}) => {
    const { error } = await supabase.from('chat_bot_events').insert({
      conversation_id: conversationId,
      message_id: messageId,
      action,
      category: decision?.category ?? null,
      confidence: decision?.confidence ?? null,
      reason: decision?.reason ?? null,
      reply: decision?.reply || null,
      model: env.CHATBOT_MODEL?.trim() || DEFAULT_MODEL,
      ...extra,
    });
    if (error) {
      console.warn('[chat-assistant] Could not log bot event:', error.message);
    }
  };

  if (skipReason) {
    await logEvent(null, 'skipped', { reason: skipReason });
    return { status: 'skipped', reason: skipReason };
  }

  const startedAt = Date.now();
  let decision: BotDecision;
  let collections: ChatbotCollection[] = [];

  const forcedCategory = findForcedHandoff(customerText);
  if (forcedCategory) {
    decision = handoffDecision(forcedCategory, `forced_handoff:${forcedCategory}`);
  } else if (!customerText && hasImage) {
    // The chat widget analyzes images itself and posts the price + customize link
    // (or a manual-review notice), and the admin is alerted for every message.
    decision = { action: 'silent', category: 'noise', confidence: 1, reply: '', reason: 'image_handled_by_chat_pricing' };
  } else {
    try {
      collections = await getChatbotCollections(supabase);
      const decide = deps.decide ?? ((transcript: string, list: ChatbotCollection[]) => decideWithClaude(transcript, list, env));
      decision = await decide(buildTranscript(rows), collections);
    } catch (error) {
      console.error('[chat-assistant] Model call failed:', error);
      decision = handoffDecision('other', 'model_error');
    }
  }

  const minConfidence = Number(env.CHATBOT_MIN_CONFIDENCE);
  decision = applyDecisionPolicy({
    decision,
    allowedCategories: parseCategoryList(env.CHATBOT_AUTO_CATEGORIES, DEFAULT_AUTO_CATEGORIES),
    minConfidence: Number.isFinite(minConfidence) && env.CHATBOT_MIN_CONFIDENCE ? minConfidence : DEFAULT_MIN_CONFIDENCE,
  });

  if (decision.action === 'reply') {
    const knownSlugs = new Set<string>([
      ...collections.map((item) => item.slug),
      ...FEATURED_COLLECTION_LINKS.map((item) => item.slug),
    ]);
    const linkProblem = findInvalidReplyLink(decision.reply, knownSlugs);
    if (linkProblem) {
      decision = { ...decision, action: 'handoff', reply: '', reason: linkProblem };
    }
  }

  const latencyMs = Date.now() - startedAt;

  if (decision.action === 'silent') {
    await logEvent(decision, 'silent', { latency_ms: latencyMs });
    return { status: 'done', decision };
  }

  if (decision.action === 'reply') {
    const { error } = await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      content: decision.reply,
      sender_type: 'merchant',
      is_bot: true,
      is_read: false,
    });
    if (error) {
      console.error('[chat-assistant] Could not store bot reply:', error.message);
      await logEvent(decision, 'error', { latency_ms: latencyMs, reason: `insert_failed:${error.message}` });
      return { status: 'skipped', reason: 'insert_failed' };
    }
    await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    await logEvent(decision, 'reply', { latency_ms: latencyMs });
    return { status: 'done', decision };
  }

  // handoff: one holding message, flip the conversation to handed_off, alert the admin.
  const { error: holdingError } = await supabase.from('chat_messages').insert({
    conversation_id: conversationId,
    content: HANDOFF_HOLDING_MESSAGE,
    sender_type: 'merchant',
    is_bot: true,
    is_read: false,
  });
  if (holdingError) {
    console.warn('[chat-assistant] Could not store holding message:', holdingError.message);
  }

  await supabase
    .from('chat_conversations')
    .update({ bot_state: 'handed_off', updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  await logEvent(decision, 'handoff', { latency_ms: latencyMs });

  try {
    await deps.notifyHandoff?.({
      conversationId,
      messageId,
      category: decision.category,
      reason: decision.reason,
      customerText,
      hasImage,
      holdingMessageSent: !holdingError,
    });
  } catch (error) {
    console.error('[chat-assistant] Handoff notification failed:', error);
  }

  return { status: 'done', decision };
}
