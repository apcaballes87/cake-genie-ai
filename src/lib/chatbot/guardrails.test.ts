import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTO_CATEGORIES,
  applyDecisionPolicy,
  findForcedHandoff,
  findInvalidReplyLink,
  getSkipReason,
  parseCategoryList,
  type BotDecision,
} from '@/lib/chatbot/guardrails';

const reply = (overrides: Partial<BotDecision> = {}): BotDecision => ({
  action: 'reply',
  category: 'delivery_area',
  confidence: 0.95,
  reply: 'We deliver within Metro Cebu.',
  reason: 'delivery question',
  ...overrides,
});

describe('findForcedHandoff', () => {
  // Real customer messages that must never be auto-answered.
  it.each([
    ['Good morning, just want to check the status of my order #ORD-20260814-23231', 'order_status'],
    ['I already paid in full', 'order_status'],
    ['Hello po, we cannot reach the rider', 'order_status'],
    ['Refundo na lang iyan', 'complaint_refund'],
    ['Hindi na po ako mag-order', 'complaint_refund'],
    ['I want to cancel my order', 'complaint_refund'],
    ['Everytime I add something to the cart it disappears', 'bug_report'],
    ['I cannot successfully add to cart', 'bug_report'],
    ['I wish to speak to a person', 'other'],
  ])('forces handoff for %j', (text, category) => {
    expect(findForcedHandoff(text)).toBe(category);
  });

  // Real customer messages the bot is allowed to consider.
  it.each([
    'Do you deliver in Cavite?',
    'How much is this',
    'hello',
    'Where are you located?',
    'Can we customize the size of this design? like 8"x8"',
    'is there no payment with credit card?',
  ])('does not force handoff for %j', (text) => {
    expect(findForcedHandoff(text)).toBeNull();
  });
});

describe('getSkipReason', () => {
  const base = { enabled: true, botState: 'active', lastHumanReplyAt: null, botReplyCount: 0 };

  it('allows the bot when everything is clear', () => {
    expect(getSkipReason(base)).toBeNull();
  });

  it('respects the kill switch', () => {
    expect(getSkipReason({ ...base, enabled: false })).toBe('bot_disabled');
  });

  it('stays quiet once handed off or switched off', () => {
    expect(getSkipReason({ ...base, botState: 'handed_off' })).toBe('bot_state_handed_off');
    expect(getSkipReason({ ...base, botState: 'off' })).toBe('bot_state_off');
  });

  it('stays quiet after a recent human reply but resumes later', () => {
    const now = Date.parse('2026-10-10T10:00:00Z');
    expect(
      getSkipReason({ ...base, now, lastHumanReplyAt: '2026-10-10T09:45:00Z' }),
    ).toBe('human_recently_replied');
    expect(getSkipReason({ ...base, now, lastHumanReplyAt: '2026-10-10T09:00:00Z' })).toBeNull();
  });

  it('caps bot replies per conversation', () => {
    expect(getSkipReason({ ...base, botReplyCount: 6 })).toBe('bot_reply_cap_reached');
  });
});

describe('applyDecisionPolicy', () => {
  it('keeps a confident reply in an allowlisted category', () => {
    expect(applyDecisionPolicy({ decision: reply(), allowedCategories: DEFAULT_AUTO_CATEGORIES }).action).toBe('reply');
  });

  it('downgrades low-confidence replies to handoff', () => {
    const result = applyDecisionPolicy({ decision: reply({ confidence: 0.4 }), allowedCategories: DEFAULT_AUTO_CATEGORIES });
    expect(result.action).toBe('handoff');
    expect(result.reply).toBe('');
  });

  it('downgrades replies in categories that are not allowlisted', () => {
    const result = applyDecisionPolicy({
      decision: reply({ category: 'complaint_refund' }),
      allowedCategories: DEFAULT_AUTO_CATEGORIES,
    });
    expect(result.action).toBe('handoff');
    expect(result.reason).toContain('category_not_allowlisted');
  });

  it('downgrades empty replies', () => {
    expect(applyDecisionPolicy({ decision: reply({ reply: '  ' }), allowedCategories: DEFAULT_AUTO_CATEGORIES }).action).toBe('handoff');
  });

  it('passes silent and handoff through untouched', () => {
    const silent = reply({ action: 'silent', reply: '' });
    expect(applyDecisionPolicy({ decision: silent, allowedCategories: [] })).toEqual(silent);
  });
});

describe('parseCategoryList', () => {
  it('falls back when unset and drops unknown categories', () => {
    expect(parseCategoryList(undefined, ['greeting'])).toEqual(['greeting']);
    expect(parseCategoryList('greeting, nope ,delivery_area', [])).toEqual(['greeting', 'delivery_area']);
  });

  it('an explicitly empty-after-filter list allows nothing', () => {
    expect(parseCategoryList('nope', ['greeting'])).toEqual([]);
  });
});

describe('findInvalidReplyLink', () => {
  const slugs = new Set(['minimalist-cake', 'kuromi-cake']);

  it('accepts known pages and known collections', () => {
    expect(findInvalidReplyLink('See https://genie.ph/price-list and https://genie.ph/collections/kuromi-cake.', slugs)).toBeNull();
    expect(findInvalidReplyLink('Upload at https://genie.ph/?upload=1', slugs)).toBeNull();
    expect(findInvalidReplyLink('No links here', slugs)).toBeNull();
  });

  it('rejects unknown collections and unknown pages', () => {
    expect(findInvalidReplyLink('https://genie.ph/collections/nope-cake', slugs)).toBe('unknown_collection:nope-cake');
    expect(findInvalidReplyLink('https://genie.ph/admin/chat', slugs)).toBe('unknown_link:/admin/chat');
  });
});
