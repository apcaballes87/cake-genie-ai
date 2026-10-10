export const BOT_CATEGORIES = [
  'delivery_area',
  'price_how_to',
  'greeting',
  'how_to_order',
  'payment_methods',
  'customization_general',
  'location_contact',
  'lead_time_general',
  'design_collections',
  'unsupported_product',
  'order_status',
  'complaint_refund',
  'bug_report',
  'specific_quote',
  'other',
  'noise',
] as const;

export type BotCategory = (typeof BOT_CATEGORIES)[number];
export type BotAction = 'reply' | 'handoff' | 'silent';

export type BotDecision = {
  action: BotAction;
  category: BotCategory;
  confidence: number;
  reply: string;
  reason: string;
};

export const DEFAULT_AUTO_CATEGORIES: BotCategory[] = [
  'delivery_area',
  'price_how_to',
  'greeting',
  'how_to_order',
  'payment_methods',
  'customization_general',
  'location_contact',
  'lead_time_general',
  'design_collections',
];

export const DEFAULT_MIN_CONFIDENCE = 0.75;
export const DEFAULT_TAKEOVER_WINDOW_MINUTES = 30;
export const DEFAULT_MAX_BOT_REPLIES = 6;

export const HANDOFF_HOLDING_MESSAGE =
  "Thanks! I've passed this to our team and they'll reply here shortly. 🙏";

// Topics the bot must never answer, regardless of what the model decides.
// Covers English, Tagalog/Taglish and Bisaya wording seen in real chats.
const FORCED_HANDOFF_PATTERNS: Array<{ category: BotCategory; pattern: RegExp }> = [
  { category: 'order_status', pattern: /\bORD-\d{6,}/i },
  {
    category: 'complaint_refund',
    pattern:
      /\b(refund|refundo|cancel|cancelled|canceled|complain|complaint|scam|fraud|chargeback|wrong order|damaged|melted|not happy|disappointed|alisin|ayaw ko na|hindi na po ako mag-?order|wala pa (rin )?(po )?(akong )?(natatanggap|dumating))\b/i,
  },
  {
    category: 'order_status',
    pattern:
      /\b(order status|status of (my )?order|update on (my )?order|already paid|i('ve| have) paid|payment received|nag-?bayad na|nabayad na|where('s| is) my (order|cake)|rider|driver|otw|on the way|edit my order|change my order|change the delivery)\b/i,
  },
  {
    category: 'bug_report',
    pattern:
      /\b(can'?t|cannot|unable to|not able to|failed to|error|not working|page not found|disappears?|lagging|stuck)\b.*\b(cart|checkout|address|pay|payment|upload|order|page)\b|\b(cart|checkout|address|payment|upload|page)\b.*\b(disappears?|not working|error|failed|stuck|lagging)\b/i,
  },
  {
    category: 'other',
    pattern: /\b(speak|talk|chat) (to|with) (a |an )?(person|human|agent|staff|someone)\b|\bhuman\b|\bagent\b|\bmanager\b/i,
  },
];

export function findForcedHandoff(text: string): BotCategory | null {
  for (const { category, pattern } of FORCED_HANDOFF_PATTERNS) {
    if (pattern.test(text)) {
      return category;
    }
  }
  return null;
}

export function parseCategoryList(value: string | undefined, fallback: BotCategory[]): BotCategory[] {
  if (!value?.trim()) {
    return fallback;
  }

  const requested = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is BotCategory => (BOT_CATEGORIES as readonly string[]).includes(item));

  return requested;
}

export type PreconditionInput = {
  enabled: boolean;
  botState: string | null;
  lastHumanReplyAt: string | null;
  botReplyCount: number;
  now?: number;
  takeoverWindowMinutes?: number;
  maxBotReplies?: number;
};

/** Returns a reason string when the bot must not act at all, otherwise null. */
export function getSkipReason(input: PreconditionInput): string | null {
  if (!input.enabled) {
    return 'bot_disabled';
  }
  if (input.botState !== 'active') {
    return `bot_state_${input.botState ?? 'unknown'}`;
  }
  if (input.lastHumanReplyAt) {
    const windowMs = (input.takeoverWindowMinutes ?? DEFAULT_TAKEOVER_WINDOW_MINUTES) * 60_000;
    const age = (input.now ?? Date.now()) - new Date(input.lastHumanReplyAt).getTime();
    if (age < windowMs) {
      return 'human_recently_replied';
    }
  }
  if (input.botReplyCount >= (input.maxBotReplies ?? DEFAULT_MAX_BOT_REPLIES)) {
    return 'bot_reply_cap_reached';
  }
  return null;
}

export type PolicyInput = {
  decision: BotDecision;
  allowedCategories: BotCategory[];
  minConfidence?: number;
};

/** Final, code-enforced action. The model can only reply within the allowlist and confidence floor. */
export function applyDecisionPolicy({ decision, allowedCategories, minConfidence }: PolicyInput): BotDecision {
  if (decision.action === 'silent') {
    return decision;
  }

  if (decision.action === 'reply') {
    const confident = decision.confidence >= (minConfidence ?? DEFAULT_MIN_CONFIDENCE);
    const allowed = allowedCategories.includes(decision.category);
    const hasReply = decision.reply.trim().length > 0;

    if (!confident || !allowed || !hasReply) {
      return {
        ...decision,
        action: 'handoff',
        reply: '',
        reason: !hasReply
          ? 'empty_reply'
          : !allowed
            ? `category_not_allowlisted:${decision.category}`
            : `low_confidence:${decision.confidence}`,
      };
    }
  }

  return decision;
}

const ALLOWED_SITE_PATHS = new Set([
  '/',
  '/collections',
  '/price-list',
  '/how-to-order',
  '/delivery-rates',
  '/payment-options',
  '/customizing',
  '/contact',
  '/reviews',
  '/faq',
  '/cake-price-calculator',
  '/is-genie-ph-a-scam',
  '/?upload=1',
]);

/**
 * Returns a reason when a reply links somewhere the bot should not send people
 * (an unknown page, or a collection slug that does not exist), otherwise null.
 */
export function findInvalidReplyLink(reply: string, collectionSlugs: ReadonlySet<string>): string | null {
  const matches = reply.match(/https?:\/\/(?:www\.)?genie\.ph[^\s)>\]"']*/gi) ?? [];

  for (const raw of matches) {
    const url = raw.replace(/[.,!?;:]+$/, '');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return `invalid_link:${url}`;
    }

    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    const collectionMatch = path.match(/^\/collections\/([a-z0-9-]+)$/i);
    if (collectionMatch) {
      if (!collectionSlugs.has(collectionMatch[1].toLowerCase())) {
        return `unknown_collection:${collectionMatch[1]}`;
      }
      continue;
    }

    const withQuery = path === '/' && parsed.search === '?upload=1' ? '/?upload=1' : path;
    if (!ALLOWED_SITE_PATHS.has(withQuery)) {
      return `unknown_link:${path}`;
    }
  }

  return null;
}
