import type { SupabaseClient } from '@supabase/supabase-js';

type DiscountCodeRow = {
  code: string;
  is_active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  times_used: number | null;
};

type SubscriberRow = {
  discount_code: string | null;
};

const DISCOUNT_CODE_SELECT = 'code, is_active, expires_at, max_uses, times_used';

export type ExistingSignupDiscountLookup =
  | { status: 'reusable'; code: string }
  | { status: 'repairable' }
  | { status: 'blocked'; message: string }
  | { status: 'none' };

/**
 * Uses a character set that avoids visual ambiguity (no 0/O/1/I).
 */
export function generateSignupDiscountCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 7; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GENIE${suffix}`;
}

export function isDiscountCodeReusable(
  discountCode: DiscountCodeRow | null | undefined,
  now = new Date()
): discountCode is DiscountCodeRow {
  if (!discountCode?.code || !discountCode.is_active) {
    return false;
  }

  if (discountCode.expires_at && new Date(discountCode.expires_at) < now) {
    return false;
  }

  if (
    discountCode.max_uses !== null &&
    discountCode.max_uses !== undefined &&
    (discountCode.times_used ?? 0) >= discountCode.max_uses
  ) {
    return false;
  }

  return true;
}

async function findCodeRecord(
  supabase: Pick<SupabaseClient, 'from'>,
  code: string
): Promise<DiscountCodeRow | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const { data } = await supabase
    .from('discount_codes')
    .select(DISCOUNT_CODE_SELECT)
    .eq('code', normalizedCode)
    .maybeSingle();

  return (data as DiscountCodeRow | null) ?? null;
}

function getBlockedDiscountMessage(discountCode: DiscountCodeRow | null | undefined, now = new Date()): string | null {
  if (!discountCode?.code) {
    return null;
  }

  if (!discountCode.is_active) {
    return 'This signup discount is no longer active.';
  }

  if (discountCode.expires_at && new Date(discountCode.expires_at) < now) {
    return 'This signup discount has expired.';
  }

  if (
    discountCode.max_uses !== null &&
    discountCode.max_uses !== undefined &&
    (discountCode.times_used ?? 0) >= discountCode.max_uses
  ) {
    return 'This signup discount has already been used.';
  }

  return null;
}

/**
 * Returns a still-usable discount code tied to either the user or the
 * newsletter subscriber record, or reports whether the stored subscriber code
 * needs repair or should be blocked from reissue.
 */
export async function inspectExistingSignupDiscount(
  supabase: Pick<SupabaseClient, 'from'>,
  options: { userId?: string | null; email?: string | null }
): Promise<ExistingSignupDiscountLookup> {
  const { userId, email } = options;
  let blockedMessage: string | null = null;

  if (userId) {
    const { data } = await supabase
      .from('discount_codes')
      .select(DISCOUNT_CODE_SELECT)
      .eq('user_id', userId);

    const userCodeRows = (data as DiscountCodeRow[] | null) ?? [];
    const reusableUserCode = userCodeRows.find((row) =>
      isDiscountCodeReusable(row)
    );

    if (reusableUserCode) {
      return { status: 'reusable', code: reusableUserCode.code };
    }

    blockedMessage = userCodeRows
      .map((row) => getBlockedDiscountMessage(row))
      .find((message): message is string => Boolean(message)) ?? null;
  }

  if (!email) {
    return blockedMessage ? { status: 'blocked', message: blockedMessage } : { status: 'none' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { data: subscriber } = await supabase
    .from('cakegenie_newsletter_subscribers')
    .select('discount_code')
    .eq('email', normalizedEmail)
    .maybeSingle();

  const subscriberCode = (subscriber as SubscriberRow | null)?.discount_code?.trim();
  if (!subscriberCode) {
    return blockedMessage ? { status: 'blocked', message: blockedMessage } : { status: 'none' };
  }

  const subscriberDiscountCode = await findCodeRecord(supabase, subscriberCode);
  if (!subscriberDiscountCode) {
    return blockedMessage ? { status: 'blocked', message: blockedMessage } : { status: 'repairable' };
  }

  if (isDiscountCodeReusable(subscriberDiscountCode)) {
    return { status: 'reusable', code: subscriberDiscountCode.code };
  }

  const subscriberBlockedMessage = getBlockedDiscountMessage(subscriberDiscountCode);
  if (subscriberBlockedMessage) {
    return { status: 'blocked', message: subscriberBlockedMessage };
  }

  return blockedMessage ? { status: 'blocked', message: blockedMessage } : { status: 'none' };
}

/**
 * Returns a still-usable discount code tied to either the user or the
 * newsletter subscriber record. Stale subscriber codes are ignored.
 */
export async function findReusableExistingDiscountCode(
  supabase: Pick<SupabaseClient, 'from'>,
  options: { userId?: string | null; email?: string | null }
): Promise<string | null> {
  const result = await inspectExistingSignupDiscount(supabase, options);
  if (result.status === 'reusable') {
    return result.code;
  }

  return null;
}

/**
 * Generates a unique code by checking for collisions against discount_codes.
 */
export async function generateUniqueSignupDiscountCode(
  supabase: Pick<SupabaseClient, 'from'>
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateSignupDiscountCode();
    const { data: collision } = await supabase
      .from('discount_codes')
      .select('code')
      .eq('code', candidate)
      .maybeSingle();

    if (!collision) {
      return candidate;
    }
  }

  return null;
}
